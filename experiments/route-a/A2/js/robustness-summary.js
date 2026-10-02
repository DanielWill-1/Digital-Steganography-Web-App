/**
 * A2 robustness summary: aggregate trials by budget and derive descriptive failure
 * observations.
 *
 * Loaded as a plain script (no ES modules). Publishes on the shared `StegoA2` namespace.
 *
 * All failure figures are *observations* from the tested budget set, not theoretical
 * thresholds. In particular a decode may fail at one budget and succeed at a larger one
 * because of structural interactions, so "first failure" is not "the limit".
 */

(function (global) {
  const StegoA2 = (global.StegoA2 = global.StegoA2 || {});

  function mean(values) {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  /** Aggregate trials by requested budget (across all seeds and bases). */
  function summarizeByBudget(trials) {
    const budgets = [...new Set(trials.map((trial) => trial.budget))].sort((a, b) => a - b);
    return budgets.map((budget) => {
      const group = trials.filter((trial) => trial.budget === budget);
      const statusCount = (status) => group.filter((trial) => trial.decodeStatus === status).length;
      const exact = statusCount('EXACT');
      const similarityValues = group.map((trial) => trial.fullSimilarityAfter);
      const modifiedValues = group.map((trial) => trial.actualModifiedModules);
      const codewordValues = group
        .filter((trial) => trial.affectedCodewordCount !== null)
        .map((trial) => trial.affectedCodewordCount);
      return {
        budget,
        actualModifiedModules: Math.round(mean(modifiedValues)),
        trialCount: group.length,
        decodedTrials: group.filter((trial) => trial.decodeStatus !== null).length,
        exactDecodeCount: exact,
        wrongPayloadCount: statusCount('WRONG_PAYLOAD'),
        noDetectionCount: statusCount('NO_DETECTION'),
        decoderErrorCount: statusCount('DECODER_ERROR'),
        exactDecodeRate: group.length ? exact / group.length : 0,
        similarityAfterMean: mean(similarityValues),
        similarityAfterMin: similarityValues.length ? Math.min(...similarityValues) : 0,
        similarityAfterMax: similarityValues.length ? Math.max(...similarityValues) : 0,
        affectedCodewordsMean: codewordValues.length ? mean(codewordValues) : null,
        affectedCodewordsMin: codewordValues.length ? Math.min(...codewordValues) : null,
        affectedCodewordsMax: codewordValues.length ? Math.max(...codewordValues) : null,
      };
    });
  }

  /**
   * Descriptive failure statistics.
   *
   * Returns per-seed observations plus the global observations:
   *   firstObservedFailureBudget        smallest budget at which any trial failed
   *   largestSuccessfulTestedBudget     largest budget at which any trial decoded exactly
   *   observedSustainedFailureBudget    smallest budget B after which every tested larger
   *                                     budget also failed (or null)
   */
  function failureObservations(trials) {
    const byRun = new Map();
    for (const trial of trials) {
      const key = trial.baseCandidateId + '|' + trial.seed;
      if (!byRun.has(key)) byRun.set(key, []);
      byRun.get(key).push(trial);
    }

    const perSeed = [];
    for (const [key, group] of byRun) {
      const ordered = group.slice().sort((a, b) => a.budget - b.budget);
      const exactBudgets = ordered
        .filter((trial) => trial.decodeStatus === 'EXACT')
        .map((trial) => trial.budget);
      const failureBudgets = ordered
        .filter((trial) => trial.decodeStatus !== null && trial.decodeStatus !== 'EXACT')
        .map((trial) => trial.budget);
      perSeed.push({
        key,
        baseCandidateId: ordered[0].baseCandidateId,
        seed: ordered[0].seed,
        largestExactBudget: exactBudgets.length ? Math.max(...exactBudgets) : null,
        firstFailureBudget: failureBudgets.length ? Math.min(...failureBudgets) : null,
      });
    }
    perSeed.sort((a, b) => a.seed - b.seed);

    const failures = trials.filter((trial) => trial.decodeStatus !== null && trial.decodeStatus !== 'EXACT');
    const exact = trials.filter((trial) => trial.decodeStatus === 'EXACT');
    const firstObservedFailureBudget = failures.length ? Math.min(...failures.map((t) => t.budget)) : null;
    const largestSuccessfulTestedBudget = exact.length ? Math.max(...exact.map((t) => t.budget)) : null;

    const budgets = [...new Set(trials.map((trial) => trial.budget))].sort((a, b) => a - b);
    let observedSustainedFailureBudget = null;
    for (const budget of budgets) {
      let total = 0;
      let allFailed = true;
      let anyUnknown = false;
      for (const trial of trials) {
        if (trial.budget < budget) continue;
        total++;
        if (trial.decodeStatus === null) anyUnknown = true;
        else if (trial.decodeStatus === 'EXACT') allFailed = false;
      }
      if (total > 0 && allFailed && !anyUnknown) {
        observedSustainedFailureBudget = budget;
        break;
      }
    }

    return {
      perSeed,
      firstObservedFailureBudget,
      largestSuccessfulTestedBudget,
      observedSustainedFailureBudget,
    };
  }

  Object.assign(StegoA2, { summarizeByBudget, failureObservations });
})(typeof globalThis !== 'undefined' ? globalThis : this);
