import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranding } from "@/contexts/BrandingContext";
import aceleraLogo from "@assets/imagem_2025-11-10_010501695-Photoroom_1762805733799.png";
import { 
  Building, 
  Calendar, 
  ChartBar, 
  ClipboardList, 
  Home, 
  QrCode, 
  Users, 
  LogOut,
  Fan,
  Map,
  Menu,
  X,
  ChevronLeft,
  Shield,
  Cog,
  Activity,
  TrendingUp,
  Wrench,
  List,
  CalendarCheck,
  FileBarChart,
  Brain,
  Package,
  AlertTriangle
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { logout, getRoleDisplayName } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useClient } from "@/contexts/ClientContext";
import { useModule, MODULE_CONFIGS } from "@/contexts/ModuleContext";
import type { Part } from "@shared/schema";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function Sidebar({ isCollapsed, onToggleCollapse }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user, canManageClients } = useAuth();
  const { can } = usePermissions();
  const { activeClientId, setActiveClientId, activeClient, customers } = useClient();
  const { currentModule, setModule, moduleConfig, allowedModules, hasMultipleModules } = useModule();
  const { branding } = useBranding();
  
  // Query para buscar peças com estoque baixo (apenas para módulo manutenção)
  const { data: lowStockParts = [] } = useQuery<Part[]>({
    queryKey: ['/api/customers', activeClientId, 'parts', 'low-stock'],
    enabled: !!activeClientId && currentModule === 'maintenance'
  });
  const lowStockCount = lowStockParts.length;
  
  // Helper para obter cores de um módulo específico (com fallback para cores padrão)
  const getModulePalette = (moduleId: 'clean' | 'maintenance') => {
    const defaultColors = MODULE_CONFIGS[moduleId];
    const customColors = activeClient?.moduleColors?.[moduleId];
    
    return {
      primary: customColors?.primary || defaultColors.primaryColor,
      secondary: customColors?.secondary || defaultColors.secondaryColor,
      accent: customColors?.accent || defaultColors.accentColor,
    };
  };
  
  // Usuários do tipo customer_user não podem alterar o cliente
  const isCustomerUser = user?.userType === 'customer_user';
  
  // Calcular módulos permitidos baseado na interseção entre módulos do usuário e do cliente ativo
  const clientModules = (activeClient?.modules || []) as ('clean' | 'maintenance')[];
  const effectiveAllowedModules = allowedModules.filter(module => clientModules.includes(module));
  const effectiveHasMultipleModules = effectiveAllowedModules.length > 1;

  // Auto-corrigir módulo quando cliente ativo mudar
  useEffect(() => {
    if (activeClient && effectiveAllowedModules.length > 0) {
      // Se o módulo atual não está disponível para o cliente ativo, trocar para o primeiro disponível
      if (!effectiveAllowedModules.includes(currentModule)) {
        const newModule = effectiveAllowedModules[0];
        console.log(`[SIDEBAR] Módulo ${currentModule} não disponível para cliente ${activeClient.name}. Trocando para ${newModule}`);
        setModule(newModule);
      }
    }
  }, [activeClient, effectiveAllowedModules, currentModule, setModule]);

  const handleLogout = async () => {
    try {
      queryClient.clear();
      await logout();
      window.location.href = "/login";
    } catch (error) {
      queryClient.clear();
      window.location.href = "/login";
    }
  };

  // Criar menu baseado em permissões granulares e módulo atual
  const menuItems = [
    // Dashboard - sempre disponível se tiver acesso ao sistema
    ...(can.viewDashboard(activeClientId) ? [{ path: "/", label: "Dashboard", icon: Home }] : []),
    
    // Ordens de Serviço
    ...(can.viewWorkOrders(activeClientId) ? [{ path: "/workorders", label: "Ordens de Serviço", icon: ClipboardList }] : []),
    
    // OPUS Clean - Menu items específicos
    ...(currentModule === 'clean' && can.viewSchedule(activeClientId) ? [{ path: "/schedule", label: "Plano de Limpeza", icon: Calendar }] : []),
    ...(currentModule === 'clean' && can.viewChecklists(activeClientId) ? [{ path: "/checklists", label: "Checklists", icon: Fan }] : []),
    
    // OPUS Manutenção - Menu items específicos
    ...(currentModule === 'maintenance' && can.viewQRCodes(activeClientId) ? [{ path: "/equipment", label: "Equipamentos", icon: Wrench }] : []),
    ...(currentModule === 'maintenance' && can.viewSchedule(activeClientId) ? [{ 
      path: "/parts-inventory", 
      label: "Estoque de Peças", 
      icon: Package,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeVariant: 'destructive' as const
    }] : []),
    ...(currentModule === 'maintenance' && can.viewSchedule(activeClientId) ? [{ path: "/maintenance-plans", label: "Planos de Manutenção", icon: CalendarCheck }] : []),
    ...(currentModule === 'maintenance' && can.viewChecklists(activeClientId) ? [{ path: "/maintenance-checklist-templates", label: "Checklists", icon: List }] : []),
    ...(currentModule === 'maintenance' && can.viewReports(activeClientId) ? [{ path: "/asset-report", label: "Relatório de Patrimônio", icon: FileBarChart }] : []),
    
    // QR Codes - disponível em ambos os módulos
    ...(can.viewQRCodes(activeClientId) ? [{ path: "/qrcodes", label: "QR Codes", icon: QrCode }] : []),
    
    // Planta dos Locais
    ...(can.viewFloorPlan(activeClientId) ? [{ path: "/floor-plan", label: "Planta dos Locais", icon: Map }] : []),
    
    // Relatórios
    ...(can.viewReports(activeClientId) ? [{ path: "/reports", label: "Relatórios", icon: ChartBar }] : []),
    
    // Usuários do Sistema (apenas para quem tem permissão)
    ...(can.viewOpusUsers() ? [{ path: "/users", label: "Usuários do Sistema", icon: Users }] : []),
    
    // Clientes (apenas admin)
    ...(can.viewCustomers() ? [{ path: "/customers", label: "Clientes", icon: Building }] : []),
    
    
    // Funções (apenas super admin)
    ...(can.manageRoles() ? [{ path: "/roles", label: "Funções", icon: Shield }] : []),
    
    // Integrações AI (apenas usuários OPUS)
    ...((user?.userType === 'opus_user' as any) ? [{ path: "/ai-integrations", label: "Integrações AI", icon: Brain }] : []),
  ];

  return (
    <div className={`${isCollapsed ? 'w-16' : 'w-64'} bg-gradient-to-b from-slate-50 via-white to-slate-50/50 border-r border-slate-200 shadow-lg flex flex-col transition-all duration-300`} data-testid="sidebar">
      {/* Header */}
      <div className={`${isCollapsed ? 'p-3' : 'py-6 px-6'} border-b border-slate-200 relative bg-gradient-to-br from-white to-slate-100`}>
        <div className="flex items-center justify-between">
          <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'justify-start'}`}>
            <img 
              src={
                isCollapsed 
                  ? (activeClient?.sidebarLogoCollapsed || branding?.sidebarLogoCollapsed || activeClient?.sidebarLogo || branding?.sidebarLogo || aceleraLogo)
                  : (activeClient?.sidebarLogo || branding?.sidebarLogo || aceleraLogo)
              } 
              alt={activeClient?.name || branding?.name || "Acelera Full Facilities"}
              data-testid={isCollapsed ? "img-sidebar-logo-collapsed" : "img-sidebar-logo"} 
              className={`${
                isCollapsed ? 'h-20 w-auto' : 'h-32 w-auto max-w-full'
              } object-contain transition-all duration-300`}
            />
          </div>
          {!isCollapsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className="h-8 w-8 p-0 flex-shrink-0 hover:bg-primary/10 border border-border/50"
              data-testid="toggle-sidebar"
            >
              <ChevronLeft className={`w-4 h-4 transition-transform text-foreground ${isCollapsed ? 'rotate-180' : ''}`} />
            </Button>
          )}
          {isCollapsed && (
            <div className="absolute top-2 right-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleCollapse}
                className="h-6 w-6 p-0 flex-shrink-0 hover:bg-primary/10 border border-border/50"
                data-testid="toggle-sidebar"
              >
                <ChevronLeft className={`w-3 h-3 transition-transform text-foreground rotate-180`} />
              </Button>
            </div>
          )}
        </div>
      </div>
      {/* Company Selector - apenas para admin/opus users */}
      {!isCollapsed && !isCustomerUser && customers.length > 0 && (
        <div className="px-6 pt-1 pb-3 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Cliente Ativo</label>
          <Select value={activeClientId} onValueChange={setActiveClientId}>
            <SelectTrigger data-testid="company-selector" className="bg-white shadow-sm border-slate-300 hover:border-slate-400 transition-colors">
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {/* Nome do Cliente fixo para customer_user */}
      {!isCollapsed && isCustomerUser && activeClient && (
        <div className="px-6 pt-1 pb-3 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <label className="block text-sm font-semibold text-slate-500 mb-2">Cliente</label>
          <div className="px-3 py-2 bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-md shadow-sm">
            <p className="text-sm font-medium text-slate-700">{activeClient.name}</p>
          </div>
        </div>
      )}
      {/* Module/Platform Selector - mostrar se o USUÁRIO tem múltiplos módulos disponíveis */}
      {!isCollapsed && hasMultipleModules && (
        <div className="px-6 pt-1 pb-3 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Plataforma
          </label>
          <Select value={currentModule} onValueChange={(value) => setModule(value as 'clean' | 'maintenance')}>
            <SelectTrigger data-testid="module-selector" className="bg-white shadow-sm border-slate-300 hover:border-slate-400 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clean" disabled={!effectiveAllowedModules.includes('clean')}>
                <span className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  {MODULE_CONFIGS.clean.displayName}
                </span>
              </SelectItem>
              <SelectItem value="maintenance" disabled={!effectiveAllowedModules.includes('maintenance')}>
                <span className="flex items-center gap-2">
                  <Cog className="w-4 h-4" />
                  {MODULE_CONFIGS.maintenance.displayName}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
      {/* Module Indicator - para usuários com apenas um módulo */}
      {!isCollapsed && !hasMultipleModules && (
        <div className="px-6 pt-1 pb-3 border-b border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <label className="block text-sm font-semibold text-slate-500 mb-2">
            Plataforma
          </label>
          <div 
            className="px-3 py-2 border rounded-md shadow-sm"
            style={{
              background: `linear-gradient(to bottom right, color-mix(in srgb, var(--module-primary) 10%, white), color-mix(in srgb, var(--module-secondary) 5%, white))`,
              borderColor: `color-mix(in srgb, var(--module-primary) 40%, white)`
            }}
          >
            <div className="flex items-center gap-2">
              {currentModule === 'maintenance' ? (
                <Cog className="w-4 h-4" style={{ color: 'var(--module-primary)' }} />
              ) : (
                <Building className="w-4 h-4" style={{ color: 'var(--module-primary)' }} />
              )}
              <p className="text-sm font-medium text-slate-700">
                {MODULE_CONFIGS[currentModule].displayName}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;
          const itemBadge = (item as any).badge;
          const badgeVariant = (item as any).badgeVariant || 'destructive';
          
          return (
            <Link key={item.path} href={item.path}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={`w-full ${isCollapsed ? 'justify-center px-0 relative' : 'justify-start'} transition-all duration-200 ${
                  isActive 
                    ? 'text-white shadow-md hover:shadow-lg'
                    : "hover:bg-slate-100 hover:text-slate-900"
                }`}
                style={isActive ? {
                  background: `linear-gradient(to right, var(--module-primary), var(--module-secondary))`
                } : undefined}
                data-testid={`nav-${item.path.slice(1) || 'dashboard'}`}
                title={isCollapsed ? (itemBadge ? `${item.label} (${itemBadge} alertas)` : item.label) : undefined}
              >
                <div className={`flex items-center ${isCollapsed ? '' : 'gap-3'} w-full`}>
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="font-medium flex-1 text-left">{item.label}</span>
                      {itemBadge && (
                        <Badge 
                          variant={badgeVariant}
                          className="flex items-center gap-1 text-xs px-1.5 py-0.5"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {itemBadge}
                        </Badge>
                      )}
                    </>
                  )}
                  {isCollapsed && itemBadge && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {itemBadge > 9 ? '9+' : itemBadge}
                    </span>
                  )}
                </div>
              </Button>
            </Link>
          );
        })}
        
        {/* Configurações do Sistema */}
        {activeClientId && can.viewServiceSettings(activeClientId) && (
          <Link href="/service-settings">
            <Button
              variant={location.startsWith('/service-settings') ? "default" : "ghost"}
              className={`w-full ${isCollapsed ? 'justify-center px-0' : 'justify-start space-x-3'} transition-all duration-200 ${
                location.startsWith('/service-settings')
                  ? 'text-white shadow-md hover:shadow-lg'
                  : "hover:bg-slate-100 hover:text-slate-900"
              }`}
              style={location.startsWith('/service-settings') ? {
                background: `linear-gradient(to right, var(--module-primary), var(--module-secondary))`
              } : undefined}
              data-testid="nav-service-settings"
              title={isCollapsed ? "Configurações" : undefined}
            >
              <Cog className="w-5 h-5" />
              {!isCollapsed && <span className="font-medium">Configurações</span>}
            </Button>
          </Link>
        )}
      </nav>
      {/* User Profile */}
      <div className="p-4 border-t border-slate-200 bg-gradient-to-br from-slate-50 to-white">
        {isCollapsed ? (
          <div className="flex justify-center">
            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-secondary-foreground">
                {user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'US'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3 p-2">
            <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-secondary-foreground">
                {user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'US'}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{user?.name || 'Usuário'}</p>
              <p className="text-xs text-muted-foreground">{user?.role ? getRoleDisplayName(user.role) : 'Sem cargo'}</p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              data-testid="logout-button"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
