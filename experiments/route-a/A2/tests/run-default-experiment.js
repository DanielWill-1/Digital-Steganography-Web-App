/**
 * Default A2 experiment run, headless.
 *
 * Controlled default:
 *   payload = g.co, target = built-in synthetic circle, base = highest-A1-similarity
 *   candidate, seeds 42–46, the dense modification budget schedule.
 *
 * Writes to the A2 experiment directory:
 *   outputs/A2_<ecc>_mask<m>_seed<s>_budget<b>.png   one PNG per trial
 *   targets/<target>-21x21.png                       the normalised target
 *   results/results.csv                              one row per trial
 *   results/manifest.json                            configuration + every trial
 *   results/budget_summary.csv                       per-budget aggregate
 *
 * jsQR validation is included only when A1_JSQR_PATH points at a local jsQR 1.4.0 copy.
 * OpenCV validation is a separate step (validation/validate_opencv.py).
 *
 * Usage: node tests/run-default-experiment.js [--payload g.co] [--target circle]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// A1 modules (classic scripts, imported for side effects) + the A1 PNG writer.
import '../../A1/js/qr-role-map.js';
import '../../A1/js/qr-experiment.js';
import '../../A1/js/metrics.js';
import '../../A1/js/target-grid.js';
import '../../A1/js/export-results.js';
import '../../A1/js/experiment-runner.js';
import { encodePng } from '../../A1/tests/png.js';

// A2 modules.
import '../js/modification-strategy.js';
import '../js/metrics-a2.js';
import '../js/robustness-summary.js';
import '../js/experiment-runner.js';
import '../js/export-results.js';

const A1 = globalThis.StegoA1;
const A2 = globalThis.StegoA2;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A2_DIR = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const payload = arg('payload', 'g.co');
const targetName = arg('target', 'circle');
if (!A1.SYNTHETIC_TARGETS.includes(targetName)) {
  console.error(`Unknown synthetic target ${targetName}. Options: ${A1.SYNTHETIC_TARGETS.join(', ')}`);
  process.exit(2);
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: A2_DIR, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
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
const runId = `A2-${timestamp.slice(0, 10).replace(/-/g, '')}-1`;
const targetMeta = Object.assign({}, A1.normalizationMetadata(21), {
  source: 'synthetic',
  synthetic_target: targetName,
});

const run = await A2.runA2Experiment({
  payload,
  target,
  targetMeta,
  baseSelection: { mode: 'auto' },
  seeds: A2.DEFAULT_SEEDS,
  budgetSchedule: A2.DEFAULT_BUDGET_SCHEDULE,
  decode,
  runId,
  timestamp,
  environment: {
    userAgent: null,
    jsqrVersion,
    runner: 'node tests/run-default-experiment.js',
    node: process.version,
    decoders: [
      { name: 'jsQR', version: jsqrVersion ?? 'not run (set A1_JSQR_PATH to enable)', role: 'browser decoder' },
      { name: 'OpenCV QRCodeDetector', version: 'see validation/validate_opencv.py output', role: 'independent decoder' },
    ],
  },
});

// Write outputs.
const outputsDir = path.join(A2_DIR, 'outputs');
const resultsDir = path.join(A2_DIR, 'results');
const targetsDir = path.join(A2_DIR, 'targets');
fs.mkdirSync(outputsDir, { recursive: true });
fs.mkdirSync(resultsDir, { recursive: true });
fs.mkdirSync(targetsDir, { recursive: true });

for (const trial of run.trials) {
  fs.writeFileSync(path.join(outputsDir, trial.filename), encodePng(trial.image.width, trial.image.height, trial.image.data));
}
const targetImage = A1.renderTargetToImageData(target, 12);
fs.writeFileSync(path.join(targetsDir, `${targetName}-21x21.png`), encodePng(targetImage.width, targetImage.height, targetImage.data));

fs.writeFileSync(path.join(resultsDir, 'results.csv'), A2.buildResultsCsv({ run, targetName: `synthetic-${targetName}` }), 'utf8');
fs.writeFileSync(path.join(resultsDir, 'budget_summary.csv'), A2.buildBudgetSummaryCsv(run), 'utf8');
fs.writeFileSync(
  path.join(resultsDir, 'manifest.json'),
  JSON.stringify(A2.buildManifest({ run, targetName: `synthetic-${targetName}`, repositoryCommit: gitCommit() }), null, 2),
  'utf8',
);

// Report.
const s = run.summary;
const base = run.bases[0];
console.log(`payload: ${payload} (${run.payloadUtf8Bytes} UTF-8 bytes)`);
console.log(`target:  synthetic ${targetName}, normalised to 21×21`);
console.log(`base:    ${base.candidateId} (ECC ${base.eccLevel} / mask ${base.mask}), A1 full similarity ${(base.fullSimilarity * 100).toFixed(2)}%`);
console.log(`eligible target mismatches: ${s.eligibleMismatchesTotal}`);
console.log(`seeds: ${run.seeds.join(', ')} (${s.seedCount})`);
console.log(`budgets: ${run.budgets.join(', ')} (${run.budgets.length})`);
console.log(`trials: ${s.trialCount}`);
console.log(decode
  ? `jsQR exact: ${s.jsqrExactCount}/${s.trialCount}  (wrong payload ${s.jsqrWrongPayloadCount}, no detection ${s.jsqrNoDetectionCount})`
  : 'jsQR: not run (A1_JSQR_PATH not set)');
console.log(`failures: first observed ${run.failures.firstObservedFailureBudget ?? 'none'}, largest successful budget ${run.failures.largestSuccessfulTestedBudget ?? 'none'}, sustained failure ${run.failures.observedSustainedFailureBudget ?? 'none'}`);

console.log('\nbudget  modified  similarity  jsQR exact  wrong  no-detect  codewords(mean)');
for (const row of run.budgetSummary) {
  console.log(
    `${String(row.budget).padStart(5)}  ${String(row.actualModifiedModules).padStart(8)}  ` +
    `${(row.similarityAfterMean * 100).toFixed(2).padStart(9)}%  ` +
    `${String(row.exactDecodeCount).padStart(9)}/${String(row.trialCount).padEnd(3)}  ` +
    `${String(row.wrongPayloadCount).padStart(5)}  ${String(row.noDetectionCount).padStart(9)}  ` +
    `${row.affectedCodewordsMean === null ? 'n/a' : row.affectedCodewordsMean.toFixed(1)}`,
  );
}

// Codeword observation: successful vs failed trials by affected codewords.
const exact = run.trials.filter((t) => t.decodeStatus === 'EXACT' && t.affectedCodewordCount !== null);
const failed = run.trials.filter((t) => t.decodeStatus !== null && t.decodeStatus !== 'EXACT' && t.affectedCodewordCount !== null);
const meanOf = (list, key) => (list.length ? list.reduce((a, t) => a + t[key], 0) / list.length : null);
console.log('\ncodeword observation (jsQR):');
console.log(`  exact trials:  ${exact.length}, mean affected codewords ${meanOf(exact, 'affectedCodewordCount')?.toFixed(1) ?? 'n/a'}, mean modified modules ${meanOf(exact, 'actualModifiedModules')?.toFixed(1) ?? 'n/a'}`);
console.log(`  failed trials: ${failed.length}, mean affected codewords ${meanOf(failed, 'affectedCodewordCount')?.toFixed(1) ?? 'n/a'}, mean modified modules ${meanOf(failed, 'actualModifiedModules')?.toFixed(1) ?? 'n/a'}`);

console.log(`\nwrote ${run.trials.length} PNGs to ${path.relative(A2_DIR, outputsDir)}/ and results to ${path.relative(A2_DIR, resultsDir)}/`);
