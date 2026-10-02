/**
 * A4.1 operating points and target descriptors.
 *
 * Loaded as a classic script; publishes on `StegoA4`. Relies on StegoA1/StegoA2/StegoA3.
 *
 * Operating points (all per target/payload/ECC configuration):
 *   A1_BASE       the highest-A1-similarity mask at that ECC
 *   A3_CLEAN_MAX  highest tested A3 similarity whose pristine candidate decodes EXACTLY with
 *                 BOTH jsQR and OpenCV
 *   A3_ROBUST     highest tested A3 candidate meeting the PREDEFINED synthetic criterion:
 *                 both-exact rate >= 0.95 x the corresponding A1 baseline both-exact rate
 *   A2_MATCHED    A2 random, seeds 42-46, at the A3_ROBUST module budget
 *
 * The 0.95 factor is fixed here, before any physical data, and is not tuned afterwards.
 */

(function (global) {
  const StegoA4 = (global.StegoA4 = global.StegoA4 || {});
  const A1 = global.StegoA1;
  const A2 = global.StegoA2;
  const A3 = global.StegoA3;

  const ROBUST_RELATIVE_THRESHOLD = 0.95;

  /** Highest-A1-similarity candidate within one ECC level for a payload/target. */
  function bestA1PerEcc({ payload, target, eccLevel }) {
    const generation = A1.generateAllCandidates({ payload });
    const within = generation.candidates.filter((c) => c.eccLevel === eccLevel);
    if (!within.length) return null; // payload does not fit this level
    let best = null;
    for (const candidate of within) {
      const metrics = A1.compareMatrixToTarget(candidate.matrix, candidate.roleMap, target);
      if (!best || metrics.fullSimilarity > best.metrics.fullSimilarity) best = { candidate, metrics };
    }
    return best;
  }

  /**
   * Descriptive packability: fraction of all eligible mismatches contained in the densest
   * `topN` codewords. Higher means the target's mismatches concentrate into fewer codewords.
   */
  function packability(eligible, topN = 4) {
    const groups = A3.groupEligibleByCodeword(eligible);
    const counts = groups.map((g) => g.positions.length).sort((a, b) => b - a);
    const top = counts.slice(0, topN).reduce((sum, n) => sum + n, 0);
    return {
      eligibleCount: eligible.length,
      codewordCount: groups.length,
      densestCounts: counts.slice(0, topN),
      topNCodewordMismatchFraction: eligible.length ? top / eligible.length : 0,
    };
  }

  /** Highest-budget A3 candidate exact under both decoders (falls back to jsQR only). */
  function pickCleanMax(candidates) {
    const both = candidates.filter((c) => c.jsqrDecodeStatus === 'EXACT' && c.opencvDecodeStatus === 'EXACT');
    if (both.length) return both.reduce((a, b) => (b.moduleBudget > a.moduleBudget ? b : a));
    const jsqrOnly = candidates.filter((c) => c.jsqrDecodeStatus === 'EXACT');
    if (jsqrOnly.length) return jsqrOnly.reduce((a, b) => (b.moduleBudget > a.moduleBudget ? b : a));
    return null;
  }

  /**
   * Highest-budget A3 candidate whose synthetic both-exact rate is at least
   * `threshold x baselineRate`. Candidates must carry `bothExactRate`.
   */
  function pickRobust(candidates, baselineRate, threshold = ROBUST_RELATIVE_THRESHOLD) {
    const target = baselineRate > 0 ? threshold * baselineRate : 0;
    const qualifying = candidates.filter(
      (c) => typeof c.bothExactRate === 'number' && c.bothExactRate >= target && c.jsqrDecodeStatus === 'EXACT',
    );
    if (!qualifying.length) return null;
    return qualifying.reduce((a, b) => (b.moduleBudget > a.moduleBudget ? b : a));
  }

  Object.assign(StegoA4, {
    ROBUST_RELATIVE_THRESHOLD,
    bestA1PerEcc,
    packability,
    pickCleanMax,
    pickRobust,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
