/**
 * A4.1 generalization runner: builds the A1 base and the A3 packed candidates for one
 * target × payload × ECC configuration.
 *
 * Loaded as a classic script; publishes on `StegoA4`. Reuses A1 (generation, metrics,
 * rasteriser), A2 (eligibility, codeword map, decode status), and A3 (packing) rather than
 * re-implementing any of them. The optimizer never calls a decoder; a decoder may be passed
 * only to validate finished candidates.
 */

(function (global) {
  const StegoA4 = (global.StegoA4 = global.StegoA4 || {});
  const A1 = global.StegoA1;
  const A2 = global.StegoA2;
  const A3 = global.StegoA3;

  function payloadSlug(payload) {
    const cleaned = payload.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return cleaned || 'empty';
  }

  function configId(targetId, payload, eccLevel) {
    return `${targetId}_${payloadSlug(payload)}_${eccLevel}`;
  }

  function decodeCandidate(image, decode, expectedPayload) {
    if (!decode) return { jsqrDecodeStatus: null, jsqrDetected: null, jsqrPayload: null };
    try {
      const decoded = decode(image);
      const detected = decoded !== null && decoded !== undefined;
      return {
        jsqrDetected: detected,
        jsqrPayload: decoded === undefined ? null : decoded,
        jsqrDecodeStatus: A2.classifyDecode({ ran: true, detected, payload: decoded, expected: expectedPayload, error: null }),
      };
    } catch (error) {
      return { jsqrDetected: false, jsqrPayload: null, jsqrDecodeStatus: A2.classifyDecode({ ran: true, detected: false, payload: null, expected: expectedPayload, error }) };
    }
  }

  /**
   * @returns {object} one configuration with its A1 base and all A3 packed candidates.
   */
  function generateConfig({
    target, targetId, targetMeta = {},
    payload, eccLevel,
    budgetSchedule = A3.A3_BUDGET_SCHEDULE,
    decode = null,
    moduleScale = A1.DEFAULT_MODULE_SCALE,
    quietZone = A1.DEFAULT_QUIET_ZONE,
  }) {
    const best = StegoA4.bestA1PerEcc({ payload, target, eccLevel });
    if (!best) return null;

    const base = best.candidate;
    const roleMap = base.roleMap;
    const before = best.metrics;
    const slope = payloadSlug(payload);
    const id = configId(targetId, payload, eccLevel);
    const codewordInfo = A2.codewordMapFor(eccLevel);
    const eligible = A2.buildEligiblePositions(base.matrix, roleMap, target, codewordInfo);
    const budgets = A2.budgetsFor(eligible.length, budgetSchedule);
    const pack = StegoA4.packability(eligible);

    const baseImage = A1.renderMatrixToImageData({ matrix: base.matrix, moduleScale, quietZone });
    const baseDecode = decodeCandidate(baseImage, decode, payload);

    const a3Candidates = [];
    for (const budget of budgets) {
      const { matrix, changed } = A3.packForModuleBudget({ baseMatrix: base.matrix, target, eligible, budget });
      const metrics = A1.compareMatrixToTarget(matrix, roleMap, target);
      const damage = A3.codewordDamage(changed);
      const image = A1.renderMatrixToImageData({ matrix, moduleScale, quietZone });
      const status = decodeCandidate(image, decode, payload);
      a3Candidates.push({
        candidateId: `${id}_packed_b${budget}`,
        strategy: 'A3_PACKED',
        targetId, targetName: targetMeta.name || targetId,
        payload, eccLevel, mask: base.mask,
        moduleBudget: budget,
        actualModifiedModules: changed.length,
        eligibleMismatchesTotal: eligible.length,
        affectedCodewordCount: damage.affectedCodewordCount,
        affectedCodewordIndices: damage.affectedCodewordIndices,
        maxFlipsInSingleCodeword: damage.maxFlipsInSingleCodeword,
        packingEfficiency: damage.packingEfficiency,
        fullSimilarityBefore: before.fullSimilarity,
        fullSimilarityAfter: metrics.fullSimilarity,
        fullSimilarityGain: metrics.fullSimilarity - before.fullSimilarity,
        penaltyTotal: A1.qrPenaltyBreakdown(matrix).total,
        jsqrDecodeStatus: status.jsqrDecodeStatus,
        opencvDecodeStatus: null,
        filename: `A4_${id}_packed_b${budget}.png`,
        matrix, changedPositions: changed, image,
      });
    }

    return {
      configId: id,
      targetId,
      targetName: targetMeta.name || targetId,
      targetCategory: targetMeta.category || null,
      payload,
      payloadBytes: A1.utf8ByteLength(payload),
      eccLevel,
      base: {
        candidateId: base.candidateId,
        mask: base.mask,
        similarity: before.fullSimilarity,
        mutableSimilarity: before.mutableSimilarity,
        fixedConflicts: before.fixedConflicts,
        theoreticalCeiling: before.theoreticalCeiling,
        eligibleCount: eligible.length,
        packability: pack,
        jsqrDecodeStatus: baseDecode.jsqrDecodeStatus,
        filename: `A4_${id}_base.png`,
        matrix: base.matrix,
        image: baseImage,
      },
      budgets,
      a3Candidates,
    };
  }

  /** Enumerate configuration descriptors across targets × payloads × ECC levels. */
  function allConfigurations(targets, payloads, eccLevels) {
    const list = [];
    for (const target of targets) {
      for (const payload of payloads) {
        for (const eccLevel of eccLevels) {
          list.push({ target, targetId: target.id, targetMeta: target, payload, eccLevel });
        }
      }
    }
    return list;
  }

  Object.assign(StegoA4, { payloadSlug, configId, generateConfig, allConfigurations });
})(typeof globalThis !== 'undefined' ? globalThis : this);
