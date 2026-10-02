/**
 * A2 modification strategy: the deterministic, non-optimised baseline.
 *
 * A2's whole point is that position selection is NOT intelligent. It finds the eligible
 * mismatching mutable modules and orders them with a seeded PRNG. Which encoded codeword
 * each module belongs to is *recorded* for analysis, but is deliberately NOT used to
 * choose positions — that is A3.
 *
 * Loaded as a plain script (no ES modules) so the page works from the filesystem as well
 * as over http. Publishes on the shared `StegoA2` namespace and reuses `StegoA1` for the
 * role map, placement order, and constants.
 */

(function (global) {
  const StegoA2 = (global.StegoA2 = global.StegoA2 || {});
  const A1 = global.StegoA1;

  /** Seeds for the repeated trials. Fixed and recorded; never Math.random(). */
  const DEFAULT_SEEDS = [42, 43, 44, 45, 46];

  /**
   * Absolute modification budgets. Denser near zero, because low-damage behaviour is the
   * part we most need to characterise. Budgets above the eligible count are dropped and
   * the full eligible set is always added.
   */
  const DEFAULT_BUDGET_SCHEDULE = [0, 1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128];

  /**
   * Codeword metadata for every data/ECC module at a level.
   *
   * The bit index is the module's position in the QR data-placement order. Eight
   * consecutive bits form one codeword, so codeword_index = floor(bit_index / 8). The
   * DATA/ECC split depends on the level (data codewords are placed first).
   *
   * @returns {{ map: Map<string, object>, dataCodewordCount: number, eccCodewordCount: number }}
   */
  function codewordMapFor(eccLevel) {
    const order = A1.version1DataModuleOrder();
    const eccCodewordCount = A1.QR_V1_ECC_CODEWORDS[eccLevel];
    const dataCodewordCount = A1.QR_VERSION_1_TOTAL_CODEWORDS - eccCodewordCount;
    const dataBits = dataCodewordCount * 8;
    const map = new Map();
    order.forEach(([row, column], bitIndex) => {
      map.set(row + ',' + column, {
        bitIndex,
        codewordIndex: Math.floor(bitIndex / 8),
        bitWithinCodeword: bitIndex % 8,
        codewordType: bitIndex < dataBits ? 'DATA' : 'ECC',
      });
    });
    return { map, dataCodewordCount, eccCodewordCount };
  }

  /**
   * Eligible positions: mutable role AND QR value != target value.
   *
   * Each entry records row, column, original/target value, role, and (where available) the
   * bit index, codeword index, bit-within-codeword, and codeword type.
   */
  function buildEligiblePositions(matrix, roleMap, target, codewordInfo) {
    const size = matrix.length;
    const positions = [];
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const role = roleMap[row][column];
        if (!A1.isMutableRole(role)) continue; // never a function module
        const qrValue = matrix[row][column] ? 1 : 0;
        const targetValue = target[row][column] === 1 ? 1 : 0;
        if (qrValue === targetValue) continue; // already matches; nothing to fix
        const meta = codewordInfo && codewordInfo.map.get(row + ',' + column);
        positions.push({
          row,
          column,
          originalValue: qrValue,
          targetValue,
          role,
          bitIndex: meta ? meta.bitIndex : null,
          codewordIndex: meta ? meta.codewordIndex : null,
          bitWithinCodeword: meta ? meta.bitWithinCodeword : null,
          codewordType: meta ? meta.codewordType : null,
        });
      }
    }
    return positions;
  }

  /** mulberry32 — a tiny deterministic PRNG. No dependency, fully reproducible. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Fisher–Yates shuffle driven by the seeded PRNG. Returns a new array. */
  function seededShuffle(array, seed) {
    const copy = array.slice();
    const rand = mulberry32(seed);
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  /**
   * The budgets to run for a given eligible count: every schedule value <= count, plus
   * zero and the full eligible count. Sorted ascending, de-duplicated.
   */
  function budgetsFor(eligibleCount, schedule = DEFAULT_BUDGET_SCHEDULE) {
    const set = new Set([0]);
    for (const budget of schedule) {
      if (budget <= eligibleCount) set.add(budget);
    }
    if (!set.has(eligibleCount)) set.add(eligibleCount);
    return [...set].sort((a, b) => a - b);
  }

  /**
   * Apply a budget to the base matrix: take the first `budget` positions of the ordered
   * list and set each module to the target value. Because every eligible position is a
   * mismatch, this changes exactly `min(budget, ordered.length)` modules and each change
   * moves the QR one step toward the target.
   *
   * Returns a fresh matrix; the base matrix is never mutated.
   */
  function applyBudget(baseMatrix, orderedPositions, budget, target) {
    const matrix = baseMatrix.map((row) => row.slice());
    const changed = [];
    const count = Math.min(budget, orderedPositions.length);
    for (let i = 0; i < count; i++) {
      const position = orderedPositions[i];
      const value = target[position.row][position.column] === 1;
      if (matrix[position.row][position.column] !== value) {
        matrix[position.row][position.column] = value;
        changed.push(position);
      }
    }
    return { matrix, changed };
  }

  Object.assign(StegoA2, {
    DEFAULT_SEEDS,
    DEFAULT_BUDGET_SCHEDULE,
    codewordMapFor,
    buildEligiblePositions,
    mulberry32,
    seededShuffle,
    budgetsFor,
    applyBudget,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
