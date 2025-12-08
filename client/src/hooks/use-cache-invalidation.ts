import { useQueryClient } from '@tanstack/react-query';

/**
 * Hook para invalidação consistente de cache em todo o sistema
 * Garante que todas as mutations invalidem o cache corretamente
 */
export function useCacheInvalidation() {
  const queryClient = useQueryClient();

  return {
    // Invalidar todas as queries de um recurso específico
    invalidateResource: (resource: string, id?: string) => {
      const patterns = [
        [resource],
        id ? [resource, id] : null,
      ].filter(Boolean);

      patterns.forEach((pattern) => {
        queryClient.invalidateQueries({ 
          queryKey: pattern as string[],
          exact: false // Invalida todas as queries que começam com esse padrão
        });
      });
    },

    // Invalidar múltiplos recursos de uma vez
    invalidateMultiple: (...resources: string[][]) => {
      resources.forEach((queryKey) => {
        queryClient.invalidateQueries({ 
          queryKey,
          exact: false 
        });
      });
    },

    // Invalidar tudo relacionado a um cliente
    invalidateCustomer: (customerId: string) => {
      const patterns = [
        ['/api/customers', customerId],
        ['/api/customers'],
        ['customer'],
      ];

      patterns.forEach((pattern) => {
        queryClient.invalidateQueries({ 
          queryKey: pattern,
          exact: false 
        });
      });
    },

    // Invalidar tudo relacionado a usuários
    invalidateUsers: (customerId?: string) => {
      if (customerId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/customers', customerId, 'users'],
          exact: false 
        });
      }
      queryClient.invalidateQueries({ 
        queryKey: ['/api/users'],
        exact: false 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['/api/system-users'],
        exact: false 
      });
    },

    // Invalidar tudo relacionado a roles/funções
    invalidateRoles: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/roles'],
        exact: false 
      });
    },

    // Invalidar tudo relacionado a sites
    invalidateSites: (customerId?: string) => {
      if (customerId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/customers', customerId, 'sites'],
          exact: false 
        });
      }
      queryClient.invalidateQueries({ 
        queryKey: ['/api/sites'],
        exact: false 
      });
    },

    // Invalidar tudo relacionado a zonas
    invalidateZones: (siteId?: string) => {
      if (siteId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/sites', siteId, 'zones'],
          exact: false 
        });
      }
      queryClient.invalidateQueries({ 
        queryKey: ['/api/zones'],
        exact: false 
      });
    },

    // Invalidar dashboards e estatísticas
    invalidateDashboards: (customerId?: string) => {
      if (customerId) {
        queryClient.invalidateQueries({ 
          queryKey: ['/api/customers', customerId, 'dashboard-stats'],
          exact: false 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['/api/customers', customerId, 'dashboard-goals'],
          exact: false 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['/api/customers', customerId, 'analytics'],
          exact: false 
        });
      }
    },

    // Invalidar tudo (use com cuidado!)
    invalidateAll: () => {
      queryClient.invalidateQueries();
    },
  };
}
