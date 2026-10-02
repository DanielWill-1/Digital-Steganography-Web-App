/**
 * Experiment A1 runner.
 *
 * Loaded as a plain script (no ES modules) so the experiment works from the filesystem as
 * well as over http. Publishes its API on the shared `StegoA1` namespace. Requires
 * `qr-role-map.js`, `qr-experiment.js`, and `metrics.js` to be loaded first.
 *
 * Wires the pieces together: generate every supported ECC × mask candidate, compute
 * similarity metrics against the target, rasterise each candidate, and validate it with an
 * injected decoder. No DOM access, so the identical code path runs in the browser and in
 * the Node harness.
 *
 * Decoder injection keeps jsQR out of the pure logic: in the browser the HTML passes a
 * jsQR-backed decoder; in tests an independent decoder or a stub is passed. Detection is
 * never treated as decoding — success requires an exact payload match.
 */

(function (global) {
  const StegoA1 = (global.StegoA1 = global.StegoA1 || {});

  const {
    generateAllCandidates,
    renderMatrixToImageData,
    DEFAULT_MODULE_SCALE,
    DEFAULT_QUIET_ZONE,
    compareMatrixToTarget,
  } = StegoA1;

  function best(candidates, score) {
    if (!candidates.length) return null;
    return candidates.reduce((current, candidate) =>
      score(candidate) > score(current) ? candidate : current);
  }

  /** Derive the experiment summary from candidate results. */
  function summarize(candidates, generation) {
    const decoded = candidates.filter((candidate) => candidate.jsqrPayloadCorrect === true);
    const failed = candidates.filter((candidate) => candidate.jsqrPayloadCorrect === false);

    return {
      candidatesExpected: generation.expectedCandidateCount,
      candidatesGenerated: candidates.length,
      candidatesSkipped: generation.skipped.length,
      skippedReasons: generation.skipped.map((entry) => ({
        eccLevel: entry.eccLevel,
        reason: entry.reason,
      })),
      jsqrSuccessful: decoded.length,
      jsqrFailed: failed.length,
      highestFullSimilarity: best(candidates, (c) => c.metrics.fullSimilarity),
      highestMutableSimilarity: best(candidates, (c) => c.metrics.mutableSimilarity),
      lowestQrPenalty: best(candidates, (c) => -c.penalties.total),
      lowestFixedConflicts: best(candidates, (c) => -c.metrics.fixedConflicts),
      standardMaskByEcc: generation.standardMaskByEcc,
    };
  }

  /**
   * Run the experiment: generate candidates, score them, rasterise, and (optionally)
   * decode each with an injected decoder.
   */
  async function runExperiment({
    payload,
    target,
    targetMeta = {},
    decode = null,
    moduleScale = DEFAULT_MODULE_SCALE,
    quietZone = DEFAULT_QUIET_ZONE,
    runId = null,
    timestamp = new Date().toISOString(),
    environment = {},
  }) {
    const generation = generateAllCandidates({ payload });
    const results = [];

    for (const candidate of generation.candidates) {
      const metrics = compareMatrixToTarget(candidate.matrix, candidate.roleMap, target);
      const image = renderMatrixToImageData({ matrix: candidate.matrix, moduleScale, quietZone });

      let jsqrDetected = null;
      let jsqrPayload = null;
      let jsqrPayloadCorrect = null;

      if (decode) {
        try {
          const decoded = await decode(image);
          jsqrDetected = decoded !== null && decoded !== undefined;
          jsqrPayload = decoded ?? null;
          jsqrPayloadCorrect = jsqrDetected && decoded === payload;
        } catch (error) {
          jsqrDetected = false;
          jsqrPayload = null;
          jsqrPayloadCorrect = false;
        }
      }

      results.push({
        candidateId: candidate.candidateId,
        eccLevel: candidate.eccLevel,
        mask: candidate.mask,
        standardSelectedMask: candidate.standardSelectedMask,
        filename: `A1_${candidate.eccLevel}_mask${candidate.mask}.png`,
        penalties: candidate.penalties,
        metrics,
        image,
        jsqrDetected,
        jsqrPayload,
        jsqrPayloadCorrect,
      });
    }

    return {
      runId,
      timestamp,
      payload,
      payloadUtf8Bytes: generation.payloadUtf8Bytes,
      targetMeta,
      environment,
      moduleScale,
      quietZone,
      candidates: results,
      skipped: generation.skipped,
      capacityReport: generation.capacityReport,
      expectedCandidateCount: generation.expectedCandidateCount,
      standardMaskByEcc: generation.standardMaskByEcc,
      summary: summarize(results, generation),
    };
  }

  /** Sort keys supported by the results table. */
  const SORT_KEYS = {
    fullSimilarity: (a, b) => b.metrics.fullSimilarity - a.metrics.fullSimilarity,
    mutableSimilarity: (a, b) => b.metrics.mutableSimilarity - a.metrics.mutableSimilarity,
    fixedConflicts: (a, b) => a.metrics.fixedConflicts - b.metrics.fixedConflicts,
    qrPenalty: (a, b) => a.penalties.total - b.penalties.total,
    ecc: (a, b) => a.eccLevel.localeCompare(b.eccLevel) || a.mask - b.mask,
    mask: (a, b) => a.mask - b.mask || a.eccLevel.localeCompare(b.eccLevel),
  };

  /** Return a sorted copy of the candidates. */
  function sortCandidates(candidates, key = 'fullSimilarity') {
    const comparator = SORT_KEYS[key];
    if (!comparator) throw new Error(`Unknown sort key: ${key}`);
    return candidates.slice().sort(comparator);
  }

  /**
   * Adapt a jsQR function into the runner's decoder interface. In the browser:
   *   const decode = StegoA1.jsQrDecoder(window.jsQR);
   */
  function jsQrDecoder(jsQR) {
    return (image) => {
      const result = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
      return result ? result.data : null;
    };
  }

  Object.assign(StegoA1, { runExperiment, summarize, SORT_KEYS, sortCandidates, jsQrDecoder });
})(typeof globalThis !== 'undefined' ? globalThis : this);
