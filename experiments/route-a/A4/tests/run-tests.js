/**
 * Experiment A4 tests — A4.0 correctness audits (and, further down, A4 corpus /
 * operating-point / physical-recorder tests).
 *
 * Run with `node tests/run-tests.js` (set A1_JSQR_PATH for the optional jsQR checks).
 *
 * The audit section deliberately tries to break the foundations inherited from A1–A3:
 * penalty rules, role map, format information, codeword mapping, and quiet zone. Findings
 * are recorded in ../BUG_AUDIT.md.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// A1 foundations (classic scripts).
import '../../A1/js/qr-role-map.js';
import '../../A1/js/qr-experiment.js';
import '../../A1/js/metrics.js';
import '../../A1/js/target-grid.js';
import '../../A1/js/export-results.js';
import '../../A1/js/experiment-runner.js';
import '../../A2/js/modification-strategy.js';
import '../../A2/js/metrics-a2.js';
import '../../A3/js/codeword-optimizer.js';
import '../../A3/js/metrics-a3.js';
// A4 helpers.
import '../js/hash.js';
import '../js/target-corpus.js';
import '../js/operating-points.js';
import '../js/generalization-runner.js';
import '../js/physical-session.js';
import '../js/analysis.js';
import '../js/export-results.js';
import { decodePng } from '../../A3/tests/png-read.js';

const A1 = globalThis.StegoA1;
const A2 = globalThis.StegoA2;
const A3 = globalThis.StegoA3;
const A4 = globalThis.StegoA4;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (error) { failed++; failures.push({ name, error }); console.log(`  FAIL ${name}\n       ${error.message}`); }
}
function assert(cond, message = 'assertion failed') { if (!cond) throw new Error(message); }
function eq(a, b, message = '') { if (a !== b) throw new Error(`${message ? message + ': ' : ''}expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function close(a, b, eps = 1e-9, message = '') { if (Math.abs(a - b) > eps) throw new Error(`${message ? message + ': ' : ''}expected ≈${b}, got ${a}`); }

const emptyMatrix = () => Array.from({ length: 21 }, () => Array(21).fill(false));
function withRow(row, values) {
  const m = emptyMatrix();
  values.forEach((v, c) => { m[row][c] = Boolean(v); });
  return m;
}
function gf2Remainder(value, generator) {
  let v = value;
  const genDegree = Math.floor(Math.log2(generator));
  while (v !== 0 && Math.floor(Math.log2(v)) >= genDegree) v ^= generator << (Math.floor(Math.log2(v)) - genDegree);
  return v;
}

// ---------------------------------------------------------------------------
console.log('\nA4.0 — SHA-256');
// ---------------------------------------------------------------------------
test('sha256 matches known vectors', () => {
  eq(A4.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  eq(A4.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
test('matrixHash is stable and order-sensitive', () => {
  const a = [[1, 0], [0, 1]];
  const b = [[1, 0], [1, 0]];
  eq(A4.matrixHash(a), A4.matrixHash(a), 'stable');
  assert(A4.matrixHash(a) !== A4.matrixHash(b), 'different matrices differ');
});

// ---------------------------------------------------------------------------
console.log('\nA4.0 — QR penalty rules');
// ---------------------------------------------------------------------------
test('rule 1 fires on a long same-colour run', () => {
  // A single-row matrix isolates the row-line rule contribution.
  eq(A1.qrPenaltyBreakdown([Array(21).fill(true)]).rule1, 19, '21-module run → 3 + (21-5) = 19');
  const alternating = Array.from({ length: 21 }, (_, i) => i % 2 === 0);
  eq(A1.qrPenaltyBreakdown([alternating]).rule1, 0, 'no run ≥5 → 0');
  const sixRun = [true, true, true, true, true, true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false];
  eq(A1.qrPenaltyBreakdown([sixRun]).rule1, 4, '6-module run → 3 + 1 = 4');
});

test('rule 2 fires on 2×2 same-colour blocks', () => {
  eq(A1.qrPenaltyBreakdown([[true, true], [true, true]]).rule2, 3, 'one block → 3');
  const three = [[true, true, true], [true, true, true], [true, true, true]];
  eq(A1.qrPenaltyBreakdown(three).rule2, 12, '3×3 → four blocks → 12');
});

test('rule 3 fires on a finder-like pattern with four light modules after', () => {
  const base = A1.qrPenaltyBreakdown(emptyMatrix());
  const m = withRow(0, [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0]); // 1011101 + 0000
  eq(A1.qrPenaltyBreakdown(m).rule3 - base.rule3, 40, 'qualifying pattern → 40');
});

test('rule 3 fires on a finder-like pattern with four light modules before', () => {
  const base = A1.qrPenaltyBreakdown(emptyMatrix());
  const m = withRow(0, [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1]); // 0000 + 1011101
  eq(A1.qrPenaltyBreakdown(m).rule3 - base.rule3, 40, 'before-side qualifying pattern → 40');
});

test('rule 3 is zero without light context', () => {
  const base = A1.qrPenaltyBreakdown(emptyMatrix());
  const m = withRow(0, [1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1]); // 1011101 but no 4 light
  eq(A1.qrPenaltyBreakdown(m).rule3 - base.rule3, 0, 'no qualifying context → 0');
});

test('rule 3 detects the pattern in a column too', () => {
  const base = A1.qrPenaltyBreakdown(emptyMatrix());
  const m = emptyMatrix();
  [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0].forEach((v, r) => { m[r][0] = Boolean(v); });
  eq(A1.qrPenaltyBreakdown(m).rule3 - base.rule3, 40, 'column pattern → 40');
});

test('rule 4 reflects dark-module balance', () => {
  eq(A1.qrPenaltyBreakdown(emptyMatrix()).rule4, 100, '0% dark → 100');
  eq(A1.qrPenaltyBreakdown(Array.from({ length: 21 }, () => Array(21).fill(true))).rule4, 100, '100% dark → 100');
  const balanced = emptyMatrix();
  let filled = 0;
  for (let r = 0; r < 21 && filled < 220; r++) for (let c = 0; c < 21 && filled < 220; c++) { balanced[r][c] = true; filled++; }
  eq(A1.qrPenaltyBreakdown(balanced).rule4, 0, '≈50% dark → 0');
});

// ---------------------------------------------------------------------------
console.log('\nA4.0 — role map');
// ---------------------------------------------------------------------------
test('every module has exactly one role and totals are correct', () => {
  for (const level of ['L', 'M', 'Q', 'H']) {
    const roleMap = A1.buildVersion1RoleMap(level);
    eq(roleMap.length, 21);
    let total = 0;
    let functionModules = 0;
    let mutableModules = 0;
    for (const row of roleMap) for (const role of row) {
      assert(typeof role === 'string' && role.length > 0, 'role defined');
      total++;
      if (A1.IMMUTABLE_ROLES.includes(role)) functionModules++;
      else if (A1.MUTABLE_ROLES.includes(role)) mutableModules++;
      else throw new Error(`unknown role ${role}`);
    }
    eq(total, 441, `${level} total`);
    eq(functionModules + mutableModules, 441, `${level} function + mutable`);
    eq(functionModules, 233, `${level} immutable`);
    eq(mutableModules, 208, `${level} mutable`);
  }
});

// ---------------------------------------------------------------------------
console.log('\nA4.0 — format information');
// ---------------------------------------------------------------------------
test('all 32 format codewords are distinct, BCH-valid, and decode correctly', () => {
  const eccBits = { L: 1, M: 0, Q: 3, H: 2 };
  const seen = new Set();
  for (const level of ['L', 'M', 'Q', 'H']) {
    for (let mask = 0; mask < 8; mask++) {
      const encoded = A1.qrBchFormat((eccBits[level] << 3) | mask);
      const unmasked = encoded ^ 0x5412;
      eq(unmasked >>> 10, (eccBits[level] << 3) | mask, `${level}/${mask} value`);
      eq(gf2Remainder(unmasked, 0x537), 0, `${level}/${mask} BCH`);
      assert(!seen.has(encoded), `${level}/${mask} distinct`);
      seen.add(encoded);
    }
  }
  eq(seen.size, 32, 'all 32 distinct');
});

test('format bits placed in both copies agree with ECC/mask', () => {
  const eccBits = { L: 1, M: 0, Q: 3, H: 2 };
  for (const level of ['L', 'M', 'Q', 'H']) {
    for (const mask of [0, 3, 7]) {
      const { matrix } = A1.generateVersion1Qr({ payload: 'g.co', eccLevel: level, mask });
      const read = (positions) => positions.reduce((v, [r, c], i) => v | ((matrix[r][c] ? 1 : 0) << i), 0);
      const copy1 = read([[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]]);
      const copy2 = read([[8, 20], [8, 19], [8, 18], [8, 17], [8, 16], [8, 15], [8, 14], [8, 13], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]]);
      eq(copy1, copy2, `${level}/${mask} copies agree`);
      eq((copy1 ^ 0x5412) >>> 10, (eccBits[level] << 3) | mask, `${level}/${mask} decodes`);
    }
  }
});

// ---------------------------------------------------------------------------
console.log('\nA4.0 — codeword mapping');
// ---------------------------------------------------------------------------
test('data-module order covers every mutable bit exactly once', () => {
  const order = A1.version1DataModuleOrder();
  eq(order.length, 208);
  const seen = new Set(order.map(([r, c]) => `${r},${c}`));
  eq(seen.size, 208, 'unique positions');
  for (const level of ['L', 'M', 'Q', 'H']) {
    const roleMap = A1.buildVersion1RoleMap(level);
    for (const [r, c] of order) {
      assert(A1.isMutableRole(roleMap[r][c]), 'order contains only mutable modules');
    }
  }
});

test('codeword boundaries and DATA/ECC split are correct per level', () => {
  const order = A1.version1DataModuleOrder();
  for (const level of ['L', 'M', 'Q', 'H']) {
    const roleMap = A1.buildVersion1RoleMap(level);
    const dataBits = (26 - A1.QR_V1_ECC_CODEWORDS[level]) * 8;
    order.forEach(([r, c], i) => {
      const expectedType = i < dataBits ? 'DATA' : 'ECC';
      eq(roleMap[r][c], expectedType, `${level} bit ${i} type`);
    });
  }
});

// ---------------------------------------------------------------------------
console.log('\nA4.0 — quiet zone / rendering');
// ---------------------------------------------------------------------------
test('renderer adds a four-module quiet zone and integer module scale', () => {
  const { matrix } = A1.generateVersion1Qr({ payload: 'g.co', eccLevel: 'Q', mask: 0 });
  for (const scale of [4, 12]) {
    const image = A1.renderMatrixToImageData({ matrix, moduleScale: scale, quietZone: 4 });
    eq(image.width, (21 + 8) * scale, `scale ${scale} width`);
    eq(image.height, (21 + 8) * scale, `scale ${scale} height`);
    // Entire 4-module border must be white.
    for (let i = 0; i < image.width; i++) {
      for (const y of [0, image.height - 1]) {
        const idx = (y * image.width + i) * 4;
        eq(image.data[idx], 255, `top/bottom border white at ${i},${y}`);
      }
    }
  }
});

// ---------------------------------------------------------------------------
console.log('\nA4.0 — CSV / JSON integrity');
// ---------------------------------------------------------------------------
test('CSV escaping handles commas, quotes, newlines and non-ASCII', () => {
  const cell = A1.csvCell;
  eq(cell('a,b'), '"a,b"');
  eq(cell('say "hi"'), '"say ""hi"""');
  eq(cell('line\nbreak'), '"line\nbreak"');
  eq(cell('café-日本'), 'café-日本');
});

test('utf8 byte length is not character count', () => {
  eq(A1.utf8ByteLength('a'), 1);
  eq(A1.utf8ByteLength('g.co'), 4);
  eq(A1.utf8ByteLength('é'), 2);
  eq(A1.utf8ByteLength('日本'), 6);
});

// ---------------------------------------------------------------------------
console.log('\nA4.1 — target corpus');
// ---------------------------------------------------------------------------
test('corpus has 8 unique 21×21 binary targets', () => {
  eq(A4.TARGETS.length, 8);
  eq(new Set(A4.TARGETS.map((t) => t.id)).size, 8);
  for (const target of A4.TARGETS) {
    eq(target.matrix.length, 21, `${target.id} rows`);
    assert(target.matrix.every((row) => row.length === 21 && row.every((v) => v === 0 || v === 1)), `${target.id} binary`);
  }
});

test('fixture PNGs normalise back to the canonical matrix', () => {
  for (const target of A4.TARGETS) {
    const file = path.resolve(__dirname, '..', 'targets', `${target.id}_${target.name}.png`);
    if (!fs.existsSync(file)) continue; // fixtures are written by run-generalization.js
    const { width, height, rgba } = decodePng(fs.readFileSync(file));
    const normalised = A1.imageDataToTargetMatrix({ data: rgba, width, height }, { size: 21 });
    eq(JSON.stringify(normalised), JSON.stringify(target.matrix), `${target.id} round-trip`);
  }
});

test('matrix hashes are stable', () => {
  for (const target of A4.TARGETS) {
    eq(A4.matrixHash(target.matrix), A4.matrixHash(target.matrix));
  }
});

// ---------------------------------------------------------------------------
console.log('\nA4.1 — payloads');
// ---------------------------------------------------------------------------
test('benchmark payloads are 1/4/7 bytes and fit every ECC level', () => {
  eq(A1.utf8ByteLength('a'), 1);
  eq(A1.utf8ByteLength('g.co'), 4);
  eq(A1.utf8ByteLength('abcdefg'), 7);
  for (const payload of ['a', 'g.co', 'abcdefg']) {
    for (const ecc of ['L', 'M', 'Q', 'H']) assert(A1.payloadFits(payload, ecc), `${payload}/${ecc}`);
  }
});

test('non-ASCII payload byte length and capacity boundaries', () => {
  eq(A1.utf8ByteLength('é'), 2);
  assert(A1.payloadFits('é', 'H'));
  assert(A1.payloadFits('x'.repeat(7), 'H'));
  assert(!A1.payloadFits('x'.repeat(8), 'H'));
  assert(A1.payloadFits('x'.repeat(17), 'L'));
  assert(!A1.payloadFits('x'.repeat(18), 'L'));
});

// ---------------------------------------------------------------------------
console.log('\nA4.1 — operating points');
// ---------------------------------------------------------------------------
function eligibleWithCounts(counts) {
  const eligible = [];
  counts.forEach((count, cw) => {
    for (let i = 0; i < count; i++) eligible.push({ row: 0, column: 0, role: 'DATA', codewordIndex: cw, codewordType: 'DATA', bitWithinCodeword: i });
  });
  return eligible;
}

test('packability reports the densest-codeword fraction', () => {
  const pack = A4.packability(eligibleWithCounts([6, 5, 2, 1]), 2);
  eq(pack.eligibleCount, 14);
  eq(pack.codewordCount, 4);
  close(pack.topNCodewordMismatchFraction, 11 / 14, 1e-9);
});

test('pickCleanMax chooses the highest both-exact budget', () => {
  const candidates = [
    { moduleBudget: 4, jsqrDecodeStatus: 'EXACT', opencvDecodeStatus: 'EXACT' },
    { moduleBudget: 8, jsqrDecodeStatus: 'EXACT', opencvDecodeStatus: 'EXACT' },
    { moduleBudget: 12, jsqrDecodeStatus: 'EXACT', opencvDecodeStatus: 'NO_DETECTION' },
  ];
  eq(A4.pickCleanMax(candidates).moduleBudget, 8);
});

test('pickRobust follows the predefined relative criterion', () => {
  // baseline rate 0.8 -> threshold 0.76
  const candidates = [
    { moduleBudget: 4, jsqrDecodeStatus: 'EXACT', bothExactRate: 0.8 },
    { moduleBudget: 8, jsqrDecodeStatus: 'EXACT', bothExactRate: 0.9 },
    { moduleBudget: 12, jsqrDecodeStatus: 'EXACT', bothExactRate: 0.5 },
  ];
  eq(A4.pickRobust(candidates, 0.8).moduleBudget, 8);
  eq(A4.pickRobust([], 0.8), null);
});

test('generateConfig produces an A1 base and packed candidates', () => {
  const target = A4.TARGETS.find((t) => t.id === 'T01');
  const config = A4.generateConfig({ target: target.matrix, targetId: 'T01', targetMeta: target, payload: 'g.co', eccLevel: 'H' });
  assert(config && config.base && config.a3Candidates.length > 0, 'config produced');
  eq(config.a3Candidates[0].strategy, 'A3_PACKED');
  // function modules untouched in the largest candidate
  const last = config.a3Candidates[config.a3Candidates.length - 1];
  const roleMap = A1.buildVersion1RoleMap('H');
  for (let r = 0; r < 21; r++) for (let c = 0; c < 21; c++) {
    if (A1.IMMUTABLE_ROLES.includes(roleMap[r][c])) eq(last.matrix[r][c], config.base.matrix[r][c], `immutable (${r},${c})`);
  }
});

// ---------------------------------------------------------------------------
console.log('\nA4.2 — physical session model');
// ---------------------------------------------------------------------------
test('trial validation enforces the exact-payload rule', () => {
  eq(A4.validateTrial({ candidate_id: 'c', payload: 'g.co', decode_status: 'EXACT', decoded_payload: 'g.co', attempt: '1' }).ok, true);
  eq(A4.validateTrial({ candidate_id: 'c', payload: 'g.co', decode_status: 'EXACT', decoded_payload: 'nope', attempt: '1' }).ok, false);
  eq(A4.validateTrial({ candidate_id: 'c', payload: 'g.co', decode_status: 'NO_DETECTION', attempt: '1' }).ok, true);
  eq(A4.validateTrial({ candidate_id: 'c', payload: 'g.co', decode_status: 'EXACT', decoded_payload: 'g.co', attempt: '0' }).ok, false);
});

test('addTrial rejects invalid trials and stores valid ones', () => {
  const session = A4.createSession('test');
  let threw = false;
  try { A4.addTrial(session, { candidate_id: 'c', payload: 'g.co', decode_status: 'EXACT', decoded_payload: 'bad', attempt: '1' }); } catch (e) { threw = true; }
  assert(threw, 'invalid trial rejected');
  A4.addTrial(session, { candidate_id: 'c', payload: 'g.co', decode_status: 'EXACT', decoded_payload: 'g.co', attempt: '1' });
  eq(session.trials.length, 1);
});

test('wilson95 stays within bounds and matches the all-success case', () => {
  const interval = A4.wilson95(5, 5);
  assert(interval.low > 0.5 && interval.high === 1, JSON.stringify(interval));
  eq(A4.wilson95(0, 0).low, null);
});

test('physical session CSV round-trips quotes, commas, and non-ASCII', () => {
  const session = A4.createSession('s1');
  A4.addTrial(session, { candidate_id: 'c1', payload: 'é', decode_status: 'EXACT', decoded_payload: 'é', attempt: '1', notes: 'bright, "edge"' });
  const csv = A4.toCsv(session);
  const back = A4.fromCsv(csv, 's1');
  eq(back.trials.length, 1);
  eq(back.trials[0].payload, 'é');
  eq(back.trials[0].notes, 'bright, "edge"');
});

test('summarizeTrials reports counts, rates, and Wilson interval', () => {
  const session = A4.createSession('s');
  for (let i = 1; i <= 5; i++) {
    A4.addTrial(session, { candidate_id: 'c', medium: 'print', device: 'PHONE_A', symbol_size: '40mm', angle_deg: '0', lighting: 'normal indoor', payload: 'g.co', attempt: String(i), decode_status: i <= 4 ? 'EXACT' : 'NO_DETECTION', decoded_payload: i <= 4 ? 'g.co' : '' });
  }
  const rows = A4.summarizeTrials(session.trials);
  eq(rows.length, 1);
  eq(rows[0].attemptCount, 5);
  eq(rows[0].exactCount, 4);
  close(rows[0].exactRate, 0.8, 1e-9);
  assert(rows[0].wilsonLow > 0 && rows[0].wilsonHigh <= 1);
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const { name, error } of failures) console.log(`  - ${name}: ${error.message}`);
  process.exitCode = 1;
}
