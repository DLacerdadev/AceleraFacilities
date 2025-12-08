import { ModernCard, ModernCardContent, ModernCardHeader } from "@/components/ui/modern-card";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import { useClient } from "@/contexts/ClientContext";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Edit, 
  Trash2,
  Tag,
  RefreshCw,
  Layers,
  Loader2,
  Download
} from "lucide-react";

interface EquipmentCategory {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  module: 'clean' | 'maintenance';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function EquipmentCategories() {
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const [, setLocation] = useLocation();
  const { activeClient } = useClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EquipmentCategory | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { toast } = useToast();
  const companyId = activeClient?.companyId;

  const { data: categories = [], isLoading } = useQuery<EquipmentCategory[]>({
    queryKey: [`/api/companies/${companyId}/equipment-categories`, { module: currentModule }],
    enabled: !!companyId,
  });

  useEffect(() => {
    if (currentModule !== 'maintenance') {
      setLocation('/');
    }
  }, [currentModule, setLocation]);

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
      const errorMessage = error?.message || "Erro ao criar categoria";
      toast({ 
        title: "Erro ao criar categoria",
        description: errorMessage,
        variant: "destructive",
      });
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
      const errorMessage = error?.message || "Erro ao atualizar categoria";
      toast({ 
        title: "Erro ao atualizar categoria",
        description: errorMessage,
        variant: "destructive",
      });
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
      const errorMessage = error?.message || "Erro ao excluir categoria";
      toast({ 
        title: "Erro ao excluir categoria",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/companies/${companyId}/equipment-categories/seed-defaults`, {
        module: currentModule
      });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: data.message || "Categorias padrão criadas",
        description: `${data.categories?.length || 0} categorias adicionadas`
      });
      queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/equipment-categories`, { module: currentModule }] });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || "Erro ao criar categorias padrão";
      toast({ 
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setCategoryName("");
    setCategoryDescription("");
    setIsActive(true);
  };

  const handleCreate = () => {
    if (!companyId || !categoryName.trim()) {
      toast({ 
        title: "Preencha o nome da categoria", 
        variant: "destructive" 
      });
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
      toast({ 
        title: "Preencha o nome da categoria", 
        variant: "destructive" 
      });
      return;
    }

    updateCategoryMutation.mutate({
      id: editingCategory.id,
      name: categoryName.trim(),
      description: categoryDescription.trim() || null,
      isActive,
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja excluir a categoria "${name}"? Equipamentos vinculados a esta categoria perderão a referência.`)) {
      deleteCategoryMutation.mutate(id);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast({ title: "Atualizando lista..." });
    await queryClient.invalidateQueries({ queryKey: [`/api/companies/${companyId}/equipment-categories`, { module: currentModule }] });
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const activeCategories = Array.isArray(categories) ? categories.filter(c => c.isActive) : [];
  const inactiveCategories = Array.isArray(categories) ? categories.filter(c => !c.isActive) : [];

  return (
    <>
      <ModernPageHeader 
        title="Categorias de Equipamentos"
        description="Gerencie as categorias para classificar seus equipamentos"
        icon={Tag}
        stats={[
          { 
            label: "Total de Categorias", 
            value: Array.isArray(categories) ? categories.length : 0,
            icon: Layers
          },
          {
            label: "Categorias Ativas",
            value: activeCategories.length,
            icon: Tag
          }
        ]}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {Array.isArray(categories) && categories.length === 0 && (
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
            <Button 
              variant="default"
              className={cn("flex items-center gap-2", theme.buttons.primary)}
              style={theme.buttons.primaryStyle}
              size="sm"
              onClick={() => setIsCreateDialogOpen(true)}
              data-testid="button-create-category-header"
            >
              <Plus className="w-4 h-4" />
              Nova Categoria
            </Button>
            <Button 
              variant="outline"
              onClick={handleRefresh}
              size="sm"
              disabled={isRefreshing}
              data-testid="button-refresh-categories"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        }
      />
      
      <div className={cn("flex-1 overflow-y-auto p-4 space-y-3", theme.gradients.section)}>
        <ModernCard variant="gradient">
          <ModernCardHeader icon={<Tag className="w-6 h-6" />}>
            Lista de Categorias
          </ModernCardHeader>
          <ModernCardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : Array.isArray(categories) && categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Tag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">Nenhuma categoria encontrada</p>
                <Button 
                  variant="outline"
                  onClick={() => seedDefaultsMutation.mutate()}
                  disabled={seedDefaultsMutation.isPending}
                  data-testid="button-seed-defaults-empty"
                >
                  {seedDefaultsMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Carregar Categorias Padrão
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id} data-testid={`row-category-${category.id}`}>
                      <TableCell className="font-medium" data-testid={`text-category-name-${category.id}`}>
                        {category.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-xs truncate" data-testid={`text-category-desc-${category.id}`}>
                        {category.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={category.isActive ? "default" : "secondary"}
                          data-testid={`badge-category-status-${category.id}`}
                        >
                          {category.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(category)}
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(category.id, category.name)}
                            className="text-destructive hover:text-destructive"
                            data-testid={`button-delete-category-${category.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ModernCardContent>
        </ModernCard>
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Categoria de Equipamento</DialogTitle>
            <DialogDescription>
              Crie uma nova categoria para classificar seus equipamentos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nome *</Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ex: HVAC, Elétrico, Hidráulico..."
                data-testid="input-category-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category-description">Descrição</Label>
              <Textarea
                id="category-description"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Descrição opcional da categoria"
                rows={3}
                data-testid="input-category-description"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="category-active">Categoria Ativa</Label>
              <Switch
                id="category-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-category-active"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetForm();
                }}
                data-testid="button-cancel-create"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={createCategoryMutation.isPending}
                className={theme.buttons.primary}
                style={theme.buttons.primaryStyle}
                data-testid="button-confirm-create"
              >
                {createCategoryMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Criar Categoria
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Categoria</DialogTitle>
            <DialogDescription>
              Atualize as informações da categoria
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-category-name">Nome *</Label>
              <Input
                id="edit-category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Nome da categoria"
                data-testid="input-edit-category-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category-description">Descrição</Label>
              <Textarea
                id="edit-category-description"
                value={categoryDescription}
                onChange={(e) => setCategoryDescription(e.target.value)}
                placeholder="Descrição opcional"
                rows={3}
                data-testid="input-edit-category-description"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-category-active">Categoria Ativa</Label>
              <Switch
                id="edit-category-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-edit-category-active"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingCategory(null);
                  resetForm();
                }}
                data-testid="button-cancel-edit"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateCategoryMutation.isPending}
                className={theme.buttons.primary}
                style={theme.buttons.primaryStyle}
                data-testid="button-confirm-edit"
              >
                {updateCategoryMutation.isPending && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                Salvar Alterações
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
