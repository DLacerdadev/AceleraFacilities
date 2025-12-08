import { ModernCard } from "@/components/ui/modern-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { usePermissions } from "@/hooks/usePermissions";
import { 
  Plus, 
  Users as UsersIcon, 
  Eye, 
  Edit, 
  Trash2,
  UserCheck,
  UserX,
  Search,
  Filter,
  KeyRound
} from "lucide-react";

interface UsersProps {
  customerId: string;
}

export default function Users({ customerId }: UsersProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userUsername, setUserUsername] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [userPassword, setUserPassword] = useState("");
  const [userModules, setUserModules] = useState<string[]>([]);
  
  // Edit user states
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<string>("");
  const [editIsActive, setEditIsActive] = useState(true);
  
  // Password change states
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const theme = useModuleTheme();
  const { can } = usePermissions();

  // Resetar campos do formulário quando o diálogo fechar
  useEffect(() => {
    if (!isCreateDialogOpen) {
      setUserName("");
      setUserEmail("");
      setUserUsername("");
      setUserPassword("");
      setUserRole("");
      setUserModules([]);
    }
  }, [isCreateDialogOpen]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["/api/customers", customerId, "users"],
    enabled: !!customerId,
  });

  const { data: customer } = useQuery<{ modules?: string[] }>({
    queryKey: ["/api/customers", customerId],
    enabled: !!customerId,
  });

  // Buscar custom roles do cliente ativo - excluir funções de sistema
  const { data: customRoles = [], isLoading: isLoadingRoles } = useQuery<any[]>({
    queryKey: ["/api/roles", { customerId, isSystemRole: 'false' }],
    staleTime: 0, // Sempre buscar dados frescos, sem cache de 5 minutos
    enabled: !!customerId,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: () => {
      toast({ title: "Usuário criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "users"] });
      setIsCreateDialogOpen(false);
      setUserName("");
      setUserEmail("");
      setUserUsername("");
      setUserPassword("");
      setUserRole("");
      setUserModules([]);
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Erro ao criar usuário";
      const errorDetails = error?.details || "Verifique se todos os campos estão preenchidos corretamente";
      
      toast({ 
        title: errorMessage,
        description: errorDetails,
        variant: "destructive" 
      });
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("PATCH", `/api/users/${userId}/deactivate`);
    },
    onSuccess: () => {
      toast({ title: "Usuário desativado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "users"] });
    },
    onError: () => {
      toast({ 
        title: "Erro ao desativar usuário", 
        variant: "destructive" 
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      toast({ title: "Usuário excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "users"] });
    },
    onError: () => {
      toast({ 
        title: "Erro ao excluir usuário", 
        variant: "destructive" 
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: { userId: string; password: string }) => {
      await apiRequest('PATCH', `/api/users/${data.userId}`, { password: data.password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "users"] });
      toast({
        title: 'Senha alterada com sucesso!',
        description: 'A nova senha foi definida para o usuário.',
      });
      setIsPasswordDialogOpen(false);
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao alterar senha',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleOpenPasswordDialog = (user: any) => {
    setSelectedUser(user);
    setNewPassword("");
    setConfirmPassword("");
    setIsPasswordDialogOpen(true);
  };

  const handleChangePassword = () => {
    if (!newPassword.trim()) {
      toast({
        title: "Senha obrigatória",
        description: "Digite uma nova senha.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "A senha e a confirmação devem ser iguais.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 4) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve ter pelo menos 4 caracteres.",
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({
      userId: selectedUser.id,
      password: newPassword,
    });
  };

  const handleCreateUser = () => {
    if (!userName.trim() || !userEmail.trim() || !userUsername.trim() || !userPassword.trim()) {
      toast({ 
        title: "Todos os campos são obrigatórios", 
        variant: "destructive" 
      });
      return;
    }

    if (!userRole || !userRole.trim()) {
      toast({ 
        title: "Selecione um perfil", 
        description: "O perfil do usuário é obrigatório",
        variant: "destructive" 
      });
      return;
    }

    if (!customer) {
      toast({ 
        title: "Erro ao obter dados do cliente", 
        variant: "destructive" 
      });
      return;
    }

    if (userModules.length === 0) {
      toast({ 
        title: "Selecione pelo menos um módulo", 
        description: "O usuário precisa ter acesso a pelo menos um módulo",
        variant: "destructive" 
      });
      return;
    }

    createUserMutation.mutate({
      companyId: (customer as any).companyId,
      customerId,
      name: userName,
      email: userEmail,
      username: userUsername,
      password: userPassword,
      role: userRole,
      authProvider: 'local',
      userType: 'customer_user',
      modules: userModules,
    });
  };

  const updateUserMutation = useMutation({
    mutationFn: async (data: any) => {
      // Atualizar dados básicos
      await apiRequest("PUT", `/api/users/${data.userId}`, data.updates);
      
      // Se mudou o perfil, atualizar o userRoleAssignment
      if (data.newRoleId && selectedUser.customRoles?.[0]?.roleId !== data.newRoleId) {
        // Remover role assignment antigo se existir
        if (selectedUser.customRoles && selectedUser.customRoles.length > 0) {
          await apiRequest("DELETE", `/api/users/${data.userId}/roles/${selectedUser.customRoles[0].roleId}`, {});
        }
        
        // Criar novo role assignment
        await apiRequest("POST", `/api/users/${data.userId}/roles`, {
          roleId: data.newRoleId,
          customerId: customerId
        });
      }
      
      return true;
    },
    onSuccess: () => {
      toast({ title: "Usuário atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "users"] });
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar usuário", 
        description: error.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const handleViewUser = (user: any) => {
    setSelectedUser(user);
    setIsViewDialogOpen(true);
  };

  const handleEditUser = (user: any) => {
    setSelectedUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    // Pegar o roleId do customRole se existir
    setEditRole(user.customRoles?.[0]?.roleId || '');
    setEditIsActive(user.isActive);
    setIsEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editName.trim() || !editEmail.trim()) {
      toast({ 
        title: "Nome e email são obrigatórios", 
        variant: "destructive" 
      });
      return;
    }

    // Primeiro atualiza os dados básicos do usuário
    updateUserMutation.mutate({
      userId: selectedUser.id,
      updates: {
        name: editName,
        email: editEmail,
        isActive: editIsActive,
      },
      // Passar o novo roleId para atualizar depois
      newRoleId: editRole
    });
  };

  const handleToggleUserActive = (user: any) => {
    const action = user.isActive ? "desativar" : "reativar";
    if (window.confirm(`Tem certeza que deseja ${action} o usuário "${user.name}"?`)) {
      deactivateUserMutation.mutate(user.id);
    }
  };

  const handleDeleteUser = (user: any) => {
    if (window.confirm(`Tem certeza que deseja excluir o usuário "${user.name}"?`)) {
      deleteUserMutation.mutate(user.id);
    }
  };

  const getRoleBadge = (user: any) => {
    // Verificar se o usuário tem customRoles
    if (user.customRoles && user.customRoles.length > 0) {
      const role = user.customRoles[0].role;
      
      // Cores baseadas no nome do role
      if (role.name.toLowerCase().includes('admin')) {
        return <Badge variant="destructive">{role.name}</Badge>;
      } else if (role.name.toLowerCase().includes('cliente') || role.name.toLowerCase().includes('gestor')) {
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">{role.name}</Badge>;
      } else if (role.name.toLowerCase().includes('supervisor')) {
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{role.name}</Badge>;
      } else if (role.name.toLowerCase().includes('operador')) {
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{role.name}</Badge>;
      } else if (role.name.toLowerCase().includes('auditor')) {
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">{role.name}</Badge>;
      }
      return <Badge variant="outline">{role.name}</Badge>;
    }
    
    // Fallback para o role padrão do sistema
    if (user.role) {
      const roleLabels: any = {
        'admin': 'Administrador',
        'gestor_cliente': 'Gestor de Cliente',
        'supervisor_site': 'Supervisor de Local',
        'operador': 'Operador',
        'auditor': 'Auditor'
      };
      
      const label = roleLabels[user.role] || user.role;
      
      if (user.role === 'admin') {
        return <Badge variant="destructive">{label}</Badge>;
      } else if (user.role === 'gestor_cliente') {
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">{label}</Badge>;
      } else if (user.role === 'supervisor_site') {
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{label}</Badge>;
      } else if (user.role === 'operador') {
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{label}</Badge>;
      } else if (user.role === 'auditor') {
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">{label}</Badge>;
      }
      return <Badge variant="outline">{label}</Badge>;
    }
    
    // Se não tem customRoles nem role padrão, mostrar "SEM PERFIL"
    return <Badge variant="destructive" className="animate-pulse">⚠️ SEM PERFIL</Badge>;
  };

  const getModulesBadges = (user: any) => {
    const modules = user.modules || [];
    
    return (
      <div className="flex flex-wrap gap-1">
        {modules.includes('clean') && (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" data-testid={`badge-module-clean-${user.id}`}>
            Clean
          </Badge>
        )}
        {modules.includes('maintenance') && (
          <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" data-testid={`badge-module-maintenance-${user.id}`}>
            Manutenção
          </Badge>
        )}
      </div>
    );
  };

  const filteredUsers = (users as any[])?.filter((user: any) => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "todos" || user.role === roleFilter;
    const matchesStatus = statusFilter === "todos" || 
                         (statusFilter === "ativo" && user.isActive) ||
                         (statusFilter === "inativo" && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  }) || [];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div>Carregando usuários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Usuários</h2>
          <p className="text-muted-foreground">Gerenciamento de usuários e permissões do sistema</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-create-user"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Novo Usuário</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome Completo *
                </label>
                <Input
                  placeholder="Ex: João da Silva"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  data-testid="input-user-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email *
                </label>
                <Input
                  type="email"
                  placeholder="joao@empresa.com"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  data-testid="input-user-email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome de Usuário *
                </label>
                <Input
                  placeholder="joao.silva"
                  value={userUsername}
                  onChange={(e) => setUserUsername(e.target.value)}
                  data-testid="input-user-username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Senha *
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={userPassword}
                  onChange={(e) => setUserPassword(e.target.value)}
                  data-testid="input-user-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Perfil *
                </label>
                {isLoadingRoles ? (
                  <div className="text-sm text-muted-foreground">Carregando perfis...</div>
                ) : Array.isArray(customRoles) && customRoles.length > 0 ? (
                  <Select value={userRole} onValueChange={(value: any) => setUserRole(value)}>
                    <SelectTrigger data-testid="select-user-role">
                      <SelectValue placeholder="Selecione o perfil do usuário" />
                    </SelectTrigger>
                    <SelectContent>
                      {customRoles.map((role: any) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="text-sm text-destructive">
                    Nenhum perfil disponível. Crie perfis em "Funções" primeiro.
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-3">
                  Módulos de Acesso * 
                </label>
                <div className="space-y-3 border rounded-lg p-4 bg-slate-50 dark:bg-slate-900">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="module-clean"
                      checked={userModules.includes('clean')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUserModules([...userModules, 'clean']);
                        } else {
                          setUserModules(userModules.filter(m => m !== 'clean'));
                        }
                      }}
                      disabled={!customer?.modules?.includes('clean')}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="checkbox-module-clean"
                    />
                    <div className="flex-1">
                      <label htmlFor="module-clean" className={customer?.modules?.includes('clean') ? "cursor-pointer" : "cursor-not-allowed opacity-50"}>
                        <div className="font-medium text-blue-900 dark:text-blue-300">OPUS Clean</div>
                        <div className="text-sm text-muted-foreground">Gestão de Limpeza e Facilities</div>
                        {!customer?.modules?.includes('clean') && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">Módulo não disponível para este cliente</div>
                        )}
                      </label>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="module-maintenance"
                      checked={userModules.includes('maintenance')}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setUserModules([...userModules, 'maintenance']);
                        } else {
                          setUserModules(userModules.filter(m => m !== 'maintenance'));
                        }
                      }}
                      disabled={!customer?.modules?.includes('maintenance')}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      data-testid="checkbox-module-maintenance"
                    />
                    <div className="flex-1">
                      <label htmlFor="module-maintenance" className={customer?.modules?.includes('maintenance') ? "cursor-pointer" : "cursor-not-allowed opacity-50"}>
                        <div className="font-medium text-orange-900 dark:text-orange-300">OPUS Manutenção</div>
                        <div className="text-sm text-muted-foreground">Gestão de Manutenção</div>
                        {!customer?.modules?.includes('maintenance') && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">Módulo não disponível para este cliente</div>
                        )}
                      </label>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Selecione um ou mais módulos que o usuário poderá acessar (apenas módulos disponíveis para o cliente)
                </p>
              </div>
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  data-testid="button-cancel-user"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="default"
                  onClick={handleCreateUser}
                  disabled={createUserMutation.isPending}
                  data-testid="button-save-user"
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                >
                  {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="space-y-6">
        {/* Filters */}
        <ModernCard variant="gradient" className="mb-6">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Buscar por nome, email ou usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-48" data-testid="select-role-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Perfis</SelectItem>
                  {(customRoles as any[])?.map((role: any) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="ativo">Ativos</SelectItem>
                  <SelectItem value="inativo">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </ModernCard>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <ModernCard variant="gradient">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Usuários</p>
                  <p className="text-2xl font-bold text-foreground">
                    {filteredUsers.length}
                  </p>
                </div>
                <UsersIcon className="w-8 h-8 text-primary" />
              </div>
            </div>
          </ModernCard>

          <ModernCard variant="gradient">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ativos</p>
                  <p className="text-2xl font-bold text-chart-2">
                    {filteredUsers.filter((u: any) => u.isActive).length}
                  </p>
                </div>
                <div className="w-8 h-8 bg-chart-2/10 rounded-full flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-chart-2" />
                </div>
              </div>
            </div>
          </ModernCard>

          <ModernCard variant="gradient">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Com Perfis</p>
                  <p className="text-2xl font-bold text-chart-4">
                    {filteredUsers.filter((u: any) => u.role).length}
                  </p>
                </div>
                <div className="w-8 h-8 bg-chart-4/10 rounded-full flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-chart-4" />
                </div>
              </div>
            </div>
          </ModernCard>

          <ModernCard variant="gradient">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Inativos</p>
                  <p className="text-2xl font-bold text-muted-foreground">
                    {filteredUsers.filter((u: any) => !u.isActive).length}
                  </p>
                </div>
                <UserX className="w-8 h-8 text-muted-foreground" />
              </div>
            </div>
          </ModernCard>
        </div>

        {/* Users Table */}
        <ModernCard variant="gradient">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Lista de Usuários</h3>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <UsersIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum usuário encontrado</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {(users as any[])?.length === 0 
                    ? "Crie o primeiro usuário para começar"
                    : "Ajuste os filtros para encontrar usuários"
                  }
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Módulos</TableHead>
                    <TableHead>Locais</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Último Acesso</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user: any) => (
                    <TableRow key={user.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="font-mono">{user.username}</TableCell>
                      <TableCell>{getRoleBadge(user)}</TableCell>
                      <TableCell>{getModulesBadges(user)}</TableCell>
                      <TableCell>
                        {user.siteAssignments && user.siteAssignments.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.siteAssignments.slice(0, 2).map((assignment: any) => (
                              <Badge 
                                key={assignment.id} 
                                variant="outline"
                                className="text-xs"
                              >
                                {assignment.site?.name || 'Local'}
                              </Badge>
                            ))}
                            {user.siteAssignments.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{user.siteAssignments.length - 2}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge className="bg-chart-2/10 text-chart-2">Ativo</Badge>
                        ) : (
                          <Badge variant="outline">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {user.lastLogin 
                          ? new Date(user.lastLogin).toLocaleDateString('pt-BR')
                          : "Nunca"
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="outline" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleViewUser(user)}
                            data-testid={`button-view-user-${user.id}`}
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditUser(user)}
                            data-testid={`button-edit-user-${user.id}`}
                            title="Editar"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenPasswordDialog(user)}
                            disabled={resetPasswordMutation.isPending}
                            data-testid={`button-reset-password-${user.id}`}
                            title="Trocar Senha"
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="outline" 
                            size="icon"
                            className={`h-8 w-8 ${user.isActive ? 'text-orange-600 hover:bg-orange-100 dark:hover:bg-orange-900' : 'text-green-600 hover:bg-green-100 dark:hover:bg-green-900'}`}
                            onClick={() => handleToggleUserActive(user)}
                            disabled={deactivateUserMutation.isPending}
                            data-testid={`button-toggle-user-active-${user.id}`}
                            title={user.isActive ? "Desativar" : "Reativar"}
                          >
                            {user.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                          </Button>
                          {can.deleteUsers(customerId) && (
                            <Button 
                              variant="outline" 
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                              onClick={() => handleDeleteUser(user)}
                              disabled={deleteUserMutation.isPending}
                              data-testid={`button-delete-user-${user.id}`}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </ModernCard>
      </div>

      {/* View User Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Nome Completo</label>
                  <p className="font-medium">{selectedUser.name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Nome de Usuário</label>
                  <p className="font-mono text-sm">{selectedUser.username}</p>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p className="font-medium">{selectedUser.email}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground">Perfil</label>
                  <div className="mt-1">{getRoleBadge(selectedUser)}</div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <div className="mt-1">
                    {selectedUser.isActive ? (
                      <Badge className="bg-chart-2/10 text-chart-2">Ativo</Badge>
                    ) : (
                      <Badge variant="outline">Inativo</Badge>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Módulos</label>
                <div className="mt-1">{getModulesBadges(selectedUser)}</div>
              </div>
              {selectedUser.siteAssignments && selectedUser.siteAssignments.length > 0 && (
                <div>
                  <label className="text-xs text-muted-foreground">Locais de Atuação</label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedUser.siteAssignments.map((assignment: any) => (
                      <Badge 
                        key={assignment.id} 
                        variant="outline"
                        className="text-xs"
                      >
                        {assignment.site?.name || 'Local'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-muted-foreground">Último Acesso</label>
                <p className="text-sm">
                  {selectedUser.lastLogin 
                    ? new Date(selectedUser.lastLogin).toLocaleString('pt-BR')
                    : "Nunca acessou"
                  }
                </p>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => setIsViewDialogOpen(false)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome Completo *
                </label>
                <Input
                  placeholder="Nome completo"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  data-testid="input-edit-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Email *
                </label>
                <Input
                  type="email"
                  placeholder="email@empresa.com"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  data-testid="input-edit-email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nome de Usuário
                </label>
                <Input
                  disabled
                  value={selectedUser.username}
                  className="bg-muted"
                  title="Nome de usuário não pode ser alterado"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Nome de usuário não pode ser alterado
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Perfil *
                </label>
                <Select value={editRole} onValueChange={(value: any) => setEditRole(value)}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue placeholder="Selecione um perfil" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customRoles as any[])?.map((role: any) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-is-active"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="h-4 w-4"
                  data-testid="checkbox-edit-active"
                />
                <label htmlFor="edit-is-active" className="text-sm font-medium">
                  Usuário ativo
                </label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="default"
                  onClick={handleUpdateUser}
                  disabled={updateUserMutation.isPending}
                  data-testid="button-save-edit"
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                >
                  {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Trocar Senha do Usuário</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">Alterando senha para:</p>
                <p className="font-medium">{selectedUser.name}</p>
                <p className="text-sm font-mono text-muted-foreground">@{selectedUser.username}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Nova Senha *
                </label>
                <Input
                  type="password"
                  placeholder="Digite a nova senha"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  data-testid="input-new-password"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Confirmar Senha *
                </label>
                <Input
                  type="password"
                  placeholder="Digite a senha novamente"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  data-testid="input-confirm-password"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ A senha será alterada imediatamente. Certifique-se de informar o usuário sobre a nova senha.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsPasswordDialogOpen(false)}
                  data-testid="button-cancel-password"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="default"
                  onClick={handleChangePassword}
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-save-password"
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                >
                  {resetPasswordMutation.isPending ? "Alterando..." : "Alterar Senha"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
