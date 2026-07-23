export const STAGES = [
  { agent: 'acquisition', requested: 'acquisition.requested', completed: 'acquisition.completed' },
  { agent: 'intelligence_processing', requested: 'intelligence.processing.requested', completed: 'intelligence.processing.completed' },
  { agent: 'release_eligibility_aoie', requested: 'matching.requested', completed: 'matching.completed' },
  { agent: 'dashboard_delivery', requested: 'dashboard.delivery.requested', completed: 'dashboard.delivery.completed' },
  { agent: 'executive_reporting', requested: 'executive.brief.requested', completed: 'daily.operations.completed' },
];

export function idempotencyKey(runId, agent, entityType = 'daily_run', entityId = runId) {
  return [runId, agent, entityType, entityId || 'none'].join(':');
}

export function groupRowsByKeySet(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = Object.keys(row).sort().join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()];
}

export function normalizeFeedback(input = {}) {
  const relevance = new Set(['very_relevant', 'somewhat_relevant', 'not_relevant']);
  const experience = new Set(['excellent', 'good', 'fair', 'poor']);
  const sessionId = String(input.session_id || '').trim();
  const improvement = String(input.improvement_comment || '').trim().slice(0, 2000);
  const viewed = Math.max(0, Math.min(10000, Number(input.opportunities_viewed) || 0));
  const fit = Math.max(0, Math.min(10000, Number(input.analyze_fit_count) || 0));
  if (sessionId.length < 8 || sessionId.length > 200) throw new Error('A valid visit session ID is required.');
  if (!relevance.has(input.relevance_rating)) throw new Error('Invalid relevance response.');
  if (!experience.has(input.experience_rating)) throw new Error('Invalid experience rating.');
  return {
    session_id: sessionId,
    relevance_rating: input.relevance_rating,
    experience_rating: input.experience_rating,
    improvement_comment: improvement || null,
    opportunities_viewed: viewed,
    analyze_fit_count: fit,
    completed_stage: String(input.completed_stage || 'dashboard').trim().slice(0, 100) || 'dashboard',
    submitted_at: new Date().toISOString(),
  };
}

export function releaseDecision(row, now = Date.now()) {
  const reasons = [];
  const current = new Set(['open', 'active', 'posted', 'upcoming', 'open_continuous']);
  const status = String(row.status || '').toLowerCase();
  if (!current.has(status)) reasons.push('not_current');
  const deadline = row.response_deadline ? Date.parse(row.response_deadline) : NaN;
  if (!Number.isFinite(deadline) || deadline < now) reasons.push('invalid_deadline');
  if (!String(row.official_source_url || row.source_url || '').trim()) reasons.push('missing_official_source');
  if (!String(row.issuing_organization || '').trim()) reasons.push('missing_issuer');
  const docs = Array.isArray(row.document_urls) ? row.document_urls : [];
  if (!String(row.description || '').trim() && docs.length === 0) reasons.push('missing_scope_or_documents');
  const requirements = row.requirements && typeof row.requirements === 'object' ? row.requirements : {};
  if (!Object.keys(requirements).length && row.natcorp_contract_dna_status !== 'complete') reasons.push('missing_requirements');
  if (row.duplicate_of) reasons.push('duplicate');
  if (row.is_latest_version === false) reasons.push('superseded');
  if (['rejected', 'failed'].includes(String(row.qa_status || '').toLowerCase())) reasons.push('qa_rejected');
  const hard = new Set(['not_current', 'invalid_deadline', 'duplicate', 'superseded', 'qa_rejected']);
  return { status: reasons.length === 0 ? 'eligible' : reasons.some((x) => hard.has(x)) ? 'rejected' : 'enrichment_required', reasons };
}

export function scoreSurvey(rows = []) {
  if (!rows.length) return { responses: 0, relevance_score: null, experience_score: null };
  const relevance = { very_relevant: 100, somewhat_relevant: 60, not_relevant: 0 };
  const experience = { excellent: 100, good: 75, fair: 45, poor: 0 };
  const avg = (values) => Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  return {
    responses: rows.length,
    relevance_score: avg(rows.map((r) => relevance[r.relevance_rating] ?? 0)),
    experience_score: avg(rows.map((r) => experience[r.experience_rating] ?? 0)),
  };
}

export function buildExecutiveBrief({ run, jobs = [], feedback = [], inventory = {} }) {
  const outputs = Object.fromEntries(jobs.map((j) => [j.agent_type, j.output_payload || {}]));
  const acq = outputs.acquisition || {};
  const intel = outputs.intelligence_processing || {};
  const match = outputs.release_eligibility_aoie || {};
  const delivery = outputs.dashboard_delivery || {};
  const survey = scoreSurvey(feedback);
  const failed = jobs.filter((j) => j.status === 'failed');
  const retries = jobs.reduce((n, j) => n + Math.max(0, Number(j.attempts || 0) - 1), 0);
  const runtimes = jobs.map((j) => Date.parse(j.completed_at || 0) - Date.parse(j.started_at || 0)).filter((n) => n >= 0);
  const avgRuntime = runtimes.length ? Math.round(runtimes.reduce((a, b) => a + b, 0) / runtimes.length) : 0;
  const connectorFailures = (acq.connectors || []).filter((c) => ['failed', 'partial'].includes(c.status));
  const reportingInProgress = jobs.some((j) => j.agent_type === 'executive_reporting' && j.status === 'running');
  const successfulJobs = jobs.filter((j) => j.status === 'completed').length + (reportingInProgress ? 1 : 0);
  const common = new Map();
  feedback.forEach((r) => { const text = String(r.improvement_comment || '').trim(); if (text) common.set(text, (common.get(text) || 0) + 1); });
  const mostRequested = [...common.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const enterprise = failed.length ? 'ATTENTION REQUIRED' : connectorFailures.length ? 'OPERATING WITH WARNINGS' : 'OPERATIONAL';
  const metrics = {
    acquisition: {
      publishers_scanned: acq.publishers_scanned || 0,
      connectors_executed: acq.connectors_executed || 0,
      new_opportunities: acq.inserted || 0,
      updated_opportunities: acq.updated || 0,
      closed_or_retired: acq.closed_or_retired || 0,
      failures: connectorFailures.length,
    },
    intelligence_processing: {
      documents_registered: intel.documents_registered || 0,
      documents_retrieved: intel.documents_retrieved || 0,
      piee_extractions_completed: intel.piee_extractions_completed || 0,
      contract_dna_completed: intel.contract_dna_completed || 0,
      enrichment_required: intel.enrichment_required || 0,
    },
    aoie_and_delivery: {
      opportunities_evaluated: match.opportunities_evaluated || 0,
      dashboard_eligible: delivery.released || 0,
      strong_matches: match.strong_matches || 0,
      partial_matches: match.partial_matches || 0,
      conditional_matches: match.conditional_matches || 0,
      ineligible_records: (delivery.rejected || 0) + (delivery.enrichment_required || 0),
      dashboard_releases: delivery.released || 0,
    },
    customer_intelligence: {
      sessions: inventory.sessions || 0,
      survey_responses: survey.responses,
      relevance_score: survey.relevance_score,
      experience_score: survey.experience_score,
      most_common_requested_improvement: mostRequested,
      analyze_fit_usage: feedback.reduce((n, r) => n + Number(r.analyze_fit_count || 0), 0),
      opportunity_engagement: feedback.reduce((n, r) => n + Number(r.opportunities_viewed || 0), 0),
    },
    system_health: {
      successful_agent_jobs: successfulJobs,
      failed_agent_jobs: failed.length,
      retry_count: retries,
      average_runtime_ms: avgRuntime,
      connector_failures: connectorFailures.length,
      pipeline_bottlenecks: failed.map((j) => j.agent_type),
    },
    cio_decision_metrics: {
      opportunity_inventory_growth: (acq.inserted || 0) - (acq.closed_or_retired || 0),
      current_actionable_inventory: inventory.current_actionable || 0,
      dashboard_eligibility_rate: inventory.evaluated ? Math.round((inventory.eligible || 0) / inventory.evaluated * 1000) / 10 : 0,
      contract_intelligence_completion_rate: intel.opportunities_processed ? Math.round((intel.contract_dna_completed || 0) / intel.opportunities_processed * 1000) / 10 : 0,
      connector_success_rate: acq.connectors_executed ? Math.round(((acq.connectors_executed - connectorFailures.length) / acq.connectors_executed) * 1000) / 10 : 0,
      aoie_release_rate: inventory.evaluated ? Math.round((delivery.released || 0) / inventory.evaluated * 1000) / 10 : 0,
      customer_relevance_score: survey.relevance_score,
      customer_experience_score: survey.experience_score,
    },
  };
  const accomplishments = [
    `${acq.connectors_executed || 0} acquisition connector snapshots executed`,
    `${intel.contract_dna_completed || 0} Contract DNA records completed`,
    `${delivery.released || 0} opportunities released to the live eligibility feed`,
  ];
  const critical = [...connectorFailures.map((c) => `${c.job_id}: ${c.error || c.status}`), ...failed.map((j) => `${j.agent_type}: ${j.error_message || 'failed'}`)];
  const summary = `${enterprise}. ${accomplishments.join('; ')}.${critical.length ? ` Critical failures: ${critical.join('; ')}.` : ''}`;
  const recommendations = [];
  if (connectorFailures.length) recommendations.push('Repair or reauthorize failed acquisition connectors before the next daily cycle.');
  if ((intel.enrichment_required || 0) > 0) recommendations.push('Prioritize document retrieval and requirement enrichment for held records.');
  if (survey.relevance_score != null && survey.relevance_score < 70) recommendations.push('Review AOIE evidence thresholds and customer-requested improvements.');
  if (!recommendations.length) recommendations.push('Continue daily execution and monitor connector drift, release quality, and customer relevance.');
  return {
    enterprise_status: enterprise,
    executive_summary: summary,
    metrics,
    risks: critical.map((message) => ({ severity: 'high', message })),
    customer_intelligence: metrics.customer_intelligence,
    recommendations,
  };
}
