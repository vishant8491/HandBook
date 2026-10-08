import axios from 'axios';
import robotsParser from 'robots-parser';
import { config } from '../config.js';
import { normalizeDomain, sanitizeUrl, resolveUrl, isSameHost } from '../utils/url.js';
import { validateDestinationHost } from '../utils/ssrf.js';
import { extractPageData } from './extractor.js';
import { getFixtureDataForDomain } from './fixtureScraper.js';
import { Lead } from '../models/Lead.js';
import { QualificationSetting } from '../models/QualificationSetting.js';
import { calculateLeadScore } from './scorer.js';

/**
 * Checks robots.txt for a given URL
 */
async function checkRobotsTxt(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;

    // Validate host first
    const hostValidation = await validateDestinationHost(parsed.hostname);
    if (!hostValidation.valid) {
      return { allowed: false, reason: hostValidation.errorReason };
    }

    const response = await axios.get(robotsUrl, {
      timeout: 3000,
      headers: { 'User-Agent': config.userAgent },
      maxRedirects: 2,
      validateStatus: (status) => status < 500, // 404 means no robots restriction
    });

    if (response.status === 200 && typeof response.data === 'string') {
      const robots = robotsParser(robotsUrl, response.data);
      const isAllowed = robots.isAllowed(targetUrl, config.userAgent);
      if (isAllowed === false) {
        return { allowed: false, reason: 'Disallowed by website robots.txt policy' };
      }
    }

    return { allowed: true };
  } catch {
    // If robots.txt times out or errors, default to allowing with caution
    return { allowed: true };
  }
}

/**
 * Safely fetches a single URL with SSRF protection, redirect verification, size limits, and timeouts
 */
async function safeFetchHtml(rawUrl, retryCount = 0) {
  const sanitized = sanitizeUrl(rawUrl);
  if (!sanitized) {
    throw new Error('Invalid URL protocol, port, or format');
  }

  let currentUrl = sanitized;
  let redirectHops = 0;

  while (redirectHops <= config.maxRedirects) {
    const parsed = new URL(currentUrl);

    // 1. SSRF DNS & IP verification
    const hostCheck = await validateDestinationHost(parsed.hostname);
    if (!hostCheck.valid) {
      throw new Error(`SSRF Blocked: ${hostCheck.errorReason}`);
    }

    try {
      const response = await axios.get(currentUrl, {
        timeout: config.scrapeTimeoutMs,
        headers: {
          'User-Agent': config.userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        maxRedirects: 0, // Manual redirect control to revalidate SSRF on each hop
        validateStatus: (status) => (status >= 200 && status < 400) || status === 404,
        responseType: 'text',
        maxContentLength: config.maxBodySizeBytes,
      });

      // Handle Redirects manually
      if (response.status >= 300 && response.status < 400) {
        const locationHeader = response.headers.location;
        if (!locationHeader) {
          throw new Error(`Redirect status ${response.status} missing Location header`);
        }
        const nextUrl = resolveUrl(locationHeader, currentUrl);
        if (!nextUrl) {
          throw new Error(`Invalid redirect target: ${locationHeader}`);
        }

        currentUrl = nextUrl;
        redirectHops += 1;
        continue;
      }

      if (response.status === 404) {
        throw new Error('HTTP 404: Page not found');
      }

      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status} error`);
      }

      // Check Content-Type is HTML
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error(`Unsupported content type: ${contentType || 'non-html'}`);
      }

      return {
        html: response.data,
        finalUrl: currentUrl,
      };
    } catch (err) {
      // Allow 1 retry for transient network/timeout errors, but NOT for 4xx errors or SSRF blocks
      const isTransient =
        err.code === 'ECONNABORTED' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNRESET' ||
        (err.response && err.response.status >= 500);

      if (isTransient && retryCount < 1) {
        return safeFetchHtml(rawUrl, retryCount + 1);
      }

      throw err;
    }
  }

  throw new Error(`Exceeded maximum redirect limit of ${config.maxRedirects}`);
}

/**
 * Main scraper orchestrator for a single domain/website
 */
export async function scrapeAndSaveLead(targetUrl, options = {}) {
  const startTime = Date.now();
  const domain = normalizeDomain(targetUrl);
  if (!domain) {
    throw new Error(`Invalid domain from input: ${targetUrl}`);
  }

  const isDemo = Boolean(options.isDemo || targetUrl.endsWith('.example') || config.demoMode);
  const userMetadata = options.userMetadata || {}; // optional industry, location from CSV import

  // 1. Freshness Cache Check in MongoDB (24h TTL)
  const existingLead = await Lead.findOne({ normalizedDomain: domain });
  const cacheFreshnessThreshold = new Date(Date.now() - config.cacheTtlHours * 60 * 60 * 1000);

  if (
    existingLead &&
    existingLead.lastScrapedAt &&
    existingLead.lastScrapedAt > cacheFreshnessThreshold &&
    !options.forceFresh
  ) {
    return {
      lead: existingLead,
      fromCache: true,
      durationMs: Date.now() - startTime,
      status: 'cached',
    };
  }

  let extractedData;
  const sourceUrls = [];

  if (isDemo) {
    // Use local fixture scraper for zero-dependency demo/test domains
    extractedData = getFixtureDataForDomain(domain);
    sourceUrls.push(`https://${domain}`);
  } else {
    // Check robots.txt
    const robotsCheck = await checkRobotsTxt(targetUrl);
    if (!robotsCheck.allowed) {
      throw new Error(`Robots.txt restricted: ${robotsCheck.reason}`);
    }

    // Fetch Homepage
    const { html, finalUrl } = await safeFetchHtml(targetUrl);
    sourceUrls.push(finalUrl);
    extractedData = extractPageData(html, finalUrl);

    // Follow up to 2 same-host secondary links (Contact, About) to gather missing email/phone/address
    if (
      extractedData.valuableLinks &&
      extractedData.valuableLinks.length > 0 &&
      (extractedData.emails.length === 0 || extractedData.phones.length === 0)
    ) {
      for (const secondaryUrl of extractedData.valuableLinks.slice(0, 2)) {
        if (!isSameHost(secondaryUrl, finalUrl)) continue;
        try {
          const secFetch = await safeFetchHtml(secondaryUrl);
          sourceUrls.push(secFetch.finalUrl);
          const secData = extractPageData(secFetch.html, secFetch.finalUrl);

          // Merge emails
          for (const email of secData.emails) {
            if (!extractedData.emails.includes(email)) {
              extractedData.emails.push(email);
            }
          }

          // Merge phones
          for (const phone of secData.phones) {
            if (!extractedData.phones.includes(phone)) {
              extractedData.phones.push(phone);
            }
          }

          // Merge location if primary was missing
          if (extractedData.location === 'Unknown' && secData.location !== 'Unknown') {
            extractedData.location = secData.location;
            extractedData.locationSource = secData.locationSource;
          }

          // Merge evidence
          extractedData.fieldEvidence.push(...secData.fieldEvidence);
        } catch {
          // Failure on secondary page does not fail the whole lead
        }
      }
    }
  }

  // Merge User-supplied CSV metadata if provided (higher precedence for provenance)
  let finalIndustry = extractedData.industry || 'Unknown';
  let finalIndustrySource = extractedData.industrySource || 'unknown';
  if (userMetadata.industry && userMetadata.industry.trim()) {
    finalIndustry = userMetadata.industry.trim();
    finalIndustrySource = 'manual';
    extractedData.fieldEvidence.push({
      field: 'industry',
      sourceUrl: targetUrl,
      method: 'user-input-csv',
      rawValue: finalIndustry,
    });
  }

  let finalLocation = extractedData.location || 'Unknown';
  let finalLocationSource = extractedData.locationSource || 'unknown';
  if (userMetadata.location && userMetadata.location.trim()) {
    finalLocation = userMetadata.location.trim();
    finalLocationSource = 'manual';
    extractedData.fieldEvidence.push({
      field: 'location',
      sourceUrl: targetUrl,
      method: 'user-input-csv',
      rawValue: finalLocation,
    });
  }

  // Preserve existing useful fields if this scrape returned empty/unknown values
  const companyName = extractedData.companyName || existingLead?.companyName || domain;
  const description = extractedData.description || existingLead?.description || '';
  const mergedEmails = Array.from(
    new Set([...(existingLead?.emails || []), ...(extractedData.emails || [])])
  );
  const mergedPhones = Array.from(
    new Set([...(existingLead?.phones || []), ...(extractedData.phones || [])])
  );
  const mergedSources = Array.from(
    new Set([...(existingLead?.sourceUrls || []), ...sourceUrls])
  );

  // Fetch current active qualification settings for scoring
  let settings = await QualificationSetting.findOne({ isActive: true });
  if (!settings) {
    settings = await QualificationSetting.create({});
  }

  const scoreResult = calculateLeadScore(
    {
      companyName,
      description,
      industry: finalIndustry,
      location: finalLocation,
      emails: mergedEmails,
      phones: mergedPhones,
    },
    settings
  );

  // Non-destructive Upsert into MongoDB
  const leadDoc = await Lead.findOneAndUpdate(
    { normalizedDomain: domain },
    {
      $set: {
        companyName,
        website: targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`,
        normalizedDomain: domain,
        description,
        emails: mergedEmails,
        phones: mergedPhones,
        industry: finalIndustry,
        industrySource: finalIndustrySource,
        location: finalLocation,
        locationSource: finalLocationSource,
        sourceUrls: mergedSources,
        fieldEvidence: extractedData.fieldEvidence,
        score: scoreResult.finalScore,
        scoreBreakdown: scoreResult,
        outreachStatus: existingLead?.outreachStatus || 'new',
        lastScrapedAt: new Date(),
        isDemo,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    lead: leadDoc,
    fromCache: false,
    durationMs: Date.now() - startTime,
    status: 'success',
  };
}
