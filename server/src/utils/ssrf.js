import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

/**
 * Checks whether an IP address belongs to private, loopback, link-local,
 * multicast, carrier-grade NAT, or cloud metadata ranges.
 */
export function isPrivateOrReservedIp(ipString) {
  try {
    const addr = ipaddr.parse(ipString);
    const range = addr.range();

    // ipaddr.js identifies:
    // 'unicast' -> public routable IP
    // 'loopback', 'private', 'linkLocal', 'carrierGradeNat', 'uniqueLocal',
    // 'multicast', 'broadcast', 'reserved', 'unspecified'
    if (range !== 'unicast') {
      return true;
    }

    // Explicit check for AWS/GCP/Azure link-local cloud metadata (169.254.169.254)
    if (ipString === '169.254.169.254' || ipString === '::ffff:169.254.169.254') {
      return true;
    }

    return false;
  } catch {
    return true; // If IP can't be parsed safely, consider it invalid/unsafe
  }
}

/**
 * Validates whether a target hostname resolves exclusively to public, routable IP addresses.
 * Returns { valid: boolean, ips: string[], errorReason?: string }
 */
export async function validateDestinationHost(hostname) {
  if (!hostname || typeof hostname !== 'string') {
    return { valid: false, ips: [], errorReason: 'Invalid or missing hostname' };
  }

  const cleanHost = hostname.toLowerCase();

  // Immediate reject for known loopback/local names
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.localhost')
  ) {
    return { valid: false, ips: [], errorReason: 'Localhost and internal domains are blocked' };
  }

  // If host is an IP literal
  if (ipaddr.isValid(cleanHost)) {
    if (isPrivateOrReservedIp(cleanHost)) {
      return { valid: false, ips: [cleanHost], errorReason: 'Private or reserved IP address blocked' };
    }
    return { valid: true, ips: [cleanHost] };
  }

  try {
    // Resolve IPv4 and IPv6
    const records = await dns.lookup(cleanHost, { all: true });

    if (!records || records.length === 0) {
      return { valid: false, ips: [], errorReason: 'Domain DNS resolution failed' };
    }

    const ips = records.map((r) => r.address);

    for (const ip of ips) {
      if (isPrivateOrReservedIp(ip)) {
        return {
          valid: false,
          ips,
          errorReason: `Domain resolved to restricted IP: ${ip}`,
        };
      }
    }

    return { valid: true, ips };
  } catch (err) {
    return { valid: false, ips: [], errorReason: `DNS lookup error: ${err.message}` };
  }
}
