/**
 * A4 dataset integrity check (cross-validation of the final CSVs, §77).
 *
 * Verifies the exported result tables are internally consistent: unique ids, valid ECC/mask
 * values, correct payload byte counts, similarity ranges, expected row counts, and that every
 * candidate resolves to a config. Physical results are validated only if present.
 *
 * Usage: node tests/verify-dataset.js   (exit 1 on any failure)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.resolve(__dirname, '..', 'results');
const targetsDir = path.resolve(__dirname, '..', 'targets');

let failures = 0;
function check(name, condition, detail = '') {
  if (condition) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}
function readCsv(file) {
  const full = path.join(resultsDir, file);
  if (!fs.existsSync(full)) return null;
  const [header, ...lines] = fs.readFileSync(full, 'utf8').trim().split(/\r?\n/);
  const columns = header.split(',');
  return lines.map((line) => {
    const row = {};
    columns.forEach((name, i) => { row[name] = line.split(',')[i]; });
    return row;
  });
}

console.log('\nA4 dataset integrity');

const configs = readCsv('generalization_configs.csv');
const candidates = readCsv('generalization_candidates_with_opencv.csv') || readCsv('generalization_candidates.csv');
check('generalization_configs.csv exists', configs !== null);
check('generalization_candidates.csv exists', candidates !== null);

if (configs) {
  const ids = configs.map((c) => c.config_id);
  check('config ids unique', new Set(ids).size === ids.length);
  check('configuration count is 96 (8 targets x 3 payloads x 4 ECC)', configs.length === 96, `got ${configs.length}`);
  check('all ECC values valid', configs.every((c) => ['L', 'M', 'Q', 'H'].includes(c.ecc)));
  check('payload byte counts correct', configs.every((c) => Number(c.payload_bytes) === Buffer.byteLength(c.payload, 'utf8')));
  check('a1_similarity in [0,1]', configs.every((c) => { const v = Number(c.a1_similarity); return v >= 0 && v <= 1; }));
  check('eligible mismatches non-negative', configs.every((c) => Number(c.eligible_mismatches) >= 0));
  check('base_filename present', configs.every((c) => c.base_filename));
}

if (candidates && configs) {
  const configIds = new Set(configs.map((c) => c.config_id));
  check('every candidate resolves to a config', candidates.every((c) => configIds.has(c.config_id)));
  check('candidate filenames unique', new Set(candidates.map((c) => c.candidate_filename)).size === candidates.length);
  const seen = new Set();
  let dup = false;
  for (const c of candidates) {
    const key = `${c.config_id}|${c.module_budget}`;
    if (seen.has(key)) dup = true;
    seen.add(key);
  }
  check('no duplicate (config, budget) rows', !dup);
  check('candidate ECC valid', candidates.every((c) => ['L', 'M', 'Q', 'H'].includes(c.ecc)));
  check('candidate similarity in [0,1]', candidates.every((c) => { const v = Number(c.full_similarity_after); return v >= 0 && v <= 1; }));
}

const corpusPath = path.join(targetsDir, 'target_corpus.json');
check('target_corpus.json exists', fs.existsSync(corpusPath));
if (fs.existsSync(corpusPath)) {
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  check('8 targets in corpus', corpus.targets.length === 8, `got ${corpus.targets.length}`);
  check('target ids unique', new Set(corpus.targets.map((t) => t.target_id)).size === corpus.targets.length);
  check('each matrix is 21x21 binary', corpus.targets.every((t) => t.matrix.length === 21 && t.matrix.every((r) => r.length === 21 && r.every((v) => v === 0 || v === 1))));
  check('each target has a matrix hash', corpus.targets.every((t) => typeof t.matrix_hash === 'string' && t.matrix_hash.length === 64));
  check('each target has a source sha256', corpus.targets.every((t) => typeof t.source_sha256 === 'string' && t.source_sha256.length === 64));
}

const op = readCsv('operating_points.csv');
if (op) {
  check('operating_points has one row per config', !configs || op.length === configs.length);
  check('operating_points has a3_robust_budget or empty', op.every((r) => r.a3_robust_budget === '' || Number.isInteger(Number(r.a3_robust_budget))));
}

const phys = readCsv('physical_summary.csv');
check('physical status is PENDING or validated', !phys || phys.every((r) => Number(r.attempt_count) > 0));
console.log(phys ? '  note: physical_summary.csv present (validated counts)' : '  note: no physical data yet (PHYSICAL VALIDATION PENDING)');

console.log(`\n${failures === 0 ? 'dataset integrity OK' : failures + ' integrity failures'}`);
process.exitCode = failures ? 1 : 0;
