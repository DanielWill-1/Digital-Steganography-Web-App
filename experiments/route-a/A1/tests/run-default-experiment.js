/**
 * Default A1 experiment run, headless.
 *
 * Produces the recorded evidence for the controlled default:
 *   payload  = g.co (4 UTF-8 bytes — fits all four ECC levels)
 *   target   = a built-in synthetic target (circle by default)
 *
 * Writes to the A1 experiment directory:
 *   outputs/A1_<ecc>_mask<n>.png     one lossless PNG per candidate
 *   outputs/<target>-21x21.png       the normalised target
 *   results/results.csv              one row per candidate
 *   results/manifest.json            the configuration actually used
 *
 * jsQR validation is included only when A1_JSQR_PATH points at a local jsQR 1.4.0 copy;
 * OpenCV validation is a separate step (validation/validate_opencv.py).
 *
 * Usage:
 *   node tests/run-default-experiment.js [--payload g.co] [--target circle]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

// Classic experiment scripts — imported for their side effects; API lives on StegoA1.
import '../js/qr-role-map.js';
import '../js/qr-experiment.js';
import '../js/metrics.js';
import '../js/target-grid.js';
import '../js/export-results.js';
import '../js/experiment-runner.js';

import { encodePng } from './png.js';

const {
  generateAllCandidates,
  renderMatrixToImageData,
  renderTargetToImageData,
  DEFAULT_MODULE_SCALE,
  DEFAULT_QUIET_ZONE,
  compareMatrixToTarget,
  syntheticTarget,
  SYNTHETIC_TARGETS,
  jsQrDecoder,
  buildCsv,
  buildManifest,
} = globalThis.StegoA1;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A1_DIR = path.resolve(__dirname, '..');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const payload = arg('payload', 'g.co');
const targetName = arg('target', 'circle');
if (!SYNTHETIC_TARGETS.includes(targetName)) {
  console.error(`Unknown synthetic target ${targetName}. Options: ${SYNTHETIC_TARGETS.join(', ')}`);
  process.exit(2);
}

function gitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: A1_DIR, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

// jsQR is a declared project dependency, loaded from CDN in the apps. The harness reuses a
// local copy if one is provided; it never fetches or vendors one.
let decode = null;
let jsqrVersion = null;
if (process.env.A1_JSQR_PATH) {
  const require = createRequire(import.meta.url);
  const jsQR = require(path.resolve(process.env.A1_JSQR_PATH));
  decode = jsQrDecoder(jsQR);
  jsqrVersion = '1.4.0';
}

const target = syntheticTarget(targetName, 21);
const timestamp = new Date().toISOString();
const runId = `A1-${timestamp.slice(0, 10).replace(/-/g, '')}-1`;
const targetMeta = {
  size: 21,
  fit_method: 'center-crop to square',
  grayscale_method: 'Rec. 601 luma: (299R + 587G + 114B) / 1000',
  downsample_method: 'box average',
  threshold: 128,
  threshold_method: 'luma < 128 → dark (1), luma >= 128 → light (0)',
  matrix_convention: '1 = target dark module, 0 = target light module',
  source: 'synthetic',
  synthetic_target: targetName,
};

// Build candidates and metrics directly (mirrors experiment-runner without async image work).
const generation = generateAllCandidates({ payload });
const candidates = [];
for (const candidate of generation.candidates) {
  const metrics = compareMatrixToTarget(candidate.matrix, candidate.roleMap, target);
  const image = renderMatrixToImageData({ matrix: candidate.matrix, moduleScale: DEFAULT_MODULE_SCALE, quietZone: DEFAULT_QUIET_ZONE });
  let jsqrDetected = null;
  let jsqrPayload = null;
  let jsqrPayloadCorrect = null;
  if (decode) {
    const decoded = decode(image);
    jsqrDetected = decoded !== null;
    jsqrPayload = decoded;
    jsqrPayloadCorrect = decoded === payload;
  }
  candidates.push({
    candidateId: candidate.candidateId,
    eccLevel: candidate.eccLevel,
    mask: candidate.mask,
    standardSelectedMask: candidate.standardSelectedMask,
    filename: `A1_${candidate.eccLevel}_mask${candidate.mask}.png`,
    penalties: candidate.penalties,
    metrics,
    image,
    jsqrDetected,
    jsqrPayload,
    jsqrPayloadCorrect,
  });
}

// Write outputs.
const outputsDir = path.join(A1_DIR, 'outputs');
const resultsDir = path.join(A1_DIR, 'results');
const targetsDir = path.join(A1_DIR, 'targets');
fs.mkdirSync(outputsDir, { recursive: true });
fs.mkdirSync(resultsDir, { recursive: true });
fs.mkdirSync(targetsDir, { recursive: true });

for (const candidate of candidates) {
  const png = encodePng(candidate.image.width, candidate.image.height, candidate.image.data);
  fs.writeFileSync(path.join(outputsDir, candidate.filename), png);
}
const targetImage = renderTargetToImageData(target, 12);
fs.writeFileSync(
  path.join(targetsDir, `${targetName}-21x21.png`),
  encodePng(targetImage.width, targetImage.height, targetImage.data),
);

const csv = buildCsv({ runId, timestamp, targetName: `synthetic-${targetName}`, payload, candidates });
fs.writeFileSync(path.join(resultsDir, 'results.csv'), csv, 'utf8');

const manifest = buildManifest({
  runId,
  timestamp,
  payload,
  targetName: `synthetic-${targetName}`,
  targetMeta,
  candidates,
  moduleScale: DEFAULT_MODULE_SCALE,
  quietZone: DEFAULT_QUIET_ZONE,
  repositoryCommit: gitCommit(),
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
  outputFiles: ['results/results.csv', 'outputs/A1_*_mask*.png'],
});
fs.writeFileSync(path.join(resultsDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

// Report.
const sorted = candidates.slice().sort((a, b) => b.metrics.fullSimilarity - a.metrics.fullSimilarity);
const best = sorted[0];
const bestMutable = candidates.slice().sort((a, b) => b.metrics.mutableSimilarity - a.metrics.mutableSimilarity)[0];
const lowestPenalty = candidates.slice().sort((a, b) => a.penalties.total - b.penalties.total)[0];
const exact = candidates.filter((c) => c.jsqrPayloadCorrect === true).length;

console.log(`payload: ${payload} (${Buffer.byteLength(payload, 'utf8')} UTF-8 bytes)`);
console.log(`target:  synthetic ${targetName}, normalised to 21×21`);
console.log(`generated: ${candidates.length}/${generation.expectedCandidateCount} candidates` +
  (generation.skipped.length ? ` (skipped: ${generation.skipped.map((s) => s.eccLevel).join(', ')})` : ''));
console.log(decode ? `jsQR exact decode: ${exact}/${candidates.length}` : 'jsQR: not run (A1_JSQR_PATH not set)');
console.log(`highest full similarity:    ${best.candidateId} ${(best.metrics.fullSimilarity * 100).toFixed(2)}%`);
console.log(`highest mutable similarity: ${bestMutable.candidateId} ${(bestMutable.metrics.mutableSimilarity * 100).toFixed(2)}%`);
console.log(`lowest total QR penalty:    ${lowestPenalty.candidateId} ${lowestPenalty.penalties.total}`);
console.log(`standard-selected mask per ECC: ${JSON.stringify(generation.standardMaskByEcc)}`);
console.log(`theoretical ceiling (best candidate): ${(best.metrics.theoreticalCeiling * 100).toFixed(2)}%`);
console.log(`wrote ${candidates.length} PNGs to ${path.relative(A1_DIR, outputsDir)}/ and results to ${path.relative(A1_DIR, resultsDir)}/`);

console.log('\nper-candidate (sorted by full similarity):');
console.log('id        full    mutable  fixed  ceiling  penalty  standard  jsqr');
for (const c of sorted) {
  console.log(
    `${c.candidateId.padEnd(9)} ${(c.metrics.fullSimilarity * 100).toFixed(2).padStart(6)}% ` +
    `${(c.metrics.mutableSimilarity * 100).toFixed(2).padStart(6)}% ` +
    `${String(c.metrics.fixedConflicts).padStart(5)} ` +
    `${(c.metrics.theoreticalCeiling * 100).toFixed(2).padStart(6)}% ` +
    `${String(c.penalties.total).padStart(7)} ` +
    `${String(c.standardSelectedMask).padStart(8)} ` +
    `${c.jsqrPayloadCorrect === null ? 'n/a' : c.jsqrPayloadCorrect ? 'exact' : 'FAIL'}`,
  );
}
