import { useLocation, useSearch } from "wouter";
import { getPersistedSubdomain } from "@/lib/subdomain-detector";

export function useSubdomainNavigation() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  const navigateTo = (path: string, preserveSubdomain = true) => {
    if (!preserveSubdomain) {
      setLocation(path);
      return;
    }

    const urlParams = new URLSearchParams(search);
    const currentSubdomain = urlParams.get('subdomain') || urlParams.get('test-subdomain');
    const persistedSubdomain = getPersistedSubdomain();
    const subdomain = currentSubdomain || persistedSubdomain;

    if (subdomain) {
      const separator = path.includes('?') ? '&' : '?';
      setLocation(`${path}${separator}subdomain=${subdomain}`);
    } else {
      setLocation(path);
    }
  };

  const getPathWithSubdomain = (path: string): string => {
    const urlParams = new URLSearchParams(search);
    const currentSubdomain = urlParams.get('subdomain') || urlParams.get('test-subdomain');
    const persistedSubdomain = getPersistedSubdomain();
    const subdomain = currentSubdomain || persistedSubdomain;

    if (subdomain) {
      const separator = path.includes('?') ? '&' : '?';
      return `${path}${separator}subdomain=${subdomain}`;
    }
    return path;
  };

  return { navigateTo, getPathWithSubdomain };
}
