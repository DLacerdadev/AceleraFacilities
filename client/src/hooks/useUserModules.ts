import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { ModuleType } from "@/contexts/ModuleContext";

interface UserModulesResponse {
  modules: ModuleType[];
  defaultModule: ModuleType;
}

/**
 * Hook para buscar e validar os módulos que o usuário tem permissão de acessar
 */
export function useUserModules() {
  const { user, isAuthenticated } = useAuth();

  const { data, isLoading, error } = useQuery<UserModulesResponse>({
    queryKey: ['/api/auth/user-modules'],
    enabled: !!user && isAuthenticated,
  });

  // Normalizar: garantir que sempre tenha pelo menos um módulo
  const rawModules = data?.modules || [];
  const allowedModules: ModuleType[] = rawModules.length > 0 ? rawModules : ['clean'];
  const defaultModule: ModuleType = data?.defaultModule || 'clean';
  const hasMultipleModules = allowedModules.length > 1;
  const hasSingleModule = allowedModules.length === 1;

  /**
   * Verifica se o usuário tem permissão para acessar um módulo específico
   */
  const canAccessModule = (module: ModuleType): boolean => {
    if (!data) return false;
    return allowedModules.includes(module);
  };

  /**
   * Retorna o módulo que deve ser usado (valida se o atual é permitido)
   */
  const getValidModule = (currentModule: ModuleType): ModuleType => {
    if (canAccessModule(currentModule)) {
      return currentModule;
    }
    return defaultModule;
  };

  return {
    allowedModules,
    defaultModule,
    hasMultipleModules,
    hasSingleModule,
    canAccessModule,
    getValidModule,
    isLoading,
    error,
  };
}
