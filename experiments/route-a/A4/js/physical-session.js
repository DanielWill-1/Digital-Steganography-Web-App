/**
 * A4.2 physical test session model.
 *
 * Pure logic for the physical-test recorder: trial records, CSV/JSON (de)serialization, and
 * per-condition rate aggregation with a Wilson 95% interval. Keeping this out of the HTML
 * makes it unit-testable and keeps the recorder a thin shell.
 *
 * Loaded as a classic script; publishes on `StegoA4`. No network, no backend.
 */

(function (global) {
  const StegoA4 = (global.StegoA4 = global.StegoA4 || {});

  const DECODE_STATUSES = ['EXACT', 'WRONG_PAYLOAD', 'NO_DETECTION', 'ERROR'];
  const TRIAL_COLUMNS = [
    'session_id', 'candidate_id', 'target', 'payload', 'payload_bytes', 'ecc', 'strategy', 'medium',
    'device', 'scanner_app', 'symbol_size', 'display_px', 'distance_mm', 'symbol_width_mm',
    'distance_to_width_ratio', 'angle_deg', 'lighting', 'attempt', 'decode_status', 'decoded_payload', 'notes', 'timestamp',
  ];

  function createSession(sessionId) {
    return { session_id: sessionId || `session-${Date.now()}`, created_at: new Date().toISOString(), trials: [] };
  }

  /** Validate a trial; returns {ok, errors}. Exact-payload rule is enforced. */
  function validateTrial(trial) {
    const errors = [];
    if (!trial.candidate_id) errors.push('candidate_id required');
    if (!trial.payload) errors.push('payload required');
    if (!DECODE_STATUSES.includes(trial.decode_status)) errors.push('invalid decode_status');
    if (trial.decode_status === 'EXACT' && trial.decoded_payload !== trial.payload) {
      errors.push('EXACT requires decoded_payload === payload');
    }
    const attempt = Number(trial.attempt);
    if (!Number.isInteger(attempt) || attempt < 1) errors.push('attempt must be an integer >= 1');
    return { ok: errors.length === 0, errors };
  }

  function addTrial(session, trial) {
    const check = validateTrial(trial);
    if (!check.ok) throw new Error(`invalid trial: ${check.errors.join('; ')}`);
    session.trials.push({ ...trial });
    return session;
  }

  /** Wilson 95% interval for a binomial proportion. */
  function wilson95(successes, trials) {
    if (!trials) return { low: null, high: null };
    const z = 1.959963984540054;
    const p = successes / trials;
    const denominator = 1 + (z * z) / trials;
    const centre = p + (z * z) / (2 * trials);
    const spread = z * Math.sqrt((p * (1 - p)) / trials + (z * z) / (4 * trials * trials));
    return { low: Math.max(0, (centre - spread) / denominator), high: Math.min(1, (centre + spread) / denominator) };
  }

  function summarizeTrials(trials) {
    const groups = new Map();
    for (const trial of trials) {
      const key = `${trial.candidate_id}|${trial.medium}|${trial.device}|${trial.symbol_size}|${trial.angle_deg}|${trial.lighting}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(trial);
    }
    const rows = [];
    for (const [key, group] of groups) {
      const first = group[0];
      const count = (status) => group.filter((t) => t.decode_status === status).length;
      const exact = count('EXACT');
      const interval = wilson95(exact, group.length);
      rows.push({
        key,
        candidateId: first.candidate_id,
        medium: first.medium,
        device: first.device,
        symbolSize: first.symbol_size,
        angleDeg: first.angle_deg,
        lighting: first.lighting,
        attemptCount: group.length,
        exactCount: exact,
        wrongPayloadCount: count('WRONG_PAYLOAD'),
        noDetectionCount: count('NO_DETECTION'),
        errorCount: count('ERROR'),
        exactRate: group.length ? exact / group.length : 0,
        wilsonLow: interval.low,
        wilsonHigh: interval.high,
      });
    }
    return rows;
  }

  function toCsv(session) {
    const cell = global.StegoA1.csvCell;
    const lines = [TRIAL_COLUMNS.join(',')];
    for (const trial of session.trials) {
      lines.push(TRIAL_COLUMNS.map((column) => cell(trial[column] === undefined ? '' : trial[column])).join(','));
    }
    return lines.join('\r\n') + '\r\n';
  }

  function parseCsv(text) {
    // Minimal RFC-4180-ish parser sufficient for our own exports (handles quotes and newlines).
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else field += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch === '\r') { /* skip */ }
      else field += ch;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
  }

  function fromCsv(text, sessionId) {
    const rows = parseCsv(text);
    if (!rows.length) return createSession(sessionId);
    const header = rows[0];
    const session = createSession(sessionId);
    for (const row of rows.slice(1)) {
      const trial = {};
      header.forEach((name, i) => { trial[name] = row[i] === undefined ? '' : row[i]; });
      session.trials.push(trial);
    }
    return session;
  }

  function toJson(session) { return JSON.stringify(session, null, 2); }
  function fromJson(text) { return JSON.parse(text); }

  Object.assign(StegoA4, {
    DECODE_STATUSES,
    TRIAL_COLUMNS,
    createSession,
    validateTrial,
    addTrial,
    wilson95,
    summarizeTrials,
    toCsv,
    fromCsv,
    toJson,
    fromJson,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
