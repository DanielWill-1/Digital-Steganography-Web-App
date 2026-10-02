/**
 * A2 result export: manifest.json (full trial records), results.csv (one row per trial),
 * and budget_summary.csv (per-budget aggregate).
 *
 * Loaded as a plain script (no ES modules). Publishes on the shared `StegoA2` namespace.
 * Pure builders, so the Node harness writes the same artefacts the browser does. Reuses
 * A1's CSV cell escaping.
 */

(function (global) {
  const StegoA2 = (global.StegoA2 = global.StegoA2 || {});

  const EXPERIMENT_ID = 'A2';
  const EXPERIMENT_NAME = 'Controlled Target-Directed QR Modification';
  const RESEARCH_QUESTION = 'How much can selected non-function modules of a valid Version 1 QR symbol be changed toward a target logo before reliable decoding begins to fail?';

  function round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  function round6(value) {
    return Math.round(value * 1000000) / 1000000;
  }

  const METRIC_DEFINITIONS = {
    full_similarity: 'target matches over all 441 modules',
    mutable_similarity: 'target matches over the 208 DATA+ECC modules',
    similarity_gain: 'full similarity after minus before; equals actual_modified_modules / 441',
    fixed_conflicts: 'immutable modules disagreeing with the target (unchanged by A2)',
    theoretical_ceiling: 'structural upper bound given immutable structure',
    affected_codeword_count: 'distinct 8-bit codewords touched by the modifications',
  };

  /** Build the manifest describing the configuration actually used. */
  function buildManifest({ run, targetName, repositoryCommit = null, notes = '' }) {
    const trials = run.trials.map((trial) => ({
      base_candidate_id: trial.baseCandidateId,
      base_ecc: trial.baseEcc,
      base_mask: trial.baseMask,
      seed: trial.seed,
      budget: trial.budget,
      requested_budget: trial.requestedBudget,
      actual_modified_modules: trial.actualModifiedModules,
      eligible_mismatches_total: trial.eligibleMismatchesTotal,
      modified_fraction_of_eligible: round6(trial.modifiedFractionOfEligible),
      full_similarity_before: round4(trial.fullSimilarityBefore),
      full_similarity_after: round4(trial.fullSimilarityAfter),
      full_similarity_gain: round4(trial.fullSimilarityGain),
      mutable_similarity_before: round4(trial.mutableSimilarityBefore),
      mutable_similarity_after: round4(trial.mutableSimilarityAfter),
      mutable_similarity_gain: round4(trial.mutableSimilarityGain),
      fixed_conflicts: trial.fixedConflicts,
      theoretical_ceiling: round4(trial.theoreticalCeiling),
      affected_codeword_count: trial.affectedCodewordCount,
      affected_codeword_indices: trial.affectedCodewordIndices,
      affected_data_codeword_count: trial.affectedDataCodewordCount,
      affected_ecc_codeword_count: trial.affectedEccCodewordCount,
      max_flips_in_single_codeword: trial.maxFlipsInSingleCodeword,
      modified_penalty_rule_1: trial.modifiedPenaltyRule1,
      modified_penalty_rule_2: trial.modifiedPenaltyRule2,
      modified_penalty_rule_3: trial.modifiedPenaltyRule3,
      modified_penalty_rule_4: trial.modifiedPenaltyRule4,
      modified_penalty_total: trial.modifiedPenaltyTotal,
      jsqr_detected: trial.jsqrDetected,
      jsqr_payload: trial.jsqrPayload,
      jsqr_payload_correct: trial.jsqrPayloadCorrect,
      decode_status: trial.decodeStatus,
      candidate_filename: trial.filename,
    }));

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
      base_ecc: run.bases[0] ? run.bases[0].eccLevel : null,
      base_mask: run.bases[0] ? run.bases[0].mask : null,
      base_full_similarity: run.bases[0] ? round4(run.bases[0].fullSimilarity) : null,
      bases: run.bases.map((base) => ({
        candidate_id: base.candidateId,
        ecc: base.eccLevel,
        mask: base.mask,
        full_similarity: round4(base.fullSimilarity),
        eligible_count: base.eligibleCount,
        budgets: base.budgets,
      })),
      eligibility: {
        mutable_roles: ['DATA', 'ECC', 'REMAINDER'],
        immutable_roles: ['FINDER', 'SEPARATOR', 'TIMING', 'FORMAT', 'DARK_MODULE'],
        eligible_mismatches_total: run.summary.eligibleMismatchesTotal,
      },
      seeds: run.seeds,
      budgets: run.budgets,
      environment: run.environment,
      metrics: METRIC_DEFINITIONS,
      success_definition: 'decoded payload === expected payload',
      render: {
        module_scale: run.moduleScale,
        quiet_zone_modules: run.quietZone,
        color: 'black/white only, lossless PNG',
      },
      failure_observations: run.failures,
      trials,
      notes,
    };
  }

  const RESULTS_COLUMNS = [
    'run_id', 'timestamp', 'target_name', 'payload', 'payload_utf8_bytes',
    'base_ecc', 'base_mask', 'base_candidate_id', 'seed', 'budget', 'requested_budget',
    'actual_modified_modules', 'eligible_mismatches_total', 'modified_fraction_of_eligible',
    'full_similarity_before', 'full_similarity_after', 'full_similarity_gain',
    'mutable_similarity_before', 'mutable_similarity_after', 'mutable_similarity_gain',
    'fixed_conflicts', 'theoretical_ceiling',
    'affected_codeword_count', 'max_flips_in_single_codeword',
    'modified_penalty_rule_1', 'modified_penalty_rule_2', 'modified_penalty_rule_3',
    'modified_penalty_rule_4', 'modified_penalty_total',
    'jsqr_detected', 'jsqr_payload', 'jsqr_payload_correct', 'decode_status',
    'candidate_filename',
  ];

  function buildResultsCsv({ run, targetName }) {
    const cell = global.StegoA1.csvCell;
    const lines = [RESULTS_COLUMNS.join(',')];
    for (const trial of run.trials) {
      const row = [
        run.runId, run.timestamp, targetName, run.payload, run.payloadUtf8Bytes,
        trial.baseEcc, trial.baseMask, trial.baseCandidateId, trial.seed, trial.budget, trial.requestedBudget,
        trial.actualModifiedModules, trial.eligibleMismatchesTotal, round6(trial.modifiedFractionOfEligible),
        round4(trial.fullSimilarityBefore), round4(trial.fullSimilarityAfter), round4(trial.fullSimilarityGain),
        round4(trial.mutableSimilarityBefore), round4(trial.mutableSimilarityAfter), round4(trial.mutableSimilarityGain),
        trial.fixedConflicts, round4(trial.theoreticalCeiling),
        trial.affectedCodewordCount === null ? '' : trial.affectedCodewordCount,
        trial.maxFlipsInSingleCodeword === null ? '' : trial.maxFlipsInSingleCodeword,
        trial.modifiedPenaltyRule1, trial.modifiedPenaltyRule2, trial.modifiedPenaltyRule3,
        trial.modifiedPenaltyRule4, trial.modifiedPenaltyTotal,
        trial.jsqrDetected === null ? '' : String(trial.jsqrDetected),
        trial.jsqrPayload,
        trial.jsqrPayloadCorrect === null ? '' : String(trial.jsqrPayloadCorrect),
        trial.decodeStatus === null ? '' : trial.decodeStatus,
        trial.filename,
      ];
      lines.push(row.map(cell).join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  const BUDGET_SUMMARY_COLUMNS = [
    'budget', 'actual_modified_modules', 'trial_count',
    'exact_decode_count', 'wrong_payload_count', 'no_detection_count', 'decoder_error_count',
    'exact_decode_rate',
    'similarity_after_mean', 'similarity_after_min', 'similarity_after_max',
    'affected_codewords_mean', 'affected_codewords_min', 'affected_codewords_max',
  ];

  function buildBudgetSummaryCsv(run) {
    const cell = global.StegoA1.csvCell;
    const lines = [BUDGET_SUMMARY_COLUMNS.join(',')];
    for (const row of run.budgetSummary) {
      lines.push([
        row.budget,
        row.actualModifiedModules,
        row.trialCount,
        row.exactDecodeCount,
        row.wrongPayloadCount,
        row.noDetectionCount,
        row.decoderErrorCount,
        round4(row.exactDecodeRate),
        round4(row.similarityAfterMean),
        round4(row.similarityAfterMin),
        round4(row.similarityAfterMax),
        row.affectedCodewordsMean === null ? '' : Math.round(row.affectedCodewordsMean),
        row.affectedCodewordsMin === null ? '' : row.affectedCodewordsMin,
        row.affectedCodewordsMax === null ? '' : row.affectedCodewordsMax,
      ].map(cell).join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  Object.assign(StegoA2, {
    EXPERIMENT_ID,
    EXPERIMENT_NAME,
    RESEARCH_QUESTION,
    RESULTS_COLUMNS,
    BUDGET_SUMMARY_COLUMNS,
    buildManifest,
    buildResultsCsv,
    buildBudgetSummaryCsv,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
