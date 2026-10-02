/**
 * A4.1 generalization benchmark, headless.
 *
 * Writes the deterministic target fixtures, then for every target × payload × ECC
 * configuration builds the A1 base and all A3 packed candidates, validating each with jsQR.
 * OpenCV is merged separately (validation/validate_opencv.py).
 *
 * Outputs (under experiments/route-a/A4):
 *   targets/T0x_<name>.png            canonical 21×21 fixtures
 *   targets/target_corpus.json        ids, hashes, dark fraction, matrices
 *   outputs/gen/A4_*.png              A1 base + A3 candidates
 *   results/generalization_configs.csv
 *   results/generalization_candidates.csv
 *   results/a4_manifest.json
 *
 * Usage: node tests/run-generalization.js
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

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
import { encodePng } from '../../A1/tests/png.js';
import '../js/hash.js';
import '../js/target-corpus.js';
import '../js/operating-points.js';
import '../js/generalization-runner.js';
import '../js/export-results.js';

const A1 = globalThis.StegoA1;
const A2 = globalThis.StegoA2;
const A3 = globalThis.StegoA3;
const A4 = globalThis.StegoA4;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A4_DIR = path.resolve(__dirname, '..');

let decode = null;
let jsqrVersion = null;
if (process.env.A1_JSQR_PATH) {
  const require = createRequire(import.meta.url);
  decode = A1.jsQrDecoder(require(path.resolve(process.env.A1_JSQR_PATH)));
  jsqrVersion = '1.4.0';
} else {
  console.error('A1_JSQR_PATH is not set — the generalization run requires jsQR for the clean verdicts.');
  process.exit(2);
}

const PAYLOADS = ['a', 'g.co', 'abcdefg'];
const ECC_LEVELS = ['L', 'M', 'Q', 'H'];

const targetsDir = path.join(A4_DIR, 'targets');
const outputsDir = path.join(A4_DIR, 'outputs', 'gen');
const resultsDir = path.join(A4_DIR, 'results');
for (const dir of [targetsDir, outputsDir, resultsDir]) fs.mkdirSync(dir, { recursive: true });

// 1. Write target fixtures + metadata.
const targets = A4.TARGETS.map((t) => {
  const image = A1.renderMatrixToImageData({ matrix: t.matrix.map((row) => row.map((v) => v === 1)), moduleScale: 1, quietZone: 0 });
  const png = encodePng(image.width, image.height, image.data);
  const file = `${t.id}_${t.name}.png`;
  fs.writeFileSync(path.join(targetsDir, file), png);
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    size: t.size,
    matrix: t.matrix,
    darkFraction: A4.darkFraction(t.matrix),
    matrixHash: A4.matrixHash(t.matrix),
    sourceFile: file,
    sourceSha256: crypto.createHash('sha256').update(png).digest('hex'),
  };
});
fs.writeFileSync(path.join(targetsDir, 'target_corpus.json'), JSON.stringify(A4.buildTargetCorpus(targets), null, 2), 'utf8');

// 2. Generate every configuration.
const timestamp = new Date().toISOString();
const runId = `A4-${timestamp.slice(0, 10).replace(/-/g, '')}-1`;
const configs = [];
const descriptors = A4.allConfigurations(targets, PAYLOADS, ECC_LEVELS);
let done = 0;
const start = Date.now();

for (const descriptor of descriptors) {
  const config = A4.generateConfig({
    target: descriptor.target.matrix,
    targetId: descriptor.targetId,
    targetMeta: descriptor.target,
    payload: descriptor.payload,
    eccLevel: descriptor.eccLevel,
    budgetSchedule: A3.A3_BUDGET_SCHEDULE,
    decode,
  });
  if (!config) continue; // payload does not fit this level (should not happen for these 3 payloads)
  configs.push(config);
  fs.writeFileSync(path.join(outputsDir, config.base.filename), encodePng(config.base.image.width, config.base.image.height, config.base.image.data));
  for (const a3 of config.a3Candidates) {
    fs.writeFileSync(path.join(outputsDir, a3.filename), encodePng(a3.image.width, a3.image.height, a3.image.data));
  }
  done++;
  if (done % 16 === 0) process.stdout.write(`  ${done}/${descriptors.length} configurations...\r`);
}

// 3. Write results.
fs.writeFileSync(path.join(resultsDir, 'generalization_configs.csv'), A4.buildConfigsCsv(configs), 'utf8');
fs.writeFileSync(path.join(resultsDir, 'generalization_candidates.csv'), A4.buildCandidatesCsv(configs), 'utf8');
const manifest = A4.buildManifest({
  runId, timestamp, targets, payloads: PAYLOADS, eccLevels: ECC_LEVELS, configCount: configs.length,
  environment: {
    node: process.version,
    os: `${os.platform()} ${os.release()}`,
    jsqr_version: jsqrVersion,
    opencv_version: 'see validation/validate_opencv.py',
    runner: 'node tests/run-generalization.js',
  },
});
fs.writeFileSync(path.join(resultsDir, 'a4_manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

// 4. Summary.
const allA3 = configs.flatMap((c) => c.a3Candidates);
const exact = allA3.filter((c) => c.jsqrDecodeStatus === 'EXACT').length;
const seconds = ((Date.now() - start) / 1000).toFixed(1);
console.log(`\ntargets: ${targets.length}  payloads: ${PAYLOADS.length}  ECC: ${ECC_LEVELS.length}  configurations: ${configs.length}`);
console.log(`A3 candidates: ${allA3.length}  jsQR exact: ${exact}/${allA3.length}`);
console.log(`wrote ${targets.length} fixtures, ${configs.length + allA3.length} candidate PNGs, and CSVs in ${seconds}s`);
console.log('next: python validation/validate_opencv.py');
