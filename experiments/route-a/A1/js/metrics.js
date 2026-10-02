/**
 * Similarity metrics for Experiment A1.
 *
 * Loaded as a plain script (no ES modules) so the experiment works from the filesystem as
 * well as over http. Publishes its API on the shared `StegoA1` namespace. Requires
 * `qr-role-map.js` to be loaded first.
 *
 * Several metrics with stated denominators, never a single unexplained score. The
 * definitions follow docs/ROUTE_A_ARTISTIC_QR.md. A "match" means the QR module's
 * dark/light state equals the target cell's state (target 1 = wants dark).
 *
 * Convention throughout: matrix values and target values are truthy for dark.
 */

(function (global) {
  const StegoA1 = (global.StegoA1 = global.StegoA1 || {});
  const { IMMUTABLE_ROLES, MUTABLE_ROLES } = StegoA1;

  function isMutable(role) {
    return MUTABLE_ROLES.includes(role);
  }

  function isImmutable(role) {
    return IMMUTABLE_ROLES.includes(role);
  }

  function safeRatio(numerator, denominator) {
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Compare a QR matrix against a 21 × 21 target using its role map.
   *
   * @param {boolean[][]} matrix
   * @param {string[][]} roleMap
   * @param {number[][]} target  values ∈ {0,1}, 1 = target wants a dark module
   */
  function compareMatrixToTarget(matrix, roleMap, target) {
    const size = matrix.length;
    if (target.length !== size) {
      throw new Error(`Target is ${target.length}×?, matrix is ${size}×?`);
    }

    let totalModules = 0;
    let matches = 0;
    let mutableModuleCount = 0;
    let mutableMatches = 0;
    let fixedModuleCount = 0;
    let fixedMatches = 0;
    let fixedConflicts = 0;

    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        const moduleDark = Boolean(matrix[row][column]);
        const targetDark = target[row][column] === 1;
        const match = moduleDark === targetDark;
        const role = roleMap[row][column];
        totalModules++;
        if (match) matches++;
        if (isMutable(role)) {
          mutableModuleCount++;
          if (match) mutableMatches++;
        } else if (isImmutable(role)) {
          fixedModuleCount++;
          if (match) fixedMatches++;
          else fixedConflicts++;
        }
      }
    }

    const fullSimilarity = safeRatio(matches, totalModules);
    const mutableSimilarity = safeRatio(mutableMatches, mutableModuleCount);
    const theoreticalBestMatches = mutableModuleCount + fixedMatches;

    return {
      totalModules,
      matches,
      fullSimilarity,
      mutableModuleCount,
      mutableMatches,
      mutableSimilarity,
      fixedModuleCount,
      fixedMatches,
      fixedConflicts,
      fixedConflictRatio: safeRatio(fixedConflicts, fixedModuleCount),
      theoreticalBestMatches,
      theoreticalCeiling: safeRatio(theoreticalBestMatches, totalModules),
      ceilingGap: safeRatio(theoreticalBestMatches, totalModules) - fullSimilarity,
    };
  }

  /** Format a 0–1 similarity as a fixed 4-decimal string plus a percentage. */
  function formatSimilarity(value) {
    return `${value.toFixed(4)} (${(value * 100).toFixed(2)}%)`;
  }

  Object.assign(StegoA1, { compareMatrixToTarget, formatSimilarity });
})(typeof globalThis !== 'undefined' ? globalThis : this);
