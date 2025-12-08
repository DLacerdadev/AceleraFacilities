import { useState, useEffect } from 'react';
import { useBranding } from '@/contexts/BrandingContext';

type LogoType = 'login' | 'sidebar' | 'sidebarCollapsed' | 'home';

interface LogoImageProps {
  type?: LogoType;
  src?: string | null | undefined;
  fallbackSrc: string;
  alt: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * Logo image component with automatic fallback handling
 * - Shows primary logo from branding if available
 * - Falls back to default logo if primary fails to load or is null
 * - Handles errors gracefully without showing broken images
 * - Resets error state when src changes (for tenant switching)
 * - Supports both type-based (auto-fetch from branding) and direct src usage
 */
export function LogoImage({ type, src, fallbackSrc, alt, className, 'data-testid': testId }: LogoImageProps) {
  const [error, setError] = useState(false);
  const { branding } = useBranding();

  // If type is provided, get logo from branding context
  let logoSrc = src;
  if (type && branding) {
    switch (type) {
      case 'login':
        logoSrc = branding.loginLogo;
        break;
      case 'sidebar':
        logoSrc = branding.sidebarLogo;
        break;
      case 'sidebarCollapsed':
        logoSrc = branding.sidebarLogoCollapsed;
        break;
      case 'home':
        logoSrc = branding.homeLogo;
        break;
    }
  }

  // Reset error state whenever logoSrc changes (critical for tenant switching)
  useEffect(() => {
    setError(false);
  }, [logoSrc]);

  // Use fallback if no logoSrc provided or if image failed to load
  const effectiveSrc = !logoSrc || error ? fallbackSrc : logoSrc;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={className}
      data-testid={testId}
      onError={() => setError(true)}
    />
  );
}
