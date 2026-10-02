/**
 * A4.3 browser analysis helpers.
 *
 * Aggregation for the A4 UI: operating points from an in-page run, plus merging of exported
 * generalization / robustness / physical summaries for the final tables. Loaded as a classic
 * script; publishes on `StegoA4`. No DOM access.
 */

(function (global) {
  const StegoA4 = (global.StegoA4 = global.StegoA4 || {});
  const A3 = global.StegoA3;

  function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
  function median(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  /** Operating points for a single in-page configuration (jsQR-only clean-max unless OpenCV merged). */
  function operatingPointForConfig(config) {
    const cleanMax = StegoA4.pickCleanMax(config.a3Candidates);
    return {
      configId: config.configId,
      targetId: config.targetId,
      targetName: config.targetName,
      payload: config.payload,
      eccLevel: config.eccLevel,
      a1Similarity: config.base.similarity,
      eligible: config.base.eligibleCount,
      top4Fraction: config.base.packability.topNCodewordMismatchFraction,
      a3CleanMax: cleanMax ? { budget: cleanMax.moduleBudget, cw: cleanMax.affectedCodewordCount, similarity: cleanMax.fullSimilarityAfter, filename: cleanMax.filename } : null,
    };
  }

  /** Aggregate operating points across configurations. */
  function aggregate(configs) {
    const rows = configs.map(operatingPointForConfig);
    const gains = rows.filter((r) => r.a3CleanMax).map((r) => r.a3CleanMax.similarity - r.a1Similarity);
    const byEcc = {};
    for (const ecc of ['L', 'M', 'Q', 'H']) {
      const values = rows.filter((r) => r.eccLevel === ecc && r.a3CleanMax).map((r) => r.a3CleanMax.similarity - r.a1Similarity);
      byEcc[ecc] = median(values);
    }
    return { rows, gainMean: mean(gains), gainMedian: median(gains), gainMin: gains.length ? Math.min(...gains) : null, gainMax: gains.length ? Math.max(...gains) : null, byEcc };
  }

  /** Parse a simple CSV (our exported analysis tables contain no embedded commas). */
  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    const header = lines[0].split(',');
    return lines.slice(1).map((line) => {
      const cells = line.split(',');
      const row = {};
      header.forEach((name, i) => { row[name] = cells[i] !== undefined ? cells[i] : ''; });
      return row;
    });
  }

  Object.assign(StegoA4, { mean, median, operatingPointForConfig, aggregate, parseCsv });
})(typeof globalThis !== 'undefined' ? globalThis : this);
