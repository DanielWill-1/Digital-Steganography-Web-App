/**
 * QR module role map for Version 1 (21 × 21) symbols.
 *
 * Loaded as a plain script (no ES modules) so the experiment works when opened directly
 * from the filesystem as well as over http. It publishes its API on the shared
 * `StegoA1` namespace. The same file is imported for its side effects by the Node tests.
 *
 * The role map is a second grid, parallel to the bit matrix, that records what each
 * module *is* rather than whether it is dark. It is foundational for Route A: later
 * experiments must never accidentally treat a mandatory structural module as a
 * modifiable one, and metrics need to know which modules are which.
 *
 * Roles are determined by geometry only. For Version 1 those counts are fixed and were
 * confirmed against the specification during the documentation pass (see
 * docs/ROUTE_A_ARTISTIC_QR.md):
 *
 *   FINDER          147   (3 × 7 × 7)
 *   SEPARATOR        45   (3 × 15, the light ring around each finder)
 *   TIMING           10   (row 6 cols 8–12, col 6 rows 8–12)
 *   FORMAT           30   (two 15-bit copies)
 *   DARK_MODULE       1   (row 13, col 8)
 *   DATA + ECC      208   (26 codewords × 8 bits)
 *   REMAINDER         0   (Version 1 has no remainder bits)
 *   total           441
 */

(function (global) {
  const StegoA1 = (global.StegoA1 = global.StegoA1 || {});

  const QR_VERSION_1_SIZE = 21;
  const QR_VERSION_1_TOTAL_CODEWORDS = 26;

  /** ECC codeword counts for Version 1, per level. */
  const QR_V1_ECC_CODEWORDS = { L: 7, M: 10, Q: 13, H: 17 };

  /** ECC level → two-bit indicator used in the format information. */
  const QR_V1_ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  /** Maximum UTF-8 payload bytes for Version 1 byte mode, per level. */
  const QR_V1_MAX_BYTES = { L: 17, M: 14, Q: 11, H: 7 };

  const QR_ROLE = Object.freeze({
    FINDER: 'FINDER',
    SEPARATOR: 'SEPARATOR',
    TIMING: 'TIMING',
    FORMAT: 'FORMAT',
    DARK_MODULE: 'DARK_MODULE',
    DATA: 'DATA',
    ECC: 'ECC',
    REMAINDER: 'REMAINDER',
    DATA_OR_ECC: 'DATA_OR_ECC',
  });

  /** Modules that A1 and every valid QR symbol must never change. */
  const IMMUTABLE_ROLES = Object.freeze([
    QR_ROLE.FINDER,
    QR_ROLE.SEPARATOR,
    QR_ROLE.TIMING,
    QR_ROLE.FORMAT,
    QR_ROLE.DARK_MODULE,
  ]);

  /** Modules that later experiments may consider modifying. */
  const MUTABLE_ROLES = Object.freeze([
    QR_ROLE.DATA,
    QR_ROLE.ECC,
    QR_ROLE.REMAINDER,
  ]);

  /**
   * The 30 positions of the two format-information copies, as [row, column] pairs.
   * Reproduces the placement used by the in-repo encoder exactly.
   */
  function version1FormatPositions() {
    const size = QR_VERSION_1_SIZE;
    const positions = [];
    for (let i = 0; i < 15; i++) {
      if (i < 6) positions.push([i, 8]);
      else if (i < 8) positions.push([i + 1, 8]);
      else positions.push([size - 15 + i, 8]);

      if (i < 8) positions.push([8, size - 1 - i]);
      else if (i === 8) positions.push([8, 7]);
      else positions.push([8, 14 - i]);
    }
    return positions;
  }

  /** True when a position is a fixed structural module (not data/ECC). */
  function isFunctionModule(row, column) {
    // The finder block spans one module beyond the 7×7 core on every side: that outer
    // ring is the separator. Relative offsets are −1…7, so the block is
    // [top−1, top+7] × [left−1, left+7], clipped by the caller's bounds.
    const inFinderBlock = (top, left) =>
      row >= top - 1 && row <= top + 7 && column >= left - 1 && column <= left + 7;
    if (inFinderBlock(0, 0) || inFinderBlock(0, 14) || inFinderBlock(14, 0)) return true;

    // Timing patterns.
    if (row === 6 && column >= 8 && column <= 12) return true;
    if (column === 6 && row >= 8 && row <= 12) return true;

    // Fixed dark module.
    if (row === 13 && column === 8) return true;

    // Format information (two 15-bit copies), matching the encoder's placement.
    for (const [r, c] of version1FormatPositions()) {
      if (row === r && column === c) return true;
    }
    return false;
  }

  /**
   * Data-module read order for Version 1: the right-to-left, two-column zig-zag the QR
   * placement uses, with column 6 skipped. Returns an array of [row, column] pairs in the
   * order bits are placed. The first (data codewords × 8) positions carry data; the rest
   * carry ECC.
   */
  function version1DataModuleOrder() {
    const size = QR_VERSION_1_SIZE;
    const order = [];
    let upward = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right--;
      for (let offset = 0; offset < size; offset++) {
        const row = upward ? size - 1 - offset : offset;
        for (let column = right; column >= right - 1; column--) {
          if (isFunctionModule(row, column)) continue;
          order.push([row, column]);
        }
      }
      upward = !upward;
    }
    return order;
  }

  /**
   * Build the Version 1 role map for a given ECC level.
   *
   * @param {'L'|'M'|'Q'|'H'} eccLevel
   * @returns {string[][]} roleMap[row][column] ∈ QR_ROLE
   */
  function buildVersion1RoleMap(eccLevel) {
    if (!(eccLevel in QR_V1_ECC_CODEWORDS)) {
      throw new Error(`Unknown ECC level for role map: ${eccLevel}`);
    }
    const size = QR_VERSION_1_SIZE;
    const map = Array.from({ length: size }, () => Array(size).fill(null));

    const assign = (row, column, role) => {
      if (row < 0 || row >= size || column < 0 || column >= size) return;
      if (map[row][column] !== null) {
        throw new Error(
          `Role map collision at (${row}, ${column}): ${map[row][column]} vs ${role}`,
        );
      }
      map[row][column] = role;
    };

    const finder = (top, left) => {
      for (let row = -1; row <= 7; row++) {
        for (let column = -1; column <= 7; column++) {
          const isFinderCore = row >= 0 && row <= 6 && column >= 0 && column <= 6;
          assign(top + row, left + column, isFinderCore ? QR_ROLE.FINDER : QR_ROLE.SEPARATOR);
        }
      }
    };
    finder(0, 0);
    finder(0, 14);
    finder(14, 0);

    for (let i = 8; i < size - 8; i++) {
      assign(6, i, QR_ROLE.TIMING);
      assign(i, 6, QR_ROLE.TIMING);
    }

    assign(size - 8, 8, QR_ROLE.DARK_MODULE);

    for (const [row, column] of version1FormatPositions()) {
      assign(row, column, QR_ROLE.FORMAT);
    }

    // Assign DATA vs ECC by replaying the placement order. Data codewords are placed
    // first.
    const dataCodewords = QR_VERSION_1_TOTAL_CODEWORDS - QR_V1_ECC_CODEWORDS[eccLevel];
    const dataBits = dataCodewords * 8;
    const order = version1DataModuleOrder();
    order.forEach(([row, column], bitIndex) => {
      assign(row, column, bitIndex < dataBits ? QR_ROLE.DATA : QR_ROLE.ECC);
    });

    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        if (map[row][column] === null) map[row][column] = QR_ROLE.REMAINDER;
      }
    }

    return map;
  }

  /** Count how many modules carry each role. */
  function countRoles(roleMap) {
    const counts = {};
    for (const row of roleMap) {
      for (const role of row) {
        counts[role] = (counts[role] || 0) + 1;
      }
    }
    return counts;
  }

  /** True when a role may be modified by later experiments (not by A1). */
  function isMutableRole(role) {
    return MUTABLE_ROLES.includes(role);
  }

  /** True when a role is mandatory QR structure. */
  function isImmutableRole(role) {
    return IMMUTABLE_ROLES.includes(role);
  }

  Object.assign(StegoA1, {
    QR_VERSION_1_SIZE,
    QR_VERSION_1_TOTAL_CODEWORDS,
    QR_V1_ECC_CODEWORDS,
    QR_V1_ECC_FORMAT_BITS,
    QR_V1_MAX_BYTES,
    QR_ROLE,
    IMMUTABLE_ROLES,
    MUTABLE_ROLES,
    version1FormatPositions,
    version1DataModuleOrder,
    buildVersion1RoleMap,
    countRoles,
    isMutableRole,
    isImmutableRole,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
