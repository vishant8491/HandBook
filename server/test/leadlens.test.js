import { describe, it, expect } from 'vitest';
import { normalizeDomain, sanitizeUrl, isSameHost, resolveUrl } from '../src/utils/url.js';
import { isPrivateOrReservedIp } from '../src/utils/ssrf.js';
import { extractPageData, cleanEmail, cleanPhone } from '../src/services/extractor.js';
import { calculateLeadScore, computeDataCompleteness } from '../src/services/scorer.js';
import { sanitizeCsvValue, generateLeadsCsv } from '../src/utils/csv.js';
import { FIXTURE_PAGES } from '../src/services/fixtureScraper.js';

describe('1. URL & Domain Normalization', () => {
  it('normalizes domains by stripping www, lowercasing, and paths', () => {
    expect(normalizeDomain('https://www.AcmeCloud.com/about')).toBe('acmecloud.com');
    expect(normalizeDomain('http://sub.domain.com/path?q=1')).toBe('sub.domain.com');
    expect(normalizeDomain('WWW.EXAMPLE.ORG')).toBe('example.org');
    expect(normalizeDomain('   https://saasquatchleads.com/   ')).toBe('saasquatchleads.com');
  });

  it('sanitizes URLs and rejects invalid protocols or embedded credentials', () => {
    expect(sanitizeUrl('http://valid-site.com')).toBe('http://valid-site.com/');
    expect(sanitizeUrl('https://secure-site.com/path')).toBe('https://secure-site.com/path');
    expect(sanitizeUrl('ftp://invalid.com')).toBeNull();
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('https://admin:secret@malicious.com')).toBeNull();
    expect(sanitizeUrl('https://site.com:8080')).toBeNull(); // non-standard port blocked
  });

  it('correctly resolves relative URLs on the same host', () => {
    expect(resolveUrl('/contact', 'https://example.com/about')).toBe('https://example.com/contact');
    expect(isSameHost('https://example.com/contact', 'https://www.example.com/team')).toBe(true);
    expect(isSameHost('https://example.com', 'https://otherdomain.com')).toBe(false);
  });
});

describe('2. SSRF & Private IP Destination Checks', () => {
  it('identifies and blocks IPv4 and IPv6 private, loopback, and cloud metadata ranges', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.100')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true); // AWS/GCP metadata
    expect(isPrivateOrReservedIp('::1')).toBe(true); // IPv6 loopback
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true); // IPv6 link-local
    expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true);
  });

  it('allows public routable unicast IP addresses', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('93.184.216.34')).toBe(false);
    expect(isPrivateOrReservedIp('142.250.190.46')).toBe(false);
  });
});

describe('3. HTML, JSON-LD, and Contact Extraction', () => {
  it('extracts structured Organization details, email, phone, and address from JSON-LD', () => {
    const html = FIXTURE_PAGES['acmecloud.example'];
    const extracted = extractPageData(html, 'https://acmecloud.example');

    expect(extracted.companyName).toBe('Acme Cloud Technologies');
    expect(extracted.emails).toContain('sales@acmecloud.example');
    expect(extracted.phones.length).toBeGreaterThan(0);
    expect(extracted.location).toContain('San Francisco, CA');
    expect(extracted.industry).toBe('SaaS & Enterprise Software');
    expect(extracted.fieldEvidence.some((e) => e.method.startsWith('jsonld'))).toBe(true);
  });

  it('extracts emails and phones from mailto links, tel links, and page text', () => {
    const html = FIXTURE_PAGES['finscale.example'];
    const extracted = extractPageData(html, 'https://finscale.example');

    expect(extracted.emails).toContain('partnerships@finscale.example');
    expect(extracted.phones.length).toBeGreaterThan(0);
    expect(extracted.industry).toBe('Fintech & Financial Services');
  });

  it('cleans invalid emails and rejects placeholder domains', () => {
    expect(cleanEmail('valid.user@company.com')).toBe('valid.user@company.com');
    expect(cleanEmail('mailto:Info@Business.Org')).toBe('info@business.org');
    expect(cleanEmail('fake@example.com')).toBeNull();
    expect(cleanEmail('noreply@business.com')).toBeNull();
    expect(cleanEmail('image.png@2x')).toBeNull();
    expect(cleanEmail('notanemail')).toBeNull();
  });

  it('cleans phone numbers and filters out invalid year-like numbers', () => {
    expect(cleanPhone('+1 (415) 555-0199')).toBe('+1 (415) 555-0199');
    expect(cleanPhone('tel:2125558833')).toBe('2125558833');
    expect(cleanPhone('2024')).toBeNull(); // Year pattern
    expect(cleanPhone('123')).toBeNull(); // Too short
  });
});

describe('4. Deterministic Scoring & Completeness Calculation', () => {
  it('calculates full 100-point score when all criteria match', () => {
    const lead = {
      companyName: 'AcmeCloud Systems',
      description: 'Enterprise B2B cloud workflow automation software and DevOps orchestration platform.',
      industry: 'SaaS & Enterprise Software',
      location: 'San Francisco, CA',
      emails: ['sales@acmecloud.example'],
      phones: ['+1 (415) 555-0100'],
    };

    const settings = {
      targetIndustry: 'SaaS & Enterprise Software',
      targetLocation: 'San Francisco, CA',
      preferredKeywords: ['b2b', 'cloud', 'software', 'platform'],
      weights: {
        industry: 30,
        location: 20,
        keywords: 20,
        email: 15,
        phone: 5,
        description: 10,
      },
    };

    const result = calculateLeadScore(lead, settings);

    expect(result.totalEarned).toBe(100);
    expect(result.totalApplicable).toBe(100);
    expect(result.finalScore).toBe(100);
    expect(result.priorityBand).toBe('high');
    expect(result.completeness.level).toBe('complete');
  });

  it('dynamically normalizes denominator when industry and location are unconfigured', () => {
    const lead = {
      companyName: 'General Corp',
      description: 'A rich business description with substantial length for testing purposes.',
      industry: 'Unknown',
      location: 'Unknown',
      emails: ['contact@general.example'],
      phones: ['+1 (800) 555-0100'],
    };

    const settings = {
      targetIndustry: '',
      targetLocation: '',
      preferredKeywords: [],
      weights: {
        industry: 30,
        location: 20,
        keywords: 20,
        email: 15,
        phone: 5,
        description: 10,
      },
    };

    const result = calculateLeadScore(lead, settings);

    // Applicable: Email(15) + Phone(5) + Desc(10) = 30
    // Earned: 15 + 5 + 10 = 30
    // (30/30) * 100 = 100
    expect(result.totalApplicable).toBe(30);
    expect(result.totalEarned).toBe(30);
    expect(result.finalScore).toBe(100);
    expect(result.criteria.find((c) => c.criterion === 'Target Industry Match')?.reason).toContain('Not included in scoring');
  });

  it('accurately calculates completeness levels separate from score', () => {
    expect(computeDataCompleteness({ emails: ['a@b.com'], phones: ['123'], industry: 'SaaS', location: 'NY', description: 'Long text here for description' }).level).toBe('complete');
    expect(computeDataCompleteness({ emails: ['a@b.com'], phones: [] }).level).toBe('email-only');
    expect(computeDataCompleteness({ emails: [], phones: [], industry: 'Unknown', location: 'Unknown' }).level).toBe('minimal');
  });
});

describe('5. CSV Formatting and Formula Injection (DDE) Protection', () => {
  it('neutralizes dangerous formula characters =, +, -, @, tab, return', () => {
    expect(sanitizeCsvValue('=cmd|"/c calc"!A0')).toBe('\'=cmd|"/c calc"!A0');
    expect(sanitizeCsvValue('+12345')).toBe('\'+12345');
    expect(sanitizeCsvValue('-SUM(1+1)')).toBe('\'-SUM(1+1)');
    expect(sanitizeCsvValue('@SUM(1+1)')).toBe('\'@SUM(1+1)');
    expect(sanitizeCsvValue('   =1+1')).toBe('\'   =1+1');
    expect(sanitizeCsvValue('Normal Company Name')).toBe('Normal Company Name');
  });

  it('generates valid RFC 4180 compliant quoted CSV with empty or populated arrays', () => {
    const emptyCsv = generateLeadsCsv([]);
    expect(emptyCsv).toContain('Company Name');

    const sampleLeads = [
      {
        companyName: '=Injected Corp',
        website: 'https://injected.example',
        industry: 'SaaS',
        location: 'NY',
        emails: ['a@example.com', 'b@example.com'],
        phones: ['123-456'],
        score: 95,
        scoreBreakdown: { priorityBand: 'high' },
        outreachStatus: 'new',
        sourceUrls: ['https://injected.example'],
        lastScrapedAt: new Date('2026-01-01T00:00:00Z'),
      },
    ];

    const csvOutput = generateLeadsCsv(sampleLeads);
    expect(csvOutput).toContain("'=Injected Corp");
    expect(csvOutput).toContain('"a@example.com; b@example.com"');
  });
});
