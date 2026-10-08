/**
 * LeadLens Transparent 100-Point Scoring Service
 * 
 * Rules:
 * - Target Industry Match: 30 pts
 * - Target Location Match: 20 pts
 * - Preferred Keywords Match: 20 pts (token-matched against name and description)
 * - Public Email Available: 15 pts (format-valid public email)
 * - Public Phone Available: 5 pts (usable public phone)
 * - Company Description: 10 pts (substantive summary > 15 chars)
 * 
 * Dynamic Denominator Normalization:
 * Excludes unconfigured criteria from denominator:
 * score = Math.round((earnedPoints / applicablePoints) * 100)
 */

function cleanText(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function computeDataCompleteness(lead) {
  const hasEmail = Array.isArray(lead.emails) && lead.emails.length > 0;
  const hasPhone = Array.isArray(lead.phones) && lead.phones.length > 0;
  const hasIndustry = Boolean(lead.industry && lead.industry !== 'Unknown');
  const hasLocation = Boolean(lead.location && lead.location !== 'Unknown');
  const hasDesc = Boolean(lead.description && lead.description.trim().length > 15);

  if (hasEmail && hasPhone && hasIndustry && hasLocation && hasDesc) {
    return { level: 'complete', label: 'Complete profile' };
  }
  if (hasEmail && hasPhone) {
    return { level: 'rich-contact', label: 'Email & phone available' };
  }
  if (hasEmail) {
    return { level: 'email-only', label: 'Email available' };
  }
  if (hasPhone) {
    return { level: 'phone-only', label: 'Phone available' };
  }
  if (hasIndustry || hasLocation) {
    return { level: 'firmographic-only', label: 'Firmographics only (no contact)' };
  }
  return { level: 'minimal', label: 'Minimal public data' };
}

export function calculateLeadScore(lead, settings = {}) {
  const weights = settings.weights || {
    industry: 30,
    location: 20,
    keywords: 20,
    email: 15,
    phone: 5,
    description: 10,
  };

  const targetIndustry = (settings.targetIndustry || '').trim();
  const targetLocation = (settings.targetLocation || '').trim();
  const rawKeywords = Array.isArray(settings.preferredKeywords)
    ? settings.preferredKeywords
    : (settings.preferredKeywords || '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

  const preferredKeywords = rawKeywords
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const criteria = [];
  let totalEarned = 0;
  let totalApplicable = 0;

  // 1. Target Industry (30 pts)
  const isIndustryConfigured = targetIndustry.length > 0;
  if (isIndustryConfigured) {
    const indWeight = weights.industry ?? 30;
    totalApplicable += indWeight;
    const leadIndustry = lead.industry || 'Unknown';
    
    // Normalized phrase match (case-insensitive)
    const cleanLeadInd = cleanText(leadIndustry);
    const cleanTargetInd = cleanText(targetIndustry);
    const isMatch =
      cleanLeadInd !== 'unknown' &&
      cleanLeadInd.length > 0 &&
      (cleanLeadInd === cleanTargetInd ||
        cleanLeadInd.includes(cleanTargetInd) ||
        cleanTargetInd.includes(cleanLeadInd));

    const earned = isMatch ? indWeight : 0;
    totalEarned += earned;
    criteria.push({
      criterion: 'Target Industry Match',
      earned,
      applicable: indWeight,
      matched: isMatch,
      reason: isMatch
        ? `Industry "${leadIndustry}" matches target "${targetIndustry}" (+${earned} pts)`
        : `Industry "${leadIndustry}" does not match target "${targetIndustry}" (0/${indWeight} pts)`,
    });
  } else {
    criteria.push({
      criterion: 'Target Industry Match',
      earned: 0,
      applicable: 0,
      matched: false,
      reason: 'Not included in scoring (target industry not configured)',
    });
  }

  // 2. Target Location (20 pts)
  const isLocationConfigured = targetLocation.length > 0;
  if (isLocationConfigured) {
    const locWeight = weights.location ?? 20;
    totalApplicable += locWeight;
    const leadLocation = lead.location || 'Unknown';
    
    // Token/phrase match
    const cleanLeadLoc = cleanText(leadLocation);
    const cleanTargetLoc = cleanText(targetLocation);
    const isMatch =
      cleanLeadLoc !== 'unknown' &&
      cleanLeadLoc.length > 0 &&
      (cleanLeadLoc === cleanTargetLoc ||
        cleanLeadLoc.includes(cleanTargetLoc) ||
        cleanTargetLoc.includes(cleanLeadLoc));

    const earned = isMatch ? locWeight : 0;
    totalEarned += earned;
    criteria.push({
      criterion: 'Target Location Match',
      earned,
      applicable: locWeight,
      matched: isMatch,
      reason: isMatch
        ? `Location "${leadLocation}" matches target "${targetLocation}" (+${earned} pts)`
        : `Location "${leadLocation}" does not match target "${targetLocation}" (0/${locWeight} pts)`,
    });
  } else {
    criteria.push({
      criterion: 'Target Location Match',
      earned: 0,
      applicable: 0,
      matched: false,
      reason: 'Not included in scoring (target location not configured)',
    });
  }

  // 3. Preferred Keywords (20 pts)
  const isKeywordsConfigured = preferredKeywords.length > 0;
  if (isKeywordsConfigured) {
    const kwWeight = weights.keywords ?? 20;
    totalApplicable += kwWeight;

    const searchableText = ` ${cleanText(lead.companyName)} ${cleanText(lead.description)} ${cleanText(lead.industry)} `;
    const matchedKws = [];

    for (const kw of preferredKeywords) {
      const cleanKw = cleanText(kw);
      if (!cleanKw) continue;
      // Word boundary check
      const kwRegex = new RegExp(`\\b${cleanKw}\\b`, 'i');
      if (kwRegex.test(searchableText)) {
        matchedKws.push(kw);
      }
    }

    const matchRatio = matchedKws.length / preferredKeywords.length;
    const earned = Math.round(matchRatio * kwWeight);
    totalEarned += earned;

    criteria.push({
      criterion: 'Preferred Keywords Match',
      earned,
      applicable: kwWeight,
      matched: matchedKws.length > 0,
      reason:
        matchedKws.length > 0
          ? `Matched ${matchedKws.length}/${preferredKeywords.length} keyword(s) [${matchedKws.join(', ')}] (+${earned} pts)`
          : `Matched 0/${preferredKeywords.length} keyword(s) in company text (0/${kwWeight} pts)`,
    });
  } else {
    criteria.push({
      criterion: 'Preferred Keywords Match',
      earned: 0,
      applicable: 0,
      matched: false,
      reason: 'Not included in scoring (preferred keywords not configured)',
    });
  }

  // 4. Public Email (15 pts)
  const emailWeight = weights.email ?? 15;
  totalApplicable += emailWeight;
  const hasEmail = Array.isArray(lead.emails) && lead.emails.length > 0;
  const emailEarned = hasEmail ? emailWeight : 0;
  totalEarned += emailEarned;
  criteria.push({
    criterion: 'Public Email Available',
    earned: emailEarned,
    applicable: emailWeight,
    matched: hasEmail,
    reason: hasEmail
      ? `Extracted ${lead.emails.length} format-valid email address(es) (+${emailEarned} pts)`
      : `No public email found (0/${emailWeight} pts)`,
  });

  // 5. Public Phone (5 pts)
  const phoneWeight = weights.phone ?? 5;
  totalApplicable += phoneWeight;
  const hasPhone = Array.isArray(lead.phones) && lead.phones.length > 0;
  const phoneEarned = hasPhone ? phoneWeight : 0;
  totalEarned += phoneEarned;
  criteria.push({
    criterion: 'Public Phone Available',
    earned: phoneEarned,
    applicable: phoneWeight,
    matched: hasPhone,
    reason: hasPhone
      ? `Extracted ${lead.phones.length} usable telephone number(s) (+${phoneEarned} pts)`
      : `No public phone found (0/${phoneWeight} pts)`,
  });

  // 6. Non-empty Company Description (10 pts)
  const descWeight = weights.description ?? 10;
  totalApplicable += descWeight;
  const hasDescription = Boolean(lead.description && lead.description.trim().length > 15);
  const descEarned = hasDescription ? descWeight : 0;
  totalEarned += descEarned;
  criteria.push({
    criterion: 'Company Description Completeness',
    earned: descEarned,
    applicable: descWeight,
    matched: hasDescription,
    reason: hasDescription
      ? `Substantive description available (${lead.description.length} chars) (+${descEarned} pts)`
      : `No substantive company description found (0/${descWeight} pts)`,
  });

  // Normalized Final Score
  let finalScore = 0;
  if (totalApplicable > 0) {
    finalScore = Math.min(100, Math.max(0, Math.round((totalEarned / totalApplicable) * 100)));
  }

  let priorityBand = 'low';
  if (finalScore >= 75) {
    priorityBand = 'high';
  } else if (finalScore >= 40) {
    priorityBand = 'medium';
  }

  const completeness = computeDataCompleteness(lead);

  return {
    totalEarned,
    totalApplicable,
    finalScore,
    priorityBand,
    completeness,
    criteria,
    recalculatedAt: new Date(),
  };
}
