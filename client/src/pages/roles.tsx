import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Users, Shield, Plus, Edit, Trash2, Settings, LayoutDashboard, FileText, MapPin, BarChart3, ClipboardCheck, QrCode, Map, Thermometer, Building2, UserCog, Settings2, Eye, CheckCircle2, XCircle } from 'lucide-react';
import usePermissions, { PermissionKey } from '@/hooks/usePermissions';
import type { CustomRole } from '@/hooks/usePermissions';
import { ModernPageHeader } from '@/components/ui/modern-page-header';
import { ModernCard } from '@/components/ui/modern-card';
import { useModuleTheme } from '@/hooks/use-module-theme';
import { useAuth } from '@/hooks/useAuth';
import { useCacheInvalidation } from '@/hooks/use-cache-invalidation';
import { useClient } from '@/contexts/ClientContext';

// Permissões exclusivas OPUS (sincronizar com backend)
const OPUS_ONLY_PERMISSIONS: PermissionKey[] = [
  'customers_view',
  'customers_create',
  'customers_edit',
  'customers_delete',
  'opus_users_view',
  'opus_users_create',
  'opus_users_edit',
  'opus_users_delete',
  'roles_manage',
  'system_roles_view',
  'system_roles_edit',
  'system_roles_delete',
];

const createRoleSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, 'Selecione pelo menos uma permissão'),
  isMobileOnly: z.boolean().default(false),
});

type CreateRoleForm = z.infer<typeof createRoleSchema>;

export default function Roles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cache = useCacheInvalidation();
  const { user } = useAuth();
  const { availablePermissions, can } = usePermissions();
  const { activeClientId } = useClient();
  const theme = useModuleTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [activeTab, setActiveTab] = useState('client'); // 'client' ou 'system'

  // Inicializar funções de sistema automaticamente se tiver permissão
  useEffect(() => {
    const initializeSystemRoles = async () => {
      // Apenas opus_user com permissão pode inicializar
      if (user?.userType === 'opus_user') {
        try {
          const response = await fetch('/api/roles/init-system-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log('[System Roles] Initialized:', data.created?.length || 0, 'new roles');
            // Se foram criadas novas roles, recarregar a query
            if (data.created?.length > 0) {
              // Aguardar um pouco e recarregar
              setTimeout(() => {
                queryClient.invalidateQueries({ queryKey: ['/api/roles?isSystemRole=true'] });
              }, 500);
            }
          }
        } catch (error) {
          console.debug('[System Roles] Already initialized or error:', error);
        }
      }
    };
    
    initializeSystemRoles();
  }, [user?.userType]);

  // ✅ MOSTRAR TODAS AS PERMISSÕES DISPONÍVEIS NO FORMULÁRIO
  // Sem filtros - o usuário deve ver e poder selecionar TODAS as permissões
  const filteredAvailablePermissions = availablePermissions;

  const form = useForm<CreateRoleForm>({
    resolver: zodResolver(createRoleSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: [],
      isMobileOnly: false,
    },
  });

  // Verificar se o usuário pode gerenciar roles
  if (!can.manageRoles()) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Acesso Negado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar o gerenciamento de funções.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Query para roles de cliente (isSystemRole=false) - FILTRADO POR CLIENTE ATIVO
  const { data: clientRoles = [], isLoading: isLoadingClientRoles, refetch: refetchClientRoles } = useQuery<CustomRole[]>({
    queryKey: ['/api/roles', { isSystemRole: false, customerId: activeClientId }],
    enabled: !!activeClientId, // Só faz a query se tiver um cliente ativo
  });

  // Query para roles de sistema (isSystemRole=true) - apenas se tiver permissão
  const { data: systemRoles = [], isLoading: isLoadingSystemRoles, refetch: refetchSystemRoles } = useQuery<CustomRole[]>({
    queryKey: ['/api/roles?isSystemRole=true'],
    enabled: can.viewSystemRoles(), // Só busca se tiver permissão
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: CreateRoleForm & { isSystemRole?: boolean }) => {
      await apiRequest('POST', '/api/roles', data);
    },
    onSuccess: (_, variables) => {
      // Refetch imediatamente a query correta baseado no tipo de role
      if (variables.isSystemRole) {
        refetchSystemRoles();
      } else {
        refetchClientRoles();
      }
      setIsCreateDialogOpen(false);
      setEditingRole(null);
      form.reset();
      toast({
        title: 'Sucesso',
        description: 'Função criada com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CreateRoleForm }) => {
      await apiRequest('PATCH', `/api/roles/${id}`, data);
    },
    onSuccess: () => {
      // Refetch imediatamente ambas as queries para garantir atualização
      refetchClientRoles();
      refetchSystemRoles();
      setIsCreateDialogOpen(false);
      setEditingRole(null);
      form.reset();
      toast({
        title: 'Sucesso',
        description: 'Função atualizada com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await apiRequest('DELETE', `/api/roles/${roleId}`);
    },
    onSuccess: () => {
      // Refetch imediatamente ambas as queries
      refetchClientRoles();
      refetchSystemRoles();
      toast({
        title: 'Sucesso',
        description: 'Função excluída com sucesso!',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Selecionar roles baseado na tab ativa
  const currentRoles: CustomRole[] = activeTab === 'system' ? systemRoles : clientRoles;
  const isLoading = activeTab === 'system' ? isLoadingSystemRoles : isLoadingClientRoles;

  const filteredRoles = currentRoles.filter((role: CustomRole) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (role: CustomRole) => {
    setEditingRole(role);
    form.reset({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions,
      isMobileOnly: role.isMobileOnly || false,
    });
    setIsCreateDialogOpen(true);
  };

  const handleSubmit = (data: CreateRoleForm) => {
    if (editingRole) {
      updateRoleMutation.mutate({ id: editingRole.id, data });
    } else {
      const isSystemRole = activeTab === 'system';
      
      // Para funções de cliente, adicionar companyId e customerId
      const roleData: any = {
        ...data,
        isSystemRole,
      };
      
      // Se for função de cliente, adicionar companyId e customerId
      if (!isSystemRole) {
        if (user?.companyId) {
          roleData.companyId = user.companyId;
        }
        // CRÍTICO: Adicionar customerId para que a função seja associada ao cliente ativo
        if (activeClientId) {
          roleData.customerId = activeClientId;
        }
      }
      
      createRoleMutation.mutate(roleData);
    }
  };

  // Agrupar permissões por categoria (usando permissões filtradas)
  const groupedPermissions = filteredAvailablePermissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, typeof filteredAvailablePermissions>);

  // Mapear áreas acessíveis com ícones
  const areaAccessMap: Record<string, { label: string; icon: any; viewPerm: string }> = {
    dashboard: { label: 'Dashboard', icon: LayoutDashboard, viewPerm: 'dashboard_view' },
    workorders: { label: 'Ordens de Serviço', icon: FileText, viewPerm: 'workorders_view' },
    schedule: { label: 'Plano de Limpeza', icon: ClipboardCheck, viewPerm: 'schedule_view' },
    checklists: { label: 'Checklists', icon: ClipboardCheck, viewPerm: 'checklists_view' },
    qrcodes: { label: 'QR Codes', icon: QrCode, viewPerm: 'qrcodes_view' },
    floorplan: { label: 'Planta dos Locais', icon: Map, viewPerm: 'floor_plan_view' },
    heatmap: { label: 'Mapa de Calor', icon: Thermometer, viewPerm: 'heatmap_view' },
    sites: { label: 'Locais', icon: Building2, viewPerm: 'sites_view' },
    reports: { label: 'Relatórios', icon: BarChart3, viewPerm: 'reports_view' },
    settings: { label: 'Configurações', icon: Settings2, viewPerm: 'service_settings_view' },
    users: { label: 'Usuários', icon: UserCog, viewPerm: 'users_view' },
  };

  const getAccessibleAreas = (permissions: string[]) => {
    return Object.entries(areaAccessMap)
      .filter(([_, area]) => permissions.includes(area.viewPerm))
      .map(([key, area]) => ({ key, ...area }));
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50/30 to-white">
      <div className="w-full px-6 py-6">
        <ModernPageHeader 
          title="Funções" 
          description="Gerencie funções e permissões personalizadas" 
          icon={Shield}
          actions={
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  onClick={() => {
                    setEditingRole(null);
                    form.reset();
                  }}
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  data-testid="button-create-role"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Função
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingRole ? 'Editar Função' : 'Nova Função'}
                </DialogTitle>
                <DialogDescription>
                  {editingRole ? 'Edite os dados da função' : 'Crie uma nova função com permissões específicas'}
                </DialogDescription>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome da Função</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Ex: Supervisor, Operador Avançado"
                              data-testid="input-role-name"
                              {...field} 
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Descrição</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Descreva as responsabilidades desta função"
                              className="resize-none"
                              data-testid="input-role-description"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="isMobileOnly"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Acesso Mobile
                          </FormLabel>
                          <div className="text-sm text-muted-foreground">
                            Este perfil é exclusivo para aplicativo mobile. Operadores não acessam o sistema web administrativo, apenas o app mobile para executar tarefas.
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-mobile-only"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <div>
                    <FormLabel className="text-base font-medium mb-4 block">
                      Permissões
                    </FormLabel>
                    <div className="space-y-4">
                      {Object.entries(groupedPermissions).map(([category, permissions]) => {
                        const categoryPermissionKeys = permissions.map(p => p.key);
                        
                        return (
                          <Card key={category}>
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium">{category}</CardTitle>
                                <FormField
                                  control={form.control}
                                  name="permissions"
                                  render={({ field }) => {
                                    const selectedInCategory = categoryPermissionKeys.filter(key => 
                                      field.value.includes(key)
                                    );
                                    const allSelected = selectedInCategory.length === categoryPermissionKeys.length;
                                    const someSelected = selectedInCategory.length > 0 && !allSelected;
                                    
                                    return (
                                      <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={(checked) => {
                                              if (checked) {
                                                // Adicionar todas as permissões desta categoria
                                                const existingSet = new Set(field.value);
                                                categoryPermissionKeys.forEach(key => existingSet.add(key));
                                                const newPermissions = Array.from(existingSet) as string[];
                                                field.onChange(newPermissions);
                                              } else {
                                                // Remover todas as permissões desta categoria
                                                const newPermissions = field.value.filter(
                                                  (value: string) => !categoryPermissionKeys.includes(value as PermissionKey)
                                                );
                                                field.onChange(newPermissions);
                                              }
                                            }}
                                            data-testid={`checkbox-select-all-${category}`}
                                          />
                                        </FormControl>
                                        <FormLabel className="text-xs font-normal text-muted-foreground cursor-pointer">
                                          {someSelected ? `${selectedInCategory.length}/${categoryPermissionKeys.length} selecionadas` : 'Selecionar todas'}
                                        </FormLabel>
                                      </FormItem>
                                    );
                                  }}
                                />
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              {permissions.map((permission) => (
                                <FormField
                                  key={permission.key}
                                  control={form.control}
                                  name="permissions"
                                  render={({ field }) => (
                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value.includes(permission.key)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              field.onChange([...field.value, permission.key]);
                                            } else {
                                              field.onChange(
                                                field.value.filter((value) => value !== permission.key)
                                              );
                                            }
                                          }}
                                          data-testid={`checkbox-permission-${permission.key}`}
                                        />
                                      </FormControl>
                                      <FormLabel className="text-sm font-normal">
                                        {permission.label}
                                      </FormLabel>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                      data-testid="button-cancel-role"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      variant="default"
                      disabled={createRoleMutation.isPending || updateRoleMutation.isPending}
                      data-testid="button-save-role"
                      className={theme.buttons.primary}
                      style={theme.buttons.primaryStyle}
                    >
                      {(createRoleMutation.isPending || updateRoleMutation.isPending) ? 'Salvando...' : 'Salvar'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          }
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md" style={{ gridTemplateColumns: can.viewSystemRoles() && user?.userType === 'opus_user' && !user?.customRoles?.some((r: any) => r.role?.name === 'Administrador') ? '1fr 1fr' : '1fr' }}>
            <TabsTrigger value="client" data-testid="tab-client-roles">
              Funções de Cliente
            </TabsTrigger>
            {can.viewSystemRoles() && user?.userType === 'opus_user' && !user?.customRoles?.some((r: any) => r.role?.name === 'Administrador') && (
              <TabsTrigger value="system" data-testid="tab-system-roles">
                Funções de Sistema
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="client" className="mt-6">
            <ModernCard variant="gradient">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle>Funções de Cliente</CardTitle>
                    <CardDescription>
                      Total de {filteredRoles.length} função(ões) de cliente
                    </CardDescription>
                  </div>
                  <Input
                    placeholder="Buscar por nome ou descrição..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-sm"
                    data-testid="input-search-roles"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {filteredRoles.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma função encontrada</h3>
                    <p className="text-muted-foreground">
                      {searchTerm ? 'Tente ajustar sua busca' : 'Crie a primeira função personalizada de cliente'}
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {filteredRoles.map((role: CustomRole) => (
                  <ModernCard key={role.id} variant="gradient">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <CardTitle className="text-lg">{role.name}</CardTitle>
                            {role.isSystemRole && (
                              <Badge variant="secondary">Sistema</Badge>
                            )}
                            {role.isMobileOnly && (
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                📱 Acesso Mobile
                              </Badge>
                            )}
                            {!role.isActive && (
                              <Badge variant="destructive">Inativo</Badge>
                            )}
                          </div>
                          {role.description && (
                            <CardDescription className="mt-2">
                              {role.description}
                            </CardDescription>
                          )}
                          {role.name === 'Operador' && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
                              <p className="text-xs text-blue-700 dark:text-blue-300">
                                ℹ️ Este perfil é exclusivo para <strong>aplicativo mobile</strong>. Operadores não acessam o sistema web administrativo, apenas o app mobile para executar tarefas.
                              </p>
                            </div>
                          )}
                          
                          {/* Áreas Acessíveis */}
                          <div className="mt-4 space-y-2">
                            <span className="text-sm font-medium text-foreground">
                              Áreas Acessíveis ({getAccessibleAreas(role.permissions).length}):
                            </span>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                              {getAccessibleAreas(role.permissions).map((area) => {
                                const Icon = area.icon;
                                return (
                                  <div 
                                    key={area.key}
                                    className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 text-sm"
                                  >
                                    <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                                    <span className="text-foreground text-xs">{area.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Total de Permissões */}
                          <div className="mt-4 pt-3 border-t">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Total de permissões:
                              </span>
                              <Badge variant="secondary">
                                {role.permissions.length}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(role)}
                            data-testid={`button-edit-role-${role.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!role.isSystemRole && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteRoleMutation.mutate(role.id)}
                              disabled={deleteRoleMutation.isPending}
                              data-testid={`button-delete-role-${role.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </ModernCard>
                ))}
              </div>
            )}
          </CardContent>
        </ModernCard>
      </TabsContent>

          {can.viewSystemRoles() && (
            <TabsContent value="system" className="mt-6">
              <ModernCard variant="gradient">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Funções de Sistema</CardTitle>
                      <CardDescription>
                        Total de {filteredRoles.length} função(ões) de sistema (OPUS)
                      </CardDescription>
                    </div>
                    <Input
                      placeholder="Buscar por nome ou descrição..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="max-w-sm"
                      data-testid="input-search-system-roles"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredRoles.length === 0 ? (
                    <div className="text-center py-12">
                      <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Nenhuma função de sistema encontrada</h3>
                      <p className="text-muted-foreground">
                        {searchTerm ? 'Tente ajustar sua busca' : 'Crie funções de sistema para gerenciar permissões OPUS'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      {filteredRoles.map((role: CustomRole) => (
                        <ModernCard key={role.id} variant="gradient">
                          <CardHeader>
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <CardTitle className="text-lg">{role.name}</CardTitle>
                                  <Badge variant="secondary">Sistema</Badge>
                                  {role.isMobileOnly && (
                                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                                      📱 Acesso Mobile
                                    </Badge>
                                  )}
                                  {!role.isActive && (
                                    <Badge variant="destructive">Inativo</Badge>
                                  )}
                                </div>
                                {role.description && (
                                  <CardDescription className="mt-2">
                                    {role.description}
                                  </CardDescription>
                                )}
                                
                                {/* Áreas Acessíveis */}
                                <div className="mt-4 space-y-2">
                                  <span className="text-sm font-medium text-foreground">
                                    Áreas Acessíveis ({getAccessibleAreas(role.permissions).length}):
                                  </span>
                                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {getAccessibleAreas(role.permissions).map((area) => {
                                      const Icon = area.icon;
                                      return (
                                        <div 
                                          key={area.key}
                                          className="flex items-center gap-2 px-3 py-2 rounded-md bg-primary/5 border border-primary/20 text-sm"
                                        >
                                          <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                                          <span className="text-foreground text-xs">{area.label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Total de Permissões */}
                                <div className="mt-4 pt-3 border-t">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      Total de permissões:
                                    </span>
                                    <Badge variant="secondary">
                                      {role.permissions.length}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex space-x-2">
                                {can.editSystemRoles() && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(role)}
                                    data-testid={`button-edit-role-${role.id}`}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                                {can.deleteSystemRoles() && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deleteRoleMutation.mutate(role.id)}
                                    disabled={deleteRoleMutation.isPending}
                                    data-testid={`button-delete-role-${role.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                        </ModernCard>
                      ))}
                    </div>
                  )}
                </CardContent>
              </ModernCard>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}