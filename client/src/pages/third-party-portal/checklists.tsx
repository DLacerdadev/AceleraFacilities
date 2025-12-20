import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Wrench, Sparkles, Loader2, AlertCircle, CheckCircle2, XCircle, ClipboardCheck, Camera, Type, Hash, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const checklistSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  description: z.string().optional(),
  module: z.enum(["maintenance", "clean"]),
  items: z.array(z.any()).min(1, "Adicione pelo menos um item"),
});

type ChecklistFormData = z.infer<typeof checklistSchema>;

interface ChecklistItem {
  id: string;
  type: 'text' | 'number' | 'photo' | 'checkbox';
  label: string;
  required: boolean;
  description?: string;
  options?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    photoMinCount?: number;
    photoMaxCount?: number;
    minChecked?: number;
  };
}

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'text': 'Texto',
    'number': 'Número',
    'photo': 'Foto',
    'checkbox': 'Checkbox'
  };
  return labels[type] || type;
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'text': return <Type className="w-4 h-4" />;
    case 'number': return <Hash className="w-4 h-4" />;
    case 'photo': return <Camera className="w-4 h-4" />;
    case 'checkbox': return <CheckSquare className="w-4 h-4" />;
    default: return null;
  }
};

interface ChecklistOption {
  id: string;
  value: string;
}

const defaultNewItem: Omit<ChecklistItem, 'id'> & { optionsWithIds: ChecklistOption[] } = {
  type: 'text',
  label: '',
  required: false,
  description: '',
  options: [],
  optionsWithIds: [],
  validation: {}
};

export default function ThirdPartyChecklists() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedChecklist, setSelectedChecklist] = useState<any>(null);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newItem, setNewItem] = useState<Omit<ChecklistItem, 'id'> & { optionsWithIds: ChecklistOption[] }>(defaultNewItem);
  const [activeTab, setActiveTab] = useState("all");

  const { data: modulesData, isLoading: loadingModules } = useQuery<{
    allowedModules: string[];
    companyName: string;
    customerId: string;
  }>({
    queryKey: ['/api/third-party-portal/my-modules'],
  });

  const { data: checklists = [], isLoading: loadingChecklists } = useQuery<any[]>({
    queryKey: ['/api/third-party-portal/checklists'],
  });

  const hasMaintenanceAccess = modulesData?.allowedModules?.includes('maintenance');
  const hasCleanAccess = modulesData?.allowedModules?.includes('clean');

  const form = useForm<ChecklistFormData>({
    resolver: zodResolver(checklistSchema),
    defaultValues: {
      name: "",
      description: "",
      module: "maintenance",
      items: [],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ChecklistFormData) => {
      return await apiRequest("POST", "/api/third-party-portal/checklists", {
        ...data,
        items: checklistItems,
      });
    },
    onSuccess: () => {
      toast({ title: "Checklist criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/checklists'] });
      resetForm();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar checklist", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string } & Partial<ChecklistFormData>) => {
      const { id, ...body } = data;
      return await apiRequest("PATCH", `/api/third-party-portal/checklists/${id}`, {
        ...body,
        items: checklistItems,
      });
    },
    onSuccess: () => {
      toast({ title: "Checklist atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/checklists'] });
      resetForm();
      setIsEditDialogOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar checklist", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/third-party-portal/checklists/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Checklist excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/checklists'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao excluir checklist", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    form.reset();
    setChecklistItems([]);
    setNewItem(defaultNewItem);
    setIsCreateDialogOpen(false);
    setSelectedChecklist(null);
  };

  const addItem = () => {
    if (newItem.label.trim()) {
      const item: ChecklistItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: newItem.type,
        label: newItem.label.trim(),
        required: newItem.required,
        description: newItem.description,
        options: newItem.type === 'checkbox' ? newItem.options : undefined,
        validation: newItem.validation,
      };
      setChecklistItems([...checklistItems, item]);
      setNewItem(defaultNewItem);
    }
  };

  const removeItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const handleEdit = (checklist: any) => {
    setSelectedChecklist(checklist);
    form.reset({
      name: checklist.name,
      description: checklist.description || "",
      module: checklist.module,
      items: checklist.items || [],
    });
    setChecklistItems(checklist.items || []);
    setIsEditDialogOpen(true);
  };

  const handleSubmit = (data: ChecklistFormData) => {
    createMutation.mutate({
      ...data,
      items: checklistItems,
    });
  };

  const handleUpdate = (data: ChecklistFormData) => {
    if (!selectedChecklist) return;
    updateMutation.mutate({
      id: selectedChecklist.id,
      ...data,
      items: checklistItems,
    });
  };

  const filteredChecklists = checklists.filter((cl: any) => {
    if (activeTab === "all") return true;
    return cl.module === activeTab;
  });

  const getModuleIcon = (module: string) => {
    return module === 'maintenance' ? 
      <Wrench className="w-4 h-4 text-orange-500" /> : 
      <Sparkles className="w-4 h-4 text-blue-500" />;
  };

  const getModuleLabel = (module: string) => {
    return module === 'maintenance' ? 'Manutenção' : 'Limpeza';
  };

  if (loadingModules) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!hasMaintenanceAccess && !hasCleanAccess) {
    return (
      <Card className="max-w-md mx-auto mt-8">
        <CardContent className="flex flex-col items-center py-8">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sem Acesso a Módulos</h3>
          <p className="text-muted-foreground text-center">
            Sua empresa não possui permissão para criar checklists.
            Entre em contato com o cliente para solicitar acesso.
          </p>
        </CardContent>
      </Card>
    );
  }

  const ChecklistForm = ({ onSubmit, isEdit }: { onSubmit: (data: ChecklistFormData) => void; isEdit?: boolean }) => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Checklist</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Verificação de Equipamentos" {...field} data-testid="input-checklist-name" />
              </FormControl>
              <FormMessage />
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
                <Textarea placeholder="Descreva o checklist..." {...field} data-testid="input-checklist-description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="module"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Módulo</FormLabel>
              <Select onValueChange={field.onChange} value={field.value} disabled={isEdit}>
                <FormControl>
                  <SelectTrigger data-testid="select-module">
                    <SelectValue placeholder="Selecione o módulo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {hasMaintenanceAccess && (
                    <SelectItem value="maintenance">Manutenção</SelectItem>
                  )}
                  {hasCleanAccess && (
                    <SelectItem value="clean">Limpeza</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Adicionar Item Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Adicionar Item ao Checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select 
                  value={newItem.type} 
                  onValueChange={(value) => setNewItem(prev => ({ ...prev, type: value as ChecklistItem['type'] }))}
                >
                  <SelectTrigger data-testid="select-item-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texto</SelectItem>
                    <SelectItem value="number">Número</SelectItem>
                    <SelectItem value="photo">Foto</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rótulo *</Label>
                <Input
                  data-testid="input-item-label"
                  value={newItem.label}
                  onChange={(e) => setNewItem(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Ex: Verificar pressão"
                />
              </div>
              <div className="space-y-2">
                <Label>Observações</Label>
                <Input
                  data-testid="input-item-description"
                  value={newItem.description}
                  onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Instruções opcionais..."
                />
              </div>
            </div>

            {/* Configurações avançadas */}
            {newItem.type && (
              <Card className="bg-muted/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Configurações - {getTypeLabel(newItem.type)}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Texto */}
                  {newItem.type === 'text' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Mínimo de caracteres</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 10"
                          value={newItem.validation?.minLength || ""}
                          onChange={(e) => setNewItem(prev => ({
                            ...prev,
                            validation: {
                              ...prev.validation,
                              minLength: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          }))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Máximo de caracteres</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 500"
                          value={newItem.validation?.maxLength || ""}
                          onChange={(e) => setNewItem(prev => ({
                            ...prev,
                            validation: {
                              ...prev.validation,
                              maxLength: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Número */}
                  {newItem.type === 'number' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Valor mínimo</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 0"
                          value={newItem.validation?.minValue || ""}
                          onChange={(e) => setNewItem(prev => ({
                            ...prev,
                            validation: {
                              ...prev.validation,
                              minValue: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          }))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Valor máximo</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 100"
                          value={newItem.validation?.maxValue || ""}
                          onChange={(e) => setNewItem(prev => ({
                            ...prev,
                            validation: {
                              ...prev.validation,
                              maxValue: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Foto */}
                  {newItem.type === 'photo' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Mínimo de fotos</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 1"
                          value={newItem.validation?.photoMinCount || ""}
                          onChange={(e) => setNewItem(prev => ({
                            ...prev,
                            validation: {
                              ...prev.validation,
                              photoMinCount: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          }))}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Máximo de fotos</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 5"
                          value={newItem.validation?.photoMaxCount || ""}
                          onChange={(e) => setNewItem(prev => ({
                            ...prev,
                            validation: {
                              ...prev.validation,
                              photoMaxCount: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Checkbox */}
                  {newItem.type === 'checkbox' && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs">Opções do Checkbox</Label>
                        <div className="space-y-2">
                          {(newItem.options || []).map((option, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={option}
                                onChange={(e) => {
                                  const newOptions = [...(newItem.options || [])];
                                  newOptions[index] = e.target.value;
                                  setNewItem(prev => ({ ...prev, options: newOptions }));
                                }}
                                className="h-8 text-xs flex-1"
                                placeholder={`Opção ${index + 1}`}
                                data-testid={`input-checkbox-option-${index}`}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newOptions = (newItem.options || []).filter((_, i) => i !== index);
                                  setNewItem(prev => ({ ...prev, options: newOptions }));
                                }}
                                className="h-8"
                                data-testid={`button-remove-option-${index}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNewItem(prev => ({
                                ...prev,
                                options: [...(prev.options || []), '']
                              }));
                            }}
                            className="h-8 text-xs"
                            data-testid="button-add-option"
                          >
                            <Plus className="w-3 h-3 mr-1" />
                            Adicionar Opção
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Mínimo de checks obrigatórios</Label>
                        <Input
                          type="number"
                          placeholder="Ex: 1"
                          value={newItem.validation?.minChecked || ""}
                          onChange={(e) => setNewItem(prev => ({
                            ...prev,
                            validation: {
                              ...prev.validation,
                              minChecked: e.target.value ? parseInt(e.target.value) : undefined
                            }
                          }))}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  {/* Campo obrigatório */}
                  <div className="flex items-center gap-2 pt-2">
                    <Switch
                      checked={newItem.required}
                      onCheckedChange={(checked) => setNewItem(prev => ({ ...prev, required: checked }))}
                      data-testid="switch-required"
                    />
                    <Label className="text-xs">Campo obrigatório</Label>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button 
              type="button" 
              onClick={addItem}
              disabled={!newItem.label.trim()}
              className="w-full"
              data-testid="button-add-item"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Item
            </Button>
          </CardContent>
        </Card>

        {/* Lista de itens */}
        <div className="space-y-2">
          <FormLabel>Itens Adicionados ({checklistItems.length})</FormLabel>
          {checklistItems.length > 0 ? (
            <div className="space-y-2">
              {checklistItems.map((item, index) => (
                <div key={item.id || index} className="flex items-center justify-between gap-2 p-3 border rounded-md">
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{getTypeIcon(item.type)}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {getTypeLabel(item.type)}
                        </Badge>
                        {item.required && (
                          <Badge variant="secondary" className="text-xs">Obrigatório</Badge>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground">{item.description}</p>
                      )}
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => removeItem(index)}
                    data-testid={`button-remove-item-${index}`}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum item adicionado</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={resetForm} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={createMutation.isPending || updateMutation.isPending || checklistItems.length === 0}
            data-testid="button-submit"
          >
            {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? 'Atualizar' : 'Criar'} Checklist
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Checklists</h1>
          <p className="text-muted-foreground">
            Gerencie os checklists para suas propostas de planos
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-checklist">
              <Plus className="w-4 h-4 mr-2" />
              Novo Checklist
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo Checklist</DialogTitle>
              <DialogDescription>
                Crie um checklist para usar em suas propostas de planos
              </DialogDescription>
            </DialogHeader>
            <ChecklistForm onSubmit={handleSubmit} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">Todos</TabsTrigger>
          {hasMaintenanceAccess && (
            <TabsTrigger value="maintenance" data-testid="tab-maintenance">Manutenção</TabsTrigger>
          )}
          {hasCleanAccess && (
            <TabsTrigger value="clean" data-testid="tab-clean">Limpeza</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loadingChecklists ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredChecklists.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-8">
                <ClipboardCheck className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhum checklist encontrado</h3>
                <p className="text-muted-foreground text-center">
                  Crie checklists para usar em suas propostas de planos.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredChecklists.map((checklist: any) => (
                <Card key={checklist.id} data-testid={`card-checklist-${checklist.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {getModuleIcon(checklist.module)}
                        <CardTitle className="text-base">{checklist.name}</CardTitle>
                      </div>
                      <Badge variant={checklist.isActive ? "secondary" : "outline"}>
                        {checklist.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                    {checklist.description && (
                      <CardDescription className="line-clamp-2">{checklist.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {(checklist.items || []).length} itens
                      </p>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleEdit(checklist)}
                          data-testid={`button-edit-${checklist.id}`}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => deleteMutation.mutate(checklist.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-${checklist.id}`}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Checklist</DialogTitle>
            <DialogDescription>
              Atualize os detalhes do checklist
            </DialogDescription>
          </DialogHeader>
          <ChecklistForm onSubmit={handleUpdate} isEdit />
        </DialogContent>
      </Dialog>
    </div>
  );
}
