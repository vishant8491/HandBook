/**
 * URL and domain normalization utilities for LeadLens
 */

export function normalizeDomain(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return '';

  let trimmed = inputUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    let hostname = parsed.hostname.toLowerCase();

    // Remove leading 'www.'
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

    // MVP simplification: subdomains like app.example.com remain separate from example.com
    return hostname;
  } catch {
    return '';
  }
}

export function sanitizeUrl(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return null;

  let trimmed = inputUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);

    // Reject non-http/https
    if (!['http:', 'https:'].includes(parsed.protocol.toLowerCase())) {
      return null;
    }

    // Reject URLs with embedded credentials (user:pass@host)
    if (parsed.username || parsed.password) {
      return null;
    }

    // Restrict ports to standard web ports or default
    if (parsed.port && !['80', '443'].includes(parsed.port)) {
      return null;
    }

    // Check basic hostname validity
    if (!parsed.hostname || parsed.hostname.includes(' ') || !parsed.hostname.includes('.')) {
      // Note: allow localhost in special unit test mocks if explicitly bypassed, but sanitizeUrl rejects plain invalid names
      if (parsed.hostname !== 'localhost') {
        return null;
      }
    }

    return parsed.href;
  } catch {
    return null;
  }
}

export function resolveUrl(relativeOrAbsolute, baseUrl) {
  try {
    return new URL(relativeOrAbsolute, baseUrl).href;
  } catch {
    return null;
  }
}

export function isSameHost(url1, url2) {
  try {
    const h1 = normalizeDomain(url1);
    const h2 = normalizeDomain(url2);
    return Boolean(h1 && h2 && h1 === h2);
  } catch {
    return false;
  }
}
