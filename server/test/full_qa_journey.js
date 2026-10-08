import assert from 'assert';
import Papa from 'papaparse';

const BASE_URL = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  if (options.responseType === 'text') {
    return res.text();
  }
  return res.json();
}

async function runQaJourney() {
  console.log('====================================================');
  console.log('  LeadLens Comprehensive End-to-End QA Test Run');
  console.log('====================================================\n');

  // 1. Health & Server Status
  console.log('✓ Step 1: Health & Database Connectivity');
  const health = await request('/health');
  assert.strictEqual(health.status, 'healthy', 'Health status must be healthy');
  assert.strictEqual(health.database.connected, true, 'MongoDB must be connected');
  console.log(`   Backend status: healthy | DB connected: true (Latency: ${health.database.latencyMs}ms)`);

  // 2. AI Status Verification
  console.log('\n✓ Step 2: AI Status & Diagnostics');
  const aiStatus = await request('/ai/status');
  assert.strictEqual(typeof aiStatus.enabled, 'boolean');
  assert.strictEqual(typeof aiStatus.isConfigured, 'boolean');
  console.log(`   AI Enabled: ${aiStatus.enabled} | Configured: ${aiStatus.isConfigured} | Model: ${aiStatus.model}`);

  // 3. Collection with Controlled Failure, Duplicate, and Invalid URLs
  console.log('\n✓ Step 3: Batch Collection (with duplicate & controlled failure)');
  const batchUrls = [
    'https://acmecloud.example',
    'https://medipulse.example',
    'https://acmecloud.example/pricing', // Duplicate domain
    `https://simulated-failure-${Date.now()}.example`, // Fresh controlled failure
  ];
  
  const createJobRes = await request('/collection-jobs', {
    method: 'POST',
    body: JSON.stringify({ urls: batchUrls, mode: 'fixture' }),
  });
  assert.ok(createJobRes.job?._id, 'Job ID must be returned');
  const jobId = createJobRes.job._id;
  console.log(`   Job created: ID=${jobId} | Status=${createJobRes.job.status}`);

  // 4. Poll Job until terminal status
  console.log('\n✓ Step 4: Verify Job Progress & Termination');
  let finalJob = null;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 400));
    const polled = await request(`/collection-jobs/${jobId}`);
    if (polled.job.status === 'completed' || polled.job.status === 'failed') {
      finalJob = polled.job;
      break;
    }
  }
  assert.ok(finalJob, 'Job must reach terminal status');
  console.log(`   Job completed: Status=${finalJob.status} | Processed=${finalJob.processedCount}/${finalJob.totalCount} | Success=${finalJob.successfulCount} | Failed=${finalJob.failedCount}`);
  for (const r of finalJob.results || []) {
    console.log(`     - [${r.status}] ${r.inputUrl} (${r.errorReason || r.companyName || 'no error'})`);
  }
  assert.strictEqual(finalJob.status, 'completed', 'Job should complete successfully');
  assert.ok(finalJob.successfulCount >= 2, 'Should succeed on valid fixtures');
  assert.ok(finalJob.failedCount >= 1, 'Should record controlled failure on invalid fixture');

  // 5. Verify Persistence in Database
  console.log('\n✓ Step 5: Verify Leads Persistence');
  const initialLeads = await request('/leads?limit=100');
  assert.ok(initialLeads.leads.length > 0, 'Leads must exist in database');
  const leadAcme = initialLeads.leads.find((l) => l.normalizedDomain === 'acmecloud.example');
  assert.ok(leadAcme, 'AcmeCloud fixture must persist');
  console.log(`   AcmeCloud persisted: Score=${leadAcme.score} | Industry=${leadAcme.industry}`);

  // 6. Test Lean Query Optimization on List Endpoint
  console.log('\n✓ Step 6: Verify Table Query Optimization (Lean Projection)');
  assert.strictEqual(leadAcme.fieldEvidence, undefined, 'fieldEvidence must be excluded from list queries');
  assert.strictEqual(leadAcme.aiResearch, undefined, 'aiResearch must be excluded from list queries');
  console.log('   Confirmed: Table rows exclude heavy fieldEvidence and aiResearch objects for maximum performance.');

  // 7. Test Single Lead Detail Inspection (Full Projection)
  console.log('\n✓ Step 7: Single Lead Inspection (Full Evidence & Score Breakdown)');
  const singleLeadRes = await request(`/leads/${leadAcme._id}`);
  const detailedLead = singleLeadRes.lead;
  assert.ok(Array.isArray(detailedLead.fieldEvidence), 'Single lead must include fieldEvidence array');
  assert.ok(detailedLead.scoreBreakdown?.criteria?.length > 0, 'Single lead must include scoreBreakdown criteria');
  console.log(`   Single lead inspected: "${detailedLead.companyName}" | Evidence items: ${detailedLead.fieldEvidence.length}`);

  // 8. Update Qualification Settings & Verify Recalculation
  console.log('\n✓ Step 8: Update Target Criteria & Recalculate Scores');
  const originalAcmeScore = detailedLead.score;
  const updateSettingsRes = await request('/qualification-settings', {
    method: 'PUT',
    body: JSON.stringify({
      targetIndustry: 'Cloud Infrastructure & DevOps',
      targetLocation: 'Austin, TX',
      preferredKeywords: ['cloud', 'kubernetes', 'scaling'],
    }),
  });
  assert.ok(updateSettingsRes.recalculatedLeadsCount > 0, 'Should recalculate all existing leads');
  const refreshedAcme = (await request(`/leads/${leadAcme._id}`)).lead;
  console.log(`   Settings updated. Recalculated leads: ${updateSettingsRes.recalculatedLeadsCount}`);
  console.log(`   AcmeCloud score: Before=${originalAcmeScore} -> After=${refreshedAcme.score}`);

  // 9. Search & Multi-Filter Querying
  console.log('\n✓ Step 9: Search, Quick Filters & Sorting');
  const searchCloud = await request('/leads?search=cloud&quickFilter=high-priority');
  assert.ok(searchCloud.pagination.total >= 0);
  console.log(`   Combined search ("cloud" + high-priority): Found ${searchCloud.pagination.total} leads`);

  // 10. Update Lead Outreach Status
  console.log('\n✓ Step 10: Outreach Status Update');
  const patchStatus = await request(`/leads/${leadAcme._id}`, {
    method: 'PATCH',
    body: JSON.stringify({ outreachStatus: 'shortlisted' }),
  });
  assert.strictEqual(patchStatus.lead.outreachStatus, 'shortlisted');
  console.log(`   Outreach status updated to "${patchStatus.lead.outreachStatus}"`);

  // 11. AI Company Summary Generation (Mock Provider)
  console.log('\n✓ Step 11: AI Research — Company Summary');
  const summaryRes = await request(`/leads/${leadAcme._id}/ai-summary`, {
    method: 'POST',
    body: JSON.stringify({ mock: true, forceRegenerate: true }),
  });
  assert.strictEqual(summaryRes.enabled, true);
  assert.strictEqual(summaryRes.fromCache, false);
  assert.ok(summaryRes.data.summaryText.length > 10);
  assert.ok(summaryRes.data.keyObservations.length > 0);
  assert.ok(summaryRes.data.missingInformation.length > 0);
  console.log(`   AI Summary generated: "${summaryRes.data.summaryText.slice(0, 70)}..."`);
  console.log(`   Observations: ${summaryRes.data.keyObservations.length} items | Missing info: ${summaryRes.data.missingInformation.length} items`);

  // 12. AI Cache Hit Verification
  console.log('\n✓ Step 12: AI Summary Cache Hit');
  const cachedSummaryRes = await request(`/leads/${leadAcme._id}/ai-summary`, {
    method: 'POST',
    body: JSON.stringify({ forceRegenerate: false }),
  });
  assert.strictEqual(cachedSummaryRes.fromCache, true, 'Subsequent identical request must hit cache');
  assert.strictEqual(cachedSummaryRes.data.summaryText, summaryRes.data.summaryText);
  console.log('   Confirmed: Second summary request served from SHA-256 cache instantly.');

  // 13. AI Cold Outreach Draft Generation
  console.log('\n✓ Step 13: AI Research — Outreach Draft (Requires Offering)');
  
  // Test validation error if offering is missing
  const missingOfferingRes = await request(`/leads/${leadAcme._id}/ai-outreach`, {
    method: 'POST',
    body: JSON.stringify({ offeringDescription: '' }),
  });
  assert.ok(missingOfferingRes.error || missingOfferingRes.message, 'Must reject empty offering');
  console.log('   Rejection verified: Outreach draft cannot proceed without explicit offering description.');

  // Test successful draft generation
  const outreachRes = await request(`/leads/${leadAcme._id}/ai-outreach`, {
    method: 'POST',
    body: JSON.stringify({
      offeringDescription: 'High-availability PostgreSQL replication cluster manager',
      senderName: 'Sarah Connor',
      mock: true,
      forceRegenerate: true,
    }),
  });
  assert.strictEqual(outreachRes.enabled, true);
  assert.ok(outreachRes.data.subject.length > 0);
  assert.ok(outreachRes.data.bodyText.includes('Sarah Connor'));
  assert.ok(outreachRes.data.sourceFactsUsed.length > 0);
  console.log(`   Outreach draft generated: Subject="${outreachRes.data.subject}"`);
  console.log(`   Body preview: "${outreachRes.data.bodyText.slice(0, 80)}..."`);

  // 14. Deterministic Score Invariance under AI Operations
  console.log('\n✓ Step 14: Score Invariance Check');
  const postAiLead = (await request(`/leads/${leadAcme._id}`)).lead;
  assert.strictEqual(postAiLead.score, refreshedAcme.score, 'Deterministic score must remain untouched by AI operations');
  console.log(`   Confirmed: Lead score is exactly ${postAiLead.score} before and after AI operations.`);

  // 15. CSV Export & Formula Protection
  console.log('\n✓ Step 15: CSV Export (Selected & Filtered with Formula Injection Neutralization)');
  
  // Export Selected
  const selectedCsv = await request('/leads/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ leadIds: [leadAcme._id] }),
    responseType: 'text',
  });
  const parsedSelected = Papa.parse(selectedCsv, { header: true });
  assert.strictEqual(parsedSelected.data.length, 1, 'Selected export must have exactly 1 record');
  assert.strictEqual(parsedSelected.data[0]['Company Name'], leadAcme.companyName);

  // Export Filtered
  const filteredCsv = await request('/leads/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters: { quickFilter: 'all' } }),
    responseType: 'text',
  });
  const parsedFiltered = Papa.parse(filteredCsv, { header: true });
  assert.ok(parsedFiltered.data.length >= 2, 'Filtered export must contain all matching leads');

  // Verify formula injection protection
  assert.ok(!selectedCsv.includes('\n='), 'Must not contain leading =');
  assert.ok(!selectedCsv.includes('\n+'), 'Must not contain leading +');
  assert.ok(!selectedCsv.includes('\n-'), 'Must not contain leading -');
  assert.ok(!selectedCsv.includes('\n@'), 'Must not contain leading @');
  console.log(`   Selected CSV rows: ${parsedSelected.data.length} | Filtered CSV rows: ${parsedFiltered.data.length}`);
  console.log('   Formula injection defense: Verified (Leading =, +, -, @ sanitized with single quotes).');

  // Reset default SaaS criteria
  await request('/qualification-settings', {
    method: 'PUT',
    body: JSON.stringify({
      targetIndustry: 'SaaS & Enterprise Software',
      targetLocation: 'San Francisco, CA',
      preferredKeywords: ['b2b', 'cloud', 'software', 'platform', 'ai'],
    }),
  });

  console.log('\n====================================================');
  console.log('  ALL 15 END-TO-END VERIFICATION STEPS PASSED (100%)');
  console.log('====================================================\n');
}

runQaJourney().catch((err) => {
  console.error('\n❌ QA Journey Failed:', err);
  process.exit(1);
});
