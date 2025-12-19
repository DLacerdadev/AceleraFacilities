import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Edit, 
  Trash2,
  Building2,
  Users as UsersIcon,
  Eye,
  EyeOff,
  UserPlus,
  Shield,
  MapPin,
  Calendar,
  Loader2,
  MoreVertical,
  Power,
  PowerOff,
  Pencil,
  UserX,
  UserCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useClient } from "@/contexts/ClientContext";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { ModernCard } from "@/components/ui/modern-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nanoid } from "nanoid";
import type { ThirdPartyCompany, Site, Zone } from "@shared/schema";

const thirdPartyCompanySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  status: z.enum(["active", "suspended", "inactive"]),
  userLimit: z.number().min(1, "Limite mínimo é 1"),
  billingEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  billingDocument: z.string().optional(),
  contractStartDate: z.string().optional(),
  contractEndDate: z.string().optional(),
  assetVisibilityMode: z.enum(["ALL", "CONTRACT_ONLY"]),
  workOrderApprovalMode: z.enum(["always_accept", "require_approval", "always_reject"]),
  allowedModules: z.array(z.string()).default([]),
});

type ThirdPartyCompanyFormData = z.infer<typeof thirdPartyCompanySchema>;

const thirdPartyUserSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  username: z.string().min(3, "Username deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  thirdPartyRole: z.enum(["THIRD_PARTY_MANAGER", "THIRD_PARTY_TEAM_LEADER", "THIRD_PARTY_OPERATOR"]),
});

type ThirdPartyUserFormData = z.infer<typeof thirdPartyUserSchema>;

export default function ThirdPartyCompanies() {
  const { activeClient } = useClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const theme = useModuleTheme();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<ThirdPartyCompany | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [siteAccessDialogOpen, setSiteAccessDialogOpen] = useState(false);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [selectedZones, setSelectedZones] = useState<string[]>([]);

  const customerId = activeClient?.id;

  const { data: companies = [], isLoading } = useQuery<ThirdPartyCompany[]>({
    queryKey: ['/api/customers', customerId, 'third-party-companies'],
    enabled: !!customerId,
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['/api/customers', customerId, 'sites'],
    enabled: !!customerId,
  });

  const { data: zones = [] } = useQuery<Zone[]>({
    queryKey: ['/api/customers', customerId, 'zones'],
    enabled: !!customerId,
  });

  const { data: companyUsers = [], isLoading: loadingUsers } = useQuery<any[]>({
    queryKey: ['/api/third-party-companies', selectedCompanyId, 'users'],
    enabled: !!selectedCompanyId,
  });

  // Módulos disponíveis do cliente
  const customerModules = activeClient?.modules || ['clean'];

  const createForm = useForm<ThirdPartyCompanyFormData>({
    resolver: zodResolver(thirdPartyCompanySchema),
    defaultValues: {
      name: "",
      status: "active",
      userLimit: 5,
      billingEmail: "",
      billingDocument: "",
      contractStartDate: "",
      contractEndDate: "",
      assetVisibilityMode: "CONTRACT_ONLY",
      workOrderApprovalMode: "require_approval",
      allowedModules: [],
    },
  });

  const editForm = useForm<ThirdPartyCompanyFormData>({
    resolver: zodResolver(thirdPartyCompanySchema),
    defaultValues: {
      name: "",
      status: "active",
      userLimit: 5,
      billingEmail: "",
      billingDocument: "",
      contractStartDate: "",
      contractEndDate: "",
      assetVisibilityMode: "CONTRACT_ONLY",
      workOrderApprovalMode: "require_approval",
      allowedModules: [],
    },
  });

  const userForm = useForm<ThirdPartyUserFormData>({
    resolver: zodResolver(thirdPartyUserSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      password: "",
      thirdPartyRole: "THIRD_PARTY_OPERATOR",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ThirdPartyCompanyFormData) => {
      return await apiRequest("POST", `/api/customers/${customerId}/third-party-companies`, {
        id: nanoid(),
        customerId,
        ...data,
        billingEmail: data.billingEmail || null,
        billingDocument: data.billingDocument || null,
        contractStartDate: data.contractStartDate || null,
        contractEndDate: data.contractEndDate || null,
        allowedSites: [],
        allowedZones: [],
      });
    },
    onSuccess: () => {
      toast({ title: "Empresa terceira criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'third-party-companies'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar empresa", description: error?.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ThirdPartyCompanyFormData & { id: string }) => {
      return await apiRequest("PUT", `/api/third-party-companies/${data.id}`, {
        ...data,
        billingEmail: data.billingEmail || null,
        billingDocument: data.billingDocument || null,
        contractStartDate: data.contractStartDate || null,
        contractEndDate: data.contractEndDate || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Empresa atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'third-party-companies'] });
      setIsEditDialogOpen(false);
      setEditingCompany(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar empresa", description: error?.message, variant: "destructive" });
    },
  });

  const updateSiteAccessMutation = useMutation({
    mutationFn: async ({ companyId, allowedSites, allowedZones }: { companyId: string; allowedSites: string[]; allowedZones: string[] }) => {
      return await apiRequest("PUT", `/api/third-party-companies/${companyId}`, {
        allowedSites,
        allowedZones,
      });
    },
    onSuccess: () => {
      toast({ title: "Acesso atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'third-party-companies'] });
      setSiteAccessDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar acesso", description: error?.message, variant: "destructive" });
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: ThirdPartyUserFormData) => {
      return await apiRequest("POST", `/api/third-party-companies/${selectedCompanyId}/users`, {
        ...data,
        companyId: activeClient?.companyId,
      });
    },
    onSuccess: () => {
      toast({ title: "Usuário criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-companies', selectedCompanyId, 'users'] });
      setIsUserDialogOpen(false);
      userForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar usuário", description: error?.message, variant: "destructive" });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: { userId: string; updates: Partial<ThirdPartyUserFormData & { isActive: boolean }> }) => {
      return await apiRequest("PUT", `/api/third-party-companies/${selectedCompanyId}/users/${data.userId}`, data.updates);
    },
    onSuccess: () => {
      toast({ title: "Usuário atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-companies', selectedCompanyId, 'users'] });
      setIsEditUserDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar usuário", description: error?.message, variant: "destructive" });
    },
  });

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setIsEditUserDialogOpen(true);
  };

  const handleToggleUserStatus = (user: any) => {
    updateUserMutation.mutate({
      userId: user.id,
      updates: { isActive: !user.isActive },
    });
  };

  const handleEdit = (company: ThirdPartyCompany) => {
    setEditingCompany(company);
    editForm.reset({
      name: company.name,
      status: company.status,
      userLimit: company.userLimit || 5,
      billingEmail: company.billingEmail || "",
      billingDocument: company.billingDocument || "",
      contractStartDate: company.contractStartDate || "",
      contractEndDate: company.contractEndDate || "",
      assetVisibilityMode: company.assetVisibilityMode,
      workOrderApprovalMode: (company as any).workOrderApprovalMode || "require_approval",
      allowedModules: (company as any).allowedModules || [],
    });
    setIsEditDialogOpen(true);
  };

  const handleEditSiteAccess = (company: ThirdPartyCompany) => {
    setEditingCompany(company);
    setSelectedSites(company.allowedSites || []);
    setSelectedZones(company.allowedZones || []);
    setSiteAccessDialogOpen(true);
  };

  const handleSaveSiteAccess = () => {
    if (editingCompany) {
      updateSiteAccessMutation.mutate({
        companyId: editingCompany.id,
        allowedSites: selectedSites,
        allowedZones: selectedZones,
      });
    }
  };

  const handleCreateCompany = (data: ThirdPartyCompanyFormData) => {
    createMutation.mutate(data);
  };

  const handleUpdateCompany = (data: ThirdPartyCompanyFormData) => {
    if (editingCompany) {
      updateMutation.mutate({ ...data, id: editingCompany.id });
    }
  };

  const handleCreateUser = (data: ThirdPartyUserFormData) => {
    createUserMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-chart-2/10 text-chart-2">Ativo</Badge>;
      case 'suspended':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Suspenso</Badge>;
      case 'inactive':
        return <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRoleBadge = (role: string) => {
    const normalizedRole = role?.toUpperCase();
    switch (normalizedRole) {
      case 'THIRD_PARTY_MANAGER':
        return <Badge className="bg-purple-500/10 text-purple-600">Gerente</Badge>;
      case 'THIRD_PARTY_TEAM_LEADER':
        return <Badge className="bg-blue-500/10 text-blue-600">Líder de Equipe</Badge>;
      case 'THIRD_PARTY_OPERATOR':
        return <Badge className="bg-gray-500/10 text-gray-600">Operador</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (!customerId) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        Selecione um cliente para gerenciar empresas terceiras
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="companies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="companies" className="flex items-center gap-2" data-testid="tab-third-party-companies">
            <Building2 className="w-4 h-4" />
            Empresas
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-third-party-users" disabled={!selectedCompanyId}>
            <UsersIcon className="w-4 h-4" />
            Usuários {selectedCompanyId && `(${companies.find(c => c.id === selectedCompanyId)?.name || ''})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="space-y-4">
          <ModernCard variant="gradient">
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Empresas Terceirizadas
                </CardTitle>
                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className={theme.buttons.primary}
                      style={theme.buttons.primaryStyle}
                      data-testid="button-create-third-party"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Nova Empresa
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Nova Empresa Terceirizada</DialogTitle>
                      <DialogDescription>Adicione uma empresa terceirizada ao sistema</DialogDescription>
                    </DialogHeader>
                    <Form {...createForm}>
                      <form onSubmit={createForm.handleSubmit(handleCreateCompany)} className="space-y-4">
                        <FormField
                          control={createForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome da Empresa</FormLabel>
                              <FormControl>
                                <Input placeholder="Nome da empresa" {...field} data-testid="input-third-party-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={createForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-third-party-status">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="active">Ativo</SelectItem>
                                    <SelectItem value="suspended">Suspenso</SelectItem>
                                    <SelectItem value="inactive">Inativo</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="userLimit"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Limite de Usuários</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    min={1} 
                                    {...field} 
                                    onChange={e => field.onChange(parseInt(e.target.value))}
                                    data-testid="input-third-party-user-limit" 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={createForm.control}
                          name="assetVisibilityMode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Visibilidade de Ativos</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-asset-visibility">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="ALL">Todos os Ativos</SelectItem>
                                  <SelectItem value="CONTRACT_ONLY">Apenas Ativos Contratados</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="workOrderApprovalMode"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Aprovação de Propostas</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-work-order-approval">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="always_accept">Aceitar Automaticamente</SelectItem>
                                  <SelectItem value="require_approval">Requerer Aprovação</SelectItem>
                                  <SelectItem value="always_reject">Recusar Automaticamente</SelectItem>
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-muted-foreground mt-1">
                                Define como lidar com propostas de O.S. desta empresa
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="allowedModules"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Módulos Permitidos</FormLabel>
                              <div className="flex flex-wrap gap-2">
                                {customerModules.map((mod: string) => (
                                  <label 
                                    key={mod} 
                                    className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover-elevate"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={field.value?.includes(mod)}
                                      onChange={(e) => {
                                        const newValue = e.target.checked
                                          ? [...(field.value || []), mod]
                                          : (field.value || []).filter((m: string) => m !== mod);
                                        field.onChange(newValue);
                                      }}
                                      className="w-4 h-4"
                                      data-testid={`checkbox-module-${mod}`}
                                    />
                                    <span className="capitalize">
                                      {mod === 'clean' ? 'Limpeza' : mod === 'maintenance' ? 'Manutenção' : mod}
                                    </span>
                                  </label>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Módulos que esta empresa terceirizada pode acessar
                              </p>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={createForm.control}
                          name="billingEmail"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Email de Faturamento</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="email@empresa.com" {...field} data-testid="input-billing-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={createForm.control}
                            name="contractStartDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Início do Contrato</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} data-testid="input-contract-start" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={createForm.control}
                            name="contractEndDate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Fim do Contrato</FormLabel>
                                <FormControl>
                                  <Input type="date" {...field} data-testid="input-contract-end" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                            Cancelar
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createMutation.isPending}
                            className={theme.buttons.primary}
                            style={theme.buttons.primaryStyle}
                            data-testid="button-submit-third-party"
                          >
                            {createMutation.isPending ? "Criando..." : "Criar Empresa"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {companies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma empresa terceirizada cadastrada</p>
                  <p className="text-sm">Clique em "Nova Empresa" para adicionar</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Limite Usuários</TableHead>
                      <TableHead>Visibilidade</TableHead>
                      <TableHead>Locais</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id} data-testid={`row-third-party-${company.id}`}>
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{getStatusBadge(company.status)}</TableCell>
                        <TableCell>{company.userLimit || 5}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {company.assetVisibilityMode === 'ALL' ? 'Todos' : 'Contratados'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {company.allowedSites?.length || 0} locais
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setSelectedCompanyId(company.id);
                              }}
                              title="Gerenciar Usuários"
                              data-testid={`button-manage-users-${company.id}`}
                            >
                              <UsersIcon className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditSiteAccess(company)}
                              title="Gerenciar Acesso a Locais"
                              data-testid={`button-manage-sites-${company.id}`}
                            >
                              <MapPin className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(company)}
                              title="Editar"
                              data-testid={`button-edit-third-party-${company.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </ModernCard>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          {selectedCompanyId && (
            <ModernCard variant="gradient">
              <CardHeader>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="flex items-center gap-2">
                    <UsersIcon className="w-5 h-5" />
                    Usuários - {companies.find(c => c.id === selectedCompanyId)?.name}
                  </CardTitle>
                  <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        className={theme.buttons.primary}
                        style={theme.buttons.primaryStyle}
                        data-testid="button-create-third-party-user"
                      >
                        <UserPlus className="w-4 h-4 mr-2" />
                        Novo Usuário
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Novo Usuário Terceirizado</DialogTitle>
                        <DialogDescription>Adicione um usuário à empresa terceirizada</DialogDescription>
                      </DialogHeader>
                      <Form {...userForm}>
                        <form onSubmit={userForm.handleSubmit(handleCreateUser)} className="space-y-4">
                          <FormField
                            control={userForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome Completo</FormLabel>
                                <FormControl>
                                  <Input placeholder="Nome do usuário" {...field} data-testid="input-user-name" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={userForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Username</FormLabel>
                                <FormControl>
                                  <Input placeholder="username" {...field} data-testid="input-user-username" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={userForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="email@empresa.com" {...field} data-testid="input-user-email" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={userForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Senha</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="Senha" {...field} data-testid="input-user-password" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={userForm.control}
                            name="thirdPartyRole"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Função</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-user-role">
                                      <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="THIRD_PARTY_MANAGER">Gerente</SelectItem>
                                    <SelectItem value="THIRD_PARTY_TEAM_LEADER">Líder de Equipe</SelectItem>
                                    <SelectItem value="THIRD_PARTY_OPERATOR">Operador</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                              Cancelar
                            </Button>
                            <Button 
                              type="submit" 
                              disabled={createUserMutation.isPending}
                              className={theme.buttons.primary}
                              style={theme.buttons.primaryStyle}
                              data-testid="button-submit-user"
                            >
                              {createUserMutation.isPending ? "Criando..." : "Criar Usuário"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : companyUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <UsersIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum usuário cadastrado nesta empresa</p>
                    <p className="text-sm">Clique em "Novo Usuário" para adicionar</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyUsers.map((user) => (
                        <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>{getRoleBadge(user.thirdPartyRole)}</TableCell>
                          <TableCell>
                            {user.isActive ? (
                              <Badge className="bg-chart-2/10 text-chart-2">Ativo</Badge>
                            ) : (
                              <Badge variant="outline">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" data-testid={`button-user-actions-${user.id}`}>
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEditUser(user)} data-testid={`button-edit-user-${user.id}`}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleUserStatus(user)} data-testid={`button-toggle-user-${user.id}`}>
                                  {user.isActive ? (
                                    <>
                                      <UserX className="w-4 h-4 mr-2" />
                                      Desativar
                                    </>
                                  ) : (
                                    <>
                                      <UserCheck className="w-4 h-4 mr-2" />
                                      Ativar
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </ModernCard>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Company Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Empresa Terceirizada</DialogTitle>
            <DialogDescription>Atualize as informações da empresa</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateCompany)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Empresa</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome da empresa" {...field} data-testid="input-edit-third-party-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-third-party-status">
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="suspended">Suspenso</SelectItem>
                          <SelectItem value="inactive">Inativo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="userLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Limite de Usuários</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min={1} 
                          {...field} 
                          onChange={e => field.onChange(parseInt(e.target.value))}
                          data-testid="input-edit-third-party-user-limit" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="assetVisibilityMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibilidade de Ativos</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-asset-visibility">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ALL">Todos os Ativos</SelectItem>
                        <SelectItem value="CONTRACT_ONLY">Apenas Ativos Contratados</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="workOrderApprovalMode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aprovação de Propostas</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "require_approval"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-work-order-approval">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="always_accept">Aceitar Automaticamente</SelectItem>
                        <SelectItem value="require_approval">Requerer Aprovação</SelectItem>
                        <SelectItem value="always_reject">Recusar Automaticamente</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Define como lidar com propostas de O.S. desta empresa
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="allowedModules"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Módulos Permitidos</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {customerModules.map((mod: string) => (
                        <label 
                          key={mod} 
                          className="flex items-center gap-2 p-2 border rounded-md cursor-pointer hover-elevate"
                        >
                          <input
                            type="checkbox"
                            checked={field.value?.includes(mod)}
                            onChange={(e) => {
                              const newValue = e.target.checked
                                ? [...(field.value || []), mod]
                                : (field.value || []).filter((m: string) => m !== mod);
                              field.onChange(newValue);
                            }}
                            className="w-4 h-4"
                            data-testid={`checkbox-edit-module-${mod}`}
                          />
                          <span className="capitalize">
                            {mod === 'clean' ? 'Limpeza' : mod === 'maintenance' ? 'Manutenção' : mod}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Módulos que esta empresa terceirizada pode acessar
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="billingEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de Faturamento</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@empresa.com" {...field} data-testid="input-edit-billing-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="contractStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Início do Contrato</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-contract-start" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="contractEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fim do Contrato</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-edit-contract-end" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  data-testid="button-submit-edit-third-party"
                >
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações do usuário terceirizado
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input 
                  defaultValue={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  data-testid="input-edit-user-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  defaultValue={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  data-testid="input-edit-user-email"
                />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select 
                  defaultValue={editingUser.thirdPartyRole?.toUpperCase()}
                  onValueChange={(value) => setEditingUser({ ...editingUser, thirdPartyRole: value })}
                >
                  <SelectTrigger data-testid="select-edit-user-role">
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THIRD_PARTY_MANAGER">Gerente</SelectItem>
                    <SelectItem value="THIRD_PARTY_TEAM_LEADER">Líder de Equipe</SelectItem>
                    <SelectItem value="THIRD_PARTY_OPERATOR">Operador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    updateUserMutation.mutate({
                      userId: editingUser.id,
                      updates: {
                        name: editingUser.name,
                        email: editingUser.email,
                        thirdPartyRole: editingUser.thirdPartyRole,
                      },
                    });
                  }}
                  disabled={updateUserMutation.isPending}
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  data-testid="button-save-user"
                >
                  {updateUserMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Site Access Dialog */}
      <Dialog open={siteAccessDialogOpen} onOpenChange={setSiteAccessDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Acesso a Locais</DialogTitle>
            <DialogDescription>
              Selecione os locais e zonas que esta empresa pode acessar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Locais Permitidos</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {sites.map((site) => (
                  <div key={site.id} className="flex items-center gap-2">
                    <Switch
                      checked={selectedSites.includes(site.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedSites([...selectedSites, site.id]);
                        } else {
                          setSelectedSites(selectedSites.filter(id => id !== site.id));
                        }
                      }}
                      data-testid={`switch-site-${site.id}`}
                    />
                    <span className="text-sm">{site.name}</span>
                  </div>
                ))}
                {sites.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum local cadastrado</p>
                )}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">Zonas Permitidas</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {zones.filter(z => selectedSites.includes(z.siteId)).map((zone) => (
                  <div key={zone.id} className="flex items-center gap-2">
                    <Switch
                      checked={selectedZones.includes(zone.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedZones([...selectedZones, zone.id]);
                        } else {
                          setSelectedZones(selectedZones.filter(id => id !== zone.id));
                        }
                      }}
                      data-testid={`switch-zone-${zone.id}`}
                    />
                    <span className="text-sm">{zone.name}</span>
                  </div>
                ))}
                {zones.filter(z => selectedSites.includes(z.siteId)).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {selectedSites.length === 0 
                      ? "Selecione um local primeiro" 
                      : "Nenhuma zona encontrada para os locais selecionados"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSiteAccessDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveSiteAccess}
                disabled={updateSiteAccessMutation.isPending}
                className={theme.buttons.primary}
                style={theme.buttons.primaryStyle}
                data-testid="button-save-site-access"
              >
                {updateSiteAccessMutation.isPending ? "Salvando..." : "Salvar Acesso"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
