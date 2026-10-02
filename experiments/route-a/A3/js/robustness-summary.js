/**
 * A3 synthetic-robustness aggregation.
 *
 * Loaded as a plain script (no ES modules). Publishes on `StegoA3`.
 *
 * Input is a flat list of cases (candidate × transform), each with jsQR and OpenCV decode
 * statuses. Family rates are defined as the fraction of that family's cases decoded exactly
 * by BOTH decoders. Every rate is reported with its raw counts and denominator — a single
 * "robustness score" never replaces the per-family numbers.
 */

(function (global) {
  const StegoA3 = (global.StegoA3 = global.StegoA3 || {});

  const FAMILIES = ['resize', 'blur', 'jpeg', 'rotation', 'perspective'];

  function summarizeRobustness(cases) {
    const byCandidate = new Map();
    for (const item of cases) {
      if (!byCandidate.has(item.candidateId)) byCandidate.set(item.candidateId, []);
      byCandidate.get(item.candidateId).push(item);
    }

    const rows = [];
    for (const [candidateId, group] of byCandidate) {
      const total = group.length;
      const count = (predicate) => group.filter(predicate).length;
      const jsqrExact = count((c) => c.jsqrDecodeStatus === 'EXACT');
      const opencvExact = count((c) => c.opencvDecodeStatus === 'EXACT');
      const bothExact = count((c) => c.jsqrDecodeStatus === 'EXACT' && c.opencvDecodeStatus === 'EXACT');
      const familyRate = (family) => {
        const familyCases = group.filter((c) => c.transformFamily === family);
        if (!familyCases.length) return null;
        const exact = familyCases.filter((c) => c.jsqrDecodeStatus === 'EXACT' && c.opencvDecodeStatus === 'EXACT').length;
        return exact / familyCases.length;
      };
      const first = group[0];
      rows.push({
        candidateId,
        strategy: first.strategy,
        moduleBudget: first.moduleBudget,
        similarity: first.similarity,
        affectedCodewords: first.affectedCodewordCount,
        transformCaseCount: total,
        jsqrExactCount: jsqrExact,
        jsqrExactRate: total ? jsqrExact / total : 0,
        opencvExactCount: opencvExact,
        opencvExactRate: total ? opencvExact / total : 0,
        bothExactCount: bothExact,
        bothExactRate: total ? bothExact / total : 0,
        resizeExactRate: familyRate('resize'),
        blurExactRate: familyRate('blur'),
        jpegExactRate: familyRate('jpeg'),
        rotationExactRate: familyRate('rotation'),
        perspectiveExactRate: familyRate('perspective'),
      });
    }
    rows.sort((a, b) => a.strategy.localeCompare(b.strategy) || a.moduleBudget - b.moduleBudget);
    return rows;
  }

  Object.assign(StegoA3, { FAMILIES, summarizeRobustness });
})(typeof globalThis !== 'undefined' ? globalThis : this);
