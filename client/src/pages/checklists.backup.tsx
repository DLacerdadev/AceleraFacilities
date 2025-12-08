import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select as CustomSelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Select from "react-select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useClient } from "@/contexts/ClientContext";
import { Plus, Edit3, Trash2, FileText, List, Eye } from "lucide-react";
import type { ChecklistTemplate } from "@shared/schema";

interface ChecklistItem {
  id: string;
  type: 'text' | 'number' | 'photo';
  label: string;
  required: boolean;
  description?: string;
  validation?: {
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    photoRequired?: boolean;
    photoMinCount?: number;
    photoMaxCount?: number;
  };
}

interface SelectOption {
  value: string;
  label: string;
}
interface Checklist {
  id: string;
  name: string;
  description: string;
  items: ChecklistItem[];
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

export default function Checklists() {
  const { activeClientId } = useClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [checklistForm, setChecklistForm] = useState({
    name: "",
    description: "",
    siteIds: [] as string[],
    zoneIds: [] as string[],
    serviceId: "",
    items: [] as ChecklistItem[]
  });
  const [newItem, setNewItem] = useState<Partial<ChecklistItem>>({
    type: 'text',
    label: "",
    required: false,
    description: "",
    validation: {}
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

// Função para lidar com a mudança de valor no Multiselect
const handleMultiSelectChange = (
  selectedOptions: SelectOption[] | null, 
  field: "siteIds" | "zoneIds"
) => {
  const ids = selectedOptions ? selectedOptions.map((option: SelectOption) => option.value) : [];
  setChecklistForm(prev => ({ ...prev, [field]: ids }));
};


  const { data: checklists = [], isLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ["/api/customers", activeClientId, "checklist-templates"],
    enabled: !!activeClientId,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["/api/customers", activeClientId, "sites"],
    enabled: !!activeClientId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["/api/customers", activeClientId, "services"],
    enabled: !!activeClientId,
  });

  // Buscar zonas quando um site é selecionado
  const { data: zones = [] } = useQuery({
    queryKey: ["/api/sites", checklistForm.siteId, "zones"],
    enabled: !!checklistForm.siteId,
  });

  const createChecklistMutation = useMutation({
    mutationFn: async (data: typeof checklistForm) => {
      const response = await apiRequest("POST", `/api/customers/${activeClientId}/checklist-templates`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "checklist-templates"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "Checklist criado",
        description: "O checklist foi criado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao criar checklist",
        description: "Houve um problema ao criar o checklist.",
        variant: "destructive",
      });
    },
  });

  const updateChecklistMutation = useMutation({
    mutationFn: async (data: typeof checklistForm & { id: string }) => {
      const response = await apiRequest("PUT", `/api/customers/${activeClientId}/checklist-templates/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "checklist-templates"] });
      setIsCreateDialogOpen(false);
      setEditingChecklist(null);
      resetForm();
      toast({
        title: "Checklist atualizado",
        description: "O checklist foi atualizado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar checklist",
        description: "Houve um problema ao atualizar o checklist.",
        variant: "destructive",
      });
    },
  });

  const deleteChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      await apiRequest("DELETE", `/api/customers/${activeClientId}/checklist-templates/${checklistId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "checklist-templates"] });
      toast({
        title: "Checklist excluído",
        description: "O checklist foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao excluir checklist",
        description: "Houve um problema ao excluir o checklist.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setChecklistForm({
      name: "",
      description: "",
      siteIds: [] as string[],
      zoneIds: [] as string[],
      serviceId: "",
      items: []
    });
    setNewItem({
      type: 'text',
      label: "",
      required: false,
      description: "",
      validation: {}
    });
  };

  const addItem = () => {
    if (!newItem.label?.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O rótulo do item é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    const item: ChecklistItem = {
      id: Date.now().toString(),
      type: newItem.type as ChecklistItem['type'],
      label: newItem.label,
      required: newItem.required || false,
      description: newItem.description || "",
      validation: newItem.validation || {}
    };

    setChecklistForm(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));

    setNewItem({
      type: 'text',
      label: "",
      required: false,
      description: "",
      validation: {}
    });
  };

  const removeItem = (itemId: string) => {
    setChecklistForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const handleEdit = (checklist: any) => {
    setEditingChecklist(checklist);
    setChecklistForm({
      name: checklist.name,
      description: checklist.description,
      siteIds: checklist.siteIds || [],
      zoneIds: checklist.zoneIds || [],
      serviceId: checklist.serviceId || "",
      items: checklist.items
    });
    setIsCreateDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!checklistForm.name.trim()) {
      toast({
        title: "Campo obrigatório",
        description: "O nome do checklist é obrigatório.",
        variant: "destructive",
      });
      return;
    }

    if (checklistForm.siteIds.length === 0) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione pelo menos um local para o checklist.",
        variant: "destructive",
      });
      return;
    }

    if (checklistForm.zoneIds.length === 0) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione pelo menos uma zona para o checklist.",
        variant: "destructive",
      });
      return;
    }

    if (!checklistForm.serviceId) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione um serviço para o checklist.",
        variant: "destructive",
      });
      return;
    }

    if (checklistForm.items.length === 0) {
      toast({
        title: "Itens obrigatórios",
        description: "Adicione pelo menos um item ao checklist.",
        variant: "destructive",
      });
      return;
    }

    if (editingChecklist) {
      updateChecklistMutation.mutate({
        ...checklistForm,
        id: editingChecklist.id
      });
    } else {
      createChecklistMutation.mutate(checklistForm);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'photo': return <Eye className="w-4 h-4" />;
      case 'number': return <span className="w-4 h-4 text-center text-xs font-bold">#</span>;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'photo': return 'Foto';
      case 'number': return 'Número';
      default: return 'Texto';
    }
  };

  if (isLoading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600">Carregando checklists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg shadow-blue-500/5 sticky top-0 z-50">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 rounded-2xl flex items-center justify-center shadow-lg">
                <List className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-green-900 to-emerald-900 bg-clip-text text-transparent">
                  Checklists
                </h1>
                <p className="text-sm text-slate-600">
                  Gerencie os checklists para ordens de serviço
                </p>
              </div>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
              setIsCreateDialogOpen(open);
              if (!open) {
                setEditingChecklist(null);
                resetForm();
              }
            }}>
              <DialogTrigger asChild>
                <Button 
                  className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800"
                  data-testid="button-create-checklist"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Checklist
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingChecklist ? "Editar Checklist" : "Criar Novo Checklist"}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Form básico */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Checklist</Label>
                      <Input
                        id="name"
                        data-testid="input-checklist-name"
                        value={checklistForm.name}
                        onChange={(e) => setChecklistForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Limpeza de Banheiros"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        data-testid="input-checklist-description"
                        value={checklistForm.description}
                        onChange={(e) => setChecklistForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Descrição do checklist..."
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Vinculação obrigatória */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="siteId">Local <span className="text-red-500">*</span></Label>
                      <Select 
                        value={checklistForm.siteId} 
                        onValueChange={(value) => setChecklistForm(prev => ({ 
                          ...prev, 
                          siteId: value,
                          zoneId: "" // Reset zona quando mudar o local
                        }))}
                      >
                        <SelectTrigger data-testid="select-checklist-site">
                          <SelectValue placeholder="Selecione o local" />
                        </SelectTrigger>
                        <SelectContent>
                          {(sites as any[]).map((site) => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zoneId">Zona <span className="text-red-500">*</span></Label>
                      <Select 
                        value={checklistForm.zoneId} 
                        onValueChange={(value) => setChecklistForm(prev => ({ ...prev, zoneId: value }))}
                        disabled={!checklistForm.siteId}
                      >
                        <SelectTrigger data-testid="select-checklist-zone">
                          <SelectValue placeholder={checklistForm.siteId ? "Selecione a zona" : "Selecione um local primeiro"} />
                        </SelectTrigger>
                        <SelectContent>
                          {(zones as any[]).map((zone) => (
                            <SelectItem key={zone.id} value={zone.id}>
                              {zone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serviceId">Serviço <span className="text-red-500">*</span></Label>
                      <Select 
                        value={checklistForm.serviceId} 
                        onValueChange={(value) => setChecklistForm(prev => ({ ...prev, serviceId: value }))}
                      >
                        <SelectTrigger data-testid="select-checklist-service">
                          <SelectValue placeholder="Selecione o serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {(services as any[]).map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Adicionar item */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Adicionar Item</CardTitle>
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
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Rótulo</Label>
                          <Input
                            data-testid="input-item-label"
                            value={newItem.label}
                            onChange={(e) => setNewItem(prev => ({ ...prev, label: e.target.value }))}
                            placeholder="Ex: Limpeza concluída?"
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

                      {/* Configurações avançadas baseadas no tipo */}
                      {newItem.type && (
                        <Card className="bg-slate-50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm">Configurações Avançadas - {getTypeLabel(newItem.type || 'text')}</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* Configurações para Texto */}
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

                            {/* Configurações para Número */}
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

                            {/* Configurações para Foto */}
                            {newItem.type === 'photo' && (
                              <div className="space-y-3">
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
                                <div className="flex items-center space-x-2">
                                  <Switch
                                    checked={newItem.validation?.photoRequired || false}
                                    onCheckedChange={(checked) => setNewItem(prev => ({
                                      ...prev,
                                      validation: {
                                        ...prev.validation,
                                      photoRequired: checked
                                      }
                                    }))}
                                  />
                                  <Label className="text-xs">Foto obrigatória (independente do campo obrigatório)</Label>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Switch
                            data-testid="switch-item-required"
                            checked={newItem.required}
                            onCheckedChange={(checked) => setNewItem(prev => ({ ...prev, required: checked }))}
                          />
                          <Label>Campo obrigatório</Label>
                        </div>
                        <Button 
                          onClick={addItem} 
                          variant="outline"
                          data-testid="button-add-item"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar Item
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Lista de itens */}
                  {checklistForm.items.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Itens do Checklist ({checklistForm.items.length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {checklistForm.items.map((item, index) => (
                            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                              <div className="flex items-center space-x-3 flex-1">
                                <span className="text-sm font-medium text-slate-500">#{index + 1}</span>
                                <div className="flex items-center space-x-2">
                                  {getTypeIcon(item.type)}
                                  <Badge variant="outline">{getTypeLabel(item.type)}</Badge>
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{item.label}</p>
                                  {item.description && (
                                    <p className="text-sm text-slate-600">{item.description}</p>
                                  )}
                                  {/* Mostrar configurações de validação aplicadas */}
                                  {item.validation && Object.keys(item.validation).length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {item.validation.minLength && (
                                        <Badge variant="outline" className="text-xs bg-blue-50">
                                          Mín: {item.validation.minLength} chars
                                        </Badge>
                                      )}
                                      {item.validation.maxLength && (
                                        <Badge variant="outline" className="text-xs bg-blue-50">
                                          Máx: {item.validation.maxLength} chars
                                        </Badge>
                                      )}
                                      {item.validation.minValue !== undefined && (
                                        <Badge variant="outline" className="text-xs bg-green-50">
                                          Mín: {item.validation.minValue}
                                        </Badge>
                                      )}
                                      {item.validation.maxValue !== undefined && (
                                        <Badge variant="outline" className="text-xs bg-green-50">
                                          Máx: {item.validation.maxValue}
                                        </Badge>
                                      )}
                                      {item.validation.photoMinCount && (
                                        <Badge variant="outline" className="text-xs bg-purple-50">
                                          Mín: {item.validation.photoMinCount} fotos
                                        </Badge>
                                      )}
                                      {item.validation.photoMaxCount && (
                                        <Badge variant="outline" className="text-xs bg-purple-50">
                                          Máx: {item.validation.photoMaxCount} fotos
                                        </Badge>
                                      )}
                                      {item.validation.photoRequired && (
                                        <Badge variant="outline" className="text-xs bg-orange-50">
                                          Foto obrigatória
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-col space-y-1">
                                  {item.required && (
                                    <Badge className="bg-red-100 text-red-800 text-xs">Obrigatório</Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(item.id)}
                                data-testid={`button-remove-item-${index}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Botões de ação */}
                  <div className="flex justify-end space-x-3">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        setEditingChecklist(null);
                        resetForm();
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                      data-testid="button-save-checklist"
                    >
                      {createChecklistMutation.isPending || updateChecklistMutation.isPending 
                        ? "Salvando..." 
                        : editingChecklist ? "Atualizar" : "Criar"
                      }
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {!Array.isArray(checklists) || checklists.length === 0 ? (
          <Card className="bg-white/80 backdrop-blur-sm border-white/20">
            <CardContent className="p-12 text-center">
              <List className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Nenhum checklist criado
              </h3>
              <p className="text-slate-600 mb-6">
                Crie seu primeiro checklist para começar a padronizar as ordens de serviço.
              </p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-gradient-to-r from-green-600 to-emerald-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Checklist
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.isArray(checklists) && checklists.map((checklist: any) => (
              <Card key={checklist.id} className="bg-white/80 backdrop-blur-sm border-white/20 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{checklist.name}</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">{checklist.description}</p>
                    </div>
                    <div className="flex space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(checklist)}
                        data-testid={`button-edit-checklist-${checklist.id}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteChecklistMutation.mutate(checklist.id)}
                        data-testid={`button-delete-checklist-${checklist.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Total de itens:</span>
                      <Badge variant="outline">{Array.isArray(checklist.items) ? checklist.items.length : 0}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600">Obrigatórios:</span>
                      <Badge variant="outline" className="bg-red-50 text-red-700">
                        {Array.isArray(checklist.items) ? checklist.items.filter((item: any) => item.required).length : 0}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500">
                      Criado em: {checklist.createdAt ? new Date(checklist.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}