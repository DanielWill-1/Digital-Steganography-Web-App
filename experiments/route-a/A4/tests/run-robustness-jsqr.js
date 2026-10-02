/**
 * A4 robustness — jsQR pass.
 *
 * Reads the transformed PNGs written by validation/synthetic_robustness.py, decodes each with
 * jsQR on identical pixels, writes robustness_results.csv (both decoders) and
 * robustness_summary.csv (per candidate, with per-family both-exact rates).
 *
 * Usage: set A1_JSQR_PATH=... && node tests/run-robustness-jsqr.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import '../../A1/js/qr-role-map.js';
import '../../A1/js/qr-experiment.js';
import '../../A1/js/export-results.js';
import '../../A2/js/metrics-a2.js';
import '../../A3/js/robustness-summary.js';
import { decodePng } from '../../A3/tests/png-read.js';

const A2 = globalThis.StegoA2;
const A3 = globalThis.StegoA3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A4_DIR = path.resolve(__dirname, '..');
if (!process.env.A1_JSQR_PATH) { console.error('A1_JSQR_PATH is not set.'); process.exit(2); }
const require = createRequire(import.meta.url);
const jsQR = require(path.resolve(process.env.A1_JSQR_PATH));

const resultsDir = path.join(A4_DIR, 'results');
const casesFile = path.join(resultsDir, 'robustness_cases.json');
if (!fs.existsSync(casesFile)) { console.error('run python validation/synthetic_robustness.py first'); process.exit(2); }
const bundle = JSON.parse(fs.readFileSync(casesFile, 'utf8'));

const CORE = bundle.preset_ids;
const summaryInput = [];
const rows = [];
for (const item of bundle.cases) {
  const png = fs.readFileSync(path.join(A4_DIR, 'outputs', item.image));
  const { width, height, rgba } = decodePng(png);
  const result = jsQR(rgba, width, height, { inversionAttempts: 'attemptBoth' });
  const detected = result !== null;
  const payload = result ? result.data : null;
  const jsqrStatus = A2.classifyDecode({ ran: true, detected, payload, expected: item.payload, error: null });
  const opencvStatus = item.opencv_decode_status;

  summaryInput.push({
    candidateId: item.candidate_id,
    strategy: item.strategy,
    moduleBudget: item.module_budget,
    similarity: item.similarity,
    affectedCodewordCount: item.affected_codeword_count,
    transformFamily: item.transform_family,
    jsqrDecodeStatus: jsqrStatus,
    opencvDecodeStatus: opencvStatus,
  });

  rows.push([
    item.case_id, item.candidate_id, item.config_id, item.target_id, item.strategy, item.payload, item.ecc,
    item.module_budget, item.affected_codeword_count, item.similarity, item.transform_family, item.transform_id,
    item.transform_parameters,
    detected, payload, jsqrStatus === 'EXACT', jsqrStatus,
    item.opencv_detected, item.opencv_payload, item.opencv_payload_correct, opencvStatus,
  ]);
}

const columns = ['case_id', 'candidate_id', 'config_id', 'target_id', 'strategy', 'payload', 'ecc',
  'module_budget', 'affected_codeword_count', 'similarity', 'transform_family', 'transform_id', 'transform_parameters',
  'jsqr_detected', 'jsqr_payload', 'jsqr_payload_correct', 'jsqr_decode_status',
  'opencv_detected', 'opencv_payload', 'opencv_payload_correct', 'opencv_decode_status'];
const cell = globalThis.StegoA1.csvCell;
const lines = [columns.join(',')];
for (const row of rows) lines.push(row.map(cell).join(','));
fs.writeFileSync(path.join(resultsDir, 'robustness_results.csv'), lines.join('\r\n') + '\r\n', 'utf8');

// Per-candidate summary; join config/target/payload/ecc from the first case of each candidate.
const summary = A3.summarizeRobustness(summaryInput);
const meta = new Map();
for (const item of bundle.cases) {
  if (!meta.has(item.candidate_id)) meta.set(item.candidate_id, item);
}
const summaryColumns = ['candidate_id', 'config_id', 'target_id', 'payload', 'ecc', 'strategy', 'module_budget',
  'similarity', 'affected_codewords', 'transform_case_count',
  'jsqr_exact_count', 'jsqr_exact_rate', 'opencv_exact_count', 'opencv_exact_rate', 'both_exact_count', 'both_exact_rate',
  'resize_exact_rate', 'blur_exact_rate', 'jpeg_exact_rate', 'rotation_exact_rate', 'perspective_exact_rate'];
const summaryLines = [summaryColumns.join(',')];
const r4 = (v) => (v === null || v === undefined ? '' : Math.round(v * 10000) / 10000);
for (const row of summary) {
  const m = meta.get(row.candidateId) || {};
  summaryLines.push([
    row.candidateId, m.config_id, m.target_id, m.payload, m.ecc, row.strategy, row.moduleBudget,
    r4(row.similarity), row.affectedCodewords, row.transformCaseCount,
    row.jsqrExactCount, r4(row.jsqrExactRate), row.opencvExactCount, r4(row.opencvExactRate), row.bothExactCount, r4(row.bothExactRate),
    r4(row.resizeExactRate), r4(row.blurExactRate), r4(row.jpegExactRate), r4(row.rotationExactRate), r4(row.perspectiveExactRate),
  ].map(cell).join(','));
}
fs.writeFileSync(path.join(resultsDir, 'robustness_summary.csv'), summaryLines.join('\r\n') + '\r\n', 'utf8');

console.log(`A4 robustness: ${rows.length} cases; jsQR exact ${summaryInput.filter((c) => c.jsqrDecodeStatus === 'EXACT').length}, OpenCV exact ${summaryInput.filter((c) => c.opencvDecodeStatus === 'EXACT').length}`);
console.log(`wrote robustness_results.csv and robustness_summary.csv (${summary.length} candidates)`);
console.log('next: python validation/analyze_results.py');
