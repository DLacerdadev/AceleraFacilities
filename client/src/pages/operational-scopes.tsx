import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Edit, 
  Trash2,
  Target,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Building2,
  Loader2,
  Archive,
  RotateCcw,
  Link as LinkIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useClient } from "@/contexts/ClientContext";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { nanoid } from "nanoid";
import type { OperationalScope, ThirdPartyCompany } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

const operationalScopeSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  moduleId: z.string().min(1, "Módulo é obrigatório"),
  slaHours: z.coerce.number().min(1, "SLA deve ser pelo menos 1 hora").optional(),
  slaWarningPercent: z.coerce.number().min(1).max(100).optional(),
  slaCriticalPercent: z.coerce.number().min(1).max(100).optional(),
});

type OperationalScopeFormData = z.infer<typeof operationalScopeSchema>;

export default function OperationalScopes() {
  const { activeClient } = useClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const theme = useModuleTheme();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<OperationalScope | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [scopeToArchive, setScopeToArchive] = useState<string | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedCompanyForAssign, setSelectedCompanyForAssign] = useState<ThirdPartyCompany | null>(null);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("active");

  const customerId = activeClient?.id;

  const { data: scopes = [], isLoading } = useQuery<OperationalScope[]>({
    queryKey: ['/api/customers', customerId, 'operational-scopes'],
    enabled: !!customerId,
  });

  const { data: companies = [] } = useQuery<ThirdPartyCompany[]>({
    queryKey: ['/api/customers', customerId, 'third-party-companies'],
    enabled: !!customerId,
  });

  const customerModules = activeClient?.modules || ['clean'];
  const activeScopes = scopes.filter(s => s.status === 'active');
  const archivedScopes = scopes.filter(s => s.status === 'archived');

  const createForm = useForm<OperationalScopeFormData>({
    resolver: zodResolver(operationalScopeSchema),
    defaultValues: {
      name: "",
      description: "",
      moduleId: customerModules[0] || "clean",
      slaHours: 24,
      slaWarningPercent: 75,
      slaCriticalPercent: 90,
    },
  });

  const editForm = useForm<OperationalScopeFormData>({
    resolver: zodResolver(operationalScopeSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: OperationalScopeFormData) => {
      const response = await apiRequest(
        'POST',
        `/api/customers/${customerId}/operational-scopes`,
        {
          id: nanoid(),
          ...data,
          customerId,
          status: 'active',
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'operational-scopes'] });
      toast({ title: "Escopo criado com sucesso" });
      setIsCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar escopo", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: OperationalScopeFormData & { id: string }) => {
      const { id, ...rest } = data;
      const response = await apiRequest(
        'PUT',
        `/api/customers/${customerId}/operational-scopes/${id}`,
        rest
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'operational-scopes'] });
      toast({ title: "Escopo atualizado com sucesso" });
      setIsEditDialogOpen(false);
      setEditingScope(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar escopo", description: error.message, variant: "destructive" });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(
        'PUT',
        `/api/customers/${customerId}/operational-scopes/${id}`,
        { status: 'archived' }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'operational-scopes'] });
      toast({ title: "Escopo arquivado com sucesso" });
      setArchiveDialogOpen(false);
      setScopeToArchive(null);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao arquivar escopo", description: error.message, variant: "destructive" });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest(
        'PUT',
        `/api/customers/${customerId}/operational-scopes/${id}`,
        { status: 'active' }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'operational-scopes'] });
      toast({ title: "Escopo restaurado com sucesso" });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao restaurar escopo", description: error.message, variant: "destructive" });
    },
  });

  const assignScopesMutation = useMutation({
    mutationFn: async ({ companyId, scopeIds }: { companyId: string; scopeIds: string[] }) => {
      const response = await apiRequest(
        'PUT',
        `/api/customers/${customerId}/third-party-companies/${companyId}/scopes`,
        { allowedOperationalScopes: scopeIds }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers', customerId, 'third-party-companies'] });
      toast({ title: "Escopos atribuídos com sucesso" });
      setAssignDialogOpen(false);
      setSelectedCompanyForAssign(null);
      setSelectedScopes([]);
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atribuir escopos", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (scope: OperationalScope) => {
    setEditingScope(scope);
    editForm.reset({
      name: scope.name,
      description: scope.description || "",
      moduleId: scope.moduleId,
      slaHours: scope.slaHours || 24,
      slaWarningPercent: scope.slaWarningPercent || 75,
      slaCriticalPercent: scope.slaCriticalPercent || 90,
    });
    setIsEditDialogOpen(true);
  };

  const handleAssign = (company: ThirdPartyCompany) => {
    setSelectedCompanyForAssign(company);
    setSelectedScopes(company.allowedOperationalScopes || []);
    setAssignDialogOpen(true);
  };

  const getModuleLabel = (moduleId: string) => {
    switch (moduleId) {
      case 'clean': return 'Limpeza';
      case 'maintenance': return 'Manutenção';
      default: return moduleId;
    }
  };

  const getModuleColor = (moduleId: string) => {
    return moduleId === 'clean' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
  };

  if (!activeClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Selecione um cliente para continuar</p>
      </div>
    );
  }

  if (!(activeClient as any).thirdPartyEnabled) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Módulo de Terceiros Desabilitado</h3>
          <p className="text-muted-foreground">
            O módulo de terceiros não está habilitado para este cliente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={theme.styles.color}>
            Escopos Operacionais
          </h1>
          <p className="text-muted-foreground">
            Defina escopos de trabalho com SLA e atribua às empresas terceirizadas
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-scope">
              <Plus className="h-4 w-4 mr-2" />
              Novo Escopo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar Escopo Operacional</DialogTitle>
              <DialogDescription>
                Defina um novo escopo de trabalho com configurações de SLA
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Escopo</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Ex: Manutenção Preventiva - Ar Condicionado" data-testid="input-scope-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Descrição opcional do escopo" data-testid="input-scope-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="moduleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Módulo</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-scope-module">
                            <SelectValue placeholder="Selecione o módulo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customerModules.includes('clean') && (
                            <SelectItem value="clean">Limpeza</SelectItem>
                          )}
                          {customerModules.includes('maintenance') && (
                            <SelectItem value="maintenance">Manutenção</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Configurações de SLA
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <FormField
                      control={createForm.control}
                      name="slaHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prazo (horas)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-sla-hours" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="slaWarningPercent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Alerta (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-sla-warning" 
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Amarelo
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="slaCriticalPercent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Crítico (%)</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              {...field} 
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              data-testid="input-sla-critical" 
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Vermelho
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-scope">
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Criar Escopo
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" data-testid="tab-active-scopes">
            Ativos ({activeScopes.length})
          </TabsTrigger>
          <TabsTrigger value="archived" data-testid="tab-archived-scopes">
            Arquivados ({archivedScopes.length})
          </TabsTrigger>
          <TabsTrigger value="assignments" data-testid="tab-assignments">
            Atribuições
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : activeScopes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum escopo ativo</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crie escopos operacionais para definir os tipos de trabalho que serão executados por terceiros.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-first-scope">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Escopo
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead>Limites</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeScopes.map((scope) => (
                      <TableRow key={scope.id} data-testid={`row-scope-${scope.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{scope.name}</p>
                            {scope.description && (
                              <p className="text-sm text-muted-foreground">{scope.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getModuleColor(scope.moduleId)}>
                            {getModuleLabel(scope.moduleId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {scope.slaHours ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span>{scope.slaHours}h</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {scope.slaWarningPercent && (
                              <span className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
                                <AlertTriangle className="h-3 w-3" />
                                {scope.slaWarningPercent}%
                              </span>
                            )}
                            {scope.slaCriticalPercent && (
                              <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                                <AlertCircle className="h-3 w-3" />
                                {scope.slaCriticalPercent}%
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(scope)}
                              data-testid={`button-edit-scope-${scope.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setScopeToArchive(scope.id);
                                setArchiveDialogOpen(true);
                              }}
                              data-testid={`button-archive-scope-${scope.id}`}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="archived">
          {archivedScopes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Archive className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum escopo arquivado</h3>
                <p className="text-muted-foreground text-center">
                  Escopos arquivados aparecerão aqui.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Módulo</TableHead>
                      <TableHead>SLA</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedScopes.map((scope) => (
                      <TableRow key={scope.id} className="opacity-60" data-testid={`row-archived-scope-${scope.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{scope.name}</p>
                            {scope.description && (
                              <p className="text-sm text-muted-foreground">{scope.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {getModuleLabel(scope.moduleId)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {scope.slaHours ? `${scope.slaHours}h` : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => restoreMutation.mutate(scope.id)}
                            disabled={restoreMutation.isPending}
                            data-testid={`button-restore-scope-${scope.id}`}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restaurar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assignments">
          {companies.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma empresa terceirizada</h3>
                <p className="text-muted-foreground text-center">
                  Cadastre empresas terceirizadas para atribuir escopos operacionais.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {companies.map((company) => {
                const companyScopes = activeScopes.filter(s => 
                  company.allowedOperationalScopes?.includes(s.id)
                );
                return (
                  <Card key={company.id} data-testid={`card-company-${company.id}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base">{company.name}</CardTitle>
                        <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                          {company.status === 'active' ? 'Ativo' : company.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Escopos atribuídos ({companyScopes.length})
                          </p>
                          {companyScopes.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">
                              Nenhum escopo atribuído
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {companyScopes.map((scope) => (
                                <Badge key={scope.id} variant="outline" className="text-xs">
                                  {scope.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => handleAssign(company)}
                          data-testid={`button-assign-scopes-${company.id}`}
                        >
                          <LinkIcon className="h-4 w-4 mr-2" />
                          Gerenciar Escopos
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Escopo Operacional</DialogTitle>
            <DialogDescription>
              Atualize as informações do escopo
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => editingScope && updateMutation.mutate({ ...data, id: editingScope.id }))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Escopo</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-scope-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-edit-scope-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="moduleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Módulo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-scope-module">
                          <SelectValue placeholder="Selecione o módulo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customerModules.includes('clean') && (
                          <SelectItem value="clean">Limpeza</SelectItem>
                        )}
                        {customerModules.includes('maintenance') && (
                          <SelectItem value="maintenance">Manutenção</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Configurações de SLA
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={editForm.control}
                    name="slaHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prazo (horas)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-edit-sla-hours" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="slaWarningPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alerta (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-edit-sla-warning" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={editForm.control}
                    name="slaCriticalPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Crítico (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            {...field} 
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            data-testid="input-edit-sla-critical" 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending} data-testid="button-update-scope">
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar Alterações
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Atribuir Escopos</DialogTitle>
            <DialogDescription>
              Selecione os escopos que {selectedCompanyForAssign?.name} pode executar
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3 pr-4">
              {activeScopes.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum escopo ativo disponível. Crie escopos primeiro.
                </p>
              ) : (
                activeScopes.map((scope) => (
                  <div
                    key={scope.id}
                    className="flex items-start gap-3 p-3 border rounded-md hover-elevate"
                  >
                    <Checkbox
                      id={scope.id}
                      checked={selectedScopes.includes(scope.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedScopes([...selectedScopes, scope.id]);
                        } else {
                          setSelectedScopes(selectedScopes.filter(id => id !== scope.id));
                        }
                      }}
                      data-testid={`checkbox-scope-${scope.id}`}
                    />
                    <div className="flex-1">
                      <label htmlFor={scope.id} className="font-medium cursor-pointer">
                        {scope.name}
                      </label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={getModuleColor(scope.moduleId)} variant="secondary">
                          {getModuleLabel(scope.moduleId)}
                        </Badge>
                        {scope.slaHours && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {scope.slaHours}h
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAssignDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => selectedCompanyForAssign && assignScopesMutation.mutate({
                companyId: selectedCompanyForAssign.id,
                scopeIds: selectedScopes,
              })}
              disabled={assignScopesMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignScopesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar Atribuições
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar Escopo</AlertDialogTitle>
            <AlertDialogDescription>
              Este escopo será arquivado e não poderá mais ser atribuído a novas ordens de serviço.
              Você pode restaurá-lo a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => scopeToArchive && archiveMutation.mutate(scopeToArchive)}
              disabled={archiveMutation.isPending}
              data-testid="button-confirm-archive"
            >
              {archiveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Arquivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
