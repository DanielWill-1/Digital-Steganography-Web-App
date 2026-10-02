/**
 * A3 strategy comparison: matched-budget A2 (seeded random) vs A3 (packed), plus clean
 * decode boundary observations.
 *
 * Loaded as a plain script (no ES modules). Publishes on `StegoA3`.
 *
 * At a matched module budget the two strategies modify the same NUMBER of target mismatches,
 * so their visual similarity is identical. The comparison is about codeword damage and
 * decoding, never about visual gain.
 */

(function (global) {
  const StegoA3 = (global.StegoA3 = global.StegoA3 || {});

  function mean(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /** Build one comparison row per matched module budget (across all bases). */
  function compareStrategies(a2Results, a3Results) {
    const budgets = [...new Set(a3Results.map((c) => c.moduleBudget))].sort((a, b) => a - b);
    const rows = [];
    for (const budget of budgets) {
      const a3At = a3Results.filter((c) => c.moduleBudget === budget);
      const a2At = a2Results.filter((c) => c.moduleBudget === budget);
      for (const a3 of a3At) {
        const a2Same = a2At.filter((c) => c.baseEcc === a3.baseEcc && c.baseMask === a3.baseMask);
        const a2Affected = a2Same.map((c) => c.affectedCodewordCount);
        const a2Exact = a2Same.filter((c) => c.jsqrDecodeStatus === 'EXACT').length;
        const reduction = a2Affected.length && a3.affectedCodewordCount !== null
          ? mean(a2Affected) - a3.affectedCodewordCount
          : null;
        rows.push({
          baseEcc: a3.baseEcc,
          baseMask: a3.baseMask,
          moduleBudget: budget,
          actualModifiedModules: a3.actualModifiedModules,
          similarity: a3.fullSimilarityAfter,
          a2TrialCount: a2Same.length,
          a2ExactCount: a2Exact,
          a2ExactRate: a2Same.length ? a2Exact / a2Same.length : 0,
          a2AffectedCodewordsMean: mean(a2Affected),
          a2AffectedCodewordsMin: a2Affected.length ? Math.min(...a2Affected) : null,
          a2AffectedCodewordsMax: a2Affected.length ? Math.max(...a2Affected) : null,
          a3AffectedCodewords: a3.affectedCodewordCount,
          a3PackingEfficiency: a3.packingEfficiency,
          a3JsqrExact: a3.jsqrDecodeStatus === 'EXACT',
          a3OpencvExact: a3.opencvDecodeStatus === 'EXACT',
          affectedCodewordReductionVsA2Mean: reduction,
        });
      }
    }
    return rows;
  }

  /** Largest budget meeting a predicate, and the similarity of the best such candidate. */
  function largestBudgetMeeting(candidates, predicate) {
    const qualifying = candidates.filter(predicate);
    if (!qualifying.length) return { budget: null, similarity: null, candidateId: null };
    const best = qualifying.reduce((current, candidate) =>
      (candidate.moduleBudget > current.moduleBudget ? candidate : current));
    return { budget: best.moduleBudget, similarity: best.fullSimilarityAfter, candidateId: best.candidateId };
  }

  /**
   * Clean decode boundary observations (§29): largest budget exact under each decoder and
   * under both, plus the highest observed clean-decodable similarity.
   *
   * opencvDecodeStatus is null until a validator merges OpenCV results, so those observations
   * are null until then.
   */
  function boundaryObservations(cleanResults) {
    const a3 = cleanResults.filter((c) => c.strategy === 'A3_PACKED');
    const jsqr = largestBudgetMeeting(a3, (c) => c.jsqrDecodeStatus === 'EXACT');
    const opencv = largestBudgetMeeting(a3, (c) => c.opencvDecodeStatus === 'EXACT');
    const both = largestBudgetMeeting(a3, (c) => c.jsqrDecodeStatus === 'EXACT' && c.opencvDecodeStatus === 'EXACT');
    return {
      largestJsqrExactBudget: jsqr.budget,
      largestJsqrExactSimilarity: jsqr.similarity,
      largestOpencvExactBudget: opencv.budget,
      largestOpencvExactSimilarity: opencv.similarity,
      largestBothExactBudget: both.budget,
      highestObservedCleanDecodableSimilarity: both.similarity,
      largestBothExactCandidateId: both.candidateId,
    };
  }

  Object.assign(StegoA3, { compareStrategies, boundaryObservations, largestBudgetMeeting });
})(typeof globalThis !== 'undefined' ? globalThis : this);
