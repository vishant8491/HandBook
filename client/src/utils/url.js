export function normalizeDomain(inputUrl) {
  if (!inputUrl || typeof inputUrl !== 'string') return '';

  let trimmed = inputUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(trimmed);
    let hostname = parsed.hostname.toLowerCase();

    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }

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

    if (!['http:', 'https:'].includes(parsed.protocol.toLowerCase())) {
      return null;
    }

    if (parsed.username || parsed.password) {
      return null;
    }

    if (parsed.port && !['80', '443'].includes(parsed.port)) {
      return null;
    }

    if (!parsed.hostname || parsed.hostname.includes(' ') || !parsed.hostname.includes('.')) {
      if (parsed.hostname !== 'localhost') {
        return null;
      }
    }

    return parsed.href;
  } catch {
    return null;
  }
}
