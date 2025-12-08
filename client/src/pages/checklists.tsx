import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModernCard, ModernCardContent, ModernCardHeader } from "@/components/ui/modern-card";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useClient } from "@/contexts/ClientContext";
import { useModule } from "@/contexts/ModuleContext";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Plus, Edit3, Trash2, FileText, List, Eye, ChevronDown, Hash } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChecklistTemplate } from "@shared/schema";

function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  "data-testid": dataTestId,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  "data-testid"?: string;
}) {
  const [open, setOpen] = useState(false);
  
  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter(v => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const selectAll = () => {
    onChange(options.map(opt => opt.value));
  };

  const deselectAll = () => {
    onChange([]);
  };

  const selectedLabels = options
    .filter(opt => value.includes(opt.value))
    .map(opt => opt.label)
    .join(", ");

  const allSelected = options.length > 0 && value.length === options.length;
  const someSelected = value.length > 0 && value.length < options.length;

  return (
    <div className="space-y-2">
      <Label className="text-slate-700 font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen} modal={true}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-white hover:bg-slate-50 border-slate-300 text-slate-900"
            disabled={disabled}
            data-testid={dataTestId}
          >
            <span className="truncate text-left">
              {selectedLabels || <span className="text-slate-500">{placeholder || "Selecione..."}</span>}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-white border border-slate-200 shadow-lg z-[100]" align="start" sideOffset={4}>
          <div className="max-h-72 overflow-auto p-2">
            {options.length === 0 ? (
              <div className="p-2 text-sm text-slate-500">
                {placeholder || "Sem opções"}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center space-x-2 p-2 border-b border-slate-200 mb-1">
                  <Checkbox
                    id={`checkbox-select-all`}
                    checked={allSelected || someSelected}
                    onCheckedChange={() => {
                      if (allSelected) {
                        deselectAll();
                      } else {
                        selectAll();
                      }
                    }}
                    className="border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                  />
                  <label 
                    htmlFor={`checkbox-select-all`}
                    className="flex-1 cursor-pointer text-sm font-medium text-slate-700 select-none"
                  >
                    Selecionar Todas
                  </label>
                </div>
                {options.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded-sm transition-colors"
                  >
                    <Checkbox
                      id={`checkbox-${option.value}`}
                      checked={value.includes(option.value)}
                      onCheckedChange={() => toggleOption(option.value)}
                      className="border-slate-300 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <label 
                      htmlFor={`checkbox-${option.value}`}
                      className="flex-1 cursor-pointer text-sm text-slate-700 select-none"
                    >
                      {option.label}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <div className="text-xs text-slate-500">
        {value?.length ? `${value.length} selecionado(s)` : "Nenhum selecionado"}
      </div>
    </div>
  );
}


interface ChecklistItem {
  id: string;
  type: 'text' | 'number' | 'photo' | 'checkbox';
  label: string;
  required: boolean;
  description?: string;
  options?: string[]; // Para tipo checkbox - lista de opções
  validation?: {
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    photoRequired?: boolean;
    photoMinCount?: number;
    photoMaxCount?: number;
    minChecked?: number; // Mínimo de checks obrigatórios
    maxChecked?: number; // Máximo de checks permitidos
  };
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
  const { currentModule } = useModule();
  const [, setLocation] = useLocation();

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
    options: [],
    validation: {}
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: checklists = [], isLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ["/api/customers", activeClientId, "checklist-templates", { module: currentModule }],
    enabled: !!activeClientId && !!currentModule,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["/api/customers", activeClientId, "sites", { module: currentModule }],
    enabled: !!activeClientId,
  });

  const { data: services = [] } = useQuery({
    queryKey: ["/api/customers", activeClientId, "services", { module: currentModule }],
    enabled: !!activeClientId && !!currentModule,
  });

  // Buscar zonas quando um site é selecionado
  const { data: zones = [] } = useQuery({
    queryKey: ["/api/customers", activeClientId, "zones", (checklistForm.siteIds || []).join(","), { module: currentModule }],
    enabled: !!activeClientId && Array.isArray(checklistForm.siteIds) && checklistForm.siteIds.length > 0,
    queryFn: async () => {
      const ids = checklistForm.siteIds;
      if (!ids?.length || !activeClientId) return [];
      
      if (ids.length === 1) {
        const qs = new URLSearchParams();
        qs.set("module", currentModule);
        const r = await fetch(`/api/sites/${ids[0]}/zones?${qs.toString()}`);
        if (!r.ok) throw new Error("Falha ao carregar zonas");
        return r.json();
      }
      
      // Use the secure endpoint with customer validation
      const qs = new URLSearchParams();
      qs.set("siteIds", ids.join(","));
      qs.set("module", currentModule);
      const r = await fetch(`/api/customers/${activeClientId}/zones?${qs.toString()}`);
      if (!r.ok) throw new Error("Falha ao carregar zonas");
      return r.json();
    }
  });

  // Fetch all zones for displaying names in the table
  const { data: allZones = [] } = useQuery({
    queryKey: [`/api/customers/${activeClientId}/zones`, { module: currentModule }],
    enabled: !!activeClientId,
    refetchOnMount: true,
  });

  // Redirect if not in clean module
  useEffect(() => {
    if (currentModule !== 'clean') {
      setLocation('/');
    }
  }, [currentModule, setLocation]);

  const createChecklistMutation = useMutation({
    mutationFn: async (data: typeof checklistForm) => {
      const response = await apiRequest("POST", `/api/customers/${activeClientId}/checklist-templates`, data);
      return response.json();
    },
    onSuccess: (result: any) => {
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
      const response = await apiRequest("DELETE", `/api/customers/${activeClientId}/checklist-templates/${checklistId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete checklist");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "checklist-templates"] });
      toast({
        title: "Checklist excluído",
        description: "O checklist foi excluído com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir checklist",
        description: error.message || "Houve um problema ao excluir o checklist.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setChecklistForm({
      name: "",
      description: "",
      siteIds: [],
      zoneIds: [],
      serviceId: "",
      items: []
    });
    setNewItem({
      type: 'text',
      label: "",
      required: false,
      description: "",
      options: [],
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
      options: newItem.options || [],
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
      options: [],
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
    
    // Filtrar apenas sites e zonas válidos do cliente atual
    const allSiteIds = checklist.siteIds || (checklist.siteId ? [String(checklist.siteId)] : []);
    const validSiteIds = allSiteIds.filter((id: string) => 
      (sites as any[])?.some(s => s.id === id)
    );
    
    const allZoneIds = checklist.zoneIds || (checklist.zoneId ? [String(checklist.zoneId)] : []);
    const validZoneIds = allZoneIds.filter((id: string) => 
      (allZones as any[])?.some(z => z.id === id)
    );
    
    setChecklistForm({
      name: checklist.name,
      description: checklist.description,
      siteIds: validSiteIds,
      zoneIds: validZoneIds,
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

    if (!checklistForm.siteIds?.length) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione um local para o checklist.",
        variant: "destructive",
      });
      return;
    }

    if (!checklistForm.zoneIds?.length) {
      toast({
        title: "Campo obrigatório",
        description: "Selecione uma zona para o checklist.",
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
      case 'checkbox': return 'Checkbox';
      default: return 'Texto';
    }
  };

  // Helper functions to get names for table display
  const getSiteNames = (siteIds: string[]) => {
    if (!siteIds || siteIds.length === 0) return [];
    return siteIds
      .map(id => {
        const site = (sites as any[])?.find(s => s.id === id);
        return site ? site.name : null;
      })
      .filter(Boolean); // Remove sites inválidos (de outros clientes)
  };

  const getZoneNames = (zoneIds: string[]) => {
    if (!zoneIds || zoneIds.length === 0) return [];
    return zoneIds
      .map(id => {
        const zone = (allZones as any[])?.find(z => z.id === id);
        return zone ? zone.name : null;
      })
      .filter(Boolean); // Remove zonas inválidas (de outros clientes)
  };

  const getServiceName = (serviceId: string | null) => {
    if (!serviceId) return null;
    return (services as any[])?.find(s => s.id === serviceId)?.name || null;
  };

  const theme = useModuleTheme();

  if (isLoading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600">Carregando checklists...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen", theme.gradients.page)}>
      <ModernPageHeader 
        title={currentModule === 'maintenance' ? 'Checklists de Manutenção' : 'Checklists'}
        description={currentModule === 'maintenance' 
          ? 'Gerencie os templates de checklist de manutenção' 
          : 'Gerencie checklists para padronizar ordens de serviço'
        }
        icon={List}
        stats={[
          {
            label: "Total de Checklists",
            value: Array.isArray(checklists) ? checklists.length : 0,
            icon: FileText
          }
        ]}
        actions={
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            className={cn(theme.buttons.primary)}
            style={theme.buttons.primaryStyle}
            data-testid="button-create-checklist"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Checklist
          </Button>
        }
      />
      
      {/* Dialog */}
      <div className={cn("flex-1 overflow-y-auto p-4 space-y-3", theme.gradients.section)}>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setEditingChecklist(null);
            resetForm();
          }
        }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingChecklist ? "Editar Checklist" : "Criar Novo Checklist"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
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
                      <MultiSelect
  label="Local *"
  options={(sites as any[] || []).map((s: any) => ({ value: String(s.id), label: s.name }))}
  value={checklistForm.siteIds || []}
  onChange={(vals) => setChecklistForm(prev => ({ ...prev, siteIds: vals, zoneIds: [] }))}
  placeholder="Selecione um ou mais locais"
  data-testid="multiselect-checklist-sites"
/>
                    </div>
                    <div className="space-y-2">
                      <MultiSelect
  label="Zona *"
  options={(zones as any[] || []).map((z: any) => ({ value: String(z.id), label: z.name }))}
  value={checklistForm.zoneIds || []}
  onChange={(vals) => setChecklistForm(prev => ({ ...prev, zoneIds: vals }))}
  placeholder={(checklistForm.siteIds?.length ?? 0) > 0 ? "Selecione uma ou mais zonas" : "Selecione ao menos um local"}
  disabled={!(checklistForm.siteIds?.length)}
  data-testid="multiselect-checklist-zones"
/>
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
                              <SelectItem value="checkbox">Checkbox</SelectItem>
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

                            {/* Configurações para Checkbox */}
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
                                        />
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            const newOptions = (newItem.options || []).filter((_, i) => i !== index);
                                            setNewItem(prev => ({ ...prev, options: newOptions }));
                                          }}
                                          className="h-8"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    ))}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setNewItem(prev => ({
                                          ...prev,
                                          options: [...(prev.options || []), '']
                                        }));
                                      }}
                                      className="h-8 w-full"
                                    >
                                      <Plus className="w-3 h-3 mr-2" /> Adicionar Opção
                                    </Button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Mínimo de checks</Label>
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
                                  <div className="space-y-1">
                                    <Label className="text-xs">Máximo de checks</Label>
                                    <Input
                                      type="number"
                                      placeholder="Ex: 3"
                                      value={newItem.validation?.maxChecked || ""}
                                      onChange={(e) => setNewItem(prev => ({
                                        ...prev,
                                        validation: {
                                          ...prev.validation,
                                          maxChecked: e.target.value ? parseInt(e.target.value) : undefined
                                        }
                                      }))}
                                      className="h-8 text-xs"
                                    />
                                  </div>
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
                                  {/* Mostrar opções do checkbox */}
                                  {item.type === 'checkbox' && item.options && item.options.length > 0 && (
                                    <div className="mt-2">
                                      <p className="text-xs text-slate-500 mb-1">Opções:</p>
                                      <div className="flex flex-wrap gap-1">
                                        {item.options.map((option, optIndex) => (
                                          <Badge key={optIndex} variant="secondary" className="text-xs">
                                            {option}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
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
                                      {item.validation.minChecked && (
                                        <Badge variant="outline" className="text-xs bg-indigo-50">
                                          Mín: {item.validation.minChecked} checks
                                        </Badge>
                                      )}
                                      {item.validation.maxChecked && (
                                        <Badge variant="outline" className="text-xs bg-indigo-50">
                                          Máx: {item.validation.maxChecked} checks
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
                      variant="default"
                      onClick={handleSubmit}
                      disabled={createChecklistMutation.isPending || updateChecklistMutation.isPending}
                      data-testid="button-save-checklist"
                      className={theme.buttons.primary}
                      style={theme.buttons.primaryStyle}
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

        {/* Statistics Card */}
        <ModernCard variant="gradient" className="mb-6">
          <ModernCardContent className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-4">
              <div className={cn("p-3 rounded-lg", theme.backgrounds.light)}>
                <FileText className={cn("w-6 h-6", theme.text.primary)} />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Total de Templates</p>
                <p className={cn("text-3xl font-bold", theme.text.primary)}>
                  {Array.isArray(checklists) ? checklists.length : 0}
                </p>
              </div>
            </div>
          </ModernCardContent>
        </ModernCard>

        {/* Content */}
        {!Array.isArray(checklists) || checklists.length === 0 ? (
          <ModernCard variant="glass">
            <ModernCardContent className="p-12 text-center">
              <List className={cn("w-16 h-16 mx-auto mb-4", theme.text.primary)} />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Nenhum template cadastrado
              </h3>
              <p className="text-slate-600 mb-6">
                Crie seu primeiro checklist para padronizar ordens de serviço
              </p>
              <Button 
                onClick={() => setIsCreateDialogOpen(true)}
                className={cn(theme.buttons.primary)}
                style={theme.buttons.primaryStyle}
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeira Checklist
              </Button>
            </ModernCardContent>
          </ModernCard>
        ) : (
          <Card>
            <CardContent className="p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(checklists) && checklists.map((checklist: any) => (
                    <TableRow key={checklist.id} data-testid={`row-checklist-${checklist.id}`}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold">{checklist.name}</p>
                          {checklist.description && (
                            <p className="text-xs text-slate-500 mt-1">{checklist.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {checklist.serviceId ? (
                          <Badge variant="outline" className="bg-cyan-50 text-cyan-700 border-cyan-200">
                            {getServiceName(checklist.serviceId) || 'N/A'}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const siteIds = checklist.siteIds || (checklist.siteId ? [checklist.siteId] : []);
                          if (siteIds.length === 0) return <span className="text-slate-400 text-xs">-</span>;
                          
                          const siteNames = getSiteNames(siteIds);
                          const displayNames = siteNames.slice(0, 2);
                          const remainingCount = siteNames.length - 2;
                          
                          return (
                            <div className="flex items-center gap-1 flex-wrap">
                              {displayNames.map((siteName, idx) => (
                                <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  {siteName}
                                </Badge>
                              ))}
                              {remainingCount > 0 && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-medium">
                                  +{remainingCount}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const zoneIds = checklist.zoneIds || (checklist.zoneId ? [checklist.zoneId] : []);
                          if (zoneIds.length === 0) return <span className="text-slate-400 text-xs">-</span>;
                          
                          // Use IDs únicos, não nomes (que podem duplicar)
                          const uniqueZoneIds = Array.from(new Set(zoneIds)) as string[];
                          const totalZones = uniqueZoneIds.length;
                          const displayIds = uniqueZoneIds.slice(0, 2);
                          const remainingCount = totalZones - 2;
                          
                          return (
                            <div className="flex items-center gap-1 flex-wrap">
                              {displayIds.map((zoneId) => {
                                const zone = (allZones as any[])?.find(z => z.id === zoneId);
                                const zoneName = zone?.name || 'N/A';
                                return (
                                  <Badge key={zoneId} variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">
                                    {zoneName}
                                  </Badge>
                                );
                              })}
                              {remainingCount > 0 && (
                                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 font-medium">
                                  +{remainingCount}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("font-semibold", theme.backgrounds.primary, "text-white")}>
                          {checklist.items && Array.isArray(checklist.items) ? checklist.items.length : 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}