/**
 * Experiment A1 QR generation.
 *
 * Loaded as a plain script (no ES modules) so the experiment works from the filesystem as
 * well as over http. Publishes its API on the shared `StegoA1` namespace, and is imported
 * for its side effects by the Node tests. Requires `qr-role-map.js` to be loaded first.
 *
 * This is a faithful port of the from-scratch Version 1 encoder in `qr_app copy.html`
 * (commit-frozen as the Route A baseline). The algorithm is copied deliberately, not
 * re-derived, so that A1 measures the *existing* encoder rather than a new one. The
 * application file itself is not modified — its encoder is wrapped in an IIFE and cannot
 * be imported, and the project's rules forbid rewriting it for an experiment's
 * convenience.
 *
 * Additions over the baseline, all additive and non-behavioural:
 *   - explicit `eccLevel` + `mask` inputs (the baseline always searched all masks);
 *   - a module role map (see qr-role-map.js);
 *   - the four penalty rules reported separately, not just their sum;
 *   - the encoded codewords exposed for inspection;
 *   - a pure rasteriser usable from both the browser and Node.
 *
 * Nothing here modifies QR modules toward a target. A1 is a measurement.
 */

(function (global) {
  const StegoA1 = (global.StegoA1 = global.StegoA1 || {});

  const {
    QR_VERSION_1_SIZE,
    QR_VERSION_1_TOTAL_CODEWORDS,
    QR_V1_ECC_CODEWORDS,
    QR_V1_ECC_FORMAT_BITS,
    QR_V1_MAX_BYTES,
    buildVersion1RoleMap,
  } = StegoA1;

  const ECC_LEVELS = ['L', 'M', 'Q', 'H'];
  const MASK_IDS = [0, 1, 2, 3, 4, 5, 6, 7];
  const QR_SIZE = QR_VERSION_1_SIZE;
  const TOTAL_CODEWORDS = QR_VERSION_1_TOTAL_CODEWORDS;
  const ECC_CODEWORDS = QR_V1_ECC_CODEWORDS;
  const ECC_FORMAT_BITS = QR_V1_ECC_FORMAT_BITS;
  const MAX_BYTES = QR_V1_MAX_BYTES;

  /** Default module scale and quiet zone for candidate rendering. */
  const DEFAULT_MODULE_SCALE = 12;
  const DEFAULT_QUIET_ZONE = 4;

  const QR_EXP = new Uint8Array(512);
  const QR_LOG = new Uint8Array(256);
  {
    let value = 1;
    for (let i = 0; i < 255; i++) {
      QR_EXP[i] = value;
      QR_LOG[value] = i;
      value <<= 1;
      if (value & 0x100) value ^= 0x11d;
    }
    for (let i = 255; i < QR_EXP.length; i++) QR_EXP[i] = QR_EXP[i - 255];
  }

  function utf8ByteLength(text) {
    return new TextEncoder().encode(text).length;
  }

  /** Maximum whole UTF-8 bytes that fit at a level in Version 1 byte mode. */
  function capacityBytes(eccLevel) {
    if (!(eccLevel in ECC_CODEWORDS)) throw new Error(`Unknown ECC level: ${eccLevel}`);
    return QR_V1_MAX_BYTES[eccLevel];
  }

  /** True when the payload fits the level's data capacity. */
  function payloadFits(payload, eccLevel) {
    return utf8ByteLength(payload) <= capacityBytes(eccLevel);
  }

  /** Which levels a payload fits, and why each unsupported level is skipped. */
  function capacityReport(payload) {
    const bytes = utf8ByteLength(payload);
    return ECC_LEVELS.map((eccLevel) => ({
      eccLevel,
      bytes,
      maxBytes: capacityBytes(eccLevel),
      supported: bytes <= capacityBytes(eccLevel),
      reason: bytes <= capacityBytes(eccLevel)
        ? null
        : `exceeds Version 1-${eccLevel} capacity (max ${capacityBytes(eccLevel)} bytes)`,
    }));
  }

  function qrMultiply(a, b) {
    return a && b ? QR_EXP[QR_LOG[a] + QR_LOG[b]] : 0;
  }

  function qrGeneratorPolynomial(eccLength) {
    let polynomial = [1];
    for (let i = 0; i < eccLength; i++) {
      const next = Array(polynomial.length + 1).fill(0);
      const root = QR_EXP[i];
      for (let j = 0; j < polynomial.length; j++) {
        next[j] ^= polynomial[j];
        next[j + 1] ^= qrMultiply(polynomial[j], root);
      }
      polynomial = next;
    }
    return polynomial;
  }

  function qrReedSolomon(data, eccLength) {
    const remainder = data.slice();
    remainder.push(...Array(eccLength).fill(0));
    const generator = qrGeneratorPolynomial(eccLength);
    for (let i = 0; i < data.length; i++) {
      const factor = remainder[i];
      if (!factor) continue;
      for (let j = 0; j < generator.length; j++) {
        remainder[i + j] ^= qrMultiply(generator[j], factor);
      }
    }
    return remainder.slice(data.length);
  }

  function qrBitsToBytes(bits) {
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j++) value = (value << 1) | (bits[i + j] || 0);
      bytes.push(value);
    }
    return bytes;
  }

  /**
   * Encode a payload into data and ECC codewords for a level. Byte mode only, Version 1.
   * Throws when the payload does not fit, matching the baseline encoder's behaviour.
   */
  function qrCodewords(payload, eccLevel) {
    if (!(eccLevel in ECC_CODEWORDS)) throw new Error(`Unknown ECC level: ${eccLevel}`);
    const bytes = Array.from(new TextEncoder().encode(payload));
    const eccLength = ECC_CODEWORDS[eccLevel];
    const dataCapacity = TOTAL_CODEWORDS - eccLength;
    const bits = [0, 1, 0, 0]; // Byte mode indicator.
    for (let i = 7; i >= 0; i--) bits.push((bytes.length >> i) & 1);
    bytes.forEach((byte) => {
      for (let i = 7; i >= 0; i--) bits.push((byte >> i) & 1);
    });
    if (bits.length > dataCapacity * 8) {
      throw new Error(
        `Version 1-${eccLevel} supports only ${dataCapacity - 2} UTF-8 bytes in byte mode.`,
      );
    }
    for (let i = 0; i < Math.min(4, dataCapacity * 8 - bits.length); i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    const data = qrBitsToBytes(bits);
    for (let i = 0; data.length < dataCapacity; i++) data.push(i % 2 ? 0x11 : 0xec);
    return { data, ecc: qrReedSolomon(data, eccLength) };
  }

  function qrBchFormat(value) {
    let remainder = value << 10;
    while (remainder >= 0x400) {
      const shift = Math.floor(Math.log2(remainder)) - 10;
      remainder ^= 0x537 << shift;
    }
    return ((value << 10) | remainder) ^ 0x5412;
  }

  function qrMask(mask, row, column) {
    switch (mask) {
      case 0: return (row + column) % 2 === 0;
      case 1: return row % 2 === 0;
      case 2: return column % 3 === 0;
      case 3: return (row + column) % 3 === 0;
      case 4: return (Math.floor(row / 2) + Math.floor(column / 3)) % 2 === 0;
      case 5: return (row * column) % 2 + (row * column) % 3 === 0;
      case 6: return ((row * column) % 2 + (row * column) % 3) % 2 === 0;
      default: return ((row * column) % 3 + (row + column) % 2) % 2 === 0;
    }
  }

  /**
   * The four ISO-style mask penalty rules, reported separately. The total equals the
   * baseline encoder's single `qrPenalty` score; only the presentation differs.
   *
   * Rule 3 is the baseline's approximation of the specification's 1:1:3:1:1 rule and is
   * therefore not directly comparable to another implementation's rule 3.
   */
  function qrPenaltyBreakdown(matrix) {
    const size = matrix.length;
    let rule1 = 0;
    let rule3 = 0;

    const linePenalty = (line) => {
      let runColor = line[0];
      let runLength = 1;
      for (let i = 1; i <= line.length; i++) {
        if (i < line.length && line[i] === runColor) runLength++;
        else {
          if (runLength >= 5) rule1 += 3 + runLength - 5;
          runColor = line[i];
          runLength = 1;
        }
      }
      for (let i = 0; i <= line.length - 7; i++) {
        if (line.slice(i, i + 7).map((value) => (value ? 1 : 0)).join('') === '1011101') {
          // NOTE (A4.0 fix): line entries are booleans, so "light" must be tested with
          // falsiness, not "=== 0". The original `bit === 0` was always false, which made
          // Rule 3 dead code. See experiments/route-a/A4/BUG_AUDIT.md.
          const before = i >= 4 && line.slice(i - 4, i).every((bit) => !bit);
          const after = i + 11 <= line.length && line.slice(i + 7, i + 11).every((bit) => !bit);
          if (before || after) rule3 += 40;
        }
      }
    };
    for (let row = 0; row < size; row++) linePenalty(matrix[row]);
    for (let column = 0; column < size; column++) linePenalty(matrix.map((row) => row[column]));

    let rule2 = 0;
    for (let row = 0; row < size - 1; row++) {
      for (let column = 0; column < size - 1; column++) {
        const value = matrix[row][column];
        if (
          matrix[row][column + 1] === value &&
          matrix[row + 1][column] === value &&
          matrix[row + 1][column + 1] === value
        ) {
          rule2 += 3;
        }
      }
    }

    let rule4 = 0;
    let dark = 0;
    matrix.forEach((row) => row.forEach((value) => { if (value) dark++; }));
    rule4 += Math.floor(Math.abs((dark * 100) / (size * size) - 50) / 5) * 10;

    return {
      rule1,
      rule2,
      rule3,
      rule4,
      total: rule1 + rule2 + rule3 + rule4,
    };
  }

  /** Total penalty only — the value the standard mask-selection rule minimises. */
  function qrPenalty(matrix) {
    return qrPenaltyBreakdown(matrix).total;
  }

  /**
   * Build the 21 × 21 matrix for a level, mask, and codeword list. Structural modules are
   * written first, then data/ECC with the mask applied inline — identical to the baseline.
   */
  function qrBuildMatrix(codewords, eccLevel, mask) {
    const matrix = Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(null));
    const setFunction = (row, column, value) => { matrix[row][column] = Boolean(value); };
    const finder = (top, left) => {
      for (let row = -1; row <= 7; row++) {
        for (let column = -1; column <= 7; column++) {
          const dark =
            row >= 0 && row <= 6 && column >= 0 && column <= 6 &&
            (row === 0 || row === 6 || column === 0 || column === 6 ||
              (row >= 2 && row <= 4 && column >= 2 && column <= 4));
          if (top + row >= 0 && top + row < QR_SIZE && left + column >= 0 && left + column < QR_SIZE) {
            setFunction(top + row, left + column, dark);
          }
        }
      }
    };
    finder(0, 0);
    finder(0, QR_SIZE - 7);
    finder(QR_SIZE - 7, 0);
    for (let i = 8; i < QR_SIZE - 8; i++) {
      if (matrix[6][i] === null) setFunction(6, i, i % 2 === 0);
      if (matrix[i][6] === null) setFunction(i, 6, i % 2 === 0);
    }
    setFunction(QR_SIZE - 8, 8, true);
    const format = qrBchFormat((ECC_FORMAT_BITS[eccLevel] << 3) | mask);
    for (let i = 0; i < 15; i++) {
      const bit = ((format >> i) & 1) !== 0;
      if (i < 6) setFunction(i, 8, bit);
      else if (i < 8) setFunction(i + 1, 8, bit);
      else setFunction(QR_SIZE - 15 + i, 8, bit);
      if (i < 8) setFunction(8, QR_SIZE - 1 - i, bit);
      else if (i === 8) setFunction(8, 7, bit);
      else setFunction(8, 14 - i, bit);
    }
    const dataBits = [];
    codewords.forEach((byte) => { for (let i = 7; i >= 0; i--) dataBits.push((byte >> i) & 1); });
    let bitIndex = 0;
    let upward = true;
    for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
      if (right === 6) right--;
      for (let offset = 0; offset < QR_SIZE; offset++) {
        const row = upward ? QR_SIZE - 1 - offset : offset;
        for (let column = right; column >= right - 1; column--) {
          if (matrix[row][column] !== null) continue;
          const bit = bitIndex < dataBits.length ? dataBits[bitIndex++] : 0;
          matrix[row][column] = Boolean(bit ^ (qrMask(mask, row, column) ? 1 : 0));
        }
      }
      upward = !upward;
    }
    return matrix;
  }

  function assertMask(mask) {
    if (!Number.isInteger(mask) || mask < 0 || mask > 7) {
      throw new Error(`Mask must be an integer 0–7, received ${mask}`);
    }
  }

  /**
   * Generate one Version 1 QR candidate for a forced ECC level and mask.
   *
   * The format information encodes the same ECC level and mask that are used, so the
   * candidate is an internally valid standards-compatible symbol.
   */
  function generateVersion1Qr({ payload, eccLevel, mask }) {
    assertMask(mask);
    const { data, ecc } = qrCodewords(payload, eccLevel);
    const codewords = data.concat(ecc);
    const matrix = qrBuildMatrix(codewords, eccLevel, mask);
    const roleMap = buildVersion1RoleMap(eccLevel);
    const penalties = qrPenaltyBreakdown(matrix);
    return {
      candidateId: `A1-${eccLevel}-M${mask}`,
      payload,
      eccLevel,
      mask,
      matrix,
      roleMap,
      dataCodewords: data,
      eccCodewords: ecc,
      codewords,
      penalties,
      formatBits: qrBchFormat((ECC_FORMAT_BITS[eccLevel] << 3) | mask),
    };
  }

  /**
   * The mask the ordinary QR encoder would select at a level, purely by lowest total
   * penalty (ties resolve to the lowest mask index, as in the baseline).
   */
  function standardSelectedMask(payload, eccLevel) {
    const { data, ecc } = qrCodewords(payload, eccLevel);
    const codewords = data.concat(ecc);
    let bestMask = 0;
    let bestPenalty = Infinity;
    for (const mask of MASK_IDS) {
      const penalty = qrPenalty(qrBuildMatrix(codewords, eccLevel, mask));
      if (penalty < bestPenalty) {
        bestPenalty = penalty;
        bestMask = mask;
      }
    }
    return bestMask;
  }

  /**
   * Generate every supported candidate for a payload.
   *
   * Levels whose capacity the payload exceeds are skipped (with a reason) rather than
   * producing an invalid symbol. For `g.co` this yields 4 × 8 = 32 candidates.
   */
  function generateAllCandidates({ payload, eccLevels = ECC_LEVELS, masks = MASK_IDS }) {
    const report = capacityReport(payload);
    const skipped = report.filter((entry) => !entry.supported);
    const candidates = [];
    const standardMaskByEcc = {};

    for (const eccLevel of eccLevels) {
      if (!payloadFits(payload, eccLevel)) continue;
      const selected = standardSelectedMask(payload, eccLevel);
      standardMaskByEcc[eccLevel] = selected;
      for (const mask of masks) {
        const candidate = generateVersion1Qr({ payload, eccLevel, mask });
        candidate.standardSelectedMask = mask === selected;
        candidates.push(candidate);
      }
    }

    return {
      payload,
      payloadUtf8Bytes: utf8ByteLength(payload),
      candidates,
      skipped,
      capacityReport: report,
      standardMaskByEcc,
      expectedCandidateCount: eccLevels.filter((l) => payloadFits(payload, l)).length * masks.length,
    };
  }

  /** Deterministic candidate filename, e.g. A1_L_mask0.png. */
  function candidateFilename(eccLevel, mask) {
    return `A1_${eccLevel}_mask${mask}.png`;
  }

  /**
   * Rasterise a matrix to RGBA pixel data with a quiet zone. Pure and dependency-free, so
   * the same pixels are produced in the browser and in Node.
   */
  function renderMatrixToImageData({
    matrix,
    moduleScale = DEFAULT_MODULE_SCALE,
    quietZone = DEFAULT_QUIET_ZONE,
    dark = [0, 0, 0],
    light = [255, 255, 255],
  }) {
    const size = matrix.length;
    const total = size + quietZone * 2;
    const width = total * moduleScale;
    const height = width;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = light[0];
      data[i + 1] = light[1];
      data[i + 2] = light[2];
      data[i + 3] = 255;
    }
    for (let row = 0; row < size; row++) {
      for (let column = 0; column < size; column++) {
        if (!matrix[row][column]) continue;
        const x0 = (column + quietZone) * moduleScale;
        const y0 = (row + quietZone) * moduleScale;
        for (let y = 0; y < moduleScale; y++) {
          for (let x = 0; x < moduleScale; x++) {
            const index = ((y0 + y) * width + (x0 + x)) * 4;
            data[index] = dark[0];
            data[index + 1] = dark[1];
            data[index + 2] = dark[2];
            data[index + 3] = 255;
          }
        }
      }
    }
    return { data, width, height, moduleScale, quietZone };
  }

  /** Rasterise a 0/1 target matrix with nearest-neighbour scaling (no interpolation). */
  function renderTargetToImageData(target, moduleScale = DEFAULT_MODULE_SCALE) {
    return renderMatrixToImageData({
      matrix: target.map((row) => row.map((value) => value === 1)),
      moduleScale,
      quietZone: 0,
      dark: [0, 0, 0],
      light: [255, 255, 255],
    });
  }

  Object.assign(StegoA1, {
    ECC_LEVELS,
    MASK_IDS,
    QR_SIZE,
    TOTAL_CODEWORDS,
    ECC_CODEWORDS,
    ECC_FORMAT_BITS,
    MAX_BYTES,
    DEFAULT_MODULE_SCALE,
    DEFAULT_QUIET_ZONE,
    utf8ByteLength,
    capacityBytes,
    payloadFits,
    capacityReport,
    qrGeneratorPolynomial,
    qrReedSolomon,
    qrCodewords,
    qrBchFormat,
    qrMask,
    qrPenaltyBreakdown,
    qrPenalty,
    qrBuildMatrix,
    generateVersion1Qr,
    standardSelectedMask,
    generateAllCandidates,
    candidateFilename,
    renderMatrixToImageData,
    renderTargetToImageData,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
