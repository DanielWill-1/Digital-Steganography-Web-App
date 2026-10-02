/**
 * Default A3 clean experiment run, headless.
 *
 * Controlled setup identical to A2 (payload g.co, synthetic circle target, auto base).
 * Produces the matched A2-vs-A3 comparison and the codeword-budget sweep.
 *
 * Writes to the A3 directory:
 *   outputs/*.png                     candidate images (A2 clean, A3 clean, codeword-budget)
 *   targets/<target>-21x21.png        normalised target
 *   results/clean_results.csv
 *   results/strategy_comparison.csv
 *   results/codeword_budget_results.csv
 *   results/manifest.json
 *
 * jsQR is included only when A1_JSQR_PATH points at a local jsQR 1.4.0 copy. OpenCV is a
 * separate step (validation/validate_opencv.py); synthetic robustness is a further step
 * (validation/synthetic_robustness.py then tests/run-robustness-jsqr.js).
 *
 * Usage: node tests/run-default-experiment.js [--payload g.co] [--target circle]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

import '../../A1/js/qr-role-map.js';
import '../../A1/js/qr-experiment.js';
import '../../A1/js/metrics.js';
import '../../A1/js/target-grid.js';
import '../../A1/js/export-results.js';
import '../../A1/js/experiment-runner.js';
import { encodePng } from '../../A1/tests/png.js';
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
const A3_DIR = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
const payload = arg('payload', 'g.co');
const targetName = arg('target', 'circle');
if (!A1.SYNTHETIC_TARGETS.includes(targetName)) {
  console.error(`Unknown synthetic target ${targetName}.`);
  process.exit(2);
}
function gitCommit() {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: A3_DIR, encoding: 'utf8' }).trim(); }
  catch { return null; }
}

let decode = null;
let jsqrVersion = null;
if (process.env.A1_JSQR_PATH) {
  const require = createRequire(import.meta.url);
  decode = A1.jsQrDecoder(require(path.resolve(process.env.A1_JSQR_PATH)));
  jsqrVersion = '1.4.0';
}

const target = A1.syntheticTarget(targetName, 21);
const timestamp = new Date().toISOString();
const runId = `A3-${timestamp.slice(0, 10).replace(/-/g, '')}-1`;
const targetMeta = Object.assign({}, A1.normalizationMetadata(21), { source: 'synthetic', synthetic_target: targetName });

const run = A3.runA3Clean({
  payload,
  target,
  targetMeta,
  baseSelection: { mode: 'auto' },
  seeds: A2.DEFAULT_SEEDS,
  budgetSchedule: A3.A3_BUDGET_SCHEDULE,
  decode,
  runId,
  timestamp,
  environment: {
    userAgent: null, jsqrVersion,
    runner: 'node tests/run-default-experiment.js',
    node: process.version,
    decoders: [
      { name: 'jsQR', version: jsqrVersion ?? 'not run (set A1_JSQR_PATH)', role: 'browser decoder' },
      { name: 'OpenCV QRCodeDetector', version: 'see validation/validate_opencv.py', role: 'independent decoder' },
    ],
  },
});

const outputsDir = path.join(A3_DIR, 'outputs');
const resultsDir = path.join(A3_DIR, 'results');
const targetsDir = path.join(A3_DIR, 'targets');
for (const dir of [outputsDir, resultsDir, targetsDir]) fs.mkdirSync(dir, { recursive: true });

for (const candidate of run.cleanResults.concat(run.codewordBudgetResults)) {
  fs.writeFileSync(path.join(outputsDir, candidate.filename), encodePng(candidate.image.width, candidate.image.height, candidate.image.data));
}
// A1 untouched base image (budget 0), for later robustness comparison.
const base = run.bases[0];
const baseMatrixImage = A1.renderMatrixToImageData({ matrix: base.baseMatrix, moduleScale: run.moduleScale, quietZone: run.quietZone });
const baseFilename = `A1base_${base.eccLevel}_mask${base.mask}.png`;
fs.writeFileSync(path.join(outputsDir, baseFilename), encodePng(baseMatrixImage.width, baseMatrixImage.height, baseMatrixImage.data));
const targetImage = A1.renderTargetToImageData(target, 12);
fs.writeFileSync(path.join(targetsDir, `${targetName}-21x21.png`), encodePng(targetImage.width, targetImage.height, targetImage.data));

const strategyComparison = A3.compareStrategies(run.a2Results, run.a3Results);
const boundary = A3.boundaryObservations(run.cleanResults);

fs.writeFileSync(path.join(resultsDir, 'clean_results.csv'), A3.buildCleanCsv({ run, targetName: `synthetic-${targetName}` }), 'utf8');
fs.writeFileSync(path.join(resultsDir, 'strategy_comparison.csv'), A3.buildStrategyComparisonCsv(strategyComparison), 'utf8');
fs.writeFileSync(path.join(resultsDir, 'codeword_budget_results.csv'), A3.buildCodewordBudgetCsv(run.codewordBudgetResults), 'utf8');
fs.writeFileSync(path.join(resultsDir, 'manifest.json'), JSON.stringify(A3.buildManifest({
  run, targetName: `synthetic-${targetName}`, repositoryCommit: gitCommit(),
}), null, 2), 'utf8');

// Report.
const s = run.summary;
console.log(`payload: ${payload}  target: synthetic ${targetName}`);
console.log(`base: ${base.candidateId}  baseline similarity ${(base.fullSimilarity * 100).toFixed(2)}%  eligible ${base.eligibleCount}`);
console.log(`budgets: ${run.budgets.length}  seeds(A2): ${run.seeds.length}`);
console.log(`clean candidates: ${s.cleanCandidateCount} (A2 ${s.a2CandidateCount}, A3 ${s.a3CandidateCount}); codeword-budget candidates ${run.codewordBudgetResults.length}`);
console.log(decode ? `jsQR exact: ${s.jsqrExactCount}/${s.cleanCandidateCount}` : 'jsQR: not run');
console.log(`A3 largest jsQR-exact budget: ${boundary.largestJsqrExactBudget} (similarity ${boundary.largestJsqrExactSimilarity === null ? 'n/a' : (boundary.largestJsqrExactSimilarity * 100).toFixed(2) + '%'})`);

console.log('\nbudget  sim      A2cwμ  A3cw  A2exact  A3exact');
for (const row of strategyComparison) {
  console.log(
    `${String(row.moduleBudget).padStart(5)}  ${(row.similarity * 100).toFixed(2).padStart(6)}%  ` +
    `${row.a2AffectedCodewordsMean.toFixed(1).padStart(5)}  ${String(row.a3AffectedCodewords).padStart(4)}  ` +
    `${(row.a2ExactCount + '/' + row.a2TrialCount).padStart(7)}  ${(row.a3JsqrExact ? 'EXACT' : 'fail').padStart(7)}`,
  );
}

console.log('\ncodeword-budget sweep:');
for (const c of run.codewordBudgetResults) {
  console.log(`  K=${String(c.codewordBudget).padStart(2)}  modules ${String(c.actualModifiedModules).padStart(3)}  sim ${(c.fullSimilarityAfter * 100).toFixed(2)}%  jsQR ${c.jsqrDecodeStatus}`);
}

console.log(`\nwrote ${run.cleanResults.length + run.codewordBudgetResults.length + 1} PNGs, clean/strategy/codeword CSVs, and manifest to ${path.relative(A3_DIR, resultsDir)}/`);
