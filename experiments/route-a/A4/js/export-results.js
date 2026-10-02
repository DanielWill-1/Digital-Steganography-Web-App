/**
 * A4 exports: CSVs, manifests, and the dataset manifest.
 *
 * Loaded as a classic script; publishes on `StegoA4`. Pure builders so the Node harness and
 * the browser UI emit identical artefacts. Reuses A1's CSV escaping.
 */

(function (global) {
  const StegoA4 = (global.StegoA4 = global.StegoA4 || {});

  const EXPERIMENT_ID = 'A4';
  const RESEARCH_QUESTION = 'Does the A3 codeword-aware advantage generalize across target structures, payload lengths, ECC levels, decoder environments, and (pending) screens, printers, and cameras?';

  function round4(v) { return Math.round(v * 10000) / 10000; }
  function round6(v) { return Math.round(v * 1000000) / 1000000; }
  function cell(v) { return global.StegoA1.csvCell(v); }
  function csv(columns, rows) {
    const lines = [columns.join(',')];
    for (const row of rows) lines.push(row.map(cell).join(','));
    return lines.join('\r\n') + '\r\n';
  }

  const CONFIG_COLUMNS = [
    'config_id', 'target_id', 'target_name', 'target_category', 'payload', 'payload_bytes', 'ecc',
    'base_mask', 'base_candidate_id', 'a1_similarity', 'a1_mutable_similarity', 'fixed_conflicts',
    'theoretical_ceiling', 'eligible_mismatches', 'codeword_count', 'top4_mismatch_fraction',
    'a3_candidate_count', 'base_filename',
  ];
  function buildConfigsCsv(configs) {
    return csv(CONFIG_COLUMNS, configs.map((c) => [
      c.configId, c.targetId, c.targetName, c.targetCategory, c.payload, c.payloadBytes, c.eccLevel,
      c.base.mask, c.base.candidateId, round4(c.base.similarity), round4(c.base.mutableSimilarity),
      c.base.fixedConflicts, round4(c.base.theoreticalCeiling), c.base.eligibleCount,
      c.base.packability.codewordCount, round4(c.base.packability.topNCodewordMismatchFraction),
      c.a3Candidates.length, c.base.filename,
    ]));
  }

  const CANDIDATE_COLUMNS = [
    'config_id', 'target_id', 'payload', 'payload_bytes', 'ecc', 'mask', 'strategy', 'module_budget',
    'actual_modified_modules', 'affected_codeword_count', 'max_flips_in_single_codeword', 'packing_efficiency',
    'full_similarity_before', 'full_similarity_after', 'full_similarity_gain', 'penalty_total',
    'jsqr_decode_status', 'opencv_decode_status', 'candidate_filename',
  ];
  function buildCandidatesCsv(configs) {
    const rows = [];
    for (const c of configs) {
      for (const a3 of c.a3Candidates) {
        rows.push([
          c.configId, c.targetId, c.payload, c.payloadBytes, c.eccLevel, a3.mask, a3.strategy, a3.moduleBudget,
          a3.actualModifiedModules, a3.affectedCodewordCount, a3.maxFlipsInSingleCodeword, round6(a3.packingEfficiency),
          round4(a3.fullSimilarityBefore), round4(a3.fullSimilarityAfter), round4(a3.fullSimilarityGain), a3.penaltyTotal,
          a3.jsqrDecodeStatus, a3.opencvDecodeStatus, a3.filename,
        ]);
      }
    }
    return csv(CANDIDATE_COLUMNS, rows);
  }

  const OPERATING_COLUMNS = [
    'config_id', 'target_id', 'target_name', 'target_category', 'payload', 'payload_bytes', 'ecc',
    'a1_similarity',
    'a3_clean_max_budget', 'a3_clean_max_cw', 'a3_clean_max_similarity', 'a3_clean_max_filename',
    'a3_robust_budget', 'a3_robust_cw', 'a3_robust_similarity', 'a3_robust_rate',
    'a2_matched_budget', 'a2_mean_cw', 'a2_clean_exact_rate', 'a2_robust_rate',
    'a3_clean_exact', 'a3_robust_exact',
  ];
  function buildOperatingPointsCsv(rows) {
    return csv(OPERATING_COLUMNS, rows.map((r) => [
      r.configId, r.targetId, r.targetName, r.targetCategory, r.payload, r.payloadBytes, r.eccLevel,
      round4(r.a1Similarity),
      r.a3CleanMaxBudget, r.a3CleanMaxCw, r.a3CleanMaxSimilarity === null ? '' : round4(r.a3CleanMaxSimilarity), r.a3CleanMaxFilename,
      r.a3RobustBudget, r.a3RobustCw, r.a3RobustSimilarity === null ? '' : round4(r.a3RobustSimilarity), r.a3RobustRate === null ? '' : round4(r.a3RobustRate),
      r.a2MatchedBudget, r.a2MeanCw === null ? '' : round4(r.a2MeanCw), r.a2CleanExactRate === null ? '' : round4(r.a2CleanExactRate), r.a2RobustRate === null ? '' : round4(r.a2RobustRate),
      r.a3CleanExact === null ? '' : r.a3CleanExact, r.a3RobustExact === null ? '' : r.a3RobustExact,
    ]));
  }

  function buildTargetCorpus(targets) {
    return {
      experiment: EXPERIMENT_ID,
      note: 'Canonical 21×21 synthetic benchmark targets (project-owned). Matrix is the canonical normalized form; the PNG fixture is written from the same matrix.',
      targets: targets.map((t) => ({
        target_id: t.id,
        target_name: t.name,
        target_category: t.category,
        size: t.size,
        source_file: t.sourceFile || null,
        source_sha256: t.sourceSha256 || null,
        matrix: t.matrix,
        matrix_hash: t.matrixHash,
        dark_fraction: round4(t.darkFraction),
      })),
    };
  }

  function buildManifest({ runId, timestamp, environment, targets, payloads, eccLevels, configCount, notes = '' }) {
    return {
      experiment: EXPERIMENT_ID,
      route: 'A',
      experiment_name: 'Multi-target generalization + cross-environment hardening + physical validation + final analysis',
      experiment_id: EXPERIMENT_ID,
      run_id: runId,
      timestamp,
      research_question: RESEARCH_QUESTION,
      targets: targets.map((t) => ({ target_id: t.id, target_name: t.name, target_category: t.category, matrix_hash: t.matrixHash })),
      payloads: payloads.map((p) => ({ payload: p, payload_utf8_bytes: global.StegoA1.utf8ByteLength(p) })),
      ecc_levels: eccLevels,
      configuration_count: configCount,
      robust_criterion: `A3_ROBUST = highest tested A3 candidate with synthetic both-exact rate >= ${StegoA4.ROBUST_RELATIVE_THRESHOLD} x the A1 baseline rate for the same configuration`,
      environment,
      success_definition: 'decoded payload === expected payload; physical data explicitly NOT fabricated',
      notes,
    };
  }

  function buildDatasetManifest({ timestamp, targets, payloads, eccLevels, versions, resultFiles, physicalStatus }) {
    return {
      experiment: EXPERIMENT_ID,
      version: '1.0.0',
      date: timestamp.slice(0, 10),
      target_corpus: targets.map((t) => ({ target_id: t.id, target_name: t.name, target_category: t.category, matrix_hash: t.matrixHash, source_sha256: t.sourceSha256 || null })),
      payload_corpus: payloads,
      ecc_levels: eccLevels,
      decoder_versions: versions.decoders,
      browser_versions: versions.browsers || null,
      opencv_version: versions.opencv || null,
      node_version: versions.node || null,
      python_version: versions.python || null,
      os_environment: versions.os || null,
      generalization_result_files: resultFiles.generalization,
      synthetic_result_files: resultFiles.synthetic,
      physical_result_files: resultFiles.physical,
      physical_status: physicalStatus,
    };
  }

  Object.assign(StegoA4, {
    EXPERIMENT_ID,
    CONFIG_COLUMNS,
    CANDIDATE_COLUMNS,
    OPERATING_COLUMNS,
    buildConfigsCsv,
    buildCandidatesCsv,
    buildOperatingPointsCsv,
    buildTargetCorpus,
    buildManifest,
    buildDatasetManifest,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
