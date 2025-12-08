import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireManageClients?: boolean;
  requireManageUsers?: boolean;
  requireManageWorkOrders?: boolean;
  requireViewReports?: boolean;
  requireViewAuditLogs?: boolean;
  fallbackPath?: string;
}

export function ProtectedRoute({ 
  children, 
  requireAdmin = false,
  requireManageClients = false,
  requireManageUsers = false,
  requireManageWorkOrders = false,
  requireViewReports = false,
  requireViewAuditLogs = false,
  fallbackPath = '/'
}: ProtectedRouteProps) {
  const { 
    user, 
    isAuthenticated, 
    canManageClients, 
    canManageUsers,
    canManageWorkOrders,
    canViewReports,
    isAdmin
  } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: 'Acesso negado',
        description: 'Você precisa estar logado para acessar esta página.',
        variant: 'destructive',
      });
      setLocation('/login');
      return;
    }

    if (requireAdmin && user?.role !== 'admin') {
      toast({
        title: 'Acesso restrito',
        description: 'Apenas administradores podem acessar esta página.',
        variant: 'destructive',
      });
      setLocation(fallbackPath);
      return;
    }

    if (requireManageClients && !canManageClients) {
      toast({
        title: 'Acesso restrito',
        description: 'Você não tem permissão para gerenciar clientes.',
        variant: 'destructive',
      });
      setLocation(fallbackPath);
      return;
    }

    if (requireManageUsers && !canManageUsers) {
      toast({
        title: 'Acesso restrito',
        description: 'Você não tem permissão para gerenciar usuários.',
        variant: 'destructive',
      });
      setLocation(fallbackPath);
      return;
    }

    if (requireManageWorkOrders && !canManageWorkOrders) {
      toast({
        title: 'Acesso restrito',
        description: 'Você não tem permissão para gerenciar ordens de serviço.',
        variant: 'destructive',
      });
      setLocation(fallbackPath);
      return;
    }

    if (requireViewReports && !canViewReports) {
      toast({
        title: 'Acesso restrito',
        description: 'Você não tem permissão para visualizar relatórios.',
        variant: 'destructive',
      });
      setLocation(fallbackPath);
      return;
    }

    if (requireViewAuditLogs && !isAdmin) {
      toast({
        title: 'Acesso restrito',
        description: 'Apenas administradores podem visualizar logs de auditoria.',
        variant: 'destructive',
      });
      setLocation(fallbackPath);
      return;
    }
  }, [
    isAuthenticated, 
    user, 
    requireAdmin, 
    requireManageClients, 
    requireManageUsers,
    requireManageWorkOrders,
    requireViewReports,
    requireViewAuditLogs,
    canManageClients, 
    canManageUsers,
    canManageWorkOrders,
    canViewReports,
    isAdmin,
    toast, 
    setLocation, 
    fallbackPath
  ]);

  // Se não passou na verificação, não renderizar nada
  if (!isAuthenticated) return null;
  if (requireAdmin && user?.role !== 'admin') return null;
  if (requireManageClients && !canManageClients) return null;
  if (requireManageUsers && !canManageUsers) return null;
  if (requireManageWorkOrders && !canManageWorkOrders) return null;
  if (requireViewReports && !canViewReports) return null;
  if (requireViewAuditLogs && !isAdmin) return null;

  return <>{children}</>;
}
