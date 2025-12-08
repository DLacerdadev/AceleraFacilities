/**
 * Adaptive Subdomain Detection Utility
 * 
 * Extracts subdomain from any URL hostname dynamically - works with:
 * - Replit dev: tecnofibra.janeway.replit.dev
 * - Production VM: tecnofibra.acelera.com
 * - Any custom domain: tecnofibra.customdomain.com
 * 
 * Also supports query parameter override: ?subdomain=nestle or ?test-subdomain=tecnofibra
 * The subdomain is persisted in localStorage for session continuity.
 */

const SUBDOMAIN_STORAGE_KEY = 'opus:activeSubdomain';

export interface SubdomainDetectionResult {
  subdomain: string | null;
  fullHostname: string;
  isTestMode: boolean;
  source: 'query' | 'hostname' | 'storage' | 'none';
}

/**
 * Check if a subdomain looks like a Replit development hostname (should not be persisted)
 */
function isInvalidSubdomain(subdomain: string): boolean {
  if (!subdomain) return true;
  
  // Replit hostnames are UUIDs like "171b9630-64fa-42a9-b21a-8b472644a059-00-gs199jgwajvv"
  const isUuidLike = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}(-[0-9]{2}-[a-z0-9]+)?$/i.test(subdomain);
  const hasReplitPattern = subdomain.includes('replit') || subdomain.includes('janeway');
  const isLongHexString = subdomain.length > 30 && /^[a-f0-9-]+$/i.test(subdomain);
  
  return isUuidLike || hasReplitPattern || isLongHexString;
}

/**
 * Get persisted subdomain from localStorage
 */
export function getPersistedSubdomain(): string | null {
  try {
    const persisted = localStorage.getItem(SUBDOMAIN_STORAGE_KEY);
    
    // Clear if it's a Replit hostname that was incorrectly persisted
    if (persisted && isInvalidSubdomain(persisted)) {
      console.log('[SUBDOMAIN] 🧹 Clearing invalid persisted subdomain:', persisted);
      localStorage.removeItem(SUBDOMAIN_STORAGE_KEY);
      return null;
    }
    
    return persisted;
  } catch {
    return null;
  }
}

/**
 * Persist subdomain to localStorage for session continuity
 */
export function persistSubdomain(subdomain: string | null): void {
  try {
    if (subdomain && !isInvalidSubdomain(subdomain)) {
      localStorage.setItem(SUBDOMAIN_STORAGE_KEY, subdomain);
      console.log('[SUBDOMAIN] 💾 Persisted subdomain:', subdomain);
    } else {
      localStorage.removeItem(SUBDOMAIN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Clear persisted subdomain (for logout or context switch)
 */
export function clearPersistedSubdomain(): void {
  try {
    localStorage.removeItem(SUBDOMAIN_STORAGE_KEY);
    console.log('[SUBDOMAIN] 🗑️ Cleared persisted subdomain');
  } catch {
    // Ignore storage errors
  }
}

/**
 * Detects subdomain from URL query params, hostname, or localStorage
 * Priority: 1) Query param (?subdomain=x) 2) Hostname subdomain 3) localStorage
 */
export function detectSubdomain(): SubdomainDetectionResult {
  const fullHostname = window.location.hostname;
  const urlParams = new URLSearchParams(window.location.search);
  
  // Priority 1: Check for subdomain via query parameter (?subdomain=nestle)
  const querySubdomain = urlParams.get('subdomain') || urlParams.get('test-subdomain');
  
  if (querySubdomain) {
    const normalized = querySubdomain.toLowerCase().trim();
    // Persist for session continuity
    persistSubdomain(normalized);
    return {
      subdomain: normalized,
      fullHostname,
      isTestMode: true,
      source: 'query'
    };
  }
  
  // Priority 2: Check for subdomain in hostname
  // Handle special cases for localhost and Replit development hostnames
  const isLocalhost = fullHostname === 'localhost' || fullHostname === '127.0.0.1';
  const isReplitDevHostname = fullHostname.includes('.janeway.replit.dev') || 
                               fullHostname.includes('.replit.dev') ||
                               fullHostname.match(/^[a-f0-9-]+\.janeway\.replit\.dev$/);
  
  if (isLocalhost || isReplitDevHostname) {
    // Check localStorage for persisted subdomain
    const persistedSubdomain = getPersistedSubdomain();
    if (persistedSubdomain) {
      return {
        subdomain: persistedSubdomain,
        fullHostname,
        isTestMode: false,
        source: 'storage'
      };
    }
    return {
      subdomain: null,
      fullHostname,
      isTestMode: false,
      source: 'none'
    };
  }
  
  // Extract subdomain adaptively from hostname
  // Examples:
  // tecnofibra.localhost -> ["tecnofibra", "localhost"] (2 parts)
  // tecnofibra.janeway.replit.dev -> ["tecnofibra", "janeway", "replit", "dev"] (4 parts)
  // tecnofibra.acelera.com -> ["tecnofibra", "acelera", "com"] (3 parts)
  // tecnofibra.co.uk -> ["tecnofibra", "co", "uk"] (3 parts)
  const parts = fullHostname.split('.');
  
  // If hostname has more than 1 part, first part might be the subdomain
  if (parts.length >= 2) {
    const subdomain = parts[0].toLowerCase();
    
    // Filter out common non-subdomain prefixes
    if (subdomain === 'www') {
      // Check localStorage for persisted subdomain
      const persistedSubdomain = getPersistedSubdomain();
      if (persistedSubdomain) {
        return {
          subdomain: persistedSubdomain,
          fullHostname,
          isTestMode: false,
          source: 'storage'
        };
      }
      return {
        subdomain: null,
        fullHostname,
        isTestMode: false,
        source: 'none'
      };
    }
    
    // For 2-part domains, check if it's a known development pattern
    // tenant.localhost, tenant.vercel.app, etc.
    if (parts.length === 2) {
      const secondPart = parts[1].toLowerCase();
      // If second part is a known dev/platform domain, first part is subdomain
      if (['localhost', 'vercel', 'app', 'dev', 'ngrok'].some(pattern => secondPart.includes(pattern))) {
        persistSubdomain(subdomain);
        return {
          subdomain,
          fullHostname,
          isTestMode: false,
          source: 'hostname'
        };
      }
      // Otherwise, it's likely a root domain (e.g., example.com) - check localStorage
      const persistedSubdomain = getPersistedSubdomain();
      if (persistedSubdomain) {
        return {
          subdomain: persistedSubdomain,
          fullHostname,
          isTestMode: false,
          source: 'storage'
        };
      }
      return {
        subdomain: null,
        fullHostname,
        isTestMode: false,
        source: 'none'
      };
    }
    
    // For 3+ part domains, first part is the subdomain
    persistSubdomain(subdomain);
    return {
      subdomain,
      fullHostname,
      isTestMode: false,
      source: 'hostname'
    };
  }
  
  // No subdomain detected from hostname - check localStorage
  const persistedSubdomain = getPersistedSubdomain();
  if (persistedSubdomain) {
    return {
      subdomain: persistedSubdomain,
      fullHostname,
      isTestMode: false,
      source: 'storage'
    };
  }
  
  return {
    subdomain: null,
    fullHostname,
    isTestMode: false,
    source: 'none'
  };
}

/**
 * Validates if a subdomain string is valid
 * - Allows 2-63 characters (to support 2-letter tenants)
 * - Only lowercase letters, numbers, and hyphens
 * - Cannot start or end with hyphen
 */
export function isValidSubdomain(subdomain: string | null): boolean {
  if (!subdomain) return false;
  
  // Subdomain validation rules (relaxed to allow 2-char subdomains)
  const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return subdomainRegex.test(subdomain);
}
