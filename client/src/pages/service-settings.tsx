import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Plus, 
  Settings as SettingsIcon, 
  Edit, 
  Trash2,
  Layers,
  Building,
  Users as UsersIcon,
  Cog,
  Target,
  Bookmark,
  Tag,
  Download,
  Loader2,
  MoreVertical,
  Power,
  PowerOff
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient as globalQueryClient } from "@/lib/queryClient";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import Sites from "./sites";
import Users from "./users";
import Services from "./services";
import { useClient } from "@/contexts/ClientContext";
import { useModule } from "@/contexts/ModuleContext";
import { useEffect } from "react";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { ModernCard } from "@/components/ui/modern-card";
import { useModuleTheme } from "@/hooks/use-module-theme";

// Schemas para validação
const serviceTypeSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  code: z.string().min(1, "Código é obrigatório"),
});

// CATEGORIAS DE SERVIÇOS - FUNCIONALIDADE COMENTADA (MANTER PARA REFERÊNCIA FUTURA)
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

interface EquipmentCategory {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  module: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function EquipmentCategoriesTab() {
  const { currentModule } = useModule();
  const { activeClient } = useClient();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const theme = useModuleTheme();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EquipmentCategory | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const companyId = activeClient?.companyId;

  const { data: categories = [], isLoading } = useQuery<EquipmentCategory[]>({
    queryKey: [`/api/companies/${companyId}/equipment-categories`, { module: currentModule }],
    enabled: !!companyId,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/equipment-categories", data);
    },
    onSuccess: () => {
      toast({ title: "Categoria criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/equipment-categories`, { module: currentModule }] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar categoria", description: error?.message, variant: "destructive" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/equipment-categories/${data.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Categoria atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/equipment-categories`, { module: currentModule }] });
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao atualizar categoria", description: error?.message, variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/equipment-categories/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Categoria excluída com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/equipment-categories`, { module: currentModule }] });
    },
    onError: (error: any) => {
      toast({ title: "Erro ao excluir categoria", description: error?.message, variant: "destructive" });
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/companies/${companyId}/equipment-categories/seed-defaults`, {
        module: currentModule
      });
    },
    onSuccess: (data: any) => {
      toast({ title: data.message || "Categorias padrão criadas", description: `${data.categories?.length || 0} categorias adicionadas` });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/equipment-categories`, { module: currentModule }] });
    },
    onError: (error: any) => {
      toast({ title: "Erro", description: error?.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setCategoryName("");
    setCategoryDescription("");
    setIsActive(true);
  };

  const handleCreate = () => {
    if (!companyId || !categoryName.trim()) {
      toast({ title: "Preencha o nome da categoria", variant: "destructive" });
      return;
    }
    createCategoryMutation.mutate({
      companyId,
      name: categoryName.trim(),
      description: categoryDescription.trim() || null,
      module: currentModule,
      isActive,
    });
  };

  const handleEdit = (category: EquipmentCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDescription(category.description || "");
    setIsActive(category.isActive);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingCategory || !categoryName.trim()) {
      toast({ title: "Preencha o nome da categoria", variant: "destructive" });
      return;
    }
    updateCategoryMutation.mutate({
      id: editingCategory.id,
      name: categoryName.trim(),
      description: categoryDescription.trim() || null,
      isActive,
    });
  };

  const handleDeleteConfirm = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete);
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <ModernCard variant="gradient">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </ModernCard>
    );
  }

  return (
    <>
      <ModernCard variant="gradient">
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Categorias de Equipamentos
            </CardTitle>
            <div className="flex items-center gap-2">
              {categories.length === 0 && (
                <Button
                  variant="outline"
                  onClick={() => seedDefaultsMutation.mutate()}
                  disabled={seedDefaultsMutation.isPending}
                  size="sm"
                  data-testid="button-seed-defaults"
                >
                  {seedDefaultsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Carregar Padrões
                </Button>
              )}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => { resetForm(); }}
                    className={theme.buttons.primary}
                    style={theme.buttons.primaryStyle}
                    data-testid="button-create-category"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Categoria
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nova Categoria</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome *</Label>
                      <Input
                        id="name"
                        value={categoryName}
                        onChange={(e) => setCategoryName(e.target.value)}
                        placeholder="Ex: Ar Condicionado"
                        data-testid="input-category-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={categoryDescription}
                        onChange={(e) => setCategoryDescription(e.target.value)}
                        placeholder="Descrição da categoria..."
                        data-testid="input-category-description"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-category-active" />
                      <Label>Ativo</Label>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                      <Button
                        onClick={handleCreate}
                        disabled={createCategoryMutation.isPending}
                        className={theme.buttons.primary}
                        style={theme.buttons.primaryStyle}
                        data-testid="button-save-category"
                      >
                        {createCategoryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Criar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Nenhuma categoria cadastrada</p>
              <p className="text-sm text-muted-foreground mt-2">
                Clique em "Carregar Padrões" para adicionar categorias comuns ou crie uma nova
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between p-4 rounded-xl border bg-white/50 hover:bg-white/80 transition-colors"
                  data-testid={`category-item-${category.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${category.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <div>
                      <p className="font-medium">{category.name}</p>
                      {category.description && (
                        <p className="text-sm text-muted-foreground">{category.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={category.isActive ? "default" : "secondary"}>
                      {category.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" data-testid={`button-category-menu-${category.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(category)} data-testid={`button-edit-category-${category.id}`}>
                          <Edit className="w-4 h-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => { setCategoryToDelete(category.id); setDeleteDialogOpen(true); }}
                          className="text-red-600"
                          data-testid={`button-delete-category-${category.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </ModernCard>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nome *</Label>
              <Input
                id="edit-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                data-testid="input-edit-category-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                data-testid="input-edit-category-description"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} data-testid="switch-edit-category-active" />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={handleUpdate}
                disabled={updateCategoryMutation.isPending}
                className={theme.buttons.primary}
                style={theme.buttons.primaryStyle}
                data-testid="button-update-category"
              >
                {updateCategoryMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Atualizar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Settings() {
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  // const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false); // CATEGORIAS - COMENTADO
  const [isGoalDialogOpen, setIsGoalDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  // const [editingCategory, setEditingCategory] = useState<any>(null); // CATEGORIAS - COMENTADO
  const [editingGoal, setEditingGoal] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { activeClientId: customerId } = useClient();
  const { currentModule } = useModule();
  const theme = useModuleTheme();

  // Invalidate cache when customer changes
  useEffect(() => {
    if (customerId) {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
    }
  }, [customerId, queryClient]);

  // Invalidate service types cache when module changes
  useEffect(() => {
    if (customerId && currentModule) {
      queryClient.invalidateQueries({ 
        queryKey: ["/api/customers", customerId, "service-types"] 
      });
    }
  }, [currentModule, customerId, queryClient]);

  // Queries
  const { data: serviceTypes = [], isLoading: loadingTypes } = useQuery({
    queryKey: ["/api/customers", customerId, "service-types", { module: currentModule }],
    enabled: !!customerId,
    staleTime: 0, // Força revalidação imediata
  });

  // CATEGORIAS - COMENTADO
  /* const { data: serviceCategories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["/api/customers", customerId, "service-categories", { module: currentModule }],
    enabled: !!customerId,
  }); */

  const { data: dashboardGoals = [], isLoading: loadingGoals } = useQuery({
    queryKey: ["/api/customers", customerId, "dashboard-goals", { module: currentModule }],
    enabled: !!customerId,
  });

  const { data: customer } = useQuery({
    queryKey: [`/api/customers/${customerId}`],
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
      currentPeriod: new Date().toISOString().slice(0, 7), // YYYY-MM format
    },
  });

  // Mutations
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
    onError: (error: unknown) => {
      // Extrair mensagem limpa do erro
      let errorMessage = "Erro ao excluir tipo de serviço";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({ 
        description: errorMessage,
        variant: "destructive" 
      });
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
      // Incluir o módulo atual ao criar categoria
      createCategoryMutation.mutate({ ...data, module: currentModule });
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

  if (loadingTypes || /* loadingCategories || */ loadingGoals) { // CATEGORIAS - LOADING COMENTADO
    return (
      <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-24 bg-gray-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50/30 to-white">
      {/* Container com padding adequado - não colar nas extremidades */}
      <div className="w-full px-6 py-6">
        {/* Header Moderno */}
        <ModernPageHeader
          title="Configurações do Sistema"
          description="Gerencie configurações gerais"
          icon={Cog}
        />
        
        <Tabs defaultValue="types" className="space-y-6 mt-6">
          {/* Tabs Responsivas com cores dinâmicas do módulo */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-2 shadow-sm border border-gray-200/50 overflow-x-auto">
            <TabsList className="flex gap-1 bg-transparent w-max min-w-full">
              <TabsTrigger 
                value="types" 
                className="flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 transition-all whitespace-nowrap data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm"
                data-testid="tab-types"
              >
                <Bookmark className="w-4 h-4" />
                Tipos
              </TabsTrigger>
              <TabsTrigger 
                value="services" 
                className="flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 transition-all whitespace-nowrap data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm"
                data-testid="tab-services"
              >
                <SettingsIcon className="w-4 h-4" />
                Serviços
              </TabsTrigger>
              <TabsTrigger 
                value="goals" 
                className="flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 transition-all whitespace-nowrap data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm"
                data-testid="tab-goals"
              >
                <Target className="w-4 h-4" />
                Metas
              </TabsTrigger>
              <TabsTrigger 
                value="sites" 
                className="flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 transition-all whitespace-nowrap data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm"
                data-testid="tab-sites"
              >
                <Building className="w-4 h-4" />
                Locais
              </TabsTrigger>
              <TabsTrigger 
                value="users" 
                className="flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 transition-all whitespace-nowrap data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm"
                data-testid="tab-users"
              >
                <UsersIcon className="w-4 h-4" />
                Usuários
              </TabsTrigger>
              {currentModule === 'maintenance' && (
                <TabsTrigger 
                  value="categories" 
                  className="flex items-center gap-2 text-sm rounded-lg px-4 py-2.5 transition-all whitespace-nowrap data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:shadow-sm"
                  data-testid="tab-categories"
                >
                  <Tag className="w-4 h-4" />
                  Categorias
                </TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="types" className="space-y-6">
            <ModernCard variant="gradient">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bookmark className="w-5 h-5" />
                    Tipos de Serviços
                  </CardTitle>
                  <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setEditingType(null);
                          typeForm.reset({ name: "", description: "", code: "" });
                        }}
                        className={theme.buttons.primary}
                        style={theme.buttons.primaryStyle}
                        data-testid="button-create-type"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Tipo
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingType ? "Editar Tipo de Serviço" : "Novo Tipo de Serviço"}
                        </DialogTitle>
                      </DialogHeader>
                      <Form {...typeForm}>
                        <form onSubmit={typeForm.handleSubmit(onSubmitType)} className="space-y-4">
                          <FormField
                            control={typeForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Hard Service" {...field} data-testid="input-type-name" />
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
                                <FormLabel>Código</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: hard_service" {...field} data-testid="input-type-code" />
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
                                <FormLabel>Descrição</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Descrição do tipo de serviço" 
                                    {...field} 
                                    data-testid="input-type-description"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setIsTypeDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              type="submit" 
                              variant="default"
                              disabled={createTypeMutation.isPending || updateTypeMutation.isPending}
                              data-testid="button-save-type"
                              className={theme.buttons.primary}
                              style={theme.buttons.primaryStyle}
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
                    <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhum tipo de serviço cadastrado</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Crie tipos de serviços para organizar melhor seu sistema
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(serviceTypes as any[]).map((type: any) => (
                      <div key={type.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-semibold text-foreground">{type.name}</h3>
                              <Badge variant="outline">{type.code}</Badge>
                              {type.isActive ? (
                                <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                              ) : (
                                <Badge variant="outline">Inativo</Badge>
                              )}
                            </div>
                            {type.description && (
                              <p className="text-sm text-muted-foreground mb-2">{type.description}</p>
                            )}
                            {/* CATEGORIAS - CONTAGEM COMENTADA */}
                            {/* <p className="text-xs text-muted-foreground">
                              Categorias: {(serviceCategories as any[]).filter(c => c.typeId === type.id).length}
                            </p> */}
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditType(type)}
                              data-testid={`button-edit-type-${type.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
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
            </ModernCard>
          </TabsContent>

          {/* CATEGORIAS - TODO O CONTEÚDO DA ABA COMENTADO */}
          {/* <TabsContent value="categories" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Layers className="w-5 h-5" />
                    Categorias de Serviços
                  </CardTitle>
                  <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setEditingCategory(null);
                          categoryForm.reset({ name: "", description: "", code: "", typeId: "" });
                        }}
                        data-testid="button-create-category"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Categoria
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
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
                                <FormLabel>Tipo de Serviço</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-category-type">
                                      <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {(serviceTypes as any[]).map((type: any) => (
                                      <SelectItem key={type.id} value={type.id}>
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
                                <FormLabel>Nome</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Manutenção Elétrica" {...field} data-testid="input-category-name" />
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
                                <FormLabel>Código</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: manutencao_eletrica" {...field} data-testid="input-category-code" />
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
                                <FormLabel>Descrição</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="Descrição da categoria" 
                                    {...field} 
                                    data-testid="input-category-description"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setIsCategoryDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              type="submit" 
                              variant="default"
                              disabled={createCategoryMutation.isPending || updateCategoryMutation.isPending}
                              data-testid="button-save-category"
                              className={theme.buttons.primary}
                              style={theme.buttons.primaryStyle}
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
                    <p className="text-muted-foreground">Nenhuma categoria cadastrada</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Crie categorias para classificar seus serviços
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(serviceCategories as any[]).map((category: any) => (
                      <div key={category.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="text-lg font-semibold text-foreground">{category.name}</h3>
                              <Badge variant="outline">{category.code}</Badge>
                              {category.isActive ? (
                                <Badge className="bg-green-100 text-green-800">Ativa</Badge>
                              ) : (
                                <Badge variant="outline">Inativa</Badge>
                              )}
                            </div>
                            {category.description && (
                              <p className="text-sm text-muted-foreground mb-2">{category.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              Tipo: {getTypeName(category.typeId)}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                              data-testid={`button-edit-category-${category.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
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

          <TabsContent value="services" className="space-y-6">
            <Services customerId={customerId} />
          </TabsContent>

          <TabsContent value="goals" className="space-y-6">
            <ModernCard variant="glass">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Metas do Dashboard
                  </CardTitle>
                  <Dialog open={isGoalDialogOpen} onOpenChange={setIsGoalDialogOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        onClick={() => {
                          setEditingGoal(null);
                          goalForm.reset({ 
                            goalType: "", 
                            goalValue: "", 
                            currentPeriod: new Date().toISOString().slice(0, 7) 
                          });
                        }}
                        className={theme.buttons.primary}
                        style={theme.buttons.primaryStyle}
                        data-testid="button-create-goal"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Nova Meta
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
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
                                <FormLabel>Tipo de Meta</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger data-testid="select-goal-type">
                                      <SelectValue placeholder="Selecione o tipo de meta" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="eficiencia_operacional">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span>Eficiência Operacional (%)</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="sla_compliance">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span>SLA Compliance (%)</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="os_concluidas_mes">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                        <span>OS Concluídas no Mês</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="indice_qualidade">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                        <span>Índice de Qualidade (0-10)</span>
                                      </div>
                                    </SelectItem>
                                    <SelectItem value="performance_mensal">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                        <span>Performance Mensal (%)</span>
                                      </div>
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                                {field.value && (
                                  <p className="text-xs text-muted-foreground mt-2">
                                    📊 Esta meta aparecerá {field.value === 'performance_mensal' ? 'como linha no gráfico de Performance ao longo do tempo' : 'no card'} <strong>
                                      {field.value === 'eficiencia_operacional' && 'verde (Eficiência Operacional)'}
                                      {field.value === 'sla_compliance' && 'azul (SLA Compliance)'}
                                      {field.value === 'os_concluidas_mes' && 'roxo (OS Concluídas)'}
                                      {field.value === 'indice_qualidade' && 'laranja (Índice de Qualidade)'}
                                      {field.value === 'performance_mensal' && 'índigo (Performance Mensal)'}
                                    </strong> {field.value !== 'performance_mensal' && 'do dashboard'}
                                  </p>
                                )}
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={goalForm.control}
                            name="goalValue"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Valor da Meta</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    placeholder="Ex: 100" 
                                    {...field} 
                                    data-testid="input-goal-value" 
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
                                <FormLabel>Período</FormLabel>
                                <FormControl>
                                  <Input 
                                    type="month" 
                                    {...field} 
                                    data-testid="input-goal-period"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end space-x-2">
                            <Button 
                              type="button" 
                              variant="outline" 
                              onClick={() => setIsGoalDialogOpen(false)}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              type="submit" 
                              variant="default"
                              disabled={createGoalMutation.isPending || updateGoalMutation.isPending}
                              data-testid="button-save-goal"
                              className={theme.buttons.primary}
                              style={theme.buttons.primaryStyle}
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
                    <p className="text-muted-foreground">Nenhuma meta configurada</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Configure metas para acompanhar o desempenho no dashboard
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(dashboardGoals as any[]).map((goal: any) => (
                      <div key={goal.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              {goal.goalType === 'eficiencia_operacional' && <div className="w-3 h-3 rounded-full bg-emerald-500"></div>}
                              {goal.goalType === 'sla_compliance' && <div className="w-3 h-3 rounded-full bg-blue-500"></div>}
                              {goal.goalType === 'os_concluidas_mes' && <div className="w-3 h-3 rounded-full bg-purple-500"></div>}
                              {goal.goalType === 'indice_qualidade' && <div className="w-3 h-3 rounded-full bg-orange-500"></div>}
                              {goal.goalType === 'performance_mensal' && <div className="w-3 h-3 rounded-full bg-indigo-500"></div>}
                              <h3 className="text-lg font-semibold text-foreground">
                                {goal.goalType === 'eficiencia_operacional' && 'Eficiência Operacional'}
                                {goal.goalType === 'sla_compliance' && 'SLA Compliance'}
                                {goal.goalType === 'os_concluidas_mes' && 'OS Concluídas no Mês'}
                                {goal.goalType === 'indice_qualidade' && 'Índice de Qualidade'}
                                {goal.goalType === 'performance_mensal' && 'Performance Mensal'}
                              </h3>
                              <Badge variant="outline">
                                Meta: {goal.goalValue}{goal.goalType === 'os_concluidas_mes' ? ' OS' : goal.goalType === 'indice_qualidade' ? '/10' : '%'}
                              </Badge>
                              {goal.isActive ? (
                                <Badge className="bg-green-100 text-green-800">Ativa</Badge>
                              ) : (
                                <Badge variant="outline">Inativa</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              📅 Período: {goal.currentPeriod} • 📊 {
                                goal.goalType === 'performance_mensal' 
                                  ? 'Aparece como linha no gráfico de Performance ao longo do tempo'
                                  : `Aparece no card ${
                                      goal.goalType === 'eficiencia_operacional' ? 'verde' : 
                                      goal.goalType === 'sla_compliance' ? 'azul' : 
                                      goal.goalType === 'os_concluidas_mes' ? 'roxo' : 
                                      'laranja'
                                    } do dashboard`
                              }
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleEditGoal(goal)}
                              data-testid={`button-edit-goal-${goal.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
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
            </ModernCard>
          </TabsContent>

          <TabsContent value="sites" className="space-y-6">
            <Sites customerId={customerId} />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Users customerId={customerId} />
          </TabsContent>

          {currentModule === 'maintenance' && (
            <TabsContent value="categories" className="space-y-6">
              <EquipmentCategoriesTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}