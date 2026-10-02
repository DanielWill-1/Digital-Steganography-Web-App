/**
 * A3 experiment runner (clean phase).
 *
 * For each base QR it builds the eligible-mismatch list once, then generates:
 *   - the A2 style seeded-random baseline (5 seeds) at every module budget, and
 *   - the A3 packed candidate at every module budget,
 * at the SAME budgets, so the only difference between matched candidates is *where* the
 * modules were changed. It also sweeps the codeword-budget mode (all useful mismatches in
 * the K densest codewords).
 *
 * Candidates are generated without any decoder feedback; validation happens afterwards.
 *
 * Loaded as a plain script (no ES modules). Publishes on `StegoA3`. Relies on StegoA1 and
 * StegoA2 being loaded first.
 */

(function (global) {
  const StegoA3 = (global.StegoA3 = global.StegoA3 || {});
  const A1 = global.StegoA1;
  const A2 = global.StegoA2;

  /** A3 default module budgets: A2's schedule plus a dense region around the A2 transition. */
  const A3_BUDGET_SCHEDULE = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    20, 24, 32, 40, 48, 64, 80, 96, 128,
  ];

  function buildCandidate({ baseMatrix, target, roleMap, matrix, changed, strategy, base, budget, seed, label, decode, penalties, moduleScale, quietZone, expectedPayload }) {
    const metrics = A1.compareMatrixToTarget(matrix, roleMap, target);
    const before = A1.compareMatrixToTarget(baseMatrix, roleMap, target);
    const damage = StegoA3.codewordDamage(changed);
    const penalty = penalties || A1.qrPenaltyBreakdown(matrix);
    const image = A1.renderMatrixToImageData({ matrix, moduleScale, quietZone });

    let jsqrDetected = null;
    let jsqrPayload = null;
    let jsqrPayloadCorrect = null;
    let jsqrDecodeStatus = null;
    if (decode) {
      try {
        const decoded = decode(image);
        jsqrDetected = decoded !== null && decoded !== undefined;
        jsqrPayload = decoded === undefined ? null : decoded;
        jsqrPayloadCorrect = jsqrDetected && decoded === expectedPayload;
        jsqrDecodeStatus = A2.classifyDecode({ ran: true, detected: jsqrDetected, payload: jsqrPayload, expected: expectedPayload, error: null });
      } catch (error) {
        jsqrDetected = false;
        jsqrPayload = null;
        jsqrPayloadCorrect = false;
        jsqrDecodeStatus = A2.classifyDecode({ ran: true, detected: false, payload: null, expected: expectedPayload, error });
      }
    }

    return {
      candidateId: label,
      strategy,
      seed,
      baseEcc: base.eccLevel,
      baseMask: base.mask,
      baseCandidateId: base.candidateId,
      moduleBudget: budget,
      actualModifiedModules: changed.length,
      eligibleMismatchesTotal: null,
      fullSimilarityBefore: before.fullSimilarity,
      fullSimilarityAfter: metrics.fullSimilarity,
      fullSimilarityGain: metrics.fullSimilarity - before.fullSimilarity,
      mutableSimilarityAfter: metrics.mutableSimilarity,
      affectedCodewordCount: damage.affectedCodewordCount,
      affectedCodewordIndices: damage.affectedCodewordIndices,
      flipsPerCodeword: damage.flipsPerCodeword,
      maxFlipsInSingleCodeword: damage.maxFlipsInSingleCodeword,
      meanFlipsPerAffectedCodeword: damage.meanFlipsPerAffectedCodeword,
      affectedDataCodewords: damage.affectedDataCodewords,
      affectedEccCodewords: damage.affectedEccCodewords,
      packingEfficiency: damage.packingEfficiency,
      penaltyRule1: penalty.rule1,
      penaltyRule2: penalty.rule2,
      penaltyRule3: penalty.rule3,
      penaltyRule4: penalty.rule4,
      penaltyTotal: penalty.total,
      jsqrDecodeStatus,
      opencvDecodeStatus: null,
      filename: label + '.png',
      matrix,
      changedPositions: changed,
      image,
    };
  }

  /**
   * @param {{
   *   payload: string, target: number[][], targetMeta?: object,
   *   baseSelection?: {mode:string, eccLevel?:string, mask?:number},
   *   seeds?: number[], budgetSchedule?: number[],
   *   decode?: ((image:object)=>string|null)|null,
   *   moduleScale?: number, quietZone?: number,
   *   runId?: string, timestamp?: string, environment?: object,
   *   onProgress?: (done:number,total:number)=>void
   * }} options
   */
  function runA3Clean({
    payload,
    target,
    targetMeta = {},
    baseSelection = { mode: 'auto' },
    seeds = A2.DEFAULT_SEEDS,
    budgetSchedule = A3_BUDGET_SCHEDULE,
    decode = null,
    moduleScale = A1.DEFAULT_MODULE_SCALE,
    quietZone = A1.DEFAULT_QUIET_ZONE,
    runId = null,
    timestamp = new Date().toISOString(),
    environment = {},
    onProgress = null,
  }) {
    const { bases } = A2.selectBases({
      payload,
      target,
      mode: baseSelection.mode,
      eccLevel: baseSelection.eccLevel,
      mask: baseSelection.mask,
    });

    const baseRecords = [];
    const a2Results = [];
    const a3Results = [];
    const codewordBudgetResults = [];

    let total = 0;
    for (const entry of bases) total += 1;
    let done = 0;
    const tick = () => { done++; if (onProgress) onProgress(done, total); };

    for (const entry of bases) {
      const base = entry.candidate;
      const roleMap = base.roleMap;
      const codewordInfo = A2.codewordMapFor(base.eccLevel);
      const eligible = A2.buildEligiblePositions(base.matrix, roleMap, target, codewordInfo);
      const budgets = A2.budgetsFor(eligible.length, budgetSchedule);
      const before = A1.compareMatrixToTarget(base.matrix, roleMap, target);

      baseRecords.push({
        eccLevel: base.eccLevel,
        mask: base.mask,
        candidateId: base.candidateId,
        fullSimilarity: before.fullSimilarity,
        eligibleCount: eligible.length,
        budgets,
        baseMatrix: base.matrix.map((row) => row.slice()),
      });

      // --- A2 seeded random baseline, all seeds, all budgets (reuses A2 exactly) ---
      for (const seed of seeds) {
        const ordered = A2.seededShuffle(eligible, seed);
        for (const budget of budgets) {
          const { matrix, changed } = A2.applyBudget(base.matrix, ordered, budget, target);
          a2Results.push(buildCandidate({
            baseMatrix: base.matrix, target, roleMap, matrix, changed,
            strategy: 'A2_RANDOM', base, budget, seed,
            label: `A2clean_${base.eccLevel}_mask${base.mask}_seed${seed}_b${budget}`,
            decode, moduleScale, quietZone, expectedPayload: payload,
          }));
        }
      }

      // --- A3 packed module-budget candidates ---
      for (const budget of budgets) {
        const { matrix, changed } = StegoA3.packForModuleBudget({ baseMatrix: base.matrix, target, eligible, budget });
        a3Results.push(buildCandidate({
          baseMatrix: base.matrix, target, roleMap, matrix, changed,
          strategy: 'A3_PACKED', base, budget, seed: null,
          label: `A3clean_${base.eccLevel}_mask${base.mask}_packed_b${budget}`,
          decode, moduleScale, quietZone, expectedPayload: payload,
        }));
      }

      // --- A3 codeword-budget mode (all useful mismatches in the K densest codewords) ---
      const maxK = StegoA3.maxCodewordBudget(eligible);
      for (let k = 0; k <= maxK; k++) {
        const { matrix, changed } = StegoA3.applyCodewordBudget({ baseMatrix: base.matrix, target, eligible, codewordBudget: k });
        const candidate = buildCandidate({
          baseMatrix: base.matrix, target, roleMap, matrix, changed,
          strategy: 'A3_CODEWORD_BUDGET', base, budget: changed.length, seed: null,
          label: `A3cw_${base.eccLevel}_mask${base.mask}_K${k}`,
          decode, moduleScale, quietZone, expectedPayload: payload,
        });
        candidate.codewordBudget = k;
        codewordBudgetResults.push(candidate);
      }

      tick();
    }

    const cleanResults = a2Results.concat(a3Results);
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
      budgets: [...new Set(cleanResults.map((c) => c.moduleBudget))].sort((a, b) => a - b),
      budgetSchedule,
      a2Results,
      a3Results,
      cleanResults,
      codewordBudgetResults,
      summary: summarize(cleanResults, a2Results, a3Results, baseRecords),
    };
  }

  function statusCount(list, status) {
    return list.filter((candidate) => candidate.jsqrDecodeStatus === status).length;
  }

  function summarize(cleanResults, a2Results, a3Results, baseRecords) {
    const exact = cleanResults.filter((c) => c.jsqrDecodeStatus === 'EXACT');
    return {
      baseCount: baseRecords.length,
      baseFullSimilarity: baseRecords[0] ? baseRecords[0].fullSimilarity : null,
      eligibleMismatchesTotal: baseRecords[0] ? baseRecords[0].eligibleCount : 0,
      seedCount: null,
      cleanCandidateCount: cleanResults.length,
      a2CandidateCount: a2Results.length,
      a3CandidateCount: a3Results.length,
      jsqrExactCount: exact.length,
      jsqrWrongPayloadCount: statusCount(cleanResults, 'WRONG_PAYLOAD'),
      jsqrNoDetectionCount: statusCount(cleanResults, 'NO_DETECTION'),
      jsqrDecoderErrorCount: statusCount(cleanResults, 'DECODER_ERROR'),
      decoderUnavailable: cleanResults.every((c) => c.jsqrDecodeStatus === null),
    };
  }

  Object.assign(StegoA3, { A3_BUDGET_SCHEDULE, runA3Clean });
})(typeof globalThis !== 'undefined' ? globalThis : this);
