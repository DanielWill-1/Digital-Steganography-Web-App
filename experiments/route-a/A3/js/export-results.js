/**
 * A3 exports: manifest.json, clean_results.csv, strategy_comparison.csv,
 * codeword_budget_results.csv, robustness_results.csv, robustness_summary.csv, and the
 * synthetic test manifest.
 *
 * Loaded as a plain script (no ES modules). Publishes on `StegoA3`; reuses A1's CSV escaping.
 */

(function (global) {
  const StegoA3 = (global.StegoA3 = global.StegoA3 || {});

  const EXPERIMENT_ID = 'A3';
  const EXPERIMENT_NAME = 'Codeword-Aware Logo Optimization + Synthetic Robustness';
  const RESEARCH_QUESTION = 'Can the same or greater target-logo similarity as A2 be obtained while preserving better decoding reliability by concentrating target-directed changes into fewer QR codewords, and does any advantage survive controlled synthetic degradation?';

  function round4(value) { return Math.round(value * 10000) / 10000; }
  function round6(value) { return Math.round(value * 1000000) / 1000000; }
  function cell(value) { return global.StegoA1.csvCell(value); }
  function csvLines(columns, rows) {
    const lines = [columns.join(',')];
    for (const row of rows) lines.push(row.map(cell).join(','));
    return lines.join('\r\n') + '\r\n';
  }

  function buildManifest({ run, targetName, repositoryCommit = null, transformManifest = null, notes = '' }) {
    return {
      experiment: EXPERIMENT_ID,
      route: 'A',
      experiment_name: EXPERIMENT_NAME,
      experiment_id: EXPERIMENT_ID,
      date: run.timestamp.slice(0, 10),
      timestamp: run.timestamp,
      run_id: run.runId,
      repository_commit: repositoryCommit,
      research_question: RESEARCH_QUESTION,
      payload: run.payload,
      payload_utf8_bytes: run.payloadUtf8Bytes,
      target: { filename: targetName, normalization: run.targetMeta },
      base_selection_mode: run.baseSelectionMode,
      bases: run.bases.map((base) => ({
        candidate_id: base.candidateId,
        ecc: base.eccLevel,
        mask: base.mask,
        full_similarity: round4(base.fullSimilarity),
        eligible_count: base.eligibleCount,
        budgets: base.budgets,
      })),
      seeds: run.seeds,
      budgets: run.budgets,
      environment: run.environment,
      success_definition: 'decoded payload === expected payload',
      render: {
        module_scale: run.moduleScale,
        quiet_zone_modules: run.quietZone,
        color: 'black/white only, lossless PNG',
      },
      notes,
      transform_manifest: transformManifest,
    };
  }

  const CLEAN_COLUMNS = [
    'run_id', 'candidate_id', 'strategy', 'target_name', 'payload', 'base_ecc', 'base_mask', 'seed',
    'module_budget', 'actual_modified_modules',
    'full_similarity_before', 'full_similarity_after', 'full_similarity_gain', 'mutable_similarity_after',
    'affected_codeword_count', 'affected_codeword_indices', 'packing_efficiency', 'max_flips_in_single_codeword',
    'mean_flips_per_affected_codeword', 'affected_data_codewords', 'affected_ecc_codewords',
    'penalty_rule_1', 'penalty_rule_2', 'penalty_rule_3', 'penalty_rule_4', 'penalty_total',
    'jsqr_decode_status', 'opencv_decode_status', 'candidate_filename',
  ];

  function buildCleanCsv({ run, targetName }) {
    const rows = run.cleanResults.map((c) => [
      run.runId, c.candidateId, c.strategy, targetName, run.payload, c.baseEcc, c.baseMask, c.seed,
      c.moduleBudget, c.actualModifiedModules,
      round4(c.fullSimilarityBefore), round4(c.fullSimilarityAfter), round4(c.fullSimilarityGain), round4(c.mutableSimilarityAfter),
      c.affectedCodewordCount, c.affectedCodewordIndices.join(';'), round6(c.packingEfficiency), c.maxFlipsInSingleCodeword,
      round6(c.meanFlipsPerAffectedCodeword), c.affectedDataCodewords, c.affectedEccCodewords,
      c.penaltyRule1, c.penaltyRule2, c.penaltyRule3, c.penaltyRule4, c.penaltyTotal,
      c.jsqrDecodeStatus, c.opencvDecodeStatus, c.filename,
    ]);
    return csvLines(CLEAN_COLUMNS, rows);
  }

  const STRATEGY_COLUMNS = [
    'base_ecc', 'base_mask', 'module_budget', 'actual_modified_modules', 'similarity',
    'a2_trial_count', 'a2_exact_count', 'a2_exact_rate',
    'a2_affected_codewords_mean', 'a2_affected_codewords_min', 'a2_affected_codewords_max',
    'a3_affected_codewords', 'a3_packing_efficiency', 'a3_jsqr_exact', 'a3_opencv_exact',
    'affected_codeword_reduction_vs_a2_mean',
  ];

  function buildStrategyComparisonCsv(rows) {
    return csvLines(STRATEGY_COLUMNS, rows.map((r) => [
      r.baseEcc, r.baseMask, r.moduleBudget, r.actualModifiedModules, round4(r.similarity),
      r.a2TrialCount, r.a2ExactCount, round4(r.a2ExactRate),
      round4(r.a2AffectedCodewordsMean),
      r.a2AffectedCodewordsMin === null ? '' : r.a2AffectedCodewordsMin,
      r.a2AffectedCodewordsMax === null ? '' : r.a2AffectedCodewordsMax,
      r.a3AffectedCodewords, round6(r.a3PackingEfficiency), r.a3JsqrExact, r.a3OpencvExact,
      r.affectedCodewordReductionVsA2Mean === null ? '' : round4(r.affectedCodewordReductionVsA2Mean),
    ]));
  }

  const CODEWORD_BUDGET_COLUMNS = [
    'base_ecc', 'base_mask', 'codeword_budget', 'actual_modified_modules', 'affected_codeword_count',
    'full_similarity_after', 'full_similarity_gain', 'packing_efficiency',
    'jsqr_decode_status', 'candidate_filename',
  ];

  function buildCodewordBudgetCsv(results) {
    return csvLines(CODEWORD_BUDGET_COLUMNS, results.map((c) => [
      c.baseEcc, c.baseMask, c.codewordBudget, c.actualModifiedModules, c.affectedCodewordCount,
      round4(c.fullSimilarityAfter), round4(c.fullSimilarityGain), round6(c.packingEfficiency),
      c.jsqrDecodeStatus, c.filename,
    ]));
  }

  const ROBUSTNESS_COLUMNS = [
    'candidate_id', 'strategy', 'base_ecc', 'base_mask', 'module_budget', 'affected_codeword_count', 'similarity',
    'transform_family', 'transform_id', 'transform_parameters',
    'jsqr_detected', 'jsqr_payload', 'jsqr_payload_correct', 'jsqr_decode_status',
    'opencv_detected', 'opencv_payload', 'opencv_payload_correct', 'opencv_decode_status',
  ];

  function buildRobustnessResultsCsv(cases) {
    return csvLines(ROBUSTNESS_COLUMNS, cases.map((c) => [
      c.candidateId, c.strategy, c.baseEcc, c.baseMask, c.moduleBudget, c.affectedCodewordCount, round4(c.similarity),
      c.transformFamily, c.transformId, c.transformParameters,
      c.jsqrDetected, c.jsqrPayload, c.jsqrPayloadCorrect, c.jsqrDecodeStatus,
      c.opencvDetected, c.opencvPayload, c.opencvPayloadCorrect, c.opencvDecodeStatus,
    ]));
  }

  const ROBUSTNESS_SUMMARY_COLUMNS = [
    'candidate_id', 'strategy', 'module_budget', 'similarity', 'affected_codewords', 'transform_case_count',
    'jsqr_exact_count', 'jsqr_exact_rate', 'opencv_exact_count', 'opencv_exact_rate',
    'both_exact_count', 'both_exact_rate',
    'resize_exact_rate', 'blur_exact_rate', 'jpeg_exact_rate', 'rotation_exact_rate', 'perspective_exact_rate',
  ];

  function buildRobustnessSummaryCsv(rows) {
    const rate = (v) => (v === null ? '' : round4(v));
    return csvLines(ROBUSTNESS_SUMMARY_COLUMNS, rows.map((r) => [
      r.candidateId, r.strategy, r.moduleBudget, round4(r.similarity), r.affectedCodewords, r.transformCaseCount,
      r.jsqrExactCount, round4(r.jsqrExactRate), r.opencvExactCount, round4(r.opencvExactRate),
      r.bothExactCount, round4(r.bothExactRate),
      rate(r.resizeExactRate), rate(r.blurExactRate), rate(r.jpegExactRate), rate(r.rotationExactRate), rate(r.perspectiveExactRate),
    ]));
  }

  Object.assign(StegoA3, {
    EXPERIMENT_ID,
    EXPERIMENT_NAME,
    RESEARCH_QUESTION,
    CLEAN_COLUMNS,
    STRATEGY_COLUMNS,
    CODEWORD_BUDGET_COLUMNS,
    ROBUSTNESS_COLUMNS,
    ROBUSTNESS_SUMMARY_COLUMNS,
    buildManifest,
    buildCleanCsv,
    buildStrategyComparisonCsv,
    buildCodewordBudgetCsv,
    buildRobustnessResultsCsv,
    buildRobustnessSummaryCsv,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
