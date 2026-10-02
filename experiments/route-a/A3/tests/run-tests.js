/**
 * Experiment A3 tests. Dependency-free; run with `node tests/run-tests.js`.
 *
 * Verifies the optimizer invariants the specification makes central: eligibility
 * preservation, function-module immutability, exact module budgets, the similarity
 * invariant (gain = B/441), minimal-codeword packing (including partial-codeword
 * selection), codeword-budget mode, determinism, and the matched-budget A2/A3 similarity
 * equality.
 *
 * Reuses A1 and A2 modules (imported for their side effects); A3 does not re-implement QR
 * generation, target normalisation, metrics, or the A2 baseline.
 *
 * jsQR round trip: set A1_JSQR_PATH to a local jsQR 1.4.0 copy to enable decode checks.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import '../../A1/js/qr-role-map.js';
import '../../A1/js/qr-experiment.js';
import '../../A1/js/metrics.js';
import '../../A1/js/target-grid.js';
import '../../A1/js/export-results.js';
import '../../A1/js/experiment-runner.js';

import '../../A2/js/modification-strategy.js';
import '../../A2/js/metrics-a2.js';
import '../../A2/js/experiment-runner.js';

import '../js/codeword-optimizer.js';
import '../js/metrics-a3.js';
import '../js/strategy-comparison.js';
import '../js/robustness-summary.js';
import '../js/experiment-runner.js';
import '../js/export-results.js';

const A1 = globalThis.StegoA1;
const A2 = globalThis.StegoA2;
const A3 = globalThis.StegoA3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (error) { failed++; failures.push({ name, error }); console.log(`  FAIL ${name}\n       ${error.message}`); }
}
async function asyncTest(name, fn) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (error) { failed++; failures.push({ name, error }); console.log(`  FAIL ${name}\n       ${error.message}`); }
}
function assert(cond, message = 'assertion failed') { if (!cond) throw new Error(message); }
function eq(a, b, message = '') { if (a !== b) throw new Error(`${message ? message + ': ' : ''}expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function close(a, b, epsilon = 1e-9, message = '') { if (Math.abs(a - b) > epsilon) throw new Error(`${message ? message + ': ' : ''}expected ≈${b}, got ${a}`); }

const PAYLOAD = 'g.co';
const TARGET = A1.syntheticTarget('circle');
const IMMUTABLE = ['FINDER', 'SEPARATOR', 'TIMING', 'FORMAT', 'DARK_MODULE'];

function autoBase() { return A2.selectBases({ payload: PAYLOAD, target: TARGET, mode: 'auto' }).bases[0]; }

/** Synthetic eligible list: `spec[i]` mismatches in codeword i, spread over unique cells. */
function synthEligible(spec) {
  const eligible = [];
  let row = 0;
  let column = 0;
  spec.forEach((count, codewordIndex) => {
    for (let i = 0; i < count; i++) {
      eligible.push({
        row, column, originalValue: 0, targetValue: 1, role: 'DATA',
        bitIndex: codewordIndex * 8 + i, codewordIndex, bitWithinCodeword: i, codewordType: 'DATA',
      });
      column++;
      if (column > 20) { column = 0; row++; }
    }
  });
  return eligible;
}
const emptyMatrix = () => Array.from({ length: 21 }, () => Array(21).fill(false));

// ---------------------------------------------------------------------------
console.log('\nPacking (STRATEGY A)');
// ---------------------------------------------------------------------------

test('packing fixture: 6+5+2 mismatches at budget 10 uses 2 codewords', () => {
  const eligible = synthEligible([6, 5, 2, 0, 0, 0]);
  const result = A3.packForModuleBudget({ baseMatrix: emptyMatrix(), target: emptyMatrix(), eligible, budget: 10 });
  eq(result.changed.length, 10, 'exactly 10 modules modified');
  eq(result.affectedCodewordIndices.length, 2, 'two distinct codewords');
  eq(result.affectedCodewordIndices.join(','), '0,1', 'the two densest codewords');
});

test('packing is optimal: minimum codewords for the budget', () => {
  // Counts sum: 6, then 11, then 13. Budget 10 -> need 2 codewords, not 3.
  const eligible = synthEligible([6, 5, 2]);
  for (const [budget, expected] of [[6, 1], [7, 2], [10, 2], [11, 2], [13, 3]]) {
    const result = A3.packForModuleBudget({ baseMatrix: emptyMatrix(), target: emptyMatrix(), eligible, budget });
    eq(result.changed.length, budget, `modified count at budget ${budget}`);
    eq(result.affectedCodewordIndices.length, expected, `codeword count at budget ${budget}`);
  }
});

test('partial final codeword selects exactly the remaining modules', () => {
  const eligible = synthEligible([6, 5]);
  const result = A3.packForModuleBudget({ baseMatrix: emptyMatrix(), target: emptyMatrix(), eligible, budget: 9 });
  eq(result.changed.length, 9, 'nine modules');
  eq(result.affectedCodewordIndices.length, 2, 'two codewords');
  const fromSecond = result.changed.filter((p) => p.codewordIndex === 1).length;
  eq(fromSecond, 3, 'three taken from the second codeword');
});

test('partial-codeword subset is deterministic', () => {
  const eligible = synthEligible([6, 5]);
  const a = A3.packForModuleBudget({ baseMatrix: emptyMatrix(), target: emptyMatrix(), eligible, budget: 9 });
  const b = A3.packForModuleBudget({ baseMatrix: emptyMatrix(), target: emptyMatrix(), eligible, budget: 9 });
  eq(JSON.stringify(a.changed), JSON.stringify(b.changed), 'same subset every time');
});

test('deterministic tie-break uses codeword index', () => {
  const eligible = synthEligible([4, 4, 4]);
  const result = A3.packForModuleBudget({ baseMatrix: emptyMatrix(), target: emptyMatrix(), eligible, budget: 4 });
  eq(result.affectedCodewordIndices.join(','), '0', 'lowest index among equal densities');
});

// ---------------------------------------------------------------------------
console.log('\nCodeword budget (STRATEGY B)');
// ---------------------------------------------------------------------------

test('codeword-budget fixture: K=2 picks the two densest codewords', () => {
  const eligible = synthEligible([7, 5, 3, 1]);
  const result = A3.applyCodewordBudget({ baseMatrix: emptyMatrix(), target: emptyMatrix(), eligible, codewordBudget: 2 });
  eq(result.affectedCodewordIndices.join(','), '0,1', 'CW0 + CW1');
  eq(result.changed.length, 12, '7 + 5 modifications');
});

test('codeword-budget K=0 modifies nothing; K=max modifies all', () => {
  const eligible = synthEligible([7, 5, 3, 1]);
  eq(A3.applyCodewordBudget({ baseMatrix: emptyMatrix(), target: emptyMatrix(), eligible, codewordBudget: 0 }).changed.length, 0);
  const all = A3.applyCodewordBudget({ baseMatrix: emptyMatrix(), target: emptyMatrix(), eligible, codewordBudget: A3.maxCodewordBudget(eligible) });
  eq(all.changed.length, 16, 'all mismatches');
  eq(all.affectedCodewordIndices.length, 4, 'all codewords');
});

// ---------------------------------------------------------------------------
console.log('\nReal-base invariants');
// ---------------------------------------------------------------------------

test('A3 modifies only eligible target mismatches', () => {
  const entry = autoBase();
  const info = A2.codewordMapFor(entry.candidate.eccLevel);
  const eligible = A2.buildEligiblePositions(entry.candidate.matrix, entry.candidate.roleMap, TARGET, info);
  const result = A3.packForModuleBudget({ baseMatrix: entry.candidate.matrix, target: TARGET, eligible, budget: 20 });
  for (const position of result.changed) {
    assert(!IMMUTABLE.includes(position.role), 'must not be a function module');
    assert((entry.candidate.matrix[position.row][position.column] ? 1 : 0) !== position.targetValue, 'was a mismatch');
    eq(result.matrix[position.row][position.column] ? 1 : 0, position.targetValue, 'now equals target');
  }
});

test('A3 never changes function modules', () => {
  const entry = autoBase();
  const info = A2.codewordMapFor(entry.candidate.eccLevel);
  const eligible = A2.buildEligiblePositions(entry.candidate.matrix, entry.candidate.roleMap, TARGET, info);
  const result = A3.packForModuleBudget({ baseMatrix: entry.candidate.matrix, target: TARGET, eligible, budget: eligible.length });
  for (let row = 0; row < 21; row++) {
    for (let column = 0; column < 21; column++) {
      if (IMMUTABLE.includes(entry.candidate.roleMap[row][column])) {
        eq(result.matrix[row][column], entry.candidate.matrix[row][column], `immutable (${row},${column})`);
      }
    }
  }
});

test('exact module budget and similarity invariant (gain = B/441)', () => {
  const entry = autoBase();
  const info = A2.codewordMapFor(entry.candidate.eccLevel);
  const eligible = A2.buildEligiblePositions(entry.candidate.matrix, entry.candidate.roleMap, TARGET, info);
  const before = A1.compareMatrixToTarget(entry.candidate.matrix, entry.candidate.roleMap, TARGET);
  for (const budget of [1, 4, 8, 12, 16]) {
    const result = A3.packForModuleBudget({ baseMatrix: entry.candidate.matrix, target: TARGET, eligible, budget });
    eq(result.changed.length, budget, `exact budget ${budget}`);
    const after = A1.compareMatrixToTarget(result.matrix, entry.candidate.roleMap, TARGET);
    close(after.fullSimilarity - before.fullSimilarity, budget / 441, 1e-12, `gain at budget ${budget}`);
  }
});

test('A3 is deterministic', () => {
  const entry = autoBase();
  const info = A2.codewordMapFor(entry.candidate.eccLevel);
  const eligible = A2.buildEligiblePositions(entry.candidate.matrix, entry.candidate.roleMap, TARGET, info);
  const a = A3.packForModuleBudget({ baseMatrix: entry.candidate.matrix, target: TARGET, eligible, budget: 15 });
  const b = A3.packForModuleBudget({ baseMatrix: entry.candidate.matrix, target: TARGET, eligible, budget: 15 });
  eq(JSON.stringify(a.matrix), JSON.stringify(b.matrix), 'same matrix every run');
});

test('matched A2/A3 budgets have identical similarity', () => {
  const entry = autoBase();
  const info = A2.codewordMapFor(entry.candidate.eccLevel);
  const eligible = A2.buildEligiblePositions(entry.candidate.matrix, entry.candidate.roleMap, TARGET, info);
  const ordered = A2.seededShuffle(eligible, 42);
  for (const budget of [4, 8, 12, 16]) {
    const a2 = A2.applyBudget(entry.candidate.matrix, ordered, budget, TARGET);
    const a3 = A3.packForModuleBudget({ baseMatrix: entry.candidate.matrix, target: TARGET, eligible, budget });
    const s2 = A1.compareMatrixToTarget(a2.matrix, entry.candidate.roleMap, TARGET).fullSimilarity;
    const s3 = A1.compareMatrixToTarget(a3.matrix, entry.candidate.roleMap, TARGET).fullSimilarity;
    close(s2, s3, 1e-12, `similarity at budget ${budget}`);
  }
});

test('A3 concentrates more than A2 at the same budget', () => {
  const entry = autoBase();
  const info = A2.codewordMapFor(entry.candidate.eccLevel);
  const eligible = A2.buildEligiblePositions(entry.candidate.matrix, entry.candidate.roleMap, TARGET, info);
  const a2 = A2.applyBudget(entry.candidate.matrix, A2.seededShuffle(eligible, 42), 12, TARGET);
  const a3 = A3.packForModuleBudget({ baseMatrix: entry.candidate.matrix, target: TARGET, eligible, budget: 12 });
  const a2Count = A3.codewordDamage(a2.changed).affectedCodewordCount;
  const a3Count = A3.codewordDamage(a3.changed).affectedCodewordCount;
  assert(a3Count <= a2Count, `A3 (${a3Count}) must not exceed A2 (${a2Count})`);
});

// ---------------------------------------------------------------------------
console.log('\nCodeword damage metrics');
// ---------------------------------------------------------------------------

test('codewordDamage reports flips, types, and packing efficiency', () => {
  const damage = A3.codewordDamage([
    { codewordIndex: 0, codewordType: 'DATA' },
    { codewordIndex: 0, codewordType: 'DATA' },
    { codewordIndex: 0, codewordType: 'DATA' },
    { codewordIndex: 2, codewordType: 'ECC' },
    { codewordIndex: 5, codewordType: 'DATA' },
  ]);
  eq(damage.affectedCodewordCount, 3);
  eq(damage.maxFlipsInSingleCodeword, 3);
  eq(damage.affectedDataCodewords, 2);
  eq(damage.affectedEccCodewords, 1);
  close(damage.packingEfficiency, 5 / 3, 1e-9);
  close(damage.meanFlipsPerAffectedCodeword, 5 / 3, 1e-9);
  eq(damage.flipsPerCodeword[0], 3);
});

// ---------------------------------------------------------------------------
console.log('\nRunner and exports');
// ---------------------------------------------------------------------------

const perfectDecode = () => PAYLOAD;
let smallRunPromise = null;
function smallRun() {
  if (!smallRunPromise) {
    smallRunPromise = A3.runA3Clean({
      payload: PAYLOAD, target: TARGET, seeds: [42, 43],
      budgetSchedule: [0, 1, 2, 4, 8, 12], decode: perfectDecode,
    });
  }
  return smallRunPromise;
}

await asyncTest('runner produces A2 and A3 candidates at matched budgets', async () => {
  const run = await smallRun();
  const base = run.bases[0];
  eq(run.a3Results.length, base.budgets.length, 'one A3 candidate per budget');
  eq(run.a2Results.length, base.budgets.length * 2, 'A2 candidates = budgets × seeds');
  assert(run.codewordBudgetResults.length > 0, 'codeword-budget sweep present');
  const a3 = run.a3Results.find((c) => c.moduleBudget === 12);
  const a2 = run.a2Results.find((c) => c.moduleBudget === 12 && c.seed === 42);
  close(a3.fullSimilarityAfter, a2.fullSimilarityAfter, 1e-12, 'matched similarity');
  assert(a3.affectedCodewordCount <= a3.actualModifiedModules, 'codewords <= modules');
});

await asyncTest('strategy comparison and boundary helpers work on the run', async () => {
  const run = await smallRun();
  const rows = A3.compareStrategies(run.a2Results, run.a3Results);
  assert(rows.length > 0, 'comparison rows');
  for (const row of rows) assert(row.a3AffectedCodewords !== null, 'a3 codeword count present');
  const boundary = A3.boundaryObservations(run.cleanResults);
  assert(boundary.largestJsqrExactBudget !== null, 'jsQR boundary computed');
});

await asyncTest('clean_results.csv and strategy_comparison.csv have expected shapes', async () => {
  const run = await smallRun();
  const clean = A3.buildCleanCsv({ run, targetName: 'synthetic-circle' });
  eq(clean.trim().split('\r\n').length, run.cleanResults.length + 1, 'clean rows');
  const comparison = A3.buildStrategyComparisonCsv(A3.compareStrategies(run.a2Results, run.a3Results));
  assert(comparison.startsWith('base_ecc,base_mask,module_budget'), 'comparison header');
  const cw = A3.buildCodewordBudgetCsv(run.codewordBudgetResults);
  assert(cw.startsWith('base_ecc,base_mask,codeword_budget'), 'codeword-budget header');
});

test('robustness aggregation reports counts and per-family rates', () => {
  const cases = [
    { candidateId: 'c', strategy: 'A3_PACKED', moduleBudget: 8, similarity: 0.5, affectedCodewordCount: 2, transformFamily: 'resize', jsqrDecodeStatus: 'EXACT', opencvDecodeStatus: 'EXACT' },
    { candidateId: 'c', strategy: 'A3_PACKED', moduleBudget: 8, similarity: 0.5, affectedCodewordCount: 2, transformFamily: 'resize', jsqrDecodeStatus: 'NO_DETECTION', opencvDecodeStatus: 'EXACT' },
    { candidateId: 'c', strategy: 'A3_PACKED', moduleBudget: 8, similarity: 0.5, affectedCodewordCount: 2, transformFamily: 'blur', jsqrDecodeStatus: 'EXACT', opencvDecodeStatus: 'EXACT' },
  ];
  const rows = A3.summarizeRobustness(cases);
  eq(rows.length, 1);
  eq(rows[0].transformCaseCount, 3);
  eq(rows[0].bothExactCount, 2);
  close(rows[0].bothExactRate, 2 / 3, 1e-9);
  close(rows[0].resizeExactRate, 1 / 2, 1e-9);
  close(rows[0].blurExactRate, 1, 1e-9);
});

// ---------------------------------------------------------------------------
console.log('\njsQR round trip (optional)');
// ---------------------------------------------------------------------------

await asyncTest('A3 budget-0 decodes exactly with jsQR', async () => {
  const jsqrPath = process.env.A1_JSQR_PATH;
  if (!jsqrPath) { console.log('       skipped — set A1_JSQR_PATH to enable'); return; }
  const require = createRequire(import.meta.url);
  const jsQR = require(path.resolve(jsqrPath));
  const run = A3.runA3Clean({ payload: PAYLOAD, target: TARGET, seeds: [42], budgetSchedule: [0], decode: A1.jsQrDecoder(jsQR) });
  const zero = run.a3Results.filter((c) => c.moduleBudget === 0);
  for (const candidate of zero) eq(candidate.jsqrDecodeStatus, 'EXACT', `${candidate.candidateId} budget 0`);
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const { name, error } of failures) console.log(`  - ${name}: ${error.message}`);
  process.exitCode = 1;
}
