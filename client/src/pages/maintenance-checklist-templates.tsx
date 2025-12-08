import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ModernCard, ModernCardContent } from "@/components/ui/modern-card";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useModule } from "@/contexts/ModuleContext";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Plus, Edit3, Trash2, List, FileText, Eye, Hash, ChevronDown, Package } from "lucide-react";
import { nanoid } from "nanoid";
import type { Part } from "@shared/schema";

interface ChecklistItem {
  id: string;
  type: 'text' | 'number' | 'photo' | 'checkbox';
  label: string;
  required: boolean;
  description?: string;
  options?: string[]; // Para tipo checkbox - lista de opções
  partId?: string; // Peça associada a este item (para consumo na execução)
  validation?: {
    minLength?: number;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
    photoMinCount?: number;
    photoMaxCount?: number;
    minChecked?: number; // Mínimo de checks obrigatórios
    maxChecked?: number; // Máximo de checks permitidos
  };
}

interface MaintenanceChecklistTemplatesProps {
  customerId: string;
}

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

  const selectedLabels = options
    .filter(opt => value.includes(opt.value))
    .map(opt => opt.label)
    .join(", ");

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
            disabled={disabled}
            data-testid={dataTestId}
          >
            <span className="truncate">
              {selectedLabels || placeholder || "Selecione..."}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <div className="max-h-64 overflow-auto p-2">
            {options.length === 0 ? (
              <div className="p-2 text-sm text-muted-foreground">
                {placeholder || "Sem opções"}
              </div>
            ) : (
              <div className="space-y-1">
                {options.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2 p-2 hover:bg-accent rounded-sm cursor-pointer"
                    onClick={() => toggleOption(option.value)}
                  >
                    <Checkbox
                      checked={value.includes(option.value)}
                      onCheckedChange={() => toggleOption(option.value)}
                    />
                    <label className="flex-1 cursor-pointer text-sm">
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

export default function MaintenanceChecklistTemplates({ customerId }: MaintenanceChecklistTemplatesProps) {
  const { toast } = useToast();
  const { currentModule } = useModule();
  const [, setLocation] = useLocation();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  
  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    serviceId: "",
    siteIds: [] as string[],
    zoneIds: [] as string[],
    equipmentIds: [] as string[],
    version: "1.0",
    items: [] as ChecklistItem[]
  });

  const [newItem, setNewItem] = useState<Partial<ChecklistItem>>({
    type: 'text',
    label: "",
    required: false,
    description: "",
    options: [],
    partId: undefined,
    validation: {}
  });

  // Fetch customer data
  const { data: customer } = useQuery({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId,
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: [`/api/customers/${customerId}/maintenance-checklist-templates`, { module: currentModule }],
    enabled: !!customerId,
  });

  // Fetch sites
  const { data: sites = [] } = useQuery({
    queryKey: [`/api/customers/${customerId}/sites`, { module: currentModule }],
    enabled: !!customerId,
    refetchOnMount: true,
  });

  // Fetch services (filtrado por módulo de manutenção)
  const { data: services = [] } = useQuery({
    queryKey: [`/api/customers/${customerId}/services`, { module: currentModule }],
    enabled: !!customerId,
    refetchOnMount: true,
  });

  // Fetch zones based on selected sites
  const { data: zones = [] } = useQuery({
    queryKey: ["/api/customers", customerId, "zones", (templateForm.siteIds || []).join(","), { module: currentModule }],
    enabled: !!customerId && Array.isArray(templateForm.siteIds) && templateForm.siteIds.length > 0,
    refetchOnMount: true,
    queryFn: async () => {
      const ids = templateForm.siteIds;
      if (!ids || ids.length === 0 || !customerId) return [];
      const qs = new URLSearchParams();
      qs.set("siteIds", ids.join(","));
      qs.set("module", currentModule);
      const res = await fetch(`/api/customers/${customerId}/zones?${qs.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch zones');
      return res.json();
    },
  });

  // Fetch all equipment for displaying names in the table
  const { data: allEquipment = [] } = useQuery({
    queryKey: [`/api/customers/${customerId}/equipment`],
    enabled: !!customerId,
    refetchOnMount: true,
  });

  // Fetch parts for the customer (para seleção no checklist)
  const { data: parts = [] } = useQuery<Part[]>({
    queryKey: [`/api/customers/${customerId}/parts`, { module: 'maintenance' }],
    enabled: !!customerId,
  });

  // Fetch all zones for displaying names in the table
  const { data: allZones = [] } = useQuery({
    queryKey: [`/api/customers/${customerId}/zones`, { module: currentModule }],
    enabled: !!customerId,
    refetchOnMount: true,
  });

  // Fetch equipment for selected zones (for the form)
  const { data: equipment = [] } = useQuery({
    queryKey: ["/api/equipment", (templateForm.zoneIds || []).join(","), { module: currentModule }],
    enabled: Array.isArray(templateForm.zoneIds) && templateForm.zoneIds.length > 0,
    refetchOnMount: true,
    queryFn: async () => {
      const ids = templateForm.zoneIds;
      if (!ids || ids.length === 0) return [];
      const qs = new URLSearchParams();
      qs.set("zoneIds", ids.join(","));
      qs.set("module", currentModule);
      const res = await fetch(`/api/equipment?${qs.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch equipment');
      return res.json();
    },
  });

  // Redirect if not in maintenance module
  useEffect(() => {
    if (currentModule !== 'maintenance') {
      setLocation('/');
    }
  }, [currentModule, setLocation]);

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/maintenance-checklist-templates", data);
    },
    onSuccess: () => {
      toast({ title: "Template criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/maintenance-checklist-templates`] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ 
        title: "Erro ao criar template", 
        variant: "destructive" 
      });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/maintenance-checklist-templates/${data.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Template atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/maintenance-checklist-templates`] });
      setIsCreateDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
    },
    onError: () => {
      toast({ 
        title: "Erro ao atualizar template", 
        variant: "destructive" 
      });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/maintenance-checklist-templates/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Template excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/maintenance-checklist-templates`] });
    },
    onError: () => {
      toast({ 
        title: "Erro ao excluir template", 
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setTemplateForm({
      name: "",
      description: "",
      serviceId: "",
      siteIds: [],
      zoneIds: [],
      equipmentIds: [],
      version: "1.0",
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

  const handleAddItem = () => {
    if (!newItem.label) {
      toast({ 
        title: "Rótulo obrigatório", 
        description: "Digite um rótulo para o item", 
        variant: "destructive" 
      });
      return;
    }

    const item: ChecklistItem = {
      id: nanoid(),
      type: newItem.type || 'text',
      label: newItem.label,
      required: newItem.required || false,
      description: newItem.description,
      options: newItem.options,
      validation: newItem.validation,
      partId: newItem.partId // Incluir a peça associada ao item
    };

    setTemplateForm(prev => ({
      ...prev,
      items: [...prev.items, item]
    }));

    // Reset new item
    setNewItem({
      type: 'text',
      label: "",
      required: false,
      description: "",
      options: [],
      validation: {},
      partId: undefined
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setTemplateForm(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const handleSubmit = () => {
    const companyId = (customer as any)?.companyId;
    if (!companyId || !templateForm.name) {
      toast({ 
        title: "Preencha todos os campos obrigatórios", 
        variant: "destructive" 
      });
      return;
    }

    if (!templateForm.serviceId) {
      toast({
        title: "Serviço obrigatório",
        description: "Selecione um serviço para o checklist.",
        variant: "destructive",
      });
      return;
    }

    if (!templateForm.equipmentIds || templateForm.equipmentIds.length === 0) {
      toast({
        title: "Equipamento obrigatório",
        description: "Selecione pelo menos um equipamento para o checklist.",
        variant: "destructive",
      });
      return;
    }

    if (templateForm.items.length === 0) {
      toast({
        title: "Itens obrigatórios",
        description: "Adicione pelo menos um item ao checklist.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      companyId,
      customerId,
      name: templateForm.name,
      description: templateForm.description || null,
      siteIds: templateForm.siteIds && templateForm.siteIds.length > 0 ? templateForm.siteIds : null,
      zoneIds: templateForm.zoneIds && templateForm.zoneIds.length > 0 ? templateForm.zoneIds : null,
      equipmentIds: templateForm.equipmentIds,
      serviceId: templateForm.serviceId,
      version: templateForm.version,
      items: templateForm.items,
      module: currentModule,
    };

    if (editingTemplate) {
      updateTemplateMutation.mutate({ ...data, id: editingTemplate.id });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const handleEdit = (template: any) => {
    setEditingTemplate(template);
    setTemplateForm({
      name: template.name,
      description: template.description || "",
      serviceId: template.serviceId || "",
      siteIds: template.siteIds || [],
      zoneIds: template.zoneIds || [],
      equipmentIds: template.equipmentIds || [],
      version: template.version,
      items: template.items || []
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este template?")) {
      deleteTemplateMutation.mutate(id);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'photo': return <Eye className="w-4 h-4" />;
      case 'number': return <Hash className="w-4 h-4" />;
      case 'checkbox': return <List className="w-4 h-4" />;
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

  const getSiteName = (siteId: string | null) => {
    if (!siteId) return null;
    return (sites as any[])?.find(s => s.id === siteId)?.name || null;
  };

  const getSiteNames = (siteIds: string[]) => {
    if (!siteIds || siteIds.length === 0) return [];
    return siteIds.map(id => {
      const site = (sites as any[])?.find(s => s.id === id);
      return site ? site.name : id;
    });
  };

  const getZoneName = (zoneId: string | null) => {
    if (!zoneId) return null;
    return (zones as any[])?.find(z => z.id === zoneId)?.name || null;
  };

  const getZoneNames = (zoneIds: string[]) => {
    if (!zoneIds || zoneIds.length === 0) return [];
    return zoneIds.map(id => {
      const zone = (allZones as any[])?.find(z => z.id === id);
      return zone ? zone.name : id;
    });
  };

  const getEquipmentNames = (equipmentIds: string[]) => {
    if (!equipmentIds || equipmentIds.length === 0) return [];
    return equipmentIds.map(id => {
      const eq = (allEquipment as any[])?.find(e => e.id === id);
      return eq ? eq.name : id;
    });
  };

  const getServiceName = (serviceId: string | null) => {
    if (!serviceId) return null;
    return (services as any[])?.find(s => s.id === serviceId)?.name || null;
  };

  if (isLoading) {
    return (
      <div className="h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600">Carregando templates...</p>
        </div>
      </div>
    );
  }

  const theme = useModuleTheme();

  return (
    <div className={cn("min-h-screen", theme.gradients.page)}>
      <ModernPageHeader 
        title="Checklists de Manutenção"
        description="Gerencie os templates de checklist de manutenção"
        icon={List}
        stats={[
          {
            label: "Total de Templates",
            value: (templates as any[]).length || 0,
            icon: FileText
          }
        ]}
        actions={
          <Button 
            variant="default"
            className={cn(theme.buttons.primary)}
            style={theme.buttons.primaryStyle}
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="button-create-template"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Checklist
          </Button>
        }
      />

      <div className={cn("flex-1 overflow-y-auto p-4 md:p-6 space-y-6", theme.gradients.section)}>
        <>
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setEditingTemplate(null);
              resetForm();
            }
          }}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingTemplate ? "Editar Template" : "Criar Novo Template"}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Form básico */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Template *</Label>
                      <Input
                        id="name"
                        data-testid="input-template-name"
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Manutenção Preventiva HVAC"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="version">Versão</Label>
                      <Input
                        id="version"
                        data-testid="input-template-version"
                        value={templateForm.version}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, version: e.target.value }))}
                        placeholder="1.0"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      data-testid="input-template-description"
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição do template..."
                      rows={2}
                    />
                  </div>

                  {/* Serviço */}
                  <div className="space-y-2">
                    <Label htmlFor="service">Serviço *</Label>
                    <Select
                      value={templateForm.serviceId || ""}
                      onValueChange={(value) => setTemplateForm(prev => ({ ...prev, serviceId: value }))}
                    >
                      <SelectTrigger data-testid="select-template-service">
                        <SelectValue placeholder="Selecione um serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {(services as any[])?.map((service: any) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Vincule este template a um serviço específico
                    </p>
                  </div>

                  {/* Local e Zona */}
                  <div className="grid grid-cols-2 gap-4">
                    <MultiSelect
                      label="Local *"
                      options={(sites as any[])?.map(site => ({ value: site.id, label: site.name })) || []}
                      value={templateForm.siteIds || []}
                      onChange={(vals) => setTemplateForm(prev => ({ ...prev, siteIds: vals, zoneIds: [] }))}
                      placeholder="Selecione um ou mais locais"
                      data-testid="select-template-sites"
                    />

                    <MultiSelect
                      label="Zona *"
                      options={(zones as any[])?.map(zone => ({ value: zone.id, label: zone.name })) || []}
                      value={templateForm.zoneIds || []}
                      onChange={(vals) => setTemplateForm(prev => ({ ...prev, zoneIds: vals }))}
                      placeholder={(templateForm.siteIds?.length ?? 0) > 0 ? "Selecione uma ou mais zonas" : "Selecione ao menos um local"}
                      disabled={!(templateForm.siteIds?.length)}
                      data-testid="select-template-zones"
                    />
                  </div>

                  {/* Seleção de Equipamentos */}
                  <MultiSelect
                    label="Equipamentos *"
                    options={(equipment as any[])?.map(eq => ({ 
                      value: eq.id, 
                      label: `${eq.name}${eq.internalCode ? ` (${eq.internalCode})` : ''}` 
                    })) || []}
                    value={templateForm.equipmentIds || []}
                    onChange={(val) => setTemplateForm(prev => ({ ...prev, equipmentIds: val }))}
                    placeholder={
                      equipment.length === 0 
                        ? (templateForm.zoneIds?.length > 0 ? "Nenhum equipamento nas zonas selecionadas" : "Selecione zonas primeiro")
                        : "Selecione um ou mais equipamentos"
                    }
                    disabled={!equipment.length}
                    data-testid="select-template-equipment"
                  />

                  {/* Adicionar item */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Adicionar Item ao Checklist</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Tipo</Label>
                          <Select 
                            value={newItem.type} 
                            onValueChange={(value) => setNewItem(prev => ({ 
                              ...prev, 
                              type: value as ChecklistItem['type'],
                              options: [],
                              validation: {}
                            }))}
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

                      {/* Campo de Peça Associada */}
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Package className="w-4 h-4" style={{ color: 'var(--module-primary)' }} />
                          Peça Associada (consumo na execução)
                        </Label>
                        <Select 
                          value={newItem.partId || "none"} 
                          onValueChange={(value) => setNewItem(prev => ({ 
                            ...prev, 
                            partId: value === "none" ? undefined : value
                          }))}
                        >
                          <SelectTrigger data-testid="select-item-part">
                            <SelectValue placeholder="Selecione uma peça (opcional)" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma peça</SelectItem>
                            {(parts as Part[]).map((part) => (
                              <SelectItem key={part.id} value={part.id}>
                                <span className="flex items-center gap-2">
                                  <span>{part.name}</span>
                                  {part.partNumber && (
                                    <span className="text-xs text-muted-foreground">({part.partNumber})</span>
                                  )}
                                  <span className="text-xs" style={{ color: parseFloat(part.currentQuantity) <= parseFloat(part.minimumQuantity) ? 'red' : 'green' }}>
                                    Estoque: {part.currentQuantity} {part.unit}
                                  </span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Se selecionada, esta peça será sugerida para consumo quando este item for executado na O.S.
                        </p>
                      </div>

                      {/* Configurações avançadas */}
                      {newItem.type && (
                        <Card className="bg-slate-50">
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
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setNewItem(prev => ({
                                          ...prev,
                                          options: [...(prev.options || []), '']
                                        }));
                                      }}
                                      className="h-8 w-full"
                                      data-testid="button-add-checkbox-option"
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
                                      data-testid="input-min-checked"
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
                                      data-testid="input-max-checked"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Campo obrigatório */}
                            <div className="flex items-center space-x-2 pt-2">
                              <Switch
                                id="required"
                                checked={newItem.required}
                                onCheckedChange={(checked) => setNewItem(prev => ({ ...prev, required: checked }))}
                              />
                              <Label htmlFor="required" className="text-sm cursor-pointer">
                                Campo obrigatório
                              </Label>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      <Button 
                        onClick={handleAddItem} 
                        className={cn("w-full", theme.buttons.primary)}
                        style={theme.buttons.primaryStyle}
                        data-testid="button-add-item"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Adicionar Item
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Lista de itens adicionados */}
                  {templateForm.items.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Itens do Checklist ({templateForm.items.length})</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {templateForm.items.map((item, index) => (
                            <div 
                              key={item.id} 
                              className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100"
                              data-testid={`item-${item.id}`}
                            >
                              <div className="flex items-center space-x-3 flex-1">
                                <span className="text-sm font-medium text-slate-500 w-8">
                                  {index + 1}.
                                </span>
                                <div className="flex items-center space-x-2">
                                  {getTypeIcon(item.type)}
                                  <Badge variant="outline" className="text-xs">
                                    {getTypeLabel(item.type)}
                                  </Badge>
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-sm">{item.label}</div>
                                  {item.description && (
                                    <div className="text-xs text-slate-500">{item.description}</div>
                                  )}
                                </div>
                                {item.required && (
                                  <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(item.id)}
                                data-testid={`button-remove-item-${item.id}`}
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        setEditingTemplate(null);
                        resetForm();
                      }}
                      data-testid="button-cancel"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleSubmit}
                      disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
                      className={cn(theme.buttons.primary)}
                      style={theme.buttons.primaryStyle}
                      data-testid="button-save-template"
                    >
                      {editingTemplate ? "Atualizar" : "Criar"} Template
                    </Button>
                  </div>
                </div>
            </DialogContent>
          </Dialog>

          {/* Content */}
        {!templates || (templates as any[]).length === 0 ? (
          <ModernCard variant="glass">
            <ModernCardContent className="p-12 text-center">
              <List className={cn("w-16 h-16 mx-auto mb-4", theme.text.primary)} />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">
                Nenhum template cadastrado
              </h3>
              <p className="text-slate-600 mb-6">
                Crie seu primeiro template de checklist de manutenção
              </p>
              <Button 
                variant="default"
                onClick={() => setIsCreateDialogOpen(true)}
                className={cn(theme.buttons.primary)}
                style={theme.buttons.primaryStyle}
              >
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Checklist
              </Button>
            </ModernCardContent>
          </ModernCard>
        ) : (
          <Card>
          <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Aplicado a</TableHead>
                    <TableHead>Versão</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(templates as any[]).map((template) => (
                    <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell>
                        {template.serviceId ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            {getServiceName(template.serviceId)}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {template.siteIds && template.siteIds.length > 0 ? (
                            getSiteNames(template.siteIds).map((name: string, idx: number) => (
                              <Badge key={template.siteIds[idx]} variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {template.zoneIds && template.zoneIds.length > 0 ? (
                            getZoneNames(template.zoneIds).map((name: string, idx: number) => (
                              <Badge 
                                key={template.zoneIds[idx]} 
                                variant="outline"
                                style={{
                                  backgroundColor: 'color-mix(in srgb, var(--module-primary) 10%, white)',
                                  color: 'var(--module-primary)',
                                  borderColor: 'color-mix(in srgb, var(--module-primary) 30%, white)'
                                }}
                              >
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {template.equipmentIds && template.equipmentIds.length > 0 ? (
                            getEquipmentNames(template.equipmentIds).map((name: string, idx: number) => (
                              <Badge key={template.equipmentIds[idx]} variant="default" className="text-xs bg-purple-600">
                                {name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs">Todos equipamentos</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{template.version}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge>{(template.items || []).length}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                            data-testid={`button-edit-${template.id}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(template.id)}
                            data-testid={`button-delete-${template.id}`}
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
        </>
      </div>
    </div>
  );
}
