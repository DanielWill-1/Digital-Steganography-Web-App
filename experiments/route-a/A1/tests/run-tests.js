/**
 * Experiment A1 tests. Dependency-free; run with `node tests/run-tests.js`.
 *
 * These are also the in-project validation evidence for the baseline encoder, in the
 * spirit of A0: dimensions, capacity, forced masks, format consistency, structural
 * integrity, penalty regressions against the values recorded during the documentation
 * pass, metrics, normalisation, and (optionally) an exact jsQR round trip of all 32
 * default candidates.
 *
 * jsQR round trip: set A1_JSQR_PATH to a local copy of jsQR 1.4.0 to enable it. Without
 * it the round trip is reported as skipped — the project adds no dependency to run tests.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The experiment modules are plain classic scripts so the UI also works when opened from
// the filesystem. Importing them here runs them for their side effects; they publish
// everything on the shared StegoA1 namespace.
import '../js/qr-role-map.js';
import '../js/qr-experiment.js';
import '../js/metrics.js';
import '../js/target-grid.js';
import '../js/export-results.js';
import '../js/experiment-runner.js';

const {
  buildVersion1RoleMap,
  countRoles,
  version1DataModuleOrder,
  QR_ROLE,
  QR_V1_ECC_CODEWORDS,
  generateVersion1Qr,
  generateAllCandidates,
  qrPenalty,
  capacityReport,
  payloadFits,
  utf8ByteLength,
  renderMatrixToImageData,
  MAX_BYTES,
  compareMatrixToTarget,
  formatSimilarity,
  imageDataToTargetMatrix,
  syntheticTarget,
  SYNTHETIC_TARGETS,
  buildCsv,
  csvCell,
  buildManifest,
  jsQrDecoder,
} = globalThis.StegoA1;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed++;
    failures.push({ name, error });
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed++;
    failures.push({ name, error });
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

function assert(condition, message = 'assertion failed') {
  if (!condition) throw new Error(message);
}

function eq(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message ? message + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function close(actual, expected, epsilon = 1e-9, message = '') {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`${message ? message + ': ' : ''}expected ≈${expected}, got ${actual}`);
  }
}

function deepEq(actual, expected, message = '') {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${message ? message + ': ' : ''}expected ${b}, got ${a}`);
}

function rgbaFrom(matrix, scale = 1) {
  // Build a small RGBA buffer from a 0/1 matrix, one pixel per cell (scale 1).
  const size = matrix.length;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const index = (row * size + column) * 4;
      const v = matrix[row][column] ? 0 : 255;
      data[index] = v;
      data[index + 1] = v;
      data[index + 2] = v;
      data[index + 3] = 255;
    }
  }
  return { data, width: size, height: size };
}

// GF(2) polynomial remainder, for the BCH format-information check. Integer `%` is not
// the same operation.
function gf2Remainder(value, generator) {
  let v = value;
  const genDegree = Math.floor(Math.log2(generator));
  while (v !== 0 && Math.floor(Math.log2(v)) >= genDegree) {
    v ^= generator << (Math.floor(Math.log2(v)) - genDegree);
  }
  return v;
}

// ---------------------------------------------------------------------------
console.log('\nRole map');
// ---------------------------------------------------------------------------

test('Version 1 role counts match the documented baseline', () => {
  const counts = countRoles(buildVersion1RoleMap('L'));
  eq(counts[QR_ROLE.FINDER], 147, 'FINDER');
  eq(counts[QR_ROLE.SEPARATOR], 45, 'SEPARATOR');
  eq(counts[QR_ROLE.TIMING], 10, 'TIMING');
  eq(counts[QR_ROLE.FORMAT], 30, 'FORMAT');
  eq(counts[QR_ROLE.DARK_MODULE], 1, 'DARK_MODULE');
  eq(counts[QR_ROLE.DATA] + counts[QR_ROLE.ECC], 208, 'DATA+ECC');
  eq(counts[QR_ROLE.REMAINDER] ?? 0, 0, 'REMAINDER');
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  eq(total, 441, 'total');
});

test('DATA/ECC split varies with level, immutable total is constant', () => {
  for (const [level, eccWords] of Object.entries(QR_V1_ECC_CODEWORDS)) {
    const counts = countRoles(buildVersion1RoleMap(level));
    eq(counts[QR_ROLE.DATA], (26 - eccWords) * 8, `${level} data modules`);
    eq(counts[QR_ROLE.ECC], eccWords * 8, `${level} ecc modules`);
    const immutable =
      counts[QR_ROLE.FINDER] + counts[QR_ROLE.SEPARATOR] + counts[QR_ROLE.TIMING] +
      counts[QR_ROLE.FORMAT] + counts[QR_ROLE.DARK_MODULE];
    eq(immutable, 233, `${level} immutable`);
  }
});

test('data module read order contains exactly 208 positions, each once', () => {
  const order = version1DataModuleOrder();
  eq(order.length, 208);
  const seen = new Set(order.map(([r, c]) => `${r},${c}`));
  eq(seen.size, 208, 'unique positions');
});

// ---------------------------------------------------------------------------
console.log('\nQR generation');
// ---------------------------------------------------------------------------

test('all 32 candidates for g.co are 21×21 and structurally consistent', () => {
  const { candidates, expectedCandidateCount } = generateAllCandidates({ payload: 'g.co' });
  eq(expectedCandidateCount, 32, 'expected count');
  eq(candidates.length, 32, 'generated count');
  for (const candidate of candidates) {
    eq(candidate.matrix.length, 21, `${candidate.candidateId} rows`);
    for (const row of candidate.matrix) eq(row.length, 21, `${candidate.candidateId} cols`);
    // Finder pattern corner must be dark.
    eq(candidate.matrix[0][0], true, `${candidate.candidateId} finder`);
    // Timing pattern alternates in row 6.
    eq(candidate.matrix[6][8], true, `${candidate.candidateId} timing`);
  }
});

test('forced masks 0–7 produce distinct matrices at one level', () => {
  const matrices = new Set();
  for (let mask = 0; mask < 8; mask++) {
    const { matrix } = generateVersion1Qr({ payload: 'g.co', eccLevel: 'Q', mask });
    matrices.add(JSON.stringify(matrix));
  }
  eq(matrices.size, 8, 'distinct mask matrices');
});

test('invalid mask is rejected', () => {
  let threw = false;
  try {
    generateVersion1Qr({ payload: 'g.co', eccLevel: 'L', mask: 8 });
  } catch {
    threw = true;
  }
  assert(threw, 'expected an error for mask 8');
});

test('forced mask is encoded in both format-information copies', () => {
  for (const eccLevel of ['L', 'M', 'Q', 'H']) {
    const eccBits = { L: 1, M: 0, Q: 3, H: 2 }[eccLevel];
    for (let mask = 0; mask < 8; mask++) {
      const { matrix } = generateVersion1Qr({ payload: 'g.co', eccLevel, mask });
      const readCopy = (positions) =>
        positions.reduce((value, [row, column], bit) => value | ((matrix[row][column] ? 1 : 0) << bit), 0);
      const copy1 = readCopy([
        [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7],
        [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
      ]);
      const copy2 = readCopy([
        [8, 20], [8, 19], [8, 18], [8, 17], [8, 16], [8, 15], [8, 14], [8, 13],
        [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
      ]);
      eq(copy1, copy2, `${eccLevel}/${mask} copies agree`);
      const unmasked = copy1 ^ 0x5412;
      eq(unmasked >>> 10, (eccBits << 3) | mask, `${eccLevel}/${mask} decodes to level+mask`);
      eq(gf2Remainder(unmasked, 0x537), 0, `${eccLevel}/${mask} BCH-valid`);
    }
  }
});

// ---------------------------------------------------------------------------
console.log('\nCapacity');
// ---------------------------------------------------------------------------

test('capacity limits are 17/14/11/7 bytes', () => {
  deepEq(MAX_BYTES, { L: 17, M: 14, Q: 11, H: 7 });
});

test('payload of 10 bytes supports L/M/Q and skips H', () => {
  const report = capacityReport('google.com');
  eq(utf8ByteLength('google.com'), 10, 'byte length');
  deepEq(
    report.map((entry) => [entry.eccLevel, entry.supported]),
    [['L', true], ['M', true], ['Q', true], ['H', false]],
  );
  const { candidates, skipped } = generateAllCandidates({ payload: 'google.com' });
  eq(skipped.length, 1, 'one skipped level');
  eq(skipped[0].eccLevel, 'H', 'H skipped');
  eq(candidates.length, 24, '24 candidates');
  assert(!payloadFits('google.com', 'H'));
});

test('payload of 12 bytes supports L/M only', () => {
  const { candidates, skipped } = generateAllCandidates({ payload: 'x'.repeat(12) });
  eq(candidates.length, 16, '16 candidates');
  eq(skipped.map((s) => s.eccLevel).join(','), 'Q,H');
});

test('payload of 18 bytes supports no level', () => {
  const { candidates, skipped } = generateAllCandidates({ payload: 'x'.repeat(18) });
  eq(candidates.length, 0);
  eq(skipped.length, 4);
});

// ---------------------------------------------------------------------------
console.log('\nPenalties');
// ---------------------------------------------------------------------------

test('penalty breakdown total equals qrPenalty and matches corrected g.co values', () => {
  // A4.0 corrected these values: Rule 3 was dead code (boolean compared with `=== 0`) and
  // is now fixed. Similarity/decode are unaffected; only penalties and the standard-selected
  // mask change. See experiments/route-a/A4/BUG_AUDIT.md (A4-BUG-001).
  const reference = {
    L: [445, 361, 437, 333, 368, 403, 381, 484],
    M: [312, 396, 360, 485, 341, 348, 292, 565],
    Q: [287, 592, 341, 424, 568, 449, 348, 397],
    H: [413, 417, 306, 402, 640, 475, 370, 450],
  };
  const selected = { L: 3, M: 6, Q: 0, H: 2 };
  for (const [eccLevel, totals] of Object.entries(reference)) {
    let minMask = 0;
    let minPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const { matrix, penalties } = generateVersion1Qr({ payload: 'g.co', eccLevel, mask });
      eq(penalties.total, qrPenalty(matrix), `${eccLevel}/${mask} total`);
      eq(penalties.rule1 + penalties.rule2 + penalties.rule3 + penalties.rule4, penalties.total, 'sum');
      eq(penalties.total, totals[mask], `${eccLevel}/${mask} documented value`);
      if (penalties.total < minPenalty) { minPenalty = penalties.total; minMask = mask; }
    }
    eq(minMask, selected[eccLevel], `${eccLevel} standard-selected mask`);
  }
});

// ---------------------------------------------------------------------------
console.log('\nMetrics');
// ---------------------------------------------------------------------------

test('identical matrix scores 1.0, inverted scores 0.0', () => {
  const roleMap = [
    [QR_ROLE.DATA, QR_ROLE.ECC],
    [QR_ROLE.FINDER, QR_ROLE.SEPARATOR],
  ];
  const identical = [[true, true], [true, true]];
  const targetAllDark = [[1, 1], [1, 1]];
  const same = compareMatrixToTarget(identical, roleMap, targetAllDark);
  close(same.fullSimilarity, 1, 1e-9, 'full');
  close(same.mutableSimilarity, 1, 1e-9, 'mutable');
  close(same.theoreticalCeiling, 1, 1e-9, 'ceiling');

  const inverted = [[false, false], [false, false]];
  const off = compareMatrixToTarget(inverted, roleMap, targetAllDark);
  close(off.fullSimilarity, 0, 1e-9, 'full inverted');
  close(off.mutableSimilarity, 0, 1e-9, 'mutable inverted');
  close(off.fixedConflicts, 2, 1e-9, 'fixed conflicts');
  close(off.fixedConflictRatio, 1, 1e-9, 'conflict ratio');
  close(off.theoreticalCeiling, 0.5, 1e-9, 'ceiling with no fixed matches');
});

test('fixed conflicts and ceiling on a synthetic role map', () => {
  const roleMap = [
    [QR_ROLE.DATA, QR_ROLE.ECC],
    [QR_ROLE.FINDER, QR_ROLE.SEPARATOR],
  ];
  const matrix = [[true, true], [true, true]];
  const target = [[0, 0], [1, 1]]; // mutable want light, fixed want dark
  const result = compareMatrixToTarget(matrix, roleMap, target);
  close(result.fullSimilarity, 0.5, 1e-9, 'full');
  close(result.mutableSimilarity, 0, 1e-9, 'mutable');
  eq(result.fixedConflicts, 0);
  eq(result.fixedMatches, 2);
  close(result.theoreticalCeiling, 1, 1e-9, 'ceiling');
  close(result.ceilingGap, 0.5, 1e-9, 'gap');
});

test('real role map gives 208 mutable and 233 fixed modules', () => {
  const roleMap = buildVersion1RoleMap('M');
  const candidate = generateVersion1Qr({ payload: 'g.co', eccLevel: 'M', mask: 0 });
  const target = syntheticTarget('circle');
  const result = compareMatrixToTarget(candidate.matrix, roleMap, target);
  eq(result.mutableModuleCount, 208);
  eq(result.fixedModuleCount, 233);
  eq(result.totalModules, 441);
  assert(result.fullSimilarity >= 0 && result.fullSimilarity <= 1, 'full in range');
  assert(result.theoreticalCeiling >= result.fullSimilarity, 'ceiling >= measured');
});

// ---------------------------------------------------------------------------
console.log('\nTarget normalisation');
// ---------------------------------------------------------------------------

test('all-dark and all-light square images normalise exactly', () => {
  const dark = rgbaFrom(Array.from({ length: 21 }, () => Array(21).fill(1)));
  const light = rgbaFrom(Array.from({ length: 21 }, () => Array(21).fill(0)));
  const darkTarget = imageDataToTargetMatrix(dark);
  const lightTarget = imageDataToTargetMatrix(light);
  assert(darkTarget.every((row) => row.every((v) => v === 1)), 'all dark');
  assert(lightTarget.every((row) => row.every((v) => v === 0)), 'all light');
});

test('threshold splits at 128', () => {
  const below = rgbaFrom([[0]]);
  below.data[0] = below.data[1] = below.data[2] = 127;
  const above = rgbaFrom([[0]]);
  above.data[0] = above.data[1] = above.data[2] = 128;
  eq(imageDataToTargetMatrix(below, { size: 1 })[0][0], 1, '127 → dark');
  eq(imageDataToTargetMatrix(above, { size: 1 })[0][0], 0, '128 → light');
});

test('non-square images are centre-cropped, not stretched', () => {
  // 30 × 10, entirely black: crop to a centred 10 × 10 square, all dark.
  const data = new Uint8ClampedArray(30 * 10 * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = data[i + 1] = data[i + 2] = 0; data[i + 3] = 255; }
  const target = imageDataToTargetMatrix({ data, width: 30, height: 10 });
  assert(target.every((row) => row.every((v) => v === 1)), 'cropped region all dark');
});

test('every synthetic target is 21×21 binary', () => {
  for (const name of SYNTHETIC_TARGETS) {
    const target = syntheticTarget(name);
    eq(target.length, 21, `${name} rows`);
    assert(target.every((row) => row.length === 21), `${name} cols`);
    assert(target.every((row) => row.every((v) => v === 0 || v === 1)), `${name} binary`);
  }
});

// ---------------------------------------------------------------------------
console.log('\nRendering and export');
// ---------------------------------------------------------------------------

test('candidate raster has a 4-module quiet zone and integer module scale', () => {
  const { matrix } = generateVersion1Qr({ payload: 'g.co', eccLevel: 'Q', mask: 0 });
  const image = renderMatrixToImageData({ matrix, moduleScale: 12, quietZone: 4 });
  eq(image.width, (21 + 8) * 12, 'width');
  eq(image.height, (21 + 8) * 12, 'height');
  eq(image.data.length, image.width * image.height * 4, 'bytes');
  // Top-left pixel is in the quiet zone → white.
  eq(image.data[0], 255, 'quiet zone white');
  // The dark module at matrix (0,0) sits at pixel (4*12, 4*12).
  const index = ((4 * 12) * image.width + (4 * 12)) * 4;
  eq(image.data[index], 0, 'finder dark');
});

test('CSV escaping follows RFC 4180', () => {
  eq(csvCell('plain'), 'plain');
  eq(csvCell('a,b'), '"a,b"');
  eq(csvCell('say "hi"'), '"say ""hi"""');
  eq(csvCell('line\nbreak'), '"line\nbreak"');
  eq(csvCell(null), '');
});

test('CSV has one header and one row per candidate with required columns', () => {
  const { candidates } = generateAllCandidates({ payload: 'g.co' });
  for (const candidate of candidates) {
    candidate.metrics = compareMatrixToTarget(candidate.matrix, candidate.roleMap, syntheticTarget('circle'));
  }
  const csv = buildCsv({ runId: 'test', timestamp: '2026-01-01T00:00:00.000Z', targetName: 'circle', payload: 'g.co', candidates });
  const lines = csv.trim().split('\r\n');
  eq(lines.length, 33, 'header + 32 rows');
  assert(lines[0].startsWith('run_id,timestamp,target_name,payload'), 'header columns');
});

test('manifest records normalisation, payload, and every candidate', () => {
  const { candidates } = generateAllCandidates({ payload: 'g.co' });
  for (const candidate of candidates) {
    candidate.metrics = compareMatrixToTarget(candidate.matrix, candidate.roleMap, syntheticTarget('circle'));
  }
  const manifest = buildManifest({
    runId: 'test', timestamp: '2026-01-01T00:00:00.000Z', payload: 'g.co', targetName: 'circle',
    targetMeta: { size: 21 },
    candidates,
    moduleScale: 12,
    quietZone: 4,
  });
  eq(manifest.experiment, 'A1');
  eq(manifest.qr_version, 1);
  eq(manifest.payload, 'g.co');
  eq(manifest.payload_utf8_bytes, 4);
  eq(manifest.candidates.length, 32);
  eq(manifest.success_definition, 'decoded payload === expected payload');
});

test('formatSimilarity renders 4 decimals and a percentage', () => {
  eq(formatSimilarity(0.6825), '0.6825 (68.25%)');
});

// ---------------------------------------------------------------------------
console.log('\njsQR round trip (optional)');
// ---------------------------------------------------------------------------

await asyncTest('all 32 default candidates decode exactly with jsQR', async () => {
  const jsqrPath = process.env.A1_JSQR_PATH;
  if (!jsqrPath) {
    console.log('       skipped — set A1_JSQR_PATH to a local jsQR 1.4.0 copy to enable');
    return;
  }
  const require = createRequire(import.meta.url);
  const jsQR = require(path.resolve(jsqrPath));
  const decode = jsQrDecoder(jsQR);
  const { candidates } = generateAllCandidates({ payload: 'g.co' });
  let decoded = 0;
  const failuresList = [];
  for (const candidate of candidates) {
    const image = renderMatrixToImageData({ matrix: candidate.matrix, moduleScale: 12, quietZone: 4 });
    const value = decode(image);
    if (value === 'g.co') decoded++;
    else failuresList.push(`${candidate.candidateId}→${JSON.stringify(value)}`);
  }
  eq(decoded, 32, `decoded ${decoded}/32; failures: ${failuresList.join(', ')}`);
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const { name, error } of failures) console.log(`  - ${name}: ${error.message}`);
  process.exitCode = 1;
}
