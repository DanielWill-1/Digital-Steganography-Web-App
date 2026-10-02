/**
 * A4.1 A2 comparator pass.
 *
 * For each configuration, evaluate the A2 seeded-random strategy (seeds 42-46) at the
 * MATCHED module budget: the largest tested budget at which the A3 packed candidate was
 * jsQR-exact (a jsQR-only proxy computed here; the both-decoder A3_CLEAN_MAX is decided
 * later from the merged results). This is a conservative comparator — A2 is given an
 * equal-or-larger module budget than the A3 clean operating point.
 *
 * Reads results/generalization_configs.csv + results/generalization_candidates.csv and
 * writes results/a2_matched.csv + outputs/gen/A2-matched PNGs.
 *
 * Usage: set A1_JSQR_PATH=... && node tests/run-a2-matched.js
 */

import fs from 'node:fs';
import path from 'node:path';
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
import '../js/target-corpus.js';
import '../js/operating-points.js';

const A1 = globalThis.StegoA1;
const A2 = globalThis.StegoA2;
const A3 = globalThis.StegoA3;
const A4 = globalThis.StegoA4;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A4_DIR = path.resolve(__dirname, '..');
if (!process.env.A1_JSQR_PATH) { console.error('A1_JSQR_PATH is not set.'); process.exit(2); }
const require = createRequire(import.meta.url);
const jsQR = require(path.resolve(process.env.A1_JSQR_PATH));

const resultsDir = path.join(A4_DIR, 'results');
const outputsDir = path.join(A4_DIR, 'outputs', 'gen');

function readCsv(file) {
  const text = fs.readFileSync(path.join(resultsDir, file), 'utf8').trim();
  const [header, ...lines] = text.split(/\r?\n/);
  const columns = header.split(',');
  return lines.map((line) => {
    // Minimal CSV parse safe for our own machine-written rows (no embedded commas in these).
    const cells = line.split(',');
    const row = {};
    columns.forEach((name, i) => { row[name] = cells[i]; });
    return row;
  });
}

const configs = readCsv('generalization_configs.csv');
// Prefer the OpenCV-merged candidate table so the matched budget is A3_CLEAN_MAX (both
// decoders exact); fall back to jsQR-only if OpenCV has not run yet.
const mergedPath = path.join(resultsDir, 'generalization_candidates_with_opencv.csv');
const candidates = readCsv(fs.existsSync(mergedPath) ? 'generalization_candidates_with_opencv.csv' : 'generalization_candidates.csv');
const hasOpenCv = candidates.length > 0 && 'opencv_decode_status' in candidates[0];
const targetsById = new Map(A4.TARGETS.map((t) => [t.id, t]));
const SEEDS = A2.DEFAULT_SEEDS;
const decode = A1.jsQrDecoder(jsQR);

const out = [];
let done = 0;
for (const config of configs) {
  const target = targetsById.get(config.target_id);
  const best = A4.bestA1PerEcc({ payload: config.payload, target: target.matrix, eccLevel: config.ecc });
  if (!best) continue;
  const base = best.candidate;
  const codewordInfo = A2.codewordMapFor(config.ecc);
  const eligible = A2.buildEligiblePositions(base.matrix, base.roleMap, target.matrix, codewordInfo);

  const exactBudgets = candidates
    .filter((c) => c.config_id === config.config_id
      && (!hasOpenCv || c.opencv_decode_status === 'EXACT')
      && c.jsqr_decode_status === 'EXACT')
    .map((c) => Number(c.module_budget));
  const matchedBudget = exactBudgets.length ? Math.max(...exactBudgets) : 0;

  for (const seed of SEEDS) {
    const ordered = A2.seededShuffle(eligible, seed);
    const { matrix, changed } = A2.applyBudget(base.matrix, ordered, matchedBudget, target.matrix);
    const metrics = A1.compareMatrixToTarget(matrix, base.roleMap, target.matrix);
    const damage = A3.codewordDamage(changed);
    const image = A1.renderMatrixToImageData({ matrix, moduleScale: A1.DEFAULT_MODULE_SCALE, quietZone: A1.DEFAULT_QUIET_ZONE });
    const decodedResult = decode(image);
    const detected = decodedResult !== null && decodedResult !== undefined;
    const jsqrDecodeStatus = A2.classifyDecode({ ran: true, detected, payload: decodedResult, expected: config.payload, error: null });
    const filename = `A4_${config.config_id}_a2_seed${seed}_b${matchedBudget}.png`;
    fs.writeFileSync(path.join(outputsDir, filename), encodePng(image.width, image.height, image.data));
    out.push([
      config.config_id, config.target_id, config.payload, config.payload_bytes, config.ecc, base.mask, 'A2_RANDOM',
      matchedBudget, changed.length, damage.affectedCodewordCount,
      Math.round(metrics.fullSimilarity * 10000) / 10000, jsqrDecodeStatus, filename, seed,
    ]);
  }
  done++;
  if (done % 16 === 0) process.stdout.write(`  ${done}/${configs.length} configurations...\r`);
}

const columns = ['config_id', 'target_id', 'payload', 'payload_bytes', 'ecc', 'mask', 'strategy', 'module_budget', 'actual_modified_modules', 'affected_codeword_count', 'full_similarity_after', 'jsqr_decode_status', 'candidate_filename', 'seed'];
const lines = [columns.join(',')];
for (const row of out) lines.push(row.join(','));
fs.writeFileSync(path.join(resultsDir, 'a2_matched.csv'), lines.join('\r\n') + '\r\n', 'utf8');
console.log(`\nwrote ${out.length} A2 matched candidates (${SEEDS.length} seeds × ${configs.length} configs)`);
console.log('next: python validation/validate_opencv.py');
