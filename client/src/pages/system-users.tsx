import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Users, Plus, Edit, Trash2, Shield, Building2, KeyRound } from 'lucide-react';
import usePermissions from '@/hooks/usePermissions';
import { useModule, MODULE_CONFIGS } from '@/contexts/ModuleContext';
import { useModuleTheme } from '@/hooks/use-module-theme';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { useCacheInvalidation } from '@/hooks/use-cache-invalidation';

const createUserSchema = z.object({
  username: z.string().min(1, 'Username é obrigatório'),
  email: z.string().email('Email inválido'),
  password: z.string().superRefine((val, ctx) => {
    if (val === '') return;
    if (val.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.too_small,
        minimum: 6,
        type: "string",
        message: 'Mínimo 6 caracteres'
      });
    }
  }),
  name: z.string().min(1, 'Nome é obrigatório'),
  customRoleId: z.string().min(1, 'Função é obrigatória'),
  modules: z.array(z.enum(['clean', 'maintenance'])).min(1, 'Selecione pelo menos um módulo'),
});

type CreateUserForm = z.infer<typeof createUserSchema>;
type User = {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  userType: string;
  isActive: boolean;
  modules?: ('clean' | 'maintenance')[];
  createdAt: string;
  updatedAt: string;
  customRoles?: Array<{
    id: string;
    userId: string;
    roleId: string;
    customerId: string | null;
    role: {
      id: string;
      name: string;
      description: string | null;
      isSystemRole: boolean;
      permissions: string[];
    };
  }>;
};

export default function SystemUsers() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cache = useCacheInvalidation();
  const { can } = usePermissions();
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const { user: currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
      name: '',
      customRoleId: '',
      modules: ['clean', 'maintenance'],
    },
  });

  if (!can.viewOpusUsers()) {
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
              Você não tem permissão para acessar o gerenciamento de usuários do sistema.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const userCompanyId = currentUser?.companyId || "a3e33b82-4f75-4f8d-86a2-2d67e61a9812";
  
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['/api/system-users'],
  });

  const { data: availableCustomers = [] } = useQuery({
    queryKey: ['/api/companies', userCompanyId, 'customers'],
    enabled: isCreateDialogOpen,
  });

  const { data: systemRoles = [] } = useQuery({
    queryKey: ['/api/roles', { isSystemRole: 'true' }],
    staleTime: 0, // Sempre buscar dados frescos, sem cache
    enabled: true,
  });

  // Debug: Log das funções do sistema
  console.log('[SYSTEM-USERS] System Roles carregadas:', systemRoles);

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const response = await apiRequest('POST', '/api/system-users', {
        ...data,
        userType: 'opus_user',
        companyId: userCompanyId,
      });
      return response;
    },
    onSuccess: () => {
      cache.invalidateUsers();
      setIsCreateDialogOpen(false);
      setEditingUser(null);
      form.reset();
      toast({
        title: 'Sucesso',
        description: 'Usuário do sistema criado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Falha ao criar usuário',
        variant: 'destructive',
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateUserForm> }) => {
      await apiRequest('PATCH', `/api/system-users/${id}`, data);
    },
    onSuccess: () => {
      cache.invalidateUsers();
      setIsCreateDialogOpen(false);
      setEditingUser(null);
      form.reset();
      toast({
        title: 'Sucesso',
        description: 'Usuário atualizado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      await apiRequest('PATCH', `/api/system-users/${userId}/status`, { isActive: false });
    },
    onSuccess: () => {
      cache.invalidateUsers();
      toast({
        title: 'Sucesso',
        description: 'Usuário desativado com sucesso!',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleEdit = (user: User) => {
    setEditingUser(user);
    const userCustomRoleId = user.customRoles?.[0]?.roleId || '';
    
    form.reset({
      username: user.username,
      email: user.email,
      name: user.name,
      customRoleId: userCustomRoleId,
      modules: user.modules || ['clean', 'maintenance'],
      password: '',
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (userId: string, userName: string) => {
    if (confirm(`Tem certeza que deseja desativar o usuário "${userName}"?`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleSubmit = async (data: CreateUserForm) => {
    try {
      if (editingUser) {
        const updateData = data.password ? data : { ...data, password: undefined };
        await updateUserMutation.mutateAsync({ id: editingUser.id, data: updateData });
      } else {
        await createUserMutation.mutateAsync(data);
      }
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    }
  };

  const filteredUsers = users.filter((user: User) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Building2 className="h-8 w-8" />
            Usuários do Sistema
          </h1>
          <p className="text-muted-foreground mt-2">
            Gerenciar usuários com acesso ao sistema de gerenciamento
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="default"
              onClick={() => {
                setEditingUser(null);
                form.reset();
              }}
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-create-system-user"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário do Sistema
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? 'Editar Usuário do Sistema' : 'Novo Usuário do Sistema'}
              </DialogTitle>
              <DialogDescription>
                {editingUser ? 'Edite os dados do usuário' : 'Crie um novo usuário com acesso ao sistema'}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                {/* Username */}
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="usuario123"
                          data-testid="input-username"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input 
                          type="email"
                          placeholder="usuario@grupoopus.com"
                          data-testid="input-email"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Nome */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="João Silva"
                          data-testid="input-name"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Senha */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {editingUser ? 'Nova Senha (deixe vazio para manter)' : 'Senha'}
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder={editingUser ? "Nova senha (opcional)" : "Mínimo 6 caracteres"}
                          data-testid="input-password"
                          {...field}
                        />
                      </FormControl>
                      {field.value && field.value.length > 0 && field.value.length < 6 && (
                        <p className="text-xs text-red-500 mt-1">
                          Senha deve ter no mínimo 6 caracteres ({field.value.length}/6)
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Função */}
                <FormField
                  control={form.control}
                  name="customRoleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Função *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ''}>
                        <FormControl>
                          <SelectTrigger data-testid="select-role">
                            <SelectValue placeholder="Selecione uma função" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(systemRoles as any[]).length === 0 ? (
                            <SelectItem value="no-roles" disabled>
                              Nenhuma função disponível
                            </SelectItem>
                          ) : (
                            (systemRoles as any[]).map((role: any) => (
                              <SelectItem key={role.id} value={role.id}>
                                {role.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Módulos */}
                <FormItem>
                  <FormLabel>Módulos Disponíveis</FormLabel>
                  <div className="space-y-2 mt-2">
                    <FormField
                      control={form.control}
                      name="modules"
                      render={({ field }) => (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={field.value?.includes('clean') ?? false}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, 'clean']);
                              } else {
                                field.onChange(current.filter((m) => m !== 'clean'));
                              }
                            }}
                            data-testid="checkbox-module-clean"
                          />
                          <label className="text-sm cursor-pointer">Clean (Limpeza)</label>
                        </div>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="modules"
                      render={({ field }) => (
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={field.value?.includes('maintenance') ?? false}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, 'maintenance']);
                              } else {
                                field.onChange(current.filter((m) => m !== 'maintenance'));
                              }
                            }}
                            data-testid="checkbox-module-maintenance"
                          />
                          <label className="text-sm cursor-pointer">Manutenção</label>
                        </div>
                      )}
                    />
                  </div>
                  <FormMessage />
                </FormItem>

                {/* Botões */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className={theme.buttons.primary}
                    style={theme.buttons.primaryStyle}
                    disabled={createUserMutation.isPending || updateUserMutation.isPending}
                    data-testid="button-submit"
                  >
                    {editingUser ? 'Atualizar' : 'Criar Usuário'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Usuários */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários Registrados</CardTitle>
          <CardDescription>Total: {filteredUsers.length} usuários</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Buscar por nome, email ou username..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search"
            />
          </div>

          <div className="space-y-2">
            {filteredUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Nenhum usuário encontrado</p>
            ) : (
              filteredUsers.map((user: User) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{user.name}</p>
                      {!user.isActive && (
                        <Badge variant="destructive" className="text-xs">Inativo</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.customRoles && user.customRoles.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Função: <span className="font-medium">{user.customRoles[0].role.name}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{user.username}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(user)}
                      data-testid={`button-edit-${user.id}`}
                      title="Editar usuário"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {can.deleteOpusUsers() && user.isActive && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDelete(user.id, user.name)}
                        data-testid={`button-delete-${user.id}`}
                        title="Desativar usuário"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
