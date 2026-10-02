/**
 * Result export for Experiment A1: a self-describing manifest.json and a tabular
 * results.csv, matching docs/EXPERIMENT_FORMAT.md and the A1 fields in the task prompt.
 *
 * Loaded as a plain script (no ES modules) so the experiment works from the filesystem as
 * well as over http. Publishes its API on the shared `StegoA1` namespace.
 *
 * The builders are pure so the Node harness can write the same artefacts the browser
 * does. Browser download helpers only touch the DOM when called.
 */

(function (global) {
  const StegoA1 = (global.StegoA1 = global.StegoA1 || {});

  const EXPERIMENT_ID = 'A1';
  const EXPERIMENT_NAME = 'Mask/ECC Visual Similarity Baseline';
  const RESEARCH_QUESTION = 'Given the same Version 1 QR payload and a target logo, how much visual similarity can be obtained using only valid QR error correction levels and mask choices, without changing any encoded module?';

  const METRIC_DEFINITIONS = {
    full_similarity: 'matches over all 441 modules',
    mutable_similarity: 'matches over the 208 DATA+ECC modules',
    fixed_conflicts: 'immutable modules whose state disagrees with the target',
    theoretical_ceiling: 'best achievable full similarity given immutable structure',
  };

  /** Round a 0–1 value to 4 decimals as a number, for stable CSV/JSON output. */
  function round4(value) {
    return Math.round(value * 10000) / 10000;
  }

  /** Build the manifest object describing the configuration actually used. */
  function buildManifest({
    runId,
    timestamp,
    payload,
    targetName,
    targetMeta,
    candidates,
    environment = {},
    repositoryCommit = null,
    moduleScale = null,
    quietZone = null,
    notes = '',
    outputFiles = ['results/results.csv'],
  }) {
    const eccLevels = [...new Set(candidates.map((candidate) => candidate.eccLevel))];
    const masks = [...new Set(candidates.map((candidate) => candidate.mask))].sort((a, b) => a - b);

    return {
      experiment: EXPERIMENT_ID,
      route: 'A',
      experiment_name: EXPERIMENT_NAME,
      experiment_id: EXPERIMENT_ID,
      date: timestamp.slice(0, 10),
      timestamp,
      run_id: runId,
      repository_commit: repositoryCommit,
      research_question: RESEARCH_QUESTION,
      qr_version: 1,
      payload,
      payload_utf8_bytes: new TextEncoder().encode(payload).length,
      ecc_levels: eccLevels,
      masks,
      target: {
        filename: targetName,
        normalization: targetMeta,
      },
      targets: [
        {
          name: targetName,
          source_file: targetMeta.source_file ?? null,
          normalized_file: targetMeta.normalized_file ?? null,
          normalization: targetMeta,
        },
      ],
      encoders: [
        { name: 'stegocode-v1-encoder', source: 'qr_app copy.html (port in A1/js/qr-experiment.js)', commit: repositoryCommit },
      ],
      decoders: environment.decoders ?? [],
      browser: environment.browser ?? null,
      environment: {
        user_agent: environment.userAgent ?? null,
        jsqr_version: environment.jsqrVersion ?? null,
        runner: environment.runner ?? null,
        node: environment.node ?? null,
      },
      random_seed: null,
      metrics: METRIC_DEFINITIONS,
      success_definition: 'decoded payload === expected payload',
      render: {
        module_scale: moduleScale,
        quiet_zone_modules: quietZone,
        color: 'black/white only, lossless PNG',
      },
      output_files: outputFiles,
      notes,
      candidates: candidates.map((candidate) => ({
        candidate_id: candidate.candidateId,
        ecc: candidate.eccLevel,
        mask: candidate.mask,
        standard_selected_mask: candidate.standardSelectedMask,
        candidate_filename: candidate.filename,
        full_similarity: round4(candidate.metrics.fullSimilarity),
        mutable_similarity: round4(candidate.metrics.mutableSimilarity),
        mutable_module_count: candidate.metrics.mutableModuleCount,
        fixed_module_count: candidate.metrics.fixedModuleCount,
        fixed_conflicts: candidate.metrics.fixedConflicts,
        fixed_conflict_ratio: round4(candidate.metrics.fixedConflictRatio),
        theoretical_ceiling: round4(candidate.metrics.theoreticalCeiling),
        ceiling_gap: round4(candidate.metrics.ceilingGap),
        qr_penalty_rule_1: candidate.penalties.rule1,
        qr_penalty_rule_2: candidate.penalties.rule2,
        qr_penalty_rule_3: candidate.penalties.rule3,
        qr_penalty_rule_4: candidate.penalties.rule4,
        qr_penalty_total: candidate.penalties.total,
        jsqr_detected: candidate.jsqrDetected,
        jsqr_payload: candidate.jsqrPayload,
        jsqr_payload_correct: candidate.jsqrPayloadCorrect,
      })),
    };
  }

  const CSV_COLUMNS = [
    'run_id',
    'timestamp',
    'target_name',
    'payload',
    'payload_utf8_bytes',
    'qr_version',
    'ecc',
    'mask',
    'full_similarity',
    'mutable_similarity',
    'mutable_module_count',
    'fixed_module_count',
    'fixed_conflicts',
    'fixed_conflict_ratio',
    'theoretical_ceiling',
    'ceiling_gap',
    'qr_penalty_1',
    'qr_penalty_2',
    'qr_penalty_3',
    'qr_penalty_4',
    'qr_penalty_total',
    'standard_selected_mask',
    'jsqr_detected',
    'jsqr_payload_correct',
    'jsqr_payload',
    'candidate_filename',
  ];

  /** RFC 4180 CSV cell escaping. */
  function csvCell(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  /** Build the results CSV text. One row per candidate. */
  function buildCsv({ runId, timestamp, targetName, payload, candidates }) {
    const rows = candidates.map((candidate) => [
      runId,
      timestamp,
      targetName,
      payload,
      new TextEncoder().encode(payload).length,
      1,
      candidate.eccLevel,
      candidate.mask,
      round4(candidate.metrics.fullSimilarity),
      round4(candidate.metrics.mutableSimilarity),
      candidate.metrics.mutableModuleCount,
      candidate.metrics.fixedModuleCount,
      candidate.metrics.fixedConflicts,
      round4(candidate.metrics.fixedConflictRatio),
      round4(candidate.metrics.theoreticalCeiling),
      round4(candidate.metrics.ceilingGap),
      candidate.penalties.rule1,
      candidate.penalties.rule2,
      candidate.penalties.rule3,
      candidate.penalties.rule4,
      candidate.penalties.total,
      candidate.standardSelectedMask === true ? 'true' : candidate.standardSelectedMask === false ? 'false' : '',
      candidate.jsqrDetected === null ? '' : String(candidate.jsqrDetected),
      candidate.jsqrPayloadCorrect === null ? '' : String(candidate.jsqrPayloadCorrect),
      candidate.jsqrPayload,
      candidate.filename,
    ]);
    const lines = [CSV_COLUMNS.join(',')];
    for (const row of rows) lines.push(row.map(csvCell).join(','));
    return lines.join('\r\n') + '\r\n';
  }

  /** Build the OpenCV-mergeable CSV skeleton (opencv columns filled elsewhere). */
  const OPENCV_MERGE_COLUMNS = [
    'candidate_filename',
    'opencv_detected',
    'opencv_payload',
    'opencv_payload_correct',
  ];

  /** Browser-only: trigger a text-file download. */
  function downloadText(filename, text, mime = 'text/plain') {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Browser-only: draw RGBA image data onto a fresh canvas. */
  function imageDataToCanvas(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d');
    context.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
    return canvas;
  }

  /** Browser-only: download a candidate as a lossless PNG. */
  function downloadImagePng(filename, image) {
    const canvas = imageDataToCanvas(image);
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    link.click();
  }

  Object.assign(StegoA1, {
    EXPERIMENT_ID,
    EXPERIMENT_NAME,
    RESEARCH_QUESTION,
    CSV_COLUMNS,
    OPENCV_MERGE_COLUMNS,
    buildManifest,
    buildCsv,
    csvCell,
    downloadText,
    imageDataToCanvas,
    downloadImagePng,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
