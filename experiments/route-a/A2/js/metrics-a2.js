/**
 * A2 trial metrics: codeword damage accounting and careful decode-status classification.
 *
 * Loaded as a plain script (no ES modules). Publishes on the shared `StegoA2` namespace.
 *
 * Note the distinction A2 must preserve: a "changed module" is a visual position; a
 * "codeword" is a Reed–Solomon symbol covering eight placed bits. Several changed modules
 * can fall inside one codeword, so module count and codeword count are different things.
 */

(function (global) {
  const StegoA2 = (global.StegoA2 = global.StegoA2 || {});

  /**
   * Given the changed positions (from modification-strategy), describe which codewords
   * were affected.
   *
   * @returns {{
   *   affectedCodewordCount: number,
   *   affectedCodewordIndices: number[],
   *   affectedDataCodewordCount: number,
   *   affectedEccCodewordCount: number,
   *   maxFlipsInSingleCodeword: number,
   *   codewordsAvailable: boolean
   * }}
   */
  function codewordImpact(changedPositions) {
    const perCodeword = new Map();
    let dataCount = 0;
    let eccCount = 0;
    let available = changedPositions.length === 0;
    for (const position of changedPositions) {
      if (position.codewordIndex === null || position.codewordIndex === undefined) continue;
      available = true;
      perCodeword.set(position.codewordIndex, (perCodeword.get(position.codewordIndex) || 0) + 1);
      if (position.codewordType === 'DATA') dataCount++;
      else if (position.codewordType === 'ECC') eccCount++;
    }
    const indices = [...perCodeword.keys()].sort((a, b) => a - b);
    let maxFlips = 0;
    for (const count of perCodeword.values()) maxFlips = Math.max(maxFlips, count);
    // A position with no codeword metadata means the mapping was unavailable.
    const anyMetaMissing = changedPositions.some(
      (position) => position.codewordIndex === null || position.codewordIndex === undefined,
    );
    return {
      affectedCodewordCount: indices.length,
      affectedCodewordIndices: indices,
      affectedDataCodewordCount: dataCount,
      affectedEccCodewordCount: eccCount,
      maxFlipsInSingleCodeword: maxFlips,
      codewordsAvailable: available && !anyMetaMissing,
    };
  }

  /**
   * Classify a decode outcome. Detection is never enough — EXACT requires the recovered
   * payload to equal the expected payload.
   *
   * @returns {'EXACT'|'WRONG_PAYLOAD'|'NO_DETECTION'|'DECODER_ERROR'|null}  null when no
   *   decoder ran (so the absence of a result is not mistaken for a failure).
   */
  function classifyDecode({ ran, detected, payload, expected, error }) {
    if (!ran) return null;
    if (error) return 'DECODER_ERROR';
    if (detected !== true) return 'NO_DETECTION';
    return payload === expected ? 'EXACT' : 'WRONG_PAYLOAD';
  }

  Object.assign(StegoA2, { codewordImpact, classifyDecode });
})(typeof globalThis !== 'undefined' ? globalThis : this);
