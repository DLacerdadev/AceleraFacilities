import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useUserModules } from '@/hooks/useUserModules';
import { useClient } from './ClientContext';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

export type ModuleType = 'clean' | 'maintenance';

interface ModuleConfig {
  id: ModuleType;
  name: string;
  displayName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  description: string;
  icon: string;
}

export const MODULE_CONFIGS: Record<ModuleType, ModuleConfig> = {
  clean: {
    id: 'clean',
    name: 'clean',
    displayName: 'Clean',
    primaryColor: '#1e3a8a',
    secondaryColor: '#3b82f6',
    accentColor: '#60a5fa',
    description: 'Gestão de Limpeza e Facilities',
    icon: '🧹',
  },
  maintenance: {
    id: 'maintenance',
    name: 'maintenance',
    displayName: 'Manutenção',
    primaryColor: '#FF9800',
    secondaryColor: '#FB8C00',
    accentColor: '#FFB74D',
    description: 'Gestão de Manutenção',
    icon: '🔧',
  },
};

interface ModuleContextType {
  currentModule: ModuleType;
  moduleConfig: ModuleConfig;
  setModule: (module: ModuleType) => void;
  getModuleRoute: (path: string) => string;
  allowedModules: ModuleType[];
  canAccessModule: (module: ModuleType) => boolean;
  hasMultipleModules: boolean;
}

const ModuleContext = createContext<ModuleContextType | undefined>(undefined);

export function ModuleProvider({ children }: { children: React.ReactNode }) {
  const { 
    allowedModules, 
    defaultModule, 
    canAccessModule, 
    getValidModule,
    hasMultipleModules,
    isLoading 
  } = useUserModules();

  // Inicializar com null e esperar os dados carregarem
  const [currentModule, setCurrentModule] = useState<ModuleType | null>(null);

  const moduleConfig = currentModule ? MODULE_CONFIGS[currentModule] : MODULE_CONFIGS.clean;
  
  // Importar ClientContext para sincronizar módulo com cliente
  const { activeClient, customers, setActiveClientId } = useClient();
  
  // Hook de autenticação para verificar se deve aplicar cores do módulo
  const { isAuthenticated } = useAuth();
  
  // Hook de navegação para redirecionamento automático
  const [, setLocation] = useLocation();

  // Inicializar o módulo apenas DEPOIS que os dados do usuário carregarem
  useEffect(() => {
    if (!isLoading && currentModule === null) {
      // Se não tem módulos configurados, forçar 'clean' como padrão seguro
      const safeDefaultModule = allowedModules.length > 0 ? defaultModule : 'clean';
      
      // Primeira inicialização - usar localStorage ou defaultModule
      const stored = localStorage.getItem('opus:currentModule');
      const storedModule = (stored === 'clean' || stored === 'maintenance') ? stored : null;
      
      // Validar se o módulo salvo é permitido
      if (storedModule && allowedModules.length > 0 && canAccessModule(storedModule)) {
        console.log(`[MODULE] Inicializando com módulo salvo: ${storedModule}`);
        setCurrentModule(storedModule);
      } else {
        console.log(`[MODULE] Inicializando com módulo padrão: ${safeDefaultModule}`);
        setCurrentModule(safeDefaultModule);
      }
    }
  }, [isLoading, allowedModules, currentModule, canAccessModule, defaultModule]);

  // Sincronizar módulo quando o cliente mudar
  useEffect(() => {
    if (!activeClient || !currentModule) return;
    
    const clientModules = activeClient.modules || [];
    
    // Apenas validar se o módulo atual é suportado pelo cliente
    // NÃO forçar troca automática, respeitar a escolha do usuário
    if (clientModules.length > 0 && !clientModules.includes(currentModule)) {
      // Trocar para o primeiro módulo do cliente que o usuário pode acessar
      const validModule = clientModules.find(m => canAccessModule(m as ModuleType));
      if (validModule) {
        console.log(`[MODULE] ⚠️ Módulo "${currentModule}" não disponível para cliente "${activeClient.name}", trocando para "${validModule}"...`);
        setCurrentModule(validModule as ModuleType);
        
        // Redirecionar para a tela inicial
        console.log(`[MODULE] Redirecionando para tela inicial do módulo "${validModule}"...`);
        setLocation('/');
      }
    }
  }, [activeClient, currentModule, canAccessModule, setLocation]);

  // Helper to convert HEX to HSL
  const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { h: 0, s: 0, l: 50 };
    
    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  };

  // Helper to check if color is dark (for foreground color)
  const isColorDark = (hsl: { h: number; s: number; l: number }) => {
    return hsl.l < 50;
  };

  useEffect(() => {
    if (currentModule) {
      localStorage.setItem('opus:currentModule', currentModule);
      document.documentElement.setAttribute('data-module', currentModule);
      
      // IMPORTANT: Only apply module colors when user is authenticated
      // Before login, BrandingContext applies systemColors which should not be overwritten
      if (!isAuthenticated) {
        console.log(`[MODULE] ⏳ Usuário não autenticado - Cores do módulo não aplicadas (systemColors do BrandingContext em uso)`);
        return;
      }
      
      // Usar cores customizadas do cliente se disponíveis, senão usar cores padrão
      const customColors = activeClient?.moduleColors?.[currentModule];
      const primaryColor = customColors?.primary || moduleConfig.primaryColor;
      const secondaryColor = customColors?.secondary || moduleConfig.secondaryColor;
      const accentColor = customColors?.accent || moduleConfig.accentColor;
      
      // Apply module colors to legacy CSS variables
      document.documentElement.style.setProperty('--module-primary', primaryColor);
      document.documentElement.style.setProperty('--module-secondary', secondaryColor);
      document.documentElement.style.setProperty('--module-accent', accentColor);
      
      // CRITICAL: Also apply to --primary, --secondary, --accent for UI components
      const root = document.documentElement;
      
      // Apply primary color
      const primaryHSL = hexToHSL(primaryColor);
      root.style.setProperty('--primary', `hsl(${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%)`);
      const primaryForeground = isColorDark(primaryHSL) ? 'hsl(0 0% 100%)' : 'hsl(0 0% 0%)';
      root.style.setProperty('--primary-foreground', primaryForeground);
      
      // Apply secondary color
      const secondaryHSL = hexToHSL(secondaryColor);
      root.style.setProperty('--secondary', `hsl(${secondaryHSL.h} ${secondaryHSL.s}% ${secondaryHSL.l}%)`);
      const secondaryForeground = isColorDark(secondaryHSL) ? 'hsl(0 0% 100%)' : 'hsl(0 0% 0%)';
      root.style.setProperty('--secondary-foreground', secondaryForeground);
      
      // Apply accent color
      const accentHSL = hexToHSL(accentColor);
      root.style.setProperty('--accent', `hsl(${accentHSL.h} ${accentHSL.s}% ${accentHSL.l}%)`);
      const accentForeground = isColorDark(accentHSL) ? 'hsl(0 0% 100%)' : 'hsl(0 0% 0%)';
      root.style.setProperty('--accent-foreground', accentForeground);
      
      console.log(`[MODULE] Aplicando cores do módulo ${currentModule} em --primary:`, {
        primary: primaryColor,
        primaryHSL: `hsl(${primaryHSL.h} ${primaryHSL.s}% ${primaryHSL.l}%)`,
        secondary: secondaryColor,
        accent: accentColor,
        customized: !!customColors
      });
    }
  }, [currentModule, moduleConfig, activeClient, isAuthenticated]);

  const setModule = (module: ModuleType) => {
    // 🔥 VALIDAÇÃO: Verificar se usuário TEM ACESSO ao módulo
    const userHasAccess = canAccessModule(module);
    
    // Verificar se usuário tem acesso ao módulo
    if (!userHasAccess) {
      console.warn(`[MODULE] ❌ ACESSO NEGADO - Usuário não tem permissão para módulo: ${module}`);
      return; // Não trocar
    }
    
    // Se o cliente ainda não foi carregado (activeClient === undefined), permitir trocar
    // A validação do módulo do cliente acontecerá no useEffect quando o cliente carregar
    if (!activeClient) {
      console.log(`[MODULE] ⏳ Cliente ainda não carregado - Permitindo seleção de módulo: ${module}`);
      setCurrentModule(module);
      return;
    }
    
    // Se o cliente já está carregado, verificar se possui o módulo
    const clientModules = (activeClient.modules || []) as ModuleType[];
    const clientHasModule = clientModules.includes(module);
    
    if (!clientHasModule) {
      console.warn(`[MODULE] ❌ ACESSO NEGADO - Cliente "${activeClient.name}" não possui módulo: ${module}`);
      return; // Não trocar
    }
    
    // ✅ Passou na validação - PODE TROCAR
    console.log(`[MODULE] ✅ Validação aprovada - Trocando para módulo: ${module}`);
    setCurrentModule(module);
    
    // Remover completamente cache de dados dependentes de módulo
    queryClient.removeQueries({ 
      predicate: (query) => {
        const key = query.queryKey;
        // Remover queries que contêm "service-types", "service-categories", "dashboard-goals", etc
        return key.some(part => 
          typeof part === 'string' && (
            part.includes('service-types') || 
            part.includes('service-categories') ||
            part.includes('dashboard-goals')
          )
        );
      }
    });
  };

  const getModuleRoute = (path: string) => {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `/${currentModule}${cleanPath}`;
  };

  // Se ainda está carregando, não renderizar nada
  if (isLoading || currentModule === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <ModuleContext.Provider
      value={{
        currentModule,
        moduleConfig,
        setModule,
        getModuleRoute,
        allowedModules,
        canAccessModule,
        hasMultipleModules,
      }}
    >
      {children}
    </ModuleContext.Provider>
  );
}

export function useModule() {
  const context = useContext(ModuleContext);
  if (!context) {
    throw new Error('useModule must be used within ModuleProvider');
  }
  return context;
}
