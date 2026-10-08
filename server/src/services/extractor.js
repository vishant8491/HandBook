import * as cheerio from 'cheerio';
import { normalizeDomain, resolveUrl } from '../utils/url.js';

// Documented keyword-based industry classifier
const INDUSTRY_RULES = [
  {
    name: 'SaaS & Enterprise Software',
    keywords: [
      'software',
      'saas',
      'cloud platform',
      'api',
      'b2b platform',
      'devops',
      'cybersecurity',
      'crm',
      'analytics platform',
    ],
  },
  {
    name: 'Healthcare & Life Sciences',
    keywords: [
      'healthcare',
      'clinical',
      'biotech',
      'medical',
      'pharmaceutical',
      'patient care',
      'hospital',
      'diagnostics',
      'health tech',
    ],
  },
  {
    name: 'Fintech & Financial Services',
    keywords: [
      'fintech',
      'banking',
      'payments',
      'wealth management',
      'insurance',
      'investment',
      'lending',
      'financial services',
    ],
  },
  {
    name: 'E-Commerce & Retail',
    keywords: [
      'ecommerce',
      'e-commerce',
      'shop',
      'store',
      'retail',
      'direct-to-consumer',
      'dtc',
      'marketplace',
    ],
  },
  {
    name: 'Marketing & Digital Media',
    keywords: [
      'marketing',
      'advertising',
      'seo',
      'branding',
      'digital agency',
      'content creation',
      'media',
    ],
  },
  {
    name: 'Industrial & Manufacturing',
    keywords: [
      'manufacturing',
      'logistics',
      'supply chain',
      'factory',
      'industrial equipment',
      'warehouse',
    ],
  },
  {
    name: 'Real Estate & Property',
    keywords: ['real estate', 'property management', 'realty', 'brokerage', 'commercial real estate'],
  },
  {
    name: 'Education & EdTech',
    keywords: ['edtech', 'learning platform', 'academy', 'education', 'training', 'university'],
  },
];

const JUNK_EMAIL_DOMAINS = [
  'example.com',
  'domain.com',
  'yoursite.com',
  'email.com',
  'test.com',
  'sample.com',
  'sentry.io',
  'wixpress.com',
  'schema.org',
  'gravatar.com',
];

const JUNK_EMAIL_PREFIXES = [
  'noreply',
  'no-reply',
  'donotreply',
  'mailer-daemon',
  'postmaster',
  'abuse',
  'test',
  'user',
  'name',
];

export function cleanEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const clean = email.toLowerCase().trim().replace(/^mailto:/i, '');

  // Valid format check
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(clean)) return null;

  const [prefix, domain] = clean.split('@');
  if (!prefix || !domain) return null;

  if (JUNK_EMAIL_DOMAINS.includes(domain)) return null;
  if (JUNK_EMAIL_PREFIXES.includes(prefix)) return null;
  if (clean.endsWith('.png') || clean.endsWith('.jpg') || clean.endsWith('.webp')) return null;

  return clean;
}

export function cleanPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let clean = phone.trim().replace(/^tel:/i, '');
  // Remove extraneous characters while keeping digits, plus, dashes, parentheses
  clean = clean.replace(/[^0-9+().\s-]/g, '').trim();

  // Extract pure digits count
  const digits = clean.replace(/\D/g, '');
  // Must be between 7 and 15 digits (US/Intl standard)
  if (digits.length < 7 || digits.length > 15) return null;

  // Ignore consecutive repetitive digits or year patterns like 2024, 1999
  if (/^(19|20)\d{2}$/.test(digits)) return null;

  return clean;
}

/**
 * Parses JSON-LD scripts from HTML to extract structured organization/business info
 */
export function extractJsonLd($, pageUrl) {
  const extracted = {
    companyName: null,
    description: null,
    location: null,
    emails: [],
    phones: [],
    fieldEvidence: [],
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).text();
      if (!text) return;
      const json = JSON.parse(text);

      const items = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;

        const type = (item['@type'] || '').toLowerCase();
        const isOrg =
          type.includes('organization') ||
          type.includes('corporation') ||
          type.includes('localbusiness') ||
          type.includes('company') ||
          type.includes('softwareapplication');

        if (isOrg || (!extracted.companyName && item.name)) {
          if (item.name && typeof item.name === 'string' && !extracted.companyName) {
            extracted.companyName = item.name.trim();
            extracted.fieldEvidence.push({
              field: 'companyName',
              sourceUrl: pageUrl,
              method: `jsonld-${item['@type'] || 'Organization'}`,
              rawValue: item.name,
            });
          }

          if (item.description && typeof item.description === 'string' && !extracted.description) {
            extracted.description = item.description.trim();
            extracted.fieldEvidence.push({
              field: 'description',
              sourceUrl: pageUrl,
              method: 'jsonld-description',
              rawValue: item.description.slice(0, 150),
            });
          }

          if (item.email) {
            const emailList = Array.isArray(item.email) ? item.email : [item.email];
            for (const em of emailList) {
              const cleaned = cleanEmail(em);
              if (cleaned && !extracted.emails.includes(cleaned)) {
                extracted.emails.push(cleaned);
                extracted.fieldEvidence.push({
                  field: 'emails',
                  sourceUrl: pageUrl,
                  method: 'jsonld-email',
                  rawValue: cleaned,
                });
              }
            }
          }

          if (item.telephone) {
            const phoneList = Array.isArray(item.telephone) ? item.telephone : [item.telephone];
            for (const ph of phoneList) {
              const cleaned = cleanPhone(ph);
              if (cleaned && !extracted.phones.includes(cleaned)) {
                extracted.phones.push(cleaned);
                extracted.fieldEvidence.push({
                  field: 'phones',
                  sourceUrl: pageUrl,
                  method: 'jsonld-telephone',
                  rawValue: cleaned,
                });
              }
            }
          }

          if (item.address && typeof item.address === 'object' && !extracted.location) {
            const addr = item.address;
            const parts = [
              addr.streetAddress,
              addr.addressLocality,
              addr.addressRegion,
              addr.postalCode,
              addr.addressCountry,
            ]
              .filter(Boolean)
              .map((p) => (typeof p === 'string' ? p.trim() : ''));

            if (parts.length > 0) {
              extracted.location = parts.join(', ');
              extracted.fieldEvidence.push({
                field: 'location',
                sourceUrl: pageUrl,
                method: 'jsonld-postaladdress',
                rawValue: extracted.location,
              });
            }
          }
        }
      }
    } catch {
      // Ignore invalid JSON-LD blocks safely
    }
  });

  return extracted;
}

/**
 * Extracts links that point to high-value pages like /contact, /about, /team
 */
export function findValuableInternalLinks($, baseUrl) {
  const candidateLinks = [];
  const visited = new Set();
  const baseDomain = normalizeDomain(baseUrl);

  const keywords = ['contact', 'about', 'team', 'company', 'get-in-touch', 'reach-us'];

  $('a[href]').each((_, el) => {
    if (candidateLinks.length >= 2) return; // Cap at 2 secondary links

    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

    const resolved = resolveUrl(href, baseUrl);
    if (!resolved) return;

    const targetDomain = normalizeDomain(resolved);
    if (targetDomain !== baseDomain) return; // Same-host only

    const lowerHref = resolved.toLowerCase();
    const linkText = $(el).text().toLowerCase();

    const isMatch = keywords.some(
      (kw) => lowerHref.includes(kw) || linkText.includes(kw)
    );

    if (isMatch && !visited.has(resolved) && resolved !== baseUrl) {
      visited.add(resolved);
      candidateLinks.push(resolved);
    }
  });

  return candidateLinks;
}

/**
 * Core HTML extraction function for a single page
 */
export function extractPageData(html, pageUrl) {
  const $ = cheerio.load(html);
  const jsonLdData = extractJsonLd($, pageUrl);

  const fieldEvidence = [...jsonLdData.fieldEvidence];
  const emails = [...jsonLdData.emails];
  const phones = [...jsonLdData.phones];

  // 1. Company Name Fallback Chain
  let companyName = jsonLdData.companyName;

  if (!companyName) {
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    if (ogSiteName && ogSiteName.trim()) {
      companyName = ogSiteName.trim();
      fieldEvidence.push({
        field: 'companyName',
        sourceUrl: pageUrl,
        method: 'opengraph-site_name',
        rawValue: companyName,
      });
    }
  }

  if (!companyName) {
    const ogTitle = $('meta[property="og:title"]').attr('content');
    if (ogTitle && ogTitle.trim()) {
      companyName = ogTitle.trim().split(/[|\-–:]/)[0].trim();
      fieldEvidence.push({
        field: 'companyName',
        sourceUrl: pageUrl,
        method: 'opengraph-title',
        rawValue: companyName,
      });
    }
  }

  if (!companyName) {
    const titleText = $('title').text();
    if (titleText && titleText.trim()) {
      companyName = titleText.trim().split(/[|\-–:]/)[0].trim();
      fieldEvidence.push({
        field: 'companyName',
        sourceUrl: pageUrl,
        method: 'html-title-tag',
        rawValue: companyName,
      });
    }
  }

  if (!companyName) {
    companyName = normalizeDomain(pageUrl);
    fieldEvidence.push({
      field: 'companyName',
      sourceUrl: pageUrl,
      method: 'hostname-fallback',
      rawValue: companyName,
    });
  }

  // 2. Description Fallback Chain
  let description = jsonLdData.description;

  if (!description) {
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc && metaDesc.trim()) {
      description = metaDesc.trim();
      fieldEvidence.push({
        field: 'description',
        sourceUrl: pageUrl,
        method: 'meta-description',
        rawValue: description.slice(0, 150),
      });
    }
  }

  if (!description) {
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc && ogDesc.trim()) {
      description = ogDesc.trim();
      fieldEvidence.push({
        field: 'description',
        sourceUrl: pageUrl,
        method: 'opengraph-description',
        rawValue: description.slice(0, 150),
      });
    }
  }

  if (!description) {
    // Fallback to first substantive paragraph
    const pText = $('main p, article p, p')
      .map((_, el) => $(el).text().trim())
      .get()
      .find((t) => t.length > 40 && t.length < 300);

    if (pText) {
      description = pText;
      fieldEvidence.push({
        field: 'description',
        sourceUrl: pageUrl,
        method: 'body-paragraph-fallback',
        rawValue: description.slice(0, 150),
      });
    } else {
      description = '';
    }
  }

  // 3. Email Extraction from mailto and text
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr('href');
    const cleaned = cleanEmail(href);
    if (cleaned && !emails.includes(cleaned)) {
      emails.push(cleaned);
      fieldEvidence.push({
        field: 'emails',
        sourceUrl: pageUrl,
        method: 'mailto-link',
        rawValue: cleaned,
      });
    }
  });

  const bodyText = $('body').text();
  const textEmailMatches = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  for (const match of textEmailMatches) {
    const cleaned = cleanEmail(match);
    if (cleaned && !emails.includes(cleaned)) {
      emails.push(cleaned);
      fieldEvidence.push({
        field: 'emails',
        sourceUrl: pageUrl,
        method: 'page-text-regex',
        rawValue: cleaned,
      });
    }
  }

  // 4. Phone Extraction from tel links and conservative regex
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr('href');
    const cleaned = cleanPhone(href);
    if (cleaned && !phones.includes(cleaned)) {
      phones.push(cleaned);
      fieldEvidence.push({
        field: 'phones',
        sourceUrl: pageUrl,
        method: 'tel-link',
        rawValue: cleaned,
      });
    }
  });

  const textPhoneMatches =
    bodyText.match(/(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g) || [];
  for (const match of textPhoneMatches) {
    const cleaned = cleanPhone(match);
    if (cleaned && !phones.includes(cleaned)) {
      phones.push(cleaned);
      fieldEvidence.push({
        field: 'phones',
        sourceUrl: pageUrl,
        method: 'page-text-phone-regex',
        rawValue: cleaned,
      });
    }
  }

  // 5. Location
  let location = jsonLdData.location || 'Unknown';
  let locationSource = jsonLdData.location ? 'structured-data' : 'unknown';

  // 6. Industry Inference
  const combinedText = `${companyName} ${description} ${$('h1, h2, h3').text()}`.toLowerCase();
  let industry = 'Unknown';
  let industrySource = 'unknown';

  for (const rule of INDUSTRY_RULES) {
    const hasMatch = rule.keywords.some((kw) => combinedText.includes(kw));
    if (hasMatch) {
      industry = rule.name;
      industrySource = 'keyword-inference';
      fieldEvidence.push({
        field: 'industry',
        sourceUrl: pageUrl,
        method: 'keyword-inference',
        rawValue: `Matched industry category "${rule.name}" via page content keywords`,
      });
      break;
    }
  }

  return {
    companyName,
    description,
    emails,
    phones,
    location,
    locationSource,
    industry,
    industrySource,
    fieldEvidence,
    valuableLinks: findValuableInternalLinks($, pageUrl),
  };
}
