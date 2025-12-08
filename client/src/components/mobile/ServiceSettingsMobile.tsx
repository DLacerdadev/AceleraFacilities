import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Tag, 
  Layers, 
  Settings as SettingsIcon, 
  Target, 
  Building, 
  Users as UsersIcon,
  Plus,
  Edit,
  Trash2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import Sites from "@/pages/sites";
import Users from "@/pages/users";
import Services from "@/pages/services";
import { useModule } from "@/contexts/ModuleContext";

interface ServiceSettingsMobileProps {
  customerId: string;
}

// Schemas para validação
const serviceTypeSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  code: z.string().min(1, "Código é obrigatório"),
});

// CATEGORIAS - FUNCIONALIDADE COMENTADA (MANTER PARA REFERÊNCIA FUTURA)
/* const serviceCategorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  code: z.string().min(1, "Código é obrigatório"),
  typeId: z.string().min(1, "Tipo é obrigatório"),
}); */

const dashboardGoalSchema = z.object({
  goalType: z.string().min(1, "Tipo de meta é obrigatório"),
  goalValue: z.string().min(1, "Valor da meta é obrigatório"),
  currentPeriod: z.string().min(1, "Período é obrigatório"),
});

export default function ServiceSettingsMobile({ customerId }: ServiceSettingsMobileProps) {
  const [activeTab, setActiveTab] = useState("types");
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  // const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false); // CATEGORIAS - COMENTADO
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  // const [editingCategory, setEditingCategory] = useState<any>(null); // CATEGORIAS - COMENTADO
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentModule } = useModule();

  // Invalidate cache when customer changes
  useEffect(() => {
    if (customerId) {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    }
  }, [customerId, queryClient]);

  // Queries
  const { data: serviceTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ["/api/customers", customerId, "service-types", { module: currentModule }],
    enabled: !!customerId && !!currentModule,
  });

  // CATEGORIAS - COMENTADO
  /* const { data: serviceCategories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["/api/customers", customerId, "service-categories"],
    enabled: !!customerId,
  }); */

  const { data: dashboardGoals = [], isLoading: loadingGoals } = useQuery({
    queryKey: ["/api/customers", customerId, "dashboard-goals", { module: currentModule }],
    enabled: !!customerId,
  });

  // Forms
  const typeForm = useForm({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      code: "",
    },
  });

  // CATEGORIAS - COMENTADO
  /* const categoryForm = useForm({
    resolver: zodResolver(serviceCategorySchema),
    defaultValues: {
      name: "",
      description: "",
      code: "",
      typeId: "",
    },
  }); */

  const goalForm = useForm({
    resolver: zodResolver(dashboardGoalSchema),
    defaultValues: {
      goalType: "",
      goalValue: "",
      currentPeriod: new Date().toISOString().slice(0, 7),
    },
  });

  // Mutations - Types
  const createTypeMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/customers/${customerId}/service-types`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "service-types", { module: currentModule }] });
      setIsTypeDialogOpen(false);
      typeForm.reset();
      toast({ title: "Tipo de serviço criado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar tipo de serviço", variant: "destructive" });
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PUT", `/api/customers/${customerId}/service-types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "service-types", { module: currentModule }] });
      setIsTypeDialogOpen(false);
      setEditingType(null);
      typeForm.reset();
      toast({ title: "Tipo de serviço atualizado com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar tipo de serviço", variant: "destructive" });
    },
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customers/${customerId}/service-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "service-types", { module: currentModule }] });
      toast({ title: "Tipo de serviço excluído com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir tipo de serviço", variant: "destructive" });
    },
  });

  // CATEGORIAS - MUTATIONS COMENTADAS
  /* const createCategoryMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/customers/${customerId}/service-categories`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "service-categories"] });
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
      toast({ title: "Categoria criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar categoria", variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PUT", `/api/customers/${customerId}/service-categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "service-categories"] });
      setIsCategoryDialogOpen(false);
      setEditingCategory(null);
      categoryForm.reset();
      toast({ title: "Categoria atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar categoria", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customers/${customerId}/service-categories/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "service-categories"] });
      toast({ title: "Categoria excluída com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir categoria", variant: "destructive" });
    },
  }); */

  // Mutations - Goals
  const createGoalMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/customers/${customerId}/dashboard-goals`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "dashboard-goals", { module: currentModule }] });
      setIsGoalDialogOpen(false);
      goalForm.reset();
      toast({ title: "Meta criada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao criar meta", variant: "destructive" });
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest("PUT", `/api/customers/${customerId}/dashboard-goals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "dashboard-goals", { module: currentModule }] });
      setIsGoalDialogOpen(false);
      setEditingGoal(null);
      goalForm.reset();
      toast({ title: "Meta atualizada com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao atualizar meta", variant: "destructive" });
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customers/${customerId}/dashboard-goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "dashboard-goals", { module: currentModule }] });
      toast({ title: "Meta excluída com sucesso!" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir meta", variant: "destructive" });
    },
  });

  // Handlers
  const onSubmitType = (data: any) => {
    if (editingType) {
      // Incluir o módulo atual ao editar tipo de serviço
      updateTypeMutation.mutate({ id: editingType.id, data: { ...data, module: currentModule } });
    } else {
      // Incluir o módulo atual ao criar tipo de serviço
      createTypeMutation.mutate({ ...data, module: currentModule });
    }
  };

  // CATEGORIAS - HANDLER COMENTADO
  /* const onSubmitCategory = (data: any) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, data });
    } else {
      createCategoryMutation.mutate(data);
    }
  }; */

  const onSubmitGoal = (data: any) => {
    if (editingGoal) {
      updateGoalMutation.mutate({ id: editingGoal.id, data });
    } else {
      // Incluir o módulo atual ao criar meta
      createGoalMutation.mutate({ ...data, module: currentModule });
    }
  };

  const handleEditType = (type: any) => {
    setEditingType(type);
    typeForm.reset({
      name: type.name,
      description: type.description || "",
      code: type.code,
    });
    setIsTypeDialogOpen(true);
  };

  // CATEGORIAS - HANDLER COMENTADO
  /* const handleEditCategory = (category: any) => {
    setEditingCategory(category);
    categoryForm.reset({
      name: category.name,
      description: category.description || "",
      code: category.code,
      typeId: category.typeId,
    });
    setIsCategoryDialogOpen(true);
  }; */

  const handleEditGoal = (goal: any) => {
    setEditingGoal(goal);
    goalForm.reset({
      goalType: goal.goalType,
      goalValue: goal.goalValue,
      currentPeriod: goal.currentPeriod,
    });
    setIsGoalDialogOpen(true);
  };

  const getTypeName = (typeId: string) => {
    const type = (serviceTypes as any[]).find(t => t.id === typeId);
    return type?.name || "Tipo não encontrado";
  };

  const getGoalTypeLabel = (goalType: string) => {
    const labels: Record<string, string> = {
      'eficiencia_operacional': 'Eficiência Operacional (%)',
      'sla_compliance': 'SLA Compliance (%)',
      'os_concluidas_mes': 'OS Concluídas no Mês',
      'indice_qualidade': 'Índice de Qualidade (0-10)',
      'performance_mensal': 'Performance Mensal (%)',
    };
    return labels[goalType] || goalType;
  };

  const getGoalTypeColor = (goalType: string) => {
    const colors: Record<string, string> = {
      'eficiencia_operacional': 'bg-emerald-500',
      'sla_compliance': 'bg-blue-500',
      'os_concluidas_mes': 'bg-purple-500',
      'indice_qualidade': 'bg-orange-500',
      'performance_mensal': 'bg-indigo-500',
    };
    return colors[goalType] || 'bg-gray-500';
  };

  if (loadingTypes || /* loadingCategories || */ loadingGoals) { // CATEGORIAS - LOADING COMENTADO
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 p-6 pb-4">
          <div className="animate-pulse flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl"></div>
            <div className="flex-1">
              <div className="h-6 bg-white/20 rounded w-40 mb-2"></div>
              <div className="h-4 bg-white/10 rounded w-32"></div>
            </div>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="animate-pulse">
            {[1,2,3].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl mb-3"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 p-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-4 ring-white/20">
            <SettingsIcon className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Configurações</h1>
            <p className="text-sm text-white/80">Sistema de serviços</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Tabs com scroll horizontal */}
        <div className="bg-white border-b sticky top-0 z-10 overflow-x-auto">
          <TabsList className="flex gap-1 bg-transparent w-max min-w-full px-4 py-2">
            <TabsTrigger 
              value="types" 
              className="flex items-center gap-1.5 text-xs rounded-xl px-4 py-2.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900 whitespace-nowrap"
              data-testid="tab-types"
            >
              <Tag className="w-4 h-4" />
              Tipos
            </TabsTrigger>
            {/* CATEGORIAS - ABA COMENTADA */}
            {/* <TabsTrigger 
              value="categories" 
              className="flex items-center gap-1.5 text-xs rounded-xl px-4 py-2.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900 whitespace-nowrap"
              data-testid="tab-categories"
            >
              <Layers className="w-4 h-4" />
              Categorias
            </TabsTrigger> */}
            <TabsTrigger 
              value="services" 
              className="flex items-center gap-1.5 text-xs rounded-xl px-4 py-2.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900 whitespace-nowrap"
              data-testid="tab-services"
            >
              <SettingsIcon className="w-4 h-4" />
              Serviços
            </TabsTrigger>
            <TabsTrigger 
              value="goals" 
              className="flex items-center gap-1.5 text-xs rounded-xl px-4 py-2.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900 whitespace-nowrap"
              data-testid="tab-goals"
            >
              <Target className="w-4 h-4" />
              Metas
            </TabsTrigger>
            <TabsTrigger 
              value="sites" 
              className="flex items-center gap-1.5 text-xs rounded-xl px-4 py-2.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900 whitespace-nowrap"
              data-testid="tab-sites"
            >
              <Building className="w-4 h-4" />
              Sites
            </TabsTrigger>
            <TabsTrigger 
              value="users" 
              className="flex items-center gap-1.5 text-xs rounded-xl px-4 py-2.5 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-900 whitespace-nowrap"
              data-testid="tab-users"
            >
              <UsersIcon className="w-4 h-4" />
              Usuários
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Aba Tipos */}
        <TabsContent value="types" className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Tag className="w-5 h-5" />
                  Tipos de Serviços
                </CardTitle>
                <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setEditingType(null);
                        typeForm.reset({ name: "", description: "", code: "" });
                      }}
                      data-testid="button-create-type"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Novo
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw]">
                    <DialogHeader>
                      <DialogTitle className="text-base">
                        {editingType ? "Editar Tipo" : "Novo Tipo"}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...typeForm}>
                      <form onSubmit={typeForm.handleSubmit(onSubmitType)} className="space-y-4">
                        <FormField
                          control={typeForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Nome</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Hard Service" {...field} data-testid="input-type-name" className="text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={typeForm.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Código</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: hard_service" {...field} data-testid="input-type-code" className="text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={typeForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Descrição</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Descrição do tipo" 
                                  {...field} 
                                  data-testid="input-type-description"
                                  className="text-sm"
                                  rows={3}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2 pt-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsTypeDialogOpen(false)}
                            size="sm"
                          >
                            Cancelar
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createTypeMutation.isPending || updateTypeMutation.isPending}
                            data-testid="button-save-type"
                            size="sm"
                          >
                            {editingType ? "Atualizar" : "Criar"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {(serviceTypes as any[]).length === 0 ? (
                <div className="text-center py-8">
                  <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Nenhum tipo cadastrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(serviceTypes as any[]).map((type: any) => (
                    <div key={type.id} className="border rounded-lg p-3 bg-white" data-testid={`card-type-${type.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-sm font-semibold truncate" data-testid={`text-type-name-${type.id}`}>{type.name}</h3>
                            <Badge variant="outline" className="text-xs" data-testid={`badge-type-code-${type.id}`}>{type.code}</Badge>
                            {type.isActive ? (
                              <Badge className="bg-green-100 text-green-800 text-xs" data-testid={`badge-type-status-${type.id}`}>Ativo</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs" data-testid={`badge-type-status-${type.id}`}>Inativo</Badge>
                            )}
                          </div>
                          {type.description && (
                            <p className="text-xs text-muted-foreground mb-1 line-clamp-2" data-testid={`text-type-description-${type.id}`}>{type.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditType(type)}
                            data-testid={`button-edit-type-${type.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600"
                            onClick={() => deleteTypeMutation.mutate(type.id)}
                            data-testid={`button-delete-type-${type.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CATEGORIAS - TODO O CONTEÚDO DA ABA COMENTADO */}
        {/* <TabsContent value="categories" className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Layers className="w-5 h-5" />
                  Categorias
                </CardTitle>
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setEditingCategory(null);
                        categoryForm.reset({ name: "", description: "", code: "", typeId: "" });
                      }}
                      data-testid="button-create-category"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Nova
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw]">
                    <DialogHeader>
                      <DialogTitle className="text-base">
                        {editingCategory ? "Editar Categoria" : "Nova Categoria"}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...categoryForm}>
                      <form onSubmit={categoryForm.handleSubmit(onSubmitCategory)} className="space-y-4">
                        <FormField
                          control={categoryForm.control}
                          name="typeId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Tipo de Serviço</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-category-type" className="text-sm">
                                    <SelectValue placeholder="Selecione o tipo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(serviceTypes as any[]).map((type: any) => (
                                    <SelectItem key={type.id} value={type.id} data-testid={`select-item-type-${type.id}`}>
                                      {type.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={categoryForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Nome</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: Manutenção Elétrica" {...field} data-testid="input-category-name" className="text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={categoryForm.control}
                          name="code"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Código</FormLabel>
                              <FormControl>
                                <Input placeholder="Ex: manutencao_eletrica" {...field} data-testid="input-category-code" className="text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={categoryForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Descrição</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Descrição da categoria" 
                                  {...field} 
                                  data-testid="input-category-description"
                                  className="text-sm"
                                  rows={3}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2 pt-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsCategoryDialogOpen(false)}
                            size="sm"
                          >
                            Cancelar
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                            data-testid="button-save-category"
                            size="sm"
                          >
                            {editingCategory ? "Atualizar" : "Criar"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {(serviceCategories as any[]).length === 0 ? (
                <div className="text-center py-8">
                  <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Nenhuma categoria cadastrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(serviceCategories as any[]).map((category: any) => (
                    <div key={category.id} className="border rounded-lg p-3 bg-white" data-testid={`card-category-${category.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-sm font-semibold truncate" data-testid={`text-category-name-${category.id}`}>{category.name}</h3>
                            <Badge variant="outline" className="text-xs" data-testid={`badge-category-code-${category.id}`}>{category.code}</Badge>
                          </div>
                          {category.description && (
                            <p className="text-xs text-muted-foreground mb-1 line-clamp-2" data-testid={`text-category-description-${category.id}`}>{category.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground" data-testid={`text-category-type-${category.id}`}>
                            Tipo: {getTypeName(category.typeId)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditCategory(category)}
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600"
                            onClick={() => deleteCategoryMutation.mutate(category.id)}
                            data-testid={`button-delete-category-${category.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent> */}

        {/* Aba Serviços */}
        <TabsContent value="services" className="mt-0">
          <Services customerId={customerId} />
        </TabsContent>

        {/* Aba Metas */}
        <TabsContent value="goals" className="p-4 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Target className="w-5 h-5" />
                  Metas do Dashboard
                </CardTitle>
                <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm"
                      onClick={() => {
                        setEditingGoal(null);
                        goalForm.reset({ 
                          goalType: "", 
                          goalValue: "", 
                          currentPeriod: new Date().toISOString().slice(0, 7) 
                        });
                      }}
                      data-testid="button-create-goal"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Nova
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[90vw]">
                    <DialogHeader>
                      <DialogTitle className="text-base">
                        {editingGoal ? "Editar Meta" : "Nova Meta"}
                      </DialogTitle>
                    </DialogHeader>
                    <Form {...goalForm}>
                      <form onSubmit={goalForm.handleSubmit(onSubmitGoal)} className="space-y-4">
                        <FormField
                          control={goalForm.control}
                          name="goalType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Tipo de Meta</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-goal-type" className="text-sm">
                                    <SelectValue placeholder="Selecione o tipo" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="eficiencia_operacional" data-testid="select-item-goal-eficiencia">
                                    Eficiência Operacional (%)
                                  </SelectItem>
                                  <SelectItem value="sla_compliance" data-testid="select-item-goal-sla">
                                    SLA Compliance (%)
                                  </SelectItem>
                                  <SelectItem value="os_concluidas_mes" data-testid="select-item-goal-os">
                                    OS Concluídas no Mês
                                  </SelectItem>
                                  <SelectItem value="indice_qualidade" data-testid="select-item-goal-qualidade">
                                    Índice de Qualidade (0-10)
                                  </SelectItem>
                                  <SelectItem value="performance_mensal" data-testid="select-item-goal-performance">
                                    Performance Mensal (%)
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={goalForm.control}
                          name="goalValue"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Valor da Meta</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  placeholder="Ex: 95" 
                                  {...field} 
                                  data-testid="input-goal-value" 
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={goalForm.control}
                          name="currentPeriod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm">Período</FormLabel>
                              <FormControl>
                                <Input 
                                  type="month" 
                                  {...field} 
                                  data-testid="input-goal-period" 
                                  className="text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2 pt-2">
                          <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsGoalDialogOpen(false)}
                            size="sm"
                          >
                            Cancelar
                          </Button>
                          <Button 
                            type="submit" 
                            disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
                            data-testid="button-save-goal"
                            size="sm"
                          >
                            {editingGoal ? "Atualizar" : "Criar"}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {(dashboardGoals as any[]).length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(dashboardGoals as any[]).map((goal: any) => (
                    <div key={goal.id} className="border rounded-lg p-3 bg-white" data-testid={`card-goal-${goal.id}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${getGoalTypeColor(goal.goalType)}`}></div>
                            <h3 className="text-sm font-semibold" data-testid={`text-goal-type-${goal.id}`}>
                              {getGoalTypeLabel(goal.goalType)}
                            </h3>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span data-testid={`text-goal-value-${goal.id}`}>Meta: <strong>{goal.goalValue}</strong></span>
                            <span data-testid={`text-goal-period-${goal.id}`}>Período: {goal.currentPeriod}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditGoal(goal)}
                            data-testid={`button-edit-goal-${goal.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600"
                            onClick={() => deleteGoalMutation.mutate(goal.id)}
                            data-testid={`button-delete-goal-${goal.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aba Sites */}
        <TabsContent value="sites" className="mt-0">
          <Sites customerId={customerId} />
        </TabsContent>

        {/* Aba Usuários */}
        <TabsContent value="users" className="mt-0">
          <Users customerId={customerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
