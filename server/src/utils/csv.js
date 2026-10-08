import Papa from 'papaparse';

/**
 * Sanitizes a single cell value to prevent CSV / Spreadsheet formula injection (CSV Injection / DDE).
 * Characters =, +, -, @, \t, \r at the start (or after leading spaces) can execute formulas in Excel/Sheets.
 */
export function sanitizeCsvValue(val) {
  if (val === null || val === undefined) return '';

  let str = String(val);

  // If the trimmed string starts with risky formula triggers
  const trimmed = str.trimStart();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    // Prepend single quote (') to force text treatment in spreadsheet software
    return `'${str}`;
  }

  return str;
}

/**
 * Converts lead objects into sanitized CSV string
 */
export function generateLeadsCsv(leads) {
  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return Papa.unparse({
      fields: [
        'Company Name',
        'Website',
        'Industry',
        'Location',
        'Public Email(s)',
        'Phone(s)',
        'Score',
        'Priority Band',
        'Outreach Status',
        'Source URLs',
        'Collected Date',
      ],
      data: [],
    });
  }

  const rows = leads.map((lead) => {
    const emails = Array.isArray(lead.emails) ? lead.emails.join('; ') : '';
    const phones = Array.isArray(lead.phones) ? lead.phones.join('; ') : '';
    const sourceUrls = Array.isArray(lead.sourceUrls) ? lead.sourceUrls.join('; ') : '';
    const collectedDate = lead.lastScrapedAt
      ? new Date(lead.lastScrapedAt).toISOString()
      : lead.createdAt
      ? new Date(lead.createdAt).toISOString()
      : '';

    return {
      'Company Name': sanitizeCsvValue(lead.companyName || ''),
      Website: sanitizeCsvValue(lead.website || ''),
      Industry: sanitizeCsvValue(lead.industry || 'Unknown'),
      Location: sanitizeCsvValue(lead.location || 'Unknown'),
      'Public Email(s)': sanitizeCsvValue(emails),
      'Phone(s)': sanitizeCsvValue(phones),
      Score: sanitizeCsvValue(lead.score ?? 0),
      'Priority Band': sanitizeCsvValue(lead.scoreBreakdown?.priorityBand || 'low'),
      'Outreach Status': sanitizeCsvValue(lead.outreachStatus || 'new'),
      'Source URLs': sanitizeCsvValue(sourceUrls),
      'Collected Date': sanitizeCsvValue(collectedDate),
    };
  });

  return Papa.unparse(rows, {
    quotes: true, // Always quote fields for robust CSV compliance
    header: true,
  });
}
