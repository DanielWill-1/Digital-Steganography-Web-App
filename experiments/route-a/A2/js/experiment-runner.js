/**
 * A2 experiment runner.
 *
 * Selects one or more A1 base candidates, builds the eligible-mismatch list, applies the
 * deterministic seeded budget schedule, records metrics and codeword damage for every
 * trial, and validates each modified candidate with an injected decoder.
 *
 * Loaded as a plain script (no ES modules). Publishes on the shared `StegoA2` namespace and
 * reuses `StegoA1` for QR generation, metrics, and rasterisation.
 */

(function (global) {
  const StegoA2 = (global.StegoA2 = global.StegoA2 || {});
  const A1 = global.StegoA1;

  function byFullSimilarity(a, b) {
    return b.metrics.fullSimilarity - a.metrics.fullSimilarity;
  }

  /**
   * Resolve the A1 base candidate(s) for a target and payload.
   *
   * mode 'auto'          — the single highest full-similarity candidate
   * mode 'manual'        — the candidate with the given eccLevel + mask
   * mode 'allEccWinners' — the best candidate within each ECC level (up to four bases)
   */
  function selectBases({ payload, target, mode = 'auto', eccLevel = null, mask = null }) {
    const generation = A1.generateAllCandidates({ payload });
    const annotated = generation.candidates.map((candidate) => ({
      candidate,
      metrics: A1.compareMatrixToTarget(candidate.matrix, candidate.roleMap, target),
    }));

    let selected;
    if (mode === 'manual') {
      selected = annotated.filter(
        (entry) => entry.candidate.eccLevel === eccLevel && entry.candidate.mask === mask,
      );
      if (!selected.length) {
        throw new Error(
          `No A1 candidate for ECC ${eccLevel} / mask ${mask} (payload may not fit that level).`,
        );
      }
    } else if (mode === 'allEccWinners') {
      selected = [];
      for (const level of A1.ECC_LEVELS) {
        const within = annotated.filter((entry) => entry.candidate.eccLevel === level);
        if (within.length) selected.push(within.sort(byFullSimilarity)[0]);
      }
    } else {
      selected = [annotated.slice().sort(byFullSimilarity)[0]];
    }
    return { generation, bases: selected };
  }

  /**
   * Run the full A2 experiment.
   *
   * @param {{
   *   payload: string,
   *   target: number[][],
   *   targetMeta?: object,
   *   baseSelection?: {mode: string, eccLevel?: string, mask?: number},
   *   seeds?: number[],
   *   budgetSchedule?: number[],
   *   decode?: ((image: object) => (string|null|Promise<string|null>))|null,
   *   moduleScale?: number,
   *   quietZone?: number,
   *   runId?: string,
   *   timestamp?: string,
   *   environment?: object,
   *   onProgress?: (done: number, total: number) => void
   * }} options
   */
  async function runA2Experiment({
    payload,
    target,
    targetMeta = {},
    baseSelection = { mode: 'auto' },
    seeds = StegoA2.DEFAULT_SEEDS,
    budgetSchedule = StegoA2.DEFAULT_BUDGET_SCHEDULE,
    decode = null,
    moduleScale = A1.DEFAULT_MODULE_SCALE,
    quietZone = A1.DEFAULT_QUIET_ZONE,
    runId = null,
    timestamp = new Date().toISOString(),
    environment = {},
    onProgress = null,
  }) {
    const { bases } = selectBases({
      payload,
      target,
      mode: baseSelection.mode,
      eccLevel: baseSelection.eccLevel,
      mask: baseSelection.mask,
    });

    const baseRecords = [];
    const trials = [];

    for (const entry of bases) {
      const base = entry.candidate;
      const roleMap = base.roleMap;
      const codewordInfo = StegoA2.codewordMapFor(base.eccLevel);
      const eligible = StegoA2.buildEligiblePositions(base.matrix, roleMap, target, codewordInfo);
      const budgets = StegoA2.budgetsFor(eligible.length, budgetSchedule);

      baseRecords.push({
        eccLevel: base.eccLevel,
        mask: base.mask,
        candidateId: base.candidateId,
        fullSimilarity: entry.metrics.fullSimilarity,
        mutableSimilarity: entry.metrics.mutableSimilarity,
        eligibleCount: eligible.length,
        budgets,
        baseMatrix: base.matrix.map((row) => row.slice()),
        codewordInfo: { dataCodewordCount: codewordInfo.dataCodewordCount, eccCodewordCount: codewordInfo.eccCodewordCount },
      });

      for (const seed of seeds) {
        const ordered = StegoA2.seededShuffle(eligible, seed);
        for (const budget of budgets) {
          const { matrix, changed } = StegoA2.applyBudget(base.matrix, ordered, budget, target);
          const metricsAfter = A1.compareMatrixToTarget(matrix, roleMap, target);
          const penalties = A1.qrPenaltyBreakdown(matrix);
          const impact = StegoA2.codewordImpact(changed);
          const image = A1.renderMatrixToImageData({ matrix, moduleScale, quietZone });

          let jsqrDetected = null;
          let jsqrPayload = null;
          let jsqrPayloadCorrect = null;
          let decodeStatus = null;
          if (decode) {
            try {
              const decoded = await decode(image);
              jsqrDetected = decoded !== null && decoded !== undefined;
              jsqrPayload = decoded === undefined ? null : decoded;
              jsqrPayloadCorrect = jsqrDetected && decoded === payload;
              decodeStatus = StegoA2.classifyDecode({ ran: true, detected: jsqrDetected, payload: jsqrPayload, expected: payload, error: null });
            } catch (error) {
              jsqrDetected = false;
              jsqrPayload = null;
              jsqrPayloadCorrect = false;
              decodeStatus = StegoA2.classifyDecode({ ran: true, detected: false, payload: null, expected: payload, error });
            }
          }

          trials.push({
            baseCandidateId: base.candidateId,
            baseEcc: base.eccLevel,
            baseMask: base.mask,
            seed,
            budget,
            requestedBudget: budget,
            actualModifiedModules: changed.length,
            eligibleMismatchesTotal: eligible.length,
            modifiedFractionOfEligible: eligible.length ? changed.length / eligible.length : 0,
            fullSimilarityBefore: entry.metrics.fullSimilarity,
            fullSimilarityAfter: metricsAfter.fullSimilarity,
            fullSimilarityGain: metricsAfter.fullSimilarity - entry.metrics.fullSimilarity,
            mutableSimilarityBefore: entry.metrics.mutableSimilarity,
            mutableSimilarityAfter: metricsAfter.mutableSimilarity,
            mutableSimilarityGain: metricsAfter.mutableSimilarity - entry.metrics.mutableSimilarity,
            fixedConflicts: metricsAfter.fixedConflicts,
            theoreticalCeiling: metricsAfter.theoreticalCeiling,
            affectedCodewordCount: impact.codewordsAvailable ? impact.affectedCodewordCount : null,
            affectedCodewordIndices: impact.affectedCodewordIndices,
            affectedDataCodewordCount: impact.codewordsAvailable ? impact.affectedDataCodewordCount : null,
            affectedEccCodewordCount: impact.codewordsAvailable ? impact.affectedEccCodewordCount : null,
            maxFlipsInSingleCodeword: impact.codewordsAvailable ? impact.maxFlipsInSingleCodeword : null,
            codewordsAvailable: impact.codewordsAvailable,
            modifiedPenaltyRule1: penalties.rule1,
            modifiedPenaltyRule2: penalties.rule2,
            modifiedPenaltyRule3: penalties.rule3,
            modifiedPenaltyRule4: penalties.rule4,
            modifiedPenaltyTotal: penalties.total,
            jsqrDetected,
            jsqrPayload,
            jsqrPayloadCorrect,
            decodeStatus,
            filename: `A2_${base.eccLevel}_mask${base.mask}_seed${seed}_budget${budget}.png`,
            matrix,
            changedPositions: changed,
            image,
          });
          if (onProgress) onProgress(trials.length, seeds.length * budgets.length * bases.length);
        }
      }
    }

    const budgetSet = [...new Set(trials.map((trial) => trial.budget))].sort((a, b) => a - b);
    const statusCount = (status) => trials.filter((trial) => trial.decodeStatus === status).length;

    return {
      runId,
      timestamp,
      payload,
      payloadUtf8Bytes: A1.utf8ByteLength(payload),
      targetMeta,
      environment,
      moduleScale,
      quietZone,
      baseSelectionMode: baseSelection.mode,
      bases: baseRecords,
      seeds,
      budgets: budgetSet,
      trials,
      budgetSummary: StegoA2.summarizeByBudget(trials),
      failures: StegoA2.failureObservations(trials),
      summary: {
        baseCount: baseRecords.length,
        baseFullSimilarity: baseRecords[0] ? baseRecords[0].fullSimilarity : null,
        eligibleMismatchesTotal: baseRecords[0] ? baseRecords[0].eligibleCount : 0,
        seedCount: seeds.length,
        budgetCount: baseRecords[0] ? baseRecords[0].budgets.length : 0,
        trialCount: trials.length,
        jsqrExactCount: statusCount('EXACT'),
        jsqrWrongPayloadCount: statusCount('WRONG_PAYLOAD'),
        jsqrNoDetectionCount: statusCount('NO_DETECTION'),
        jsqrDecoderErrorCount: statusCount('DECODER_ERROR'),
        decoderUnavailable: trials.every((trial) => trial.decodeStatus === null),
      },
    };
  }

  Object.assign(StegoA2, { selectBases, runA2Experiment });
})(typeof globalThis !== 'undefined' ? globalThis : this);
