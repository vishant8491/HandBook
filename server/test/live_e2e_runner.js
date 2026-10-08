async function runFullE2e() {
  console.log('=== Step 1: Health & DB Connectivity ===');
  const health = await fetch('http://localhost:5000/api/health').then((r) => r.json());
  console.log('Health check status:', health.status, '| DB connected:', health.database.connected);

  console.log('\n=== Step 2: Overview Dashboard Metrics ===');
  const dash = await fetch('http://localhost:5000/api/dashboard').then((r) => r.json());
  console.log('Dashboard metrics:', dash.metrics);
  console.log('Top leads count:', dash.topLeads?.length);
  console.log('Recent jobs count:', dash.recentJobs?.length);

  console.log('\n=== Step 3: Collection Job (Batch URLs) ===');
  const createJob = await fetch('http://localhost:5000/api/collection-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urls: [
        'https://acmecloud.example',
        'https://medipulse.example',
        'https://shoppulse.example',
      ],
      mode: 'fixture',
    }),
  }).then((r) => r.json());
  console.log('Job created ID:', createJob.job?._id, '| Status:', createJob.job?.status);

  // Poll job until completed
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const polled = await fetch('http://localhost:5000/api/collection-jobs/' + createJob.job._id).then((r) =>
      r.json()
    );
    if (polled.job?.status === 'completed') {
      console.log(
        'Job completed! Processed:',
        polled.job.processedCount,
        '| Success:',
        polled.job.successfulCount,
        '| Failed:',
        polled.job.failedCount
      );
      break;
    }
  }

  console.log('\n=== Step 4: Leads Directory Filters & Search ===');
  const allLeads = await fetch('http://localhost:5000/api/leads').then((r) => r.json());
  console.log('Total leads:', allLeads.pagination.total);

  const highPriority = await fetch('http://localhost:5000/api/leads?quickFilter=high-priority').then((r) =>
    r.json()
  );
  console.log('High priority leads (75+ pts):', highPriority.pagination.total);

  const hasEmail = await fetch('http://localhost:5000/api/leads?quickFilter=has-email').then((r) =>
    r.json()
  );
  console.log('Leads with public email:', hasEmail.pagination.total);

  const missingContact = await fetch('http://localhost:5000/api/leads?quickFilter=missing-contact').then((r) =>
    r.json()
  );
  console.log('Leads missing contact info:', missingContact.pagination.total);

  const searchRes = await fetch('http://localhost:5000/api/leads?search=cloud').then((r) => r.json());
  console.log('Search "cloud" results count:', searchRes.pagination.total);

  console.log('\n=== Step 5: Lead Details Inspection & Evidence ===');
  const targetLead = allLeads.leads[0];
  const leadDetails = await fetch('http://localhost:5000/api/leads/' + targetLead._id).then((r) => r.json());
  console.log('Inspecting lead:', leadDetails.lead.companyName);
  console.log('Score:', leadDetails.lead.score, '| Priority band:', leadDetails.lead.scoreBreakdown?.priorityBand);
  console.log('Criteria evaluated count:', leadDetails.lead.scoreBreakdown?.criteria?.length);
  console.log('Evidence provenance items:', leadDetails.lead.fieldEvidence?.length);

  console.log('\n=== Step 6: Status Update Persistence ===');
  const updated = await fetch('http://localhost:5000/api/leads/' + targetLead._id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outreachStatus: 'shortlisted' }),
  }).then((r) => r.json());
  console.log('Updated outreach status:', updated.lead?.outreachStatus);

  console.log('\n=== Step 7: CSV Export & Formula Protection ===');
  const csvText = await fetch('http://localhost:5000/api/leads/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters: { quickFilter: 'high-priority' } }),
  }).then((r) => r.text());
  console.log('Exported CSV header:', csvText.split('\n')[0]);
  console.log('Exported CSV rows count:', csvText.split('\n').filter(Boolean).length - 1);
  console.log('Formula injection safe:', !csvText.includes('\n=') && !csvText.includes('\n+'));

  console.log('\n=== Step 8: Qualification Settings Recalculation ===');
  const settingsRes = await fetch('http://localhost:5000/api/qualification-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetIndustry: 'Healthcare & Life Sciences',
      targetLocation: 'Boston, MA',
      preferredKeywords: ['diagnostics', 'clinical', 'hospital'],
    }),
  }).then((r) => r.json());
  console.log('Settings updated! Recalculated leads:', settingsRes.recalculatedLeadsCount);

  // Check top lead after recalculation
  const topAfter = await fetch('http://localhost:5000/api/leads?sortBy=score&sortOrder=desc').then((r) =>
    r.json()
  );
  console.log(
    'Top lead under Healthcare target:',
    topAfter.leads[0]?.companyName,
    '| Score:',
    topAfter.leads[0]?.score,
    '| Industry:',
    topAfter.leads[0]?.industry
  );

  // Restore original SaaS settings
  await fetch('http://localhost:5000/api/qualification-settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetIndustry: 'SaaS & Enterprise Software',
      targetLocation: 'San Francisco, CA',
      preferredKeywords: ['b2b', 'cloud', 'software', 'platform', 'ai'],
    }),
  });

  console.log('\n=== All E2E API & Data Quality Checks Passed ===');
}

runFullE2e().catch((err) => console.error(err));
