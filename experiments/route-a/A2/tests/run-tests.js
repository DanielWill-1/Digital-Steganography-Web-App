/**
 * Experiment A2 tests. Dependency-free; run with `node tests/run-tests.js`.
 *
 * These verify the A2 invariants the specification makes central: function modules are
 * never touched, every change moves toward the target, budget zero reproduces A1 exactly,
 * budget N changes exactly N eligible modules, similarity gain is N/441, seeded ordering is
 * deterministic, and the runner produces the expected candidate count.
 *
 * Reuses the A1 modules (imported for their side effects) — A2 does not re-implement QR
 * generation, normalisation, metrics, or rendering.
 *
 * jsQR round trip: set A1_JSQR_PATH to a local jsQR 1.4.0 copy to enable the decode checks.
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

import '../js/modification-strategy.js';
import '../js/metrics-a2.js';
import '../js/robustness-summary.js';
import '../js/experiment-runner.js';
import '../js/export-results.js';

const A1 = globalThis.StegoA1;
const A2 = globalThis.StegoA2;

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
function eq(actual, expected, message = '') {
  if (actual !== expected) throw new Error(`${message ? message + ': ' : ''}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
function close(actual, expected, epsilon = 1e-9, message = '') {
  if (Math.abs(actual - expected) > epsilon) throw new Error(`${message ? message + ': ' : ''}expected ≈${expected}, got ${actual}`);
}

const PAYLOAD = 'g.co';
const TARGET = A1.syntheticTarget('circle');
const IMMUTABLE = ['FINDER', 'SEPARATOR', 'TIMING', 'FORMAT', 'DARK_MODULE'];

function autoBase() {
  return A2.selectBases({ payload: PAYLOAD, target: TARGET, mode: 'auto' }).bases[0];
}
function eligibleOf(entry) {
  const info = A2.codewordMapFor(entry.candidate.eccLevel);
  return { info, eligible: A2.buildEligiblePositions(entry.candidate.matrix, entry.candidate.roleMap, TARGET, info) };
}

// A shared run with a perfect-decoder stub, so aggregation tests are deterministic.
const perfectDecode = () => PAYLOAD;
let smallRunPromise = null;
function smallRun() {
  if (!smallRunPromise) {
    smallRunPromise = A2.runA2Experiment({ payload: PAYLOAD, target: TARGET, seeds: [42, 43], decode: perfectDecode });
  }
  return smallRunPromise;
}

// ---------------------------------------------------------------------------
console.log('\nModification strategy');
// ---------------------------------------------------------------------------

test('budgetsFor filters above eligibility, always includes 0 and the full set', () => {
  const budgets = A2.budgetsFor(93);
  eq(budgets[0], 0, 'starts at 0');
  eq(budgets[budgets.length - 1], 93, 'ends at eligible count');
  assert(budgets.every((b) => b <= 93), 'none exceed eligibility');
  assert(budgets.includes(80) && !budgets.includes(96), 'filters the schedule correctly');
});

test('eligible positions are mutable mismatches only', () => {
  const entry = autoBase();
  const { eligible } = eligibleOf(entry);
  eq(eligible.length, 208 - entry.metrics.mutableMatches, 'eligible count = mutable mismatches');
  for (const position of eligible) {
    assert(!IMMUTABLE.includes(position.role), `role ${position.role} must not be eligible`);
    assert((entry.candidate.matrix[position.row][position.column] ? 1 : 0) !== position.targetValue, 'must be a mismatch');
    eq(position.targetValue, TARGET[position.row][position.column], 'target value recorded');
  }
});

test('codeword mapping is consistent with the A1 role map', () => {
  const info = A2.codewordMapFor('H');
  const roleMap = A1.buildVersion1RoleMap('H');
  const order = A1.version1DataModuleOrder();
  eq(order.length, 208, '208 data modules');
  order.forEach(([row, column], bitIndex) => {
    const meta = info.map.get(row + ',' + column);
    eq(meta.bitIndex, bitIndex, 'bit index');
    eq(meta.codewordIndex, Math.floor(bitIndex / 8), 'codeword index');
    eq(meta.bitWithinCodeword, bitIndex % 8, 'bit within codeword');
    eq(meta.codewordType, roleMap[row][column], 'DATA/ECC matches role map');
  });
});

// ---------------------------------------------------------------------------
console.log('\nDeterministic ordering');
// ---------------------------------------------------------------------------

test('seed 42 produces the same ordering every time', () => {
  const { eligible } = eligibleOf(autoBase());
  const a = A2.seededShuffle(eligible, 42).map((p) => `${p.row},${p.column}`);
  const b = A2.seededShuffle(eligible, 42).map((p) => `${p.row},${p.column}`);
  eq(a.join('|'), b.join('|'), 'same seed → same order');
});

test('different seeds produce different orderings', () => {
  const { eligible } = eligibleOf(autoBase());
  const a = A2.seededShuffle(eligible, 42).map((p) => `${p.row},${p.column}`).join('|');
  const b = A2.seededShuffle(eligible, 43).map((p) => `${p.row},${p.column}`).join('|');
  assert(a !== b, 'different seeds → different order');
});

// ---------------------------------------------------------------------------
console.log('\nBudget invariants');
// ---------------------------------------------------------------------------

test('budget zero reproduces the A1 base exactly', () => {
  const entry = autoBase();
  const { eligible } = eligibleOf(entry);
  const ordered = A2.seededShuffle(eligible, 42);
  const { matrix, changed } = A2.applyBudget(entry.candidate.matrix, ordered, 0, TARGET);
  eq(changed.length, 0, 'no changes');
  eq(JSON.stringify(matrix), JSON.stringify(entry.candidate.matrix), 'matrix identical to base');
  const metrics = A1.compareMatrixToTarget(matrix, entry.candidate.roleMap, TARGET);
  close(metrics.fullSimilarity, entry.metrics.fullSimilarity, 1e-12, 'similarity before == A1 similarity');
});

test('budget N changes exactly N modules and moves each toward the target', () => {
  const entry = autoBase();
  const { eligible } = eligibleOf(entry);
  const ordered = A2.seededShuffle(eligible, 44);
  for (const budget of [1, 2, 4, 8, 16]) {
    const { matrix, changed } = A2.applyBudget(entry.candidate.matrix, ordered, budget, TARGET);
    eq(changed.length, budget, `changed count at budget ${budget}`);
    for (const position of changed) {
      eq(matrix[position.row][position.column] ? 1 : 0, position.targetValue, 'module now equals target');
    }
  }
});

test('similarity gain equals changed modules / 441', () => {
  const entry = autoBase();
  const { eligible } = eligibleOf(entry);
  const ordered = A2.seededShuffle(eligible, 45);
  for (const budget of [1, 2, 6, 12, 24]) {
    const { matrix, changed } = A2.applyBudget(entry.candidate.matrix, ordered, budget, TARGET);
    const metrics = A1.compareMatrixToTarget(matrix, entry.candidate.roleMap, TARGET);
    close(metrics.fullSimilarity - entry.metrics.fullSimilarity, changed.length / 441, 1e-12, `gain at budget ${budget}`);
  }
});

test('function modules are never modified', () => {
  const entry = autoBase();
  const { eligible } = eligibleOf(entry);
  const ordered = A2.seededShuffle(eligible, 46);
  const { matrix } = A2.applyBudget(entry.candidate.matrix, ordered, ordered.length, TARGET);
  for (let row = 0; row < 21; row++) {
    for (let column = 0; column < 21; column++) {
      if (IMMUTABLE.includes(entry.candidate.roleMap[row][column])) {
        eq(matrix[row][column], entry.candidate.matrix[row][column], `immutable (${row},${column})`);
      }
    }
  }
});

test('fixed conflicts and theoretical ceiling are unchanged by modification', () => {
  const entry = autoBase();
  const { eligible } = eligibleOf(entry);
  const ordered = A2.seededShuffle(eligible, 42);
  const { matrix } = A2.applyBudget(entry.candidate.matrix, ordered, 10, TARGET);
  const before = A1.compareMatrixToTarget(entry.candidate.matrix, entry.candidate.roleMap, TARGET);
  const after = A1.compareMatrixToTarget(matrix, entry.candidate.roleMap, TARGET);
  eq(after.fixedConflicts, before.fixedConflicts, 'fixed conflicts');
  close(after.theoreticalCeiling, before.theoreticalCeiling, 1e-12, 'ceiling');
});

test('similarity_after is identical across seeds at a given budget', async () => {
  const run = await smallRun();
  for (const row of run.budgetSummary) {
    close(row.similarityAfterMin, row.similarityAfterMax, 1e-12, `budget ${row.budget} deterministic similarity`);
  }
});

// ---------------------------------------------------------------------------
console.log('\nCodeword impact');
// ---------------------------------------------------------------------------

test('codeword impact groups changed modules into distinct codewords', () => {
  const impact = A2.codewordImpact([
    { codewordIndex: 0, codewordType: 'DATA' },
    { codewordIndex: 0, codewordType: 'DATA' },
    { codewordIndex: 3, codewordType: 'DATA' },
    { codewordIndex: 5, codewordType: 'ECC' },
  ]);
  eq(impact.affectedCodewordCount, 3, 'distinct codewords');
  eq(impact.maxFlipsInSingleCodeword, 2, 'max flips in one codeword');
  eq(impact.affectedDataCodewordCount, 3, 'data codewords');
  eq(impact.affectedEccCodewordCount, 1, 'ecc codewords');
  eq(impact.affectedCodewordIndices.join(','), '0,3,5', 'indices sorted');
});

test('12 modules can touch fewer than 12 codewords', () => {
  const positions = [];
  for (let i = 0; i < 12; i++) positions.push({ codewordIndex: Math.floor(i / 2), codewordType: 'DATA' });
  eq(A2.codewordImpact(positions).affectedCodewordCount, 6, 'six codewords for twelve modules');
});

test('classifyDecode distinguishes the failure modes', () => {
  eq(A2.classifyDecode({ ran: false }), null);
  eq(A2.classifyDecode({ ran: true, detected: false, payload: '', expected: 'g.co' }), 'NO_DETECTION');
  eq(A2.classifyDecode({ ran: true, detected: true, payload: 'g.co', expected: 'g.co' }), 'EXACT');
  eq(A2.classifyDecode({ ran: true, detected: true, payload: 'g.c0', expected: 'g.co' }), 'WRONG_PAYLOAD');
  eq(A2.classifyDecode({ ran: true, detected: false, expected: 'g.co', error: new Error('boom') }), 'DECODER_ERROR');
});

// ---------------------------------------------------------------------------
console.log('\nRunner');
// ---------------------------------------------------------------------------

test('runner produces seeds × budgets trials for one base', async () => {
  const run = await smallRun();
  const entry = run.bases[0];
  eq(run.summary.trialCount, run.seeds.length * entry.budgets.length, 'trial count');
  eq(run.trials.length, run.summary.trialCount, 'trials length');
  eq(run.summary.eligibleMismatchesTotal, entry.eligibleCount, 'eligible total');
  assert(run.trials.every((t) => t.baseEcc === entry.eccLevel && t.baseMask === entry.mask), 'single base');
});

test('all-ECC-winners mode selects one base per ECC level', () => {
  const selection = A2.selectBases({ payload: PAYLOAD, target: TARGET, mode: 'allEccWinners' });
  eq(selection.bases.length, 4, 'four bases');
  eq(selection.bases.map((b) => b.candidate.eccLevel).join(','), 'L,M,Q,H', 'one per level');
});

test('auto mode selects the true highest-similarity A1 candidate', () => {
  const selection = A2.selectBases({ payload: PAYLOAD, target: TARGET, mode: 'auto' });
  const generation = A1.generateAllCandidates({ payload: PAYLOAD });
  let best = null;
  for (const candidate of generation.candidates) {
    const s = A1.compareMatrixToTarget(candidate.matrix, candidate.roleMap, TARGET).fullSimilarity;
    if (!best || s > best.s) best = { s, id: candidate.candidateId };
  }
  eq(selection.bases[0].candidate.candidateId, best.id, 'auto base');
});

test('budget summary groups by budget across seeds', async () => {
  const run = await smallRun();
  eq(run.budgetSummary.length, run.bases[0].budgets.length, 'one row per budget');
  for (const row of run.budgetSummary) eq(row.trialCount, run.seeds.length, `trials at budget ${row.budget}`);
  close(run.budgetSummary[0].similarityAfterMean, run.summary.baseFullSimilarity, 1e-12, 'budget 0 similarity == base');
  eq(run.budgetSummary[0].exactDecodeCount, run.seeds.length, 'budget 0 exact');
});

test('failure observations are offered for the tested budget set', async () => {
  const run = await smallRun();
  assert(run.failures.perSeed.length === run.seeds.length, 'per-seed entries');
  eq(run.failures.largestSuccessfulTestedBudget, Math.max(...run.budgets), 'stub decoder succeeds maximally');
  eq(run.failures.observedSustainedFailureBudget, null, 'no sustained failure when all decode');
});

// ---------------------------------------------------------------------------
console.log('\nExports');
// ---------------------------------------------------------------------------

test('results.csv has a header plus one row per trial', async () => {
  const run = await smallRun();
  const csv = A2.buildResultsCsv({ run, targetName: 'synthetic-circle' });
  eq(csv.trim().split('\r\n').length, run.trials.length + 1, 'header + trials');
  assert(csv.startsWith('run_id,timestamp,target_name'), 'header columns');
});

test('budget_summary.csv has a header plus one row per budget', async () => {
  const run = await smallRun();
  const csv = A2.buildBudgetSummaryCsv(run);
  eq(csv.trim().split('\r\n').length, run.budgetSummary.length + 1, 'header + budgets');
});

test('manifest records base, seeds, budgets, and every trial', async () => {
  const run = await smallRun();
  const manifest = A2.buildManifest({ run, targetName: 'synthetic-circle' });
  eq(manifest.experiment, 'A2');
  eq(manifest.payload, 'g.co');
  eq(manifest.seeds.length, 2);
  eq(manifest.trials.length, run.trials.length);
  eq(manifest.success_definition, 'decoded payload === expected payload');
});

// ---------------------------------------------------------------------------
console.log('\njsQR round trip (optional)');
// ---------------------------------------------------------------------------

await asyncTest('budget zero decodes exactly with jsQR', async () => {
  const jsqrPath = process.env.A1_JSQR_PATH;
  if (!jsqrPath) {
    console.log('       skipped — set A1_JSQR_PATH to a local jsQR 1.4.0 copy to enable');
    return;
  }
  const require = createRequire(import.meta.url);
  const jsQR = require(path.resolve(jsqrPath));
  const run = await A2.runA2Experiment({ payload: PAYLOAD, target: TARGET, seeds: [42], decode: A1.jsQrDecoder(jsQR) });
  const budgetZero = run.trials.filter((trial) => trial.budget === 0);
  eq(budgetZero.length, run.bases.length, 'one budget-0 trial per base');
  for (const trial of budgetZero) eq(trial.decodeStatus, 'EXACT', `${trial.baseCandidateId} budget 0`);
});

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('\nFailures:');
  for (const { name, error } of failures) console.log(`  - ${name}: ${error.message}`);
  process.exitCode = 1;
}
