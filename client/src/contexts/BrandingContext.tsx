import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { detectSubdomain, isValidSubdomain, getPersistedSubdomain } from '@/lib/subdomain-detector';
import { useClient } from '@/contexts/ClientContext';
import { useAuth } from '@/hooks/useAuth';

interface BrandingConfig {
  name: string;
  subdomain: string | null;
  loginLogo: string | null;
  sidebarLogo: string | null;
  sidebarLogoCollapsed: string | null;
  homeLogo: string | null;
  favicon: string | null;
  modules: string[] | null;
  moduleColors: {
    clean?: {
      primary: string;
      secondary: string;
      accent: string;
    };
    maintenance?: {
      primary: string;
      secondary: string;
      accent: string;
    };
  } | null;
}

interface BrandingContextType {
  branding: BrandingConfig | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | null>(null);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get active client and subdomain customer from ClientContext
  const { activeClient, activeClientId, subdomainCustomer, activeSubdomain, isSubdomainLoading } = useClient();
  const { isAuthenticated } = useAuth();
  
  // Track if branding was already applied for current client to avoid loops
  const appliedClientIdRef = useRef<string | null>(null);
  const appliedSubdomainRef = useRef<string | null>(null);

  // Load branding from subdomain (for public pages / landing)
  const loadBrandingFromSubdomain = async () => {
    try {
      const detection = detectSubdomain();
      const subdomain = detection.subdomain;
      
      console.log('[BRANDING] 🔍 Detecção subdomain:', detection);

      if (subdomain && isValidSubdomain(subdomain)) {
        console.log('[BRANDING] 🌐 Buscando branding por subdomain:', subdomain);
        const response = await fetch(`/api/public/customer-by-subdomain/${subdomain}`);
        
        if (response.ok) {
          const customerData = await response.json();
          console.log('[BRANDING] ✨ Branding carregado do subdomain:', customerData.name);
          applyBrandingData(customerData);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('[BRANDING] Erro ao carregar branding por subdomain:', error);
      return false;
    }
  };

  // Load branding directly from customer ID (for logged-in users)
  const loadBrandingFromCustomerId = async (customerId: string) => {
    try {
      console.log('[BRANDING] 🔄 Carregando branding do cliente:', customerId);
      
      // Get token from localStorage
      const token = localStorage.getItem('acelera_token');
      if (!token) {
        console.warn('[BRANDING] Token não encontrado, tentando API pública');
        return false;
      }

      const response = await fetch(`/api/customers/${customerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const customerData = await response.json();
        console.log('[BRANDING] ✨ Branding carregado do cliente:', customerData.name);
        applyBrandingData(customerData);
        appliedClientIdRef.current = customerId;
        return true;
      } else {
        console.warn('[BRANDING] Falha ao carregar branding do cliente:', response.status);
      }
      return false;
    } catch (error) {
      console.error('[BRANDING] Erro ao carregar branding do cliente:', error);
      return false;
    }
  };

  // Apply branding data to state and CSS variables
  const applyBrandingData = (customerData: any) => {
    // Build branding config
    const brandingConfig: BrandingConfig = {
      name: customerData.name,
      subdomain: customerData.subdomain || null,
      loginLogo: customerData.loginLogo || null,
      sidebarLogo: customerData.sidebarLogo || null,
      sidebarLogoCollapsed: customerData.sidebarLogoCollapsed || null,
      homeLogo: customerData.homeLogo || null,
      favicon: customerData.favicon || null,
      modules: customerData.modules || null,
      moduleColors: customerData.moduleColors || null,
    };
    
    setBranding(brandingConfig);
    
    console.log('[BRANDING] 🎨 Branding aplicado:', {
      name: brandingConfig.name,
      logos: {
        login: !!brandingConfig.loginLogo,
        sidebar: !!brandingConfig.sidebarLogo,
        sidebarCollapsed: !!brandingConfig.sidebarLogoCollapsed,
        home: !!brandingConfig.homeLogo,
        favicon: !!brandingConfig.favicon,
      },
      colors: brandingConfig.moduleColors
    });

    // Apply module colors dynamically via CSS variables
    applyModuleColors(customerData.moduleColors);
    setIsLoading(false);
  };

  // Apply module colors to CSS variables
  const applyModuleColors = (moduleColors: any) => {
    if (!moduleColors) return;
    
    const root = document.documentElement;
    
    // Apply clean module colors if available
    if (moduleColors.clean) {
      const colors = moduleColors.clean;
      if (colors.primary) {
        const hsl = hexToHSL(colors.primary);
        root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
        root.style.setProperty('--module-primary', colors.primary);
      }
      if (colors.secondary) {
        const hsl = hexToHSL(colors.secondary);
        root.style.setProperty('--secondary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
        root.style.setProperty('--module-secondary', colors.secondary);
      }
      if (colors.accent) {
        const hsl = hexToHSL(colors.accent);
        root.style.setProperty('--accent', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
        root.style.setProperty('--module-accent', colors.accent);
      }
    }
    
    // Apply maintenance module colors if available
    if (moduleColors.maintenance) {
      const colors = moduleColors.maintenance;
      if (colors.primary) {
        const hsl = hexToHSL(colors.primary);
        root.style.setProperty('--maintenance-primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      }
      if (colors.secondary) {
        const hsl = hexToHSL(colors.secondary);
        root.style.setProperty('--maintenance-secondary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      }
      if (colors.accent) {
        const hsl = hexToHSL(colors.accent);
        root.style.setProperty('--maintenance-accent', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
      }
    }
  };

  // Reset CSS variables to defaults (to prevent mixed branding)
  const resetCSSVariables = () => {
    const root = document.documentElement;
    root.style.removeProperty('--primary');
    root.style.removeProperty('--secondary');
    root.style.removeProperty('--accent');
    root.style.removeProperty('--module-primary');
    root.style.removeProperty('--module-secondary');
    root.style.removeProperty('--module-accent');
    root.style.removeProperty('--maintenance-primary');
    root.style.removeProperty('--maintenance-secondary');
    root.style.removeProperty('--maintenance-accent');
  };

  // Main branding loader - decides strategy based on auth state and subdomain
  const loadBranding = async () => {
    setIsLoading(true);
    
    // Priority 1: If subdomain customer is already loaded (from ClientContext), use it immediately
    if (subdomainCustomer && activeSubdomain !== appliedSubdomainRef.current) {
      console.log('[BRANDING] 🌐 Aplicando branding do subdomain:', subdomainCustomer.name);
      resetCSSVariables();
      applyBrandingData(subdomainCustomer);
      appliedSubdomainRef.current = activeSubdomain;
      return;
    }
    
    // Priority 2: If user is authenticated and has activeClientId, load from customer
    if (isAuthenticated && activeClientId && activeClientId !== appliedClientIdRef.current) {
      console.log('[BRANDING] 👤 Usuário autenticado, carregando branding do cliente:', activeClientId);
      resetCSSVariables();
      const loaded = await loadBrandingFromCustomerId(activeClientId);
      if (loaded) return;
    }
    
    // Priority 3: Try subdomain detection (for public pages - fetches from API)
    const subdomainLoaded = await loadBrandingFromSubdomain();
    if (subdomainLoaded) return;
    
    // No branding found - use defaults
    console.log('[BRANDING] ℹ️ Nenhum branding encontrado, usando padrão');
    setBranding(null);
    setIsLoading(false);
  };

  // Initial load on mount (wait for subdomain loading first)
  useEffect(() => {
    if (!isSubdomainLoading) {
      loadBranding();
    }
  }, [isSubdomainLoading]);

  // CRITICAL: React to subdomainCustomer changes (for pre-login branding)
  useEffect(() => {
    if (subdomainCustomer && activeSubdomain && activeSubdomain !== appliedSubdomainRef.current) {
      console.log('[BRANDING] 🌐 Subdomain customer loaded:', subdomainCustomer.name);
      resetCSSVariables();
      applyBrandingData(subdomainCustomer);
      appliedSubdomainRef.current = activeSubdomain;
    }
  }, [subdomainCustomer, activeSubdomain]);

  // CRITICAL: Reload branding when activeClientId changes (after login or client switch)
  useEffect(() => {
    if (activeClientId && activeClientId !== appliedClientIdRef.current) {
      console.log('[BRANDING] 🔄 Cliente ativo mudou:', activeClientId, '(anterior:', appliedClientIdRef.current, ')');
      loadBrandingFromCustomerId(activeClientId);
    }
  }, [activeClientId]);

  // Also react to activeClient data changes (when React Query returns fresh data)
  useEffect(() => {
    if (activeClient && activeClient.id && activeClient.id !== appliedClientIdRef.current) {
      console.log('[BRANDING] 🔄 Dados do cliente ativo recebidos:', activeClient.name);
      applyClientBranding(activeClient);
      appliedClientIdRef.current = activeClient.id;
    }
  }, [activeClient?.id, activeClient?.moduleColors, activeClient?.loginLogo, activeClient?.sidebarLogo]);

  // Apply favicon dynamically when branding changes
  useEffect(() => {
    if (branding?.favicon) {
      console.log('[BRANDING] 🎨 Aplicando favicon:', branding.favicon);
      
      // Remove existing favicon link tags
      const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
      existingFavicons.forEach(favicon => favicon.remove());
      
      // Create new favicon link element
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/png';
      link.href = branding.favicon;
      
      // Append to head
      document.head.appendChild(link);
    } else {
      console.log('[BRANDING] ℹ️ Nenhum favicon personalizado, mantendo padrão');
    }
  }, [branding?.favicon]);

  // Apply branding from activeClient data (for dropdown changes)
  const applyClientBranding = (client: any) => {
    // Reuse applyBrandingData to avoid code duplication
    applyBrandingData(client);
  };

  return (
    <BrandingContext.Provider value={{ branding, isLoading, refresh: loadBranding }}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within BrandingProvider');
  }
  return context;
};

// Helper: Converter HEX para HSL
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}
