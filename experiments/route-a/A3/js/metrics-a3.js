/**
 * A3 codeword-damage metrics.
 *
 * Loaded as a plain script (no ES modules). Publishes on `StegoA3`.
 *
 * A changed *module* and a changed *codeword symbol* are different things: one codeword
 * holds eight placed bits, so several changed modules can fall inside one codeword.
 * `packing_efficiency = modified_modules / affected_codeword_count` summarises how
 * concentrated the damage is. It is a structural explanatory metric — NOT a decode
 * probability.
 */

(function (global) {
  const StegoA3 = (global.StegoA3 = global.StegoA3 || {});

  /**
   * @param {object[]} changedPositions  positions with codewordIndex / codewordType
   */
  function codewordDamage(changedPositions) {
    const flipsPerCodeword = {};
    let affectedDataCodewords = 0;
    let affectedEccCodewords = 0;
    let maxFlips = 0;
    const indices = [];

    for (const position of changedPositions) {
      if (position.codewordIndex === null || position.codewordIndex === undefined) continue;
      if (!(position.codewordIndex in flipsPerCodeword)) {
        flipsPerCodeword[position.codewordIndex] = 0;
        indices.push(position.codewordIndex);
        if (position.codewordType === 'DATA') affectedDataCodewords++;
        else if (position.codewordType === 'ECC') affectedEccCodewords++;
      }
      flipsPerCodeword[position.codewordIndex]++;
    }
    indices.sort((a, b) => a - b);
    let totalFlips = 0;
    for (const index of indices) {
      totalFlips += flipsPerCodeword[index];
      maxFlips = Math.max(maxFlips, flipsPerCodeword[index]);
    }
    const affectedCodewordCount = indices.length;
    return {
      affectedCodewordCount,
      affectedCodewordIndices: indices,
      flipsPerCodeword,
      maxFlipsInSingleCodeword: maxFlips,
      meanFlipsPerAffectedCodeword: affectedCodewordCount ? totalFlips / affectedCodewordCount : 0,
      affectedDataCodewords,
      affectedEccCodewords,
      packingEfficiency: affectedCodewordCount ? changedPositions.length / affectedCodewordCount : 0,
    };
  }

  Object.assign(StegoA3, { codewordDamage });
})(typeof globalThis !== 'undefined' ? globalThis : this);
