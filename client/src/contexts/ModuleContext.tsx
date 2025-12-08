import { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useUserModules } from '@/hooks/useUserModules';
import { useClient } from './ClientContext';
import { queryClient } from '@/lib/queryClient';

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

  useEffect(() => {
    if (currentModule) {
      localStorage.setItem('opus:currentModule', currentModule);
      
      document.documentElement.setAttribute('data-module', currentModule);
      
      // Usar cores customizadas do cliente se disponíveis, senão usar cores padrão
      const customColors = activeClient?.moduleColors?.[currentModule];
      const primaryColor = customColors?.primary || moduleConfig.primaryColor;
      const secondaryColor = customColors?.secondary || moduleConfig.secondaryColor;
      const accentColor = customColors?.accent || moduleConfig.accentColor;
      
      document.documentElement.style.setProperty('--module-primary', primaryColor);
      document.documentElement.style.setProperty('--module-secondary', secondaryColor);
      document.documentElement.style.setProperty('--module-accent', accentColor);
      
      console.log(`[MODULE] Aplicando cores personalizadas do módulo ${currentModule}:`, {
        primary: primaryColor,
        secondary: secondaryColor,
        accent: accentColor,
        customized: !!customColors
      });
    }
  }, [currentModule, moduleConfig, activeClient]);

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
