/**
 * A3 codeword-aware optimizer: the deterministic, decoder-independent heart of the
 * experiment.
 *
 * Central idea: under the binary target metric, B target-directed corrections always give
 * the same visual gain (B/441), regardless of which positions are chosen. So visual gain is
 * fixed by the module budget; the thing worth minimising is the number of distinct encoded
 * Reed–Solomon codewords damaged. This module therefore packs modifications into as few
 * codewords as possible.
 *
 * This optimizer must NEVER consult a decoder. Candidate generation is decoder-independent;
 * validation happens afterwards (see experiment-runner.js).
 *
 * Loaded as a plain script (no ES modules). Publishes on `StegoA3` and relies on `StegoA1`
 * and `StegoA2` being loaded first.
 */

(function (global) {
  const StegoA3 = (global.StegoA3 = global.StegoA3 || {});
  const A1 = global.StegoA1;
  const A2 = global.StegoA2;

  /**
   * Group eligible mismatch positions by codeword. Positions inside a codeword are ordered
   * by bit-within-codeword, so subsets are deterministic.
   *
   * @returns {Array<{codewordIndex:number, codewordType:string, positions:object[]}>}
   */
  function groupEligibleByCodeword(eligible) {
    const groups = new Map();
    for (const position of eligible) {
      if (position.codewordIndex === null || position.codewordIndex === undefined) continue;
      if (!groups.has(position.codewordIndex)) {
        groups.set(position.codewordIndex, {
          codewordIndex: position.codewordIndex,
          codewordType: position.codewordType,
          positions: [],
        });
      }
      groups.get(position.codewordIndex).positions.push(position);
    }
    const list = [...groups.values()];
    for (const group of list) {
      group.positions.sort(
        (a, b) => (a.bitWithinCodeword - b.bitWithinCodeword) ||
          (a.row - b.row) || (a.column - b.column),
      );
    }
    return list;
  }

  /** Build a fresh matrix from the base with the given positions set to their target value. */
  function matrixWithPositions(baseMatrix, positions, target) {
    const matrix = baseMatrix.map((row) => row.slice());
    for (const position of positions) {
      matrix[position.row][position.column] = target[position.row][position.column] === 1;
    }
    return matrix;
  }

  /** Total QR penalty of base + positions, used only as a deterministic structural tie-break. */
  function penaltyOf(baseMatrix, positions, target) {
    return A1.qrPenalty(matrixWithPositions(baseMatrix, positions, target));
  }

  /** All size-r index combinations from 0..n-1, in lexicographic order. */
  function combinations(n, r) {
    const result = [];
    const combo = [];
    const recurse = (start) => {
      if (combo.length === r) { result.push(combo.slice()); return; }
      for (let i = start; i <= n - (r - combo.length); i++) {
        combo.push(i);
        recurse(i + 1);
        combo.pop();
      }
    };
    if (r >= 0 && r <= n) recurse(0);
    return result;
  }

  /**
   * Choose exactly `r` positions out of one codeword's positions (`n <= 8`) minimizing the
   * resulting QR penalty; ties break by bit order. Brute-force enumeration is fine at n<=8.
   */
  function choosePartialSubset(baseMatrix, selectedPositions, group, r, target) {
    const n = group.positions.length;
    let best = null;
    for (const combo of combinations(n, r)) {
      const subset = combo.map((index) => group.positions[index]);
      const penalty = penaltyOf(baseMatrix, selectedPositions.concat(subset), target);
      if (best === null || penalty < best.penalty) best = { subset, penalty };
    }
    return best.subset;
  }

  /**
   * STRATEGY A — packed module-budget optimization.
   *
   * Select exactly `budget` eligible mismatch modules while minimizing the number of distinct
   * affected codewords. Greedy: repeatedly take the codeword with the most remaining eligible
   * mismatches (ties broken by lower resulting QR penalty, then lower codeword index), and
   * consume it; if it exceeds the remaining budget, choose the best partial subset.
   */
  function packForModuleBudget({ baseMatrix, target, eligible, budget }) {
    const groups = groupEligibleByCodeword(eligible);
    const pool = groups.slice();
    const selected = [];
    let remaining = Math.min(budget, eligible.length);

    while (remaining > 0 && pool.length) {
      let bestIndex = 0;
      let bestCount = -1;
      for (let i = 0; i < pool.length; i++) {
        const count = pool[i].positions.length;
        if (count > bestCount) { bestCount = count; bestIndex = i; }
      }
      const tied = [];
      for (let i = 0; i < pool.length; i++) {
        if (pool[i].positions.length === bestCount) tied.push(i);
      }
      let chosenIndex = tied[0];
      if (tied.length > 1) {
        // Deterministic structural tie-break: lowest resulting QR penalty, then lowest index.
        let bestPenalty = Infinity;
        for (const i of tied) {
          const penalty = penaltyOf(baseMatrix, selected.concat(pool[i].positions.slice(0, remaining)), target);
          if (penalty < bestPenalty) { bestPenalty = penalty; chosenIndex = i; }
        }
      }
      const group = pool[chosenIndex];
      if (group.positions.length <= remaining) {
        for (const position of group.positions) selected.push(position);
        remaining -= group.positions.length;
        pool.splice(chosenIndex, 1);
      } else {
        const subset = choosePartialSubset(baseMatrix, selected, group, remaining, target);
        for (const position of subset) selected.push(position);
        remaining = 0;
      }
    }

    const matrix = matrixWithPositions(baseMatrix, selected, target);
    const indices = [...new Set(selected.map((p) => p.codewordIndex))].sort((a, b) => a - b);
    return { matrix, changed: selected, affectedCodewordIndices: indices };
  }

  /**
   * STRATEGY B — codeword-budget optimization.
   *
   * Select the K codewords with the most eligible mismatches (ties: lower codeword index) and
   * apply all their useful target-directed mismatches. Maximises target similarity for a
   * capped number of damaged codewords.
   */
  function applyCodewordBudget({ baseMatrix, target, eligible, codewordBudget }) {
    const groups = groupEligibleByCodeword(eligible).slice().sort(
      (a, b) => (b.positions.length - a.positions.length) || (a.codewordIndex - b.codewordIndex),
    );
    const chosen = groups.slice(0, Math.max(0, Math.min(codewordBudget, groups.length)));
    const selected = [];
    for (const group of chosen) for (const position of group.positions) selected.push(position);
    const matrix = matrixWithPositions(baseMatrix, selected, target);
    const indices = chosen.map((g) => g.codewordIndex).sort((a, b) => a - b);
    return { matrix, changed: selected, affectedCodewordIndices: indices };
  }

  /** The maximum K worth sweeping for a codeword budget: the number of damaged-codeword groups. */
  function maxCodewordBudget(eligible) {
    return groupEligibleByCodeword(eligible).length;
  }

  Object.assign(StegoA3, {
    groupEligibleByCodeword,
    matrixWithPositions,
    combinations,
    packForModuleBudget,
    applyCodewordBudget,
    maxCodewordBudget,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
