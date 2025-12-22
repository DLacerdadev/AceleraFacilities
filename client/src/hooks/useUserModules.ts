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

  // CRITICAL: Include user.id in queryKey to refetch when user changes
  // Use separate queryKey structure so user.id doesn't become part of URL
  const { data, isLoading, error } = useQuery<UserModulesResponse>({
    queryKey: ['user-modules', user?.id],
    queryFn: async () => {
      const token = localStorage.getItem('opus:token');
      const response = await fetch('/api/auth/user-modules', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user modules');
      }
      return response.json();
    },
    enabled: !!user && isAuthenticated,
    staleTime: 0, // Always refetch on mount
  });

  // Indica se os dados reais da API já chegaram (não é fallback)
  // Considera que temos dados se: API retornou com sucesso OU se houve erro (não bloquear)
  const hasApiData = !!data && data.modules && data.modules.length > 0;
  // Se houve erro ou query não está carregando e não tem dados, não bloquear a UI
  const apiCompleted = !isLoading && (hasApiData || !!error);
  
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
    hasApiData, // Indica se os dados vieram da API com sucesso
    apiCompleted, // Indica se a API já respondeu (sucesso ou erro) - não bloqueia UI
    error,
  };
}
