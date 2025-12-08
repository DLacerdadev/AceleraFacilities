import { useState, useEffect, useMemo } from 'react';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';

export type PermissionKey = 
  | 'dashboard_view'
  | 'workorders_view' | 'workorders_create' | 'workorders_edit' | 'workorders_delete' | 'workorders_comment' | 'workorders_evaluate'
  | 'schedule_view' | 'schedule_create' | 'schedule_edit' | 'schedule_delete'
  | 'checklists_view' | 'checklists_create' | 'checklists_edit' | 'checklists_delete'
  | 'qrcodes_view' | 'qrcodes_create' | 'qrcodes_edit' | 'qrcodes_delete'
  | 'floor_plan_view' | 'floor_plan_edit'
  | 'heatmap_view'
  | 'sites_view' | 'sites_create' | 'sites_edit' | 'sites_delete'
  | 'zones_view' | 'zones_create' | 'zones_edit' | 'zones_delete'
  | 'users_view' | 'users_create' | 'users_edit' | 'users_delete'
  | 'customers_view' | 'customers_create' | 'customers_edit' | 'customers_delete'
  | 'reports_view'
  | 'audit_logs_view'
  | 'service_settings_view' | 'service_settings_edit'
  | 'roles_manage'
  | 'opus_users_view' | 'opus_users_create' | 'opus_users_edit' | 'opus_users_delete'
  | 'client_users_view' | 'client_users_create' | 'client_users_edit' | 'client_users_delete'
  | 'system_roles_view' | 'system_roles_edit' | 'system_roles_delete';

export interface CustomRole {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  isSystemRole: boolean;
  isMobileOnly: boolean;
  isActive: boolean;
  permissions: PermissionKey[];
}

export interface UserRoleAssignment {
  id: string;
  userId: string;
  roleId: string;
  customerId?: string;
  role: CustomRole;
}

export function usePermissions() {
  const { user, isAuthenticated } = useAuth();

  // Buscar roles e permissões do usuário
  const { data: userRoles = [], isLoading } = useQuery<UserRoleAssignment[]>({
    queryKey: ['/api/users', user?.id, 'roles'],
    enabled: !!user?.id && isAuthenticated,
  });

  // Calcular permissões consolidadas
  const permissions = useMemo(() => {
    if (!userRoles.length) return new Set<PermissionKey>();
    
    const allPermissions = new Set<PermissionKey>();
    
    userRoles.forEach((assignment: UserRoleAssignment) => {
      assignment.role.permissions.forEach(permission => {
        allPermissions.add(permission);
      });
    });
    
    return allPermissions;
  }, [userRoles]);

  // Função para verificar permissão específica
  const hasPermission = (permission: PermissionKey, customerId?: string): boolean => {
    if (!isAuthenticated || !user) return false;
    
    // Admin sempre tem todas as permissões
    if (user.role === 'admin') return true;
    
    // Se especificou cliente, verificar permissões específicas
    if (customerId) {
      const customerSpecificRole = userRoles.find(
        (assignment: UserRoleAssignment) => assignment.customerId === customerId
      );
      if (customerSpecificRole) {
        return customerSpecificRole.role.permissions.includes(permission);
      }
    }
    
    // Verificar permissões gerais
    return permissions.has(permission);
  };

  // Funções de conveniência para cada área do sistema
  const can = {
    // Dashboard
    viewDashboard: (customerId?: string) => hasPermission('dashboard_view', customerId),
    
    // Ordens de Serviço
    viewWorkOrders: (customerId?: string) => hasPermission('workorders_view', customerId),
    createWorkOrders: (customerId?: string) => hasPermission('workorders_create', customerId),
    editWorkOrders: (customerId?: string) => hasPermission('workorders_edit', customerId),
    deleteWorkOrders: (customerId?: string) => hasPermission('workorders_delete', customerId),
    commentWorkOrders: (customerId?: string) => hasPermission('workorders_comment', customerId),
    evaluateWorkOrders: (customerId?: string) => hasPermission('workorders_evaluate', customerId),
    
    // Plano de Limpeza
    viewSchedule: (customerId?: string) => hasPermission('schedule_view', customerId),
    createSchedule: (customerId?: string) => hasPermission('schedule_create', customerId),
    editSchedule: (customerId?: string) => hasPermission('schedule_edit', customerId),
    deleteSchedule: (customerId?: string) => hasPermission('schedule_delete', customerId),
    
    // Checklists
    viewChecklists: (customerId?: string) => hasPermission('checklists_view', customerId),
    createChecklists: (customerId?: string) => hasPermission('checklists_create', customerId),
    editChecklists: (customerId?: string) => hasPermission('checklists_edit', customerId),
    deleteChecklists: (customerId?: string) => hasPermission('checklists_delete', customerId),
    
    // QR Codes
    viewQRCodes: (customerId?: string) => hasPermission('qrcodes_view', customerId),
    createQRCodes: (customerId?: string) => hasPermission('qrcodes_create', customerId),
    editQRCodes: (customerId?: string) => hasPermission('qrcodes_edit', customerId),
    deleteQRCodes: (customerId?: string) => hasPermission('qrcodes_delete', customerId),
    
    // Planta dos Locais
    viewFloorPlan: (customerId?: string) => hasPermission('floor_plan_view', customerId),
    editFloorPlan: (customerId?: string) => hasPermission('floor_plan_edit', customerId),
    
    // Mapa de Calor
    viewHeatmap: (customerId?: string) => hasPermission('heatmap_view', customerId),
    
    // Sites
    viewSites: (customerId?: string) => hasPermission('sites_view', customerId),
    createSites: (customerId?: string) => hasPermission('sites_create', customerId),
    editSites: (customerId?: string) => hasPermission('sites_edit', customerId),
    deleteSites: (customerId?: string) => hasPermission('sites_delete', customerId),
    
    // Usuários
    viewUsers: (customerId?: string) => hasPermission('users_view', customerId),
    createUsers: (customerId?: string) => hasPermission('users_create', customerId),
    editUsers: (customerId?: string) => hasPermission('users_edit', customerId),
    deleteUsers: (customerId?: string) => hasPermission('users_delete', customerId),
    
    // Usuários OPUS (funcionários da empresa)
    viewOpusUsers: () => hasPermission('opus_users_view'),
    createOpusUsers: () => hasPermission('opus_users_create'),
    editOpusUsers: () => hasPermission('opus_users_edit'),
    deleteOpusUsers: () => hasPermission('opus_users_delete'),
    
    // Usuários de Cliente
    viewClientUsers: (customerId?: string) => hasPermission('client_users_view', customerId),
    createClientUsers: (customerId?: string) => hasPermission('client_users_create', customerId),
    editClientUsers: (customerId?: string) => hasPermission('client_users_edit', customerId),
    deleteClientUsers: (customerId?: string) => hasPermission('client_users_delete', customerId),
    
    // Clientes (apenas admin)
    viewCustomers: () => user?.role === 'admin' && hasPermission('customers_view'),
    createCustomers: () => user?.role === 'admin' && hasPermission('customers_create'),
    editCustomers: () => user?.role === 'admin' && hasPermission('customers_edit'),
    deleteCustomers: () => user?.role === 'admin' && hasPermission('customers_delete'),
    
    // Relatórios
    viewReports: (customerId?: string) => hasPermission('reports_view', customerId),
    
    // Logs de Auditoria
    viewAuditLogs: (customerId?: string) => hasPermission('audit_logs_view', customerId),
    
    // Configurações de Serviço
    viewServiceSettings: (customerId?: string) => hasPermission('service_settings_view', customerId),
    editServiceSettings: (customerId?: string) => hasPermission('service_settings_edit', customerId),
    
    // Gerenciamento de Roles (apenas super admin)
    manageRoles: () => hasPermission('roles_manage'),
    
    // Funções de Sistema (OPUS only por padrão)
    viewSystemRoles: () => hasPermission('system_roles_view'),
    editSystemRoles: () => hasPermission('system_roles_edit'),
    deleteSystemRoles: () => hasPermission('system_roles_delete'),
    
    // Verificar se é SUPER ADMIN (tem todas as permissões incluindo roles_manage)
    isSuperAdmin: () => hasPermission('roles_manage'),

    // === FUNÇÕES DE ACESSO ÀS ÁREAS ===
    // Estas verificam se o usuário pode acessar uma área específica do sistema
    
    // Área: Dashboard
    canAccessDashboard: (customerId?: string) => hasPermission('dashboard_view', customerId),
    
    // Área: Ordens de Serviço
    canAccessWorkOrders: (customerId?: string) => hasPermission('workorders_view', customerId),
    
    // Área: Plano de Limpeza
    canAccessSchedule: (customerId?: string) => hasPermission('schedule_view', customerId),
    
    // Área: Checklists
    canAccessChecklists: (customerId?: string) => hasPermission('checklists_view', customerId),
    
    // Área: QR Codes
    canAccessQRCodes: (customerId?: string) => hasPermission('qrcodes_view', customerId),
    
    // Área: Planta dos Locais
    canAccessFloorPlan: (customerId?: string) => hasPermission('floor_plan_view', customerId),
    
    // Área: Mapa de Calor
    canAccessHeatmap: (customerId?: string) => hasPermission('heatmap_view', customerId),
    
    // Área: Sites/Locais
    canAccessSites: (customerId?: string) => hasPermission('sites_view', customerId),
    
    // Área: Usuários (geral - para clientes)
    canAccessUsers: (customerId?: string) => hasPermission('users_view', customerId),
    
    // Área: Usuários OPUS (funcionários da empresa OPUS)
    canAccessOpusUsers: () => hasPermission('opus_users_view'),
    
    // Área: Usuários de Cliente
    canAccessClientUsers: (customerId?: string) => hasPermission('client_users_view', customerId),
    
    // Área: Clientes (apenas admin OPUS)
    canAccessCustomers: () => user?.role === 'admin' && hasPermission('customers_view'),
    
    // Área: Relatórios
    canAccessReports: (customerId?: string) => hasPermission('reports_view', customerId),
    
    // Área: Logs de Auditoria
    canAccessAuditLogs: (customerId?: string) => hasPermission('audit_logs_view', customerId),
    
    // Área: Configurações de Serviço
    canAccessSettings: (customerId?: string) => hasPermission('service_settings_view', customerId),
    
    // Área: Gerenciamento de Funções/Roles
    canAccessRoles: () => hasPermission('roles_manage'),
  };

  // Lista de todas as permissões disponíveis
  const availablePermissions: { key: PermissionKey; label: string; category: string }[] = [
    // Dashboard
    { key: 'dashboard_view', label: 'Visualizar Dashboard', category: 'Dashboard' },
    
    // Ordens de Serviço
    { key: 'workorders_view', label: 'Visualizar Ordens de Serviço', category: 'Ordens de Serviço' },
    { key: 'workorders_create', label: 'Criar Ordens de Serviço', category: 'Ordens de Serviço' },
    { key: 'workorders_edit', label: 'Editar Ordens de Serviço', category: 'Ordens de Serviço' },
    { key: 'workorders_delete', label: 'Excluir Ordens de Serviço', category: 'Ordens de Serviço' },
    { key: 'workorders_comment', label: 'Comentar em Ordens de Serviço', category: 'Ordens de Serviço' },
    { key: 'workorders_evaluate', label: 'Avaliar Ordens de Serviço', category: 'Ordens de Serviço' },
    
    // Plano de Limpeza
    { key: 'schedule_view', label: 'Visualizar Plano de Limpeza', category: 'Plano de Limpeza' },
    { key: 'schedule_create', label: 'Criar Plano de Limpeza', category: 'Plano de Limpeza' },
    { key: 'schedule_edit', label: 'Editar Plano de Limpeza', category: 'Plano de Limpeza' },
    { key: 'schedule_delete', label: 'Excluir Plano de Limpeza', category: 'Plano de Limpeza' },
    
    // Checklists
    { key: 'checklists_view', label: 'Visualizar Checklists', category: 'Checklists' },
    { key: 'checklists_create', label: 'Criar Checklists', category: 'Checklists' },
    { key: 'checklists_edit', label: 'Editar Checklists', category: 'Checklists' },
    { key: 'checklists_delete', label: 'Excluir Checklists', category: 'Checklists' },
    
    // QR Codes
    { key: 'qrcodes_view', label: 'Visualizar QR Codes', category: 'QR Codes' },
    { key: 'qrcodes_create', label: 'Criar QR Codes', category: 'QR Codes' },
    { key: 'qrcodes_edit', label: 'Editar QR Codes', category: 'QR Codes' },
    { key: 'qrcodes_delete', label: 'Excluir QR Codes', category: 'QR Codes' },
    
    // Planta dos Locais
    { key: 'floor_plan_view', label: 'Visualizar Planta dos Locais', category: 'Planta dos Locais' },
    { key: 'floor_plan_edit', label: 'Editar Planta dos Locais', category: 'Planta dos Locais' },
    
    // Mapa de Calor
    { key: 'heatmap_view', label: 'Visualizar Mapa de Calor', category: 'Mapa de Calor' },
    
    // Locais
    { key: 'sites_view', label: 'Visualizar Locais', category: 'Locais' },
    { key: 'sites_create', label: 'Criar Locais', category: 'Locais' },
    { key: 'sites_edit', label: 'Editar Locais', category: 'Locais' },
    { key: 'sites_delete', label: 'Excluir Locais', category: 'Locais' },
    
    // Zonas
    { key: 'zones_view', label: 'Visualizar Zonas', category: 'Zonas' },
    { key: 'zones_create', label: 'Criar Zonas', category: 'Zonas' },
    { key: 'zones_edit', label: 'Editar Zonas', category: 'Zonas' },
    { key: 'zones_delete', label: 'Excluir Zonas', category: 'Zonas' },
    
    // Usuários
    { key: 'users_view', label: 'Visualizar Usuários', category: 'Usuários' },
    { key: 'users_create', label: 'Criar Usuários', category: 'Usuários' },
    { key: 'users_edit', label: 'Editar Usuários', category: 'Usuários' },
    { key: 'users_delete', label: 'Excluir Usuários', category: 'Usuários' },
    
    // Clientes
    { key: 'customers_view', label: 'Visualizar Clientes', category: 'Clientes' },
    { key: 'customers_create', label: 'Criar Clientes', category: 'Clientes' },
    { key: 'customers_edit', label: 'Editar Clientes', category: 'Clientes' },
    { key: 'customers_delete', label: 'Excluir Clientes', category: 'Clientes' },
    
    // Relatórios
    { key: 'reports_view', label: 'Visualizar Relatórios', category: 'Relatórios' },
    
    // Logs de Auditoria
    { key: 'audit_logs_view', label: 'Visualizar Logs de Auditoria', category: 'Auditoria' },
    
    // Configurações
    { key: 'service_settings_view', label: 'Visualizar Configurações', category: 'Configurações' },
    { key: 'service_settings_edit', label: 'Editar Configurações', category: 'Configurações' },
    
    // Gerenciamento de Roles
    { key: 'roles_manage', label: 'Gerenciar Funções', category: 'Administração' },
    
    // Funções de Sistema (OPUS only)
    { key: 'system_roles_view', label: 'Visualizar Funções de Sistema', category: 'Funções de Sistema' },
    { key: 'system_roles_edit', label: 'Editar Funções de Sistema', category: 'Funções de Sistema' },
    { key: 'system_roles_delete', label: 'Excluir Funções de Sistema', category: 'Funções de Sistema' },
    
    // Usuários OPUS
    { key: 'opus_users_view', label: 'Visualizar Usuários OPUS', category: 'Usuários OPUS' },
    { key: 'opus_users_create', label: 'Criar Usuários OPUS', category: 'Usuários OPUS' },
    { key: 'opus_users_edit', label: 'Editar Usuários OPUS', category: 'Usuários OPUS' },
    { key: 'opus_users_delete', label: 'Excluir Usuários OPUS', category: 'Usuários OPUS' },
    
    // Usuários de Cliente
    { key: 'client_users_view', label: 'Visualizar Usuários de Cliente', category: 'Usuários de Cliente' },
    { key: 'client_users_create', label: 'Criar Usuários de Cliente', category: 'Usuários de Cliente' },
    { key: 'client_users_edit', label: 'Editar Usuários de Cliente', category: 'Usuários de Cliente' },
    { key: 'client_users_delete', label: 'Excluir Usuários de Cliente', category: 'Usuários de Cliente' },
  ];

  // Detectar se o usuário é "mobile-only" (Operador)
  // Operadores têm apenas 4 permissões específicas e não devem acessar a web
  const isMobileOnlyUser = useMemo(() => {
    if (!isAuthenticated || !user) return false;
    
    // Admin nunca é mobile-only
    if (user.role === 'admin') return false;
    
    // Se não tem custom roles, usar fallback do role enum
    if (userRoles.length === 0) {
      return user.role === 'operador';
    }
    
    // Verificar se tem apenas permissões mobile (4 específicas)
    const mobilePermissions: PermissionKey[] = ['dashboard_view', 'workorders_view', 'workorders_edit', 'checklists_view'];
    const webOnlyPermissions: PermissionKey[] = [
      'sites_view', 'users_view', 'customers_view', 'reports_view', 
      'audit_logs_view', 'roles_manage', 'opus_users_view', 'client_users_view',
      'schedule_view', 'qrcodes_view', 'floor_plan_view', 'heatmap_view',
      'service_settings_view'
    ];
    
    // Se tem alguma permissão web, não é mobile-only
    const hasWebPermissions = webOnlyPermissions.some(perm => permissions.has(perm));
    if (hasWebPermissions) return false;
    
    // Se tem pelo menos 3 das 4 permissões mobile e nenhuma web, é mobile-only
    const mobilePermCount = mobilePermissions.filter(perm => permissions.has(perm)).length;
    return mobilePermCount >= 3;
  }, [isAuthenticated, user, userRoles, permissions]);

  return {
    permissions,
    userRoles,
    hasPermission,
    can,
    availablePermissions,
    isLoading,
    isAuthenticated,
    isMobileOnlyUser,
  };
}

export default usePermissions;