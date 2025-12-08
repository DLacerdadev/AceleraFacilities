import { Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'kJsXXrXanldoNcZJG/iHeTEI8WdMch4PFWNIao1llTU=';

export type UserRole = 'admin' | 'gestor_cliente' | 'supervisor_site' | 'operador' | 'auditor';

export interface SessionUser {
  id: string;
  companyId: string;
  customerId?: string;
  username: string;
  email: string;
  name: string;
  role: UserRole;
  userType?: string;
  isActive: boolean;
  modules?: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

// ============================================================================
// SISTEMA DE PERMISSÕES BASEADO EM CUSTOM ROLES
// ============================================================================

/**
 * Permissões exclusivas para usuários OPUS (opus_user)
 * Customer users NUNCA podem ter essas permissões
 */
export const OPUS_ONLY_PERMISSIONS = [
  // Gerenciamento de Usuários OPUS
  'opus_users_view',
  'opus_users_create',
  'opus_users_edit',
  'opus_users_delete',
  
  // Gerenciamento de Funções/Roles (geral)
  'roles_manage',
  
  // Gerenciamento de Funções de Sistema (específicas)
  'system_roles_view',
  'system_roles_edit',
  'system_roles_delete',
] as const;

/**
 * Permissões permitidas para customer_user
 * Todas exceto as OPUS_ONLY_PERMISSIONS
 */
export const CLIENT_ALLOWED_PERMISSIONS = [
  // Dashboard
  'dashboard_view',
  
  // Work Orders
  'workorders_view',
  'workorders_create',
  'workorders_edit',
  'workorders_delete',
  'workorders_comment',
  'workorders_evaluate',
  
  // Plano de Limpeza / Manutenção
  'schedule_view',
  'schedule_create',
  'schedule_edit',
  'schedule_delete',
  
  // Checklists
  'checklists_view',
  'checklists_create',
  'checklists_edit',
  'checklists_delete',
  
  // QR Codes
  'qrcodes_view',
  'qrcodes_create',
  'qrcodes_edit',
  'qrcodes_delete',
  
  // Planta dos Locais
  'floor_plan_view',
  'floor_plan_edit',
  
  // Mapa de Calor
  'heatmap_view',
  
  // Sites e Zonas
  'sites_view',
  'sites_create',
  'sites_edit',
  'sites_delete',
  'zones_view',
  'zones_create',
  'zones_edit',
  'zones_delete',
  
  // Gerenciamento de Clientes (para customer_user admins gerenciarem seus clientes)
  'customers_view',
  'customers_create',
  'customers_edit',
  'customers_delete',
  
  // Usuários de Cliente (gerenciar seus próprios usuários)
  'users_view',
  'users_create',
  'users_edit',
  'users_delete',
  'client_users_view',
  'client_users_create',
  'client_users_edit',
  'client_users_delete',
  
  // Relatórios
  'reports_view',
  
  // Logs de Auditoria
  'audit_logs_view',
  
  // Configurações de Serviço
  'service_settings_view',
  'service_settings_edit',
] as const;

/**
 * TODAS as permissões disponíveis no sistema (OPUS + CLIENT)
 * Usadas para Administrador e para listar permissões disponíveis
 */
export const ALL_PERMISSIONS = [
  ...OPUS_ONLY_PERMISSIONS,
  ...CLIENT_ALLOWED_PERMISSIONS
] as const;

/**
 * Busca todas as permissões de um usuário consolidadas de seus custom roles
 * @param userId - ID do usuário
 * @returns Array de strings com todas as permissões
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const userRoles = await storage.getUserRoles(userId);
    const permissions = new Set<string>();
    
    for (const roleAssignment of userRoles) {
      const rolePerms = await storage.getRolePermissions(roleAssignment.roleId);
      rolePerms.forEach((p: any) => {
        if (p.permission) {
          permissions.add(p.permission);
        }
      });
    }
    
    return Array.from(permissions);
  } catch (error) {
    console.error(`[getUserPermissions] Error fetching permissions for user ${userId}:`, error);
    return [];
  }
}

/**
 * Valida se as permissões são compatíveis com o tipo de usuário
 * @param userType - Tipo do usuário ('opus_user' ou 'customer_user')
 * @param permissions - Array de permissões a validar
 * @returns Objeto com validação: { valid: boolean, invalidPermissions: string[] }
 */
export function validatePermissionsByUserType(
  userType: string,
  permissions: string[]
): { valid: boolean; invalidPermissions: string[] } {
  // opus_user pode ter QUALQUER permissão
  if (userType === 'opus_user') {
    return { valid: true, invalidPermissions: [] };
  }
  
  // customer_user NÃO pode ter permissões OPUS_ONLY
  if (userType === 'customer_user') {
    const invalidPermissions = permissions.filter(p => 
      OPUS_ONLY_PERMISSIONS.includes(p as any)
    );
    
    return {
      valid: invalidPermissions.length === 0,
      invalidPermissions
    };
  }
  
  // Tipo desconhecido - negar tudo
  return {
    valid: false,
    invalidPermissions: permissions
  };
}

/**
 * Determina o role efetivo baseado nas permissões dos custom roles
 */
function getEffectiveRole(baseRole: UserRole, permissions: string[]): UserRole {
  // Se já tem role de admin na tabela users, manter
  if (baseRole === 'admin') {
    return 'admin';
  }
  
  // Mapear permissões para roles
  if (permissions.includes('customers_create') || permissions.includes('customers_edit') || permissions.includes('customers_delete')) {
    return 'admin';
  }
  
  if (permissions.includes('users_create') || permissions.includes('users_edit') || permissions.includes('users_delete')) {
    return 'gestor_cliente';
  }
  
  if (permissions.includes('workorders_create') || permissions.includes('workorders_edit') || permissions.includes('sites_create')) {
    return 'supervisor_site';
  }
  
  if (permissions.includes('audit_logs_view') || permissions.includes('reports_view')) {
    return 'auditor';
  }
  
  // Default: operador
  return baseRole;
}

/**
 * Helper function to extract user from Authorization header
 */
export async function getUserFromToken(req: Request): Promise<SessionUser | null> {
  try {
    const authHeader = req.headers.authorization;
    const reqPath = req.path;
    
    if (!authHeader) {
      if (reqPath.includes('my-customers')) {
        console.log('[AUTH DEBUG] No auth header for:', reqPath);
      }
      return null;
    }
    
    if (reqPath.includes('my-customers')) {
      console.log('[AUTH DEBUG] Has auth header for:', reqPath, '- token starts with:', authHeader.substring(0, 20));
    }
    
    const token = authHeader.replace('Bearer ', '');
    
    // Try JWT first
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const user = await storage.getUser(decoded.userId);
      if (!user || !user.isActive) {
        return null;
      }
      
      // Buscar custom roles e suas permissões do usuário
      const userRoles = await storage.getUserRoles(user.id);
      const permissions: string[] = [];
      
      for (const roleAssignment of userRoles) {
        const rolePerms = await storage.getRolePermissions(roleAssignment.roleId);
        permissions.push(...rolePerms.map((p: any) => p.permission).filter((p: string | null) => p !== null));
      }
      
      // Determinar role efetivo baseado nas permissões
      const effectiveRole = getEffectiveRole(user.role as UserRole, permissions);
      
      return {
        id: user.id,
        companyId: user.companyId || '',
        customerId: user.customerId || undefined,
        username: user.username,
        email: user.email,
        name: user.name,
        role: effectiveRole,
        userType: user.userType || 'opus_user',
        isActive: user.isActive,
        modules: user.modules || []
      };
    } catch (jwtError: any) {
      // Log JWT error for debugging
      if (reqPath.includes('my-customers')) {
        console.log('[AUTH DEBUG] JWT verification failed:', jwtError.message);
      }
      // Fallback to old token format for backwards compatibility
      const parts = token.split('_');
      if (parts.length >= 2 && parts[0] === 'token') {
        const userId = parts[1];
        const user = await storage.getUser(userId);
        if (!user || !user.isActive) {
          return null;
        }
        
        // Buscar custom roles e suas permissões do usuário
        const userRoles = await storage.getUserRoles(user.id);
        const permissions: string[] = [];
        
        for (const roleAssignment of userRoles) {
          const rolePerms = await storage.getRolePermissions(roleAssignment.roleId);
          permissions.push(...rolePerms.map((p: any) => p.permission).filter((p: string | null) => p !== null));
        }
        
        // Determinar role efetivo baseado nas permissões
        const effectiveRole = getEffectiveRole(user.role as UserRole, permissions);
        
        return {
          id: user.id,
          companyId: user.companyId || '',
          customerId: user.customerId || undefined,
          username: user.username,
          email: user.email,
          name: user.name,
          role: effectiveRole,
          userType: user.userType || 'opus_user',
          isActive: user.isActive,
          modules: user.modules || []
        };
      }
      return null;
    }
  } catch (error) {
    console.error('Error extracting user from token:', error);
    return null;
  }
}

/**
 * Middleware para verificar se o usuário está autenticado
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = await getUserFromToken(req);
  
  if (!user) {
    return res.status(401).json({ 
      error: 'Não autenticado',
      message: 'Você precisa estar logado para acessar este recurso.' 
    });
  }
  
  if (!user.isActive) {
    return res.status(403).json({ 
      error: 'Conta desativada',
      message: 'Sua conta está desativada. Entre em contato com o administrador.' 
    });
  }
  
  // Attach user to request
  req.user = user;
  next();
}

/**
 * Middleware para verificar se o usuário tem um dos roles permitidos
 */
export function requireRole(allowedRoles: UserRole[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await getUserFromToken(req);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Não autenticado',
        message: 'Você precisa estar logado para acessar este recurso.' 
      });
    }
    
    if (!allowedRoles.includes(user.role)) {
      console.warn(`[ACCESS DENIED] User ${user.id} (${user.role}) tentou acessar recurso que requer: ${allowedRoles.join(', ')}`);
      return res.status(403).json({ 
        error: 'Acesso negado',
        message: `Apenas usuários com as seguintes funções podem acessar: ${allowedRoles.join(', ')}.`,
        requiredRoles: allowedRoles,
        userRole: user.role
      });
    }
    
    // Attach user to request
    req.user = user;
    next();
  };
}

/**
 * Middleware para verificar se o usuário é admin
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole(['admin'])(req, res, next);
}

/**
 * Middleware para verificar se o usuário pode gerenciar clientes (apenas admin)
 */
export function requireManageClients(req: Request, res: Response, next: NextFunction) {
  return requireRole(['admin'])(req, res, next);
}

/**
 * Middleware para verificar se o usuário pode gerenciar usuários (admin ou gestor_cliente)
 */
export function requireManageUsers(req: Request, res: Response, next: NextFunction) {
  return requireRole(['admin', 'gestor_cliente'])(req, res, next);
}

/**
 * Middleware para verificar se o usuário pode gerenciar work orders
 * (admin, gestor_cliente ou supervisor_site)
 */
export function requireManageWorkOrders(req: Request, res: Response, next: NextFunction) {
  return requireRole(['admin', 'gestor_cliente', 'supervisor_site'])(req, res, next);
}

/**
 * Middleware para verificar se o usuário pode visualizar relatórios
 * (admin, gestor_cliente ou auditor)
 */
export function requireViewReports(req: Request, res: Response, next: NextFunction) {
  return requireRole(['admin', 'gestor_cliente', 'auditor'])(req, res, next);
}

/**
 * Middleware para permitir acesso a um cliente se:
 * 1. Usuário é admin (opus_user ou customer_user), OU
 * 2. Usuário tem permissão customers_view, OU
 * 3. Usuário é customer_user gerenciando seus clientes via userAllowedCustomers
 */
export async function requireCustomerAccessOrPermission(req: Request, res: Response, next: NextFunction) {
  const user = await getUserFromToken(req);
  const customerId = req.params.id || req.params.customerId;
  
  if (!user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  
  // Se user é admin (opus_user ou customer_user), permite acesso total
  if (user.role === 'admin') {
    req.user = user;
    return next();
  }
  
  // Se user é opus_user não-admin, verifica permissão customers_view
  if (user.userType === 'opus_user') {
    const userPermissions = await getUserPermissions(user.id);
    if (!userPermissions.includes('customers_view')) {
      return res.status(403).json({ error: 'Permissão negada: customers_view requerida' });
    }
    req.user = user;
    return next();
  }
  
  // Se user é customer_user admin, permite acesso direto sem verificar permissão
  // (já que está gerenciando seus clientes via userAllowedCustomers)
  if (user.userType === 'customer_user' && user.role === 'admin') {
    req.user = user;
    return next();
  }
  
  // Se chegou aqui, não tem acesso
  return res.status(403).json({ error: 'Acesso negado a este cliente' });
}

/**
 * Middleware para validar que o usuário só acessa dados do seu próprio cliente
 * (exceto admin que pode acessar tudo)
 */
export async function requireOwnCustomer(req: Request, res: Response, next: NextFunction) {
  const user = await getUserFromToken(req);
  
  if (!user) {
    return res.status(401).json({ 
      error: 'Não autenticado' 
    });
  }
  
  // Admin pode acessar qualquer cliente
  if (user.role === 'admin') {
    req.user = user;
    return next();
  }
  
  // Pegar customerId do parâmetro da rota ou do body
  const requestedCustomerId = req.params.customerId || req.body.customerId;
  
  if (!requestedCustomerId) {
    return res.status(400).json({ 
      error: 'Cliente não especificado',
      message: 'É necessário especificar o ID do cliente.' 
    });
  }
  
  // Verificar se o usuário pertence ao cliente solicitado
  if (user.customerId !== requestedCustomerId) {
    console.warn(`[ACCESS DENIED] User ${user.id} tentou acessar dados do cliente ${requestedCustomerId} mas pertence a ${user.customerId}`);
    return res.status(403).json({ 
      error: 'Acesso negado',
      message: 'Você não tem permissão para acessar dados deste cliente.',
      userCustomerId: user.customerId,
      requestedCustomerId
    });
  }
  
  req.user = user;
  next();
}

/**
 * Middleware para validar que o usuário só acessa suas próprias work orders
 * (usado para operadores que só podem ver suas próprias OSs)
 */
export async function requireOwnWorkOrders(req: Request, res: Response, next: NextFunction) {
  const user = await getUserFromToken(req);
  
  if (!user) {
    return res.status(401).json({ 
      error: 'Não autenticado' 
    });
  }
  
  // Admin, gestor e supervisor podem ver todas as OSs
  if (['admin', 'gestor_cliente', 'supervisor_site'].includes(user.role)) {
    req.user = user;
    return next();
  }
  
  // Operadores só podem ver suas próprias OSs
  // Isso será validado na query do banco de dados
  req.user = user;
  next();
}

/**
 * Middleware para verificar se o usuário tem uma permissão específica
 * NOVO SISTEMA: Valida permissões granulares ao invés de roles genéricos
 * @param permission - String da permissão requerida (ex: 'users_create', 'sites_edit')
 */
export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = await getUserFromToken(req);
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Não autenticado',
        message: 'Você precisa estar logado para acessar este recurso.' 
      });
    }
    
    // Buscar permissões do usuário
    const userPermissions = await getUserPermissions(user.id);
    
    // Admin OPUS sempre tem todas as permissões
    if (user.role === 'admin' && user.userType === 'opus_user') {
      console.log(`[PERMISSION CHECK] ✅ Admin OPUS ${user.id} tem acesso total (permissão: ${permission})`);
      req.user = user;
      return next();
    }
    
    // Verificar se o usuário tem a permissão específica
    if (!userPermissions.includes(permission)) {
      console.warn(`[PERMISSION DENIED] ❌ User ${user.id} (${user.role}) tentou acessar recurso que requer permissão: ${permission}`);
      console.warn(`[PERMISSION DENIED] Permissões do usuário: ${userPermissions.join(', ')}`);
      
      return res.status(403).json({ 
        error: 'Permissão negada',
        message: `Você não tem permissão para realizar esta ação. Permissão necessária: ${permission}`,
        requiredPermission: permission,
        userPermissions: userPermissions
      });
    }
    
    console.log(`[PERMISSION CHECK] ✅ User ${user.id} tem permissão: ${permission}`);
    req.user = user;
    next();
  };
}

/**
 * Middleware para verificar se o usuário é do tipo OPUS (opus_user)
 * Apenas usuários OPUS podem acessar funcionalidades administrativas avançadas
 */
export async function requireOpusUser(req: Request, res: Response, next: NextFunction) {
  const user = await getUserFromToken(req);
  
  if (!user) {
    return res.status(401).json({ 
      error: 'Não autenticado',
      message: 'Você precisa estar logado para acessar este recurso.' 
    });
  }
  
  if (user.userType !== 'opus_user') {
    console.warn(`[ACCESS DENIED] User ${user.id} (${user.userType}) tentou acessar recurso restrito a OPUS users`);
    return res.status(403).json({ 
      error: 'Acesso negado',
      message: 'Este recurso está disponível apenas para usuários OPUS.',
      userType: user.userType
    });
  }
  
  req.user = user;
  next();
}

/**
 * Função helper para logar tentativas de acesso negado
 * (pode ser expandida para salvar em audit_logs)
 */
export function logAccessDenied(
  userId: string, 
  resource: string, 
  action: string, 
  reason: string
) {
  console.warn(`[ACCESS DENIED] User ${userId} tentou ${action} em ${resource}. Motivo: ${reason}`);
  // TODO: Salvar em audit_logs no banco de dados
}
