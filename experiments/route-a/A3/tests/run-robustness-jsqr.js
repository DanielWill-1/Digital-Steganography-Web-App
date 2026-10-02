/**
 * A3 robustness — jsQR pass.
 *
 * Reads the transformed PNGs written by `validation/synthetic_robustness.py`, decodes each
 * with jsQR on the identical pixels, fills the jsQR columns, rewrites robustness_results.csv
 * with both decoders, and writes robustness_summary.csv.
 *
 * Requires A1_JSQR_PATH (the project adds no dependency; a local jsQR 1.4.0 copy is used).
 *
 * Usage:
 *   set A1_JSQR_PATH=C:\path\to\jsQR.js && node tests/run-robustness-jsqr.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import '../../A1/js/qr-role-map.js';
import '../../A1/js/qr-experiment.js';
import '../../A1/js/export-results.js';
import '../../A2/js/metrics-a2.js';
import '../js/robustness-summary.js';
import '../js/export-results.js';
import { decodePng } from './png-read.js';

const A2 = globalThis.StegoA2;
const A3 = globalThis.StegoA3;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const A3_DIR = path.resolve(__dirname, '..');

if (!process.env.A1_JSQR_PATH) {
  console.error('A1_JSQR_PATH is not set. Point it at a local jsQR 1.4.0 copy (see A1 README).');
  process.exit(2);
}
const require = createRequire(import.meta.url);
const jsQR = require(path.resolve(process.env.A1_JSQR_PATH));

const resultsDir = path.join(A3_DIR, 'results');
const casesFile = path.join(resultsDir, 'robustness_cases.json');
if (!fs.existsSync(casesFile)) {
  console.error(`Missing ${casesFile}. Run: python validation/synthetic_robustness.py`);
  process.exit(2);
}
const bundle = JSON.parse(fs.readFileSync(casesFile, 'utf8'));

const cases = [];
for (const item of bundle.cases) {
  const png = fs.readFileSync(path.join(A3_DIR, 'outputs', item.image));
  const { width, height, rgba } = decodePng(png);
  const result = jsQR(rgba, width, height, { inversionAttempts: 'attemptBoth' });
  const detected = result !== null;
  const payload = result ? result.data : null;
  const jsqrStatus = A2.classifyDecode({ ran: true, detected, payload, expected: bundle.payload, error: null });
  cases.push({
    candidateId: item.candidate_id,
    strategy: item.strategy,
    baseEcc: item.base_ecc,
    baseMask: item.base_mask,
    moduleBudget: item.module_budget,
    affectedCodewordCount: item.affected_codeword_count,
    similarity: item.similarity,
    transformFamily: item.transform_family,
    transformId: item.transform_id,
    transformParameters: item.transform_parameters,
    jsqrDetected: detected,
    jsqrPayload: payload,
    jsqrPayloadCorrect: jsqrStatus === 'EXACT',
    jsqrDecodeStatus: jsqrStatus,
    opencvDetected: item.opencv_detected === 'true',
    opencvPayload: item.opencv_payload,
    opencvPayloadCorrect: item.opencv_payload_correct === 'true',
    opencvDecodeStatus: item.opencv_decode_status,
  });
}

fs.writeFileSync(path.join(resultsDir, 'robustness_results.csv'), A3.buildRobustnessResultsCsv(cases), 'utf8');
const summary = A3.summarizeRobustness(cases);
fs.writeFileSync(path.join(resultsDir, 'robustness_summary.csv'), A3.buildRobustnessSummaryCsv(summary), 'utf8');

console.log(`robustness: ${cases.length} candidate×transform cases`);
console.log(`jsQR exact ${cases.filter((c) => c.jsqrDecodeStatus === 'EXACT').length}, OpenCV exact ${cases.filter((c) => c.opencvDecodeStatus === 'EXACT').length}, both ${cases.filter((c) => c.jsqrDecodeStatus === 'EXACT' && c.opencvDecodeStatus === 'EXACT').length}`);
console.log('\ncandidate                         budget  sim      cw  jsQR  OpenCV  both');
for (const row of summary) {
  console.log(
    `${row.candidateId.padEnd(32)} ${String(row.moduleBudget).padStart(5)}  ${(row.similarity * 100).toFixed(2)}%  ${String(row.affectedCodewords).padStart(2)}  ` +
    `${(row.jsqrExactCount + '/' + row.transformCaseCount).padStart(5)}  ${(row.opencvExactCount + '/' + row.transformCaseCount).padStart(6)}  ${(row.bothExactCount + '/' + row.transformCaseCount).padStart(5)}`,
  );
}
console.log(`\nwrote robustness_results.csv and robustness_summary.csv to results/`);
