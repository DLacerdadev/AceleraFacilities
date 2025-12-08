import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { X, Save, Calendar, Timer, MapPin, User, Settings, AlertCircle, CheckSquare, Package, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SelectedPart {
  partId: string;
  partName: string;
  quantity: number;
  available: number;
  unit: string;
}

interface CreateWorkOrderModalProps {
  customerId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateWorkOrderModal({ customerId, onClose, onSuccess }: CreateWorkOrderModalProps) {
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "corretiva_interna",
    priority: "media",
    siteId: "", // Local (Site)
    zoneId: "", // Zona
    assignedUserId: "unassigned",
    // Campos específicos do Clean
    serviceId: "",
    checklistTemplateId: "",
    // Campos específicos do Manutenção
    equipmentId: "",
    maintenanceChecklistTemplateId: "",
    // Datas
    scheduledDate: "",
    dueDate: "",
    // Campos opcionais de horário
    startTime: "",
    endTime: ""
  });
  
  // Estado para peças selecionadas (Manutenção)
  const [selectedParts, setSelectedParts] = useState<SelectedPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [partQuantity, setPartQuantity] = useState<string>("1");
  
  const { toast } = useToast();

  const { data: sites } = useQuery({
    queryKey: ["/api/customers", customerId, "sites", { module: currentModule }],
    enabled: !!customerId,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/customers", customerId, "users"],
    enabled: !!customerId,
  });

  // Serviços para módulo Clean
  const { data: services } = useQuery({
    queryKey: ["/api/customers", customerId, "services", { module: currentModule }],
    enabled: !!customerId && currentModule === 'clean',
  });

  // Equipamentos para módulo Manutenção
  const { data: equipmentList } = useQuery({
    queryKey: ["/api/customers", customerId, "equipment"],
    enabled: !!customerId && currentModule === 'maintenance',
  });

  // Templates de checklist de manutenção
  const { data: maintenanceChecklistTemplates } = useQuery({
    queryKey: ["/api/customers", customerId, "maintenance-checklist-templates"],
    enabled: !!customerId && currentModule === 'maintenance',
  });

  // Peças disponíveis para módulo Manutenção
  const { data: availableParts } = useQuery({
    queryKey: ["/api/customers", customerId, "parts"],
    enabled: !!customerId && currentModule === 'maintenance',
  });

  // Templates de checklist de limpeza (Clean)
  const { data: cleanChecklistTemplates } = useQuery({
    queryKey: ["/api/customers", customerId, "checklist-templates"],
    enabled: !!customerId && currentModule === 'clean',
  });

  // Buscar dados do customer para pegar o companyId
  const { data: customer } = useQuery({
    queryKey: ["/api/customers", customerId],
    enabled: !!customerId,
  });

  // Carregar zones filtradas pelo site selecionado (usado por ambos módulos)
  const { data: zonesForSite } = useQuery({
    queryKey: ["/api/sites", formData.siteId, "zones", { module: currentModule }],
    enabled: !!formData.siteId,
  });

  // Filtrar equipamentos pela zona selecionada (Manutenção)
  const filteredEquipment = (equipmentList as any[] || []).filter((eq: any) => 
    formData.zoneId ? eq.zoneId === formData.zoneId : true
  );

  // Filtrar checklists de manutenção pelo equipamento selecionado
  const filteredMaintenanceChecklists = (maintenanceChecklistTemplates as any[] || []).filter((template: any) => {
    if (!formData.equipmentId) return true;
    // Checklist deve ter o equipmentId no array de equipmentIds
    return template.equipmentIds && Array.isArray(template.equipmentIds) && 
           template.equipmentIds.includes(formData.equipmentId);
  });

  // Filtrar checklists de limpeza pelo serviço selecionado (Clean)
  const filteredCleanChecklists = (cleanChecklistTemplates as any[] || []).filter((template: any) => {
    if (!formData.serviceId) return true;
    // Checklist deve ter o serviceId (relação 1:1)
    return template.serviceId === formData.serviceId;
  });

  // Filtrar peças ativas com estoque disponível
  const activeParts = (availableParts as any[] || []).filter((part: any) => 
    part.isActive && parseFloat(part.currentQuantity) > 0
  );

  // Funções para gerenciar peças selecionadas
  const handleAddPart = () => {
    if (!selectedPartId) {
      toast({ title: "Selecione uma peça", variant: "destructive" });
      return;
    }
    
    const quantity = parseFloat(partQuantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast({ title: "Informe uma quantidade válida", variant: "destructive" });
      return;
    }

    const part = (availableParts as any[]).find((p: any) => p.id === selectedPartId);
    if (!part) return;

    const available = parseFloat(part.currentQuantity);
    const alreadySelected = selectedParts.find(p => p.partId === selectedPartId);
    const alreadyUsed = alreadySelected ? alreadySelected.quantity : 0;
    
    if (quantity + alreadyUsed > available) {
      toast({ 
        title: "Estoque insuficiente", 
        description: `Disponível: ${available} ${part.unit}. Já selecionado: ${alreadyUsed} ${part.unit}.`,
        variant: "destructive" 
      });
      return;
    }

    if (alreadySelected) {
      setSelectedParts(prev => prev.map(p => 
        p.partId === selectedPartId 
          ? { ...p, quantity: p.quantity + quantity }
          : p
      ));
    } else {
      setSelectedParts(prev => [...prev, {
        partId: part.id,
        partName: part.name,
        quantity,
        available,
        unit: part.unit || 'un'
      }]);
    }

    setSelectedPartId("");
    setPartQuantity("1");
  };

  const handleRemovePart = (partId: string) => {
    setSelectedParts(prev => prev.filter(p => p.partId !== partId));
  };

  const handleUpdatePartQuantity = (partId: string, newQuantity: number) => {
    const part = selectedParts.find(p => p.partId === partId);
    if (!part) return;

    if (newQuantity <= 0) {
      handleRemovePart(partId);
      return;
    }

    if (newQuantity > part.available) {
      toast({ 
        title: "Estoque insuficiente", 
        description: `Disponível: ${part.available} ${part.unit}`,
        variant: "destructive" 
      });
      return;
    }

    setSelectedParts(prev => prev.map(p => 
      p.partId === partId ? { ...p, quantity: newQuantity } : p
    ));
  };

  const createWorkOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      // Preparar dados para envio - converter strings de data para Date objects ou null
      const submitData: any = {
        title: data.title,
        description: data.description || null,
        type: data.type,
        priority: data.priority,
        status: "aberta",
        zoneId: data.zoneId,
        companyId: (customer as any)?.companyId || "company-opus-default",
        assignedUserId: data.assignedUserId === "unassigned" ? null : data.assignedUserId,
        scheduledDate: data.scheduledDate ? new Date(data.scheduledDate + 'T00:00:00').toISOString() : null,
        dueDate: data.dueDate ? new Date(data.dueDate + 'T00:00:00').toISOString() : null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        module: currentModule, // Incluir o módulo atual
      };

      // Campos específicos do módulo Clean
      if (currentModule === 'clean') {
        submitData.serviceId = data.serviceId || null;
        submitData.checklistTemplateId = data.checklistTemplateId || null;
      }

      // Campos específicos do módulo Manutenção
      if (currentModule === 'maintenance') {
        submitData.equipmentId = data.equipmentId || null;
        submitData.maintenanceChecklistTemplateId = data.maintenanceChecklistTemplateId || null;
      }
      
      // Calcular scheduledStartAt e scheduledEndAt se tiver horários
      if (data.scheduledDate && data.startTime) {
        const baseDate = new Date(data.scheduledDate + 'T00:00:00');
        const [hours, minutes] = data.startTime.split(':');
        baseDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        submitData.scheduledStartAt = baseDate.toISOString();
      }
      
      if (data.scheduledDate && data.endTime) {
        const endDate = new Date(data.scheduledDate + 'T00:00:00');
        const [hours, minutes] = data.endTime.split(':');
        endDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        submitData.scheduledEndAt = endDate.toISOString();
      }
      
      // Criar a O.S.
      const response = await apiRequest("POST", "/api/work-orders", submitData);
      const workOrder = await response.json();
      
      // Se tiver peças selecionadas, criar as work_order_parts
      if (data.selectedParts && data.selectedParts.length > 0) {
        const workOrderId = workOrder.id;
        
        for (const part of data.selectedParts) {
          await apiRequest("POST", `/api/work-orders/${workOrderId}/parts`, {
            partId: part.partId,
            quantityPlanned: String(part.quantity),
          });
        }
      }
      
      return workOrder;
    },
    onSuccess: () => {
      toast({ title: "Ordem de serviço criada com sucesso!" });
      // Invalidar cache de peças para refletir estoque
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "parts"] });
      onSuccess();
    },
    onError: (error: any) => {
      let errorMessage = "Erro ao criar ordem de serviço";
      let errorDetails = "Verifique se todos os campos obrigatórios foram preenchidos corretamente.";
      
      // Tentar extrair mensagem do erro
      if (error?.message) {
        // Se a mensagem for um JSON string, fazer parse
        if (error.message.startsWith('{')) {
          try {
            const parsed = JSON.parse(error.message);
            errorMessage = parsed.message || errorMessage;
            errorDetails = parsed.details || errorDetails;
          } catch (e) {
            errorMessage = error.message;
          }
        } else {
          errorMessage = error.message;
        }
      }
      
      // Se já tiver details separado, usar ele
      if (error?.details) {
        errorDetails = error.details;
      }
      
      toast({ 
        title: errorMessage,
        description: errorDetails,
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação básica
    if (!formData.title || !formData.zoneId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título e selecione um local",
        variant: "destructive"
      });
      return;
    }

    // Validação específica por módulo
    if (currentModule === 'clean') {
      if (!formData.siteId) {
        toast({
          title: "Campos obrigatórios",
          description: "Selecione um local",
          variant: "destructive"
        });
        return;
      }
      if (!formData.serviceId) {
        toast({
          title: "Campos obrigatórios",
          description: "Selecione um serviço",
          variant: "destructive"
        });
        return;
      }
      if (!formData.checklistTemplateId) {
        toast({
          title: "Campos obrigatórios",
          description: "Selecione um checklist",
          variant: "destructive"
        });
        return;
      }
    }

    if (currentModule === 'maintenance') {
      if (!formData.siteId) {
        toast({
          title: "Campos obrigatórios",
          description: "Selecione um local",
          variant: "destructive"
        });
        return;
      }
      if (!formData.equipmentId) {
        toast({
          title: "Campos obrigatórios",
          description: "Selecione um equipamento",
          variant: "destructive"
        });
        return;
      }
      if (!formData.maintenanceChecklistTemplateId) {
        toast({
          title: "Campos obrigatórios",
          description: "Selecione um checklist de manutenção",
          variant: "destructive"
        });
        return;
      }
    }

    // Criar cópia sem o siteId (que é apenas para controle do frontend)
    const { siteId, ...submitData } = formData;
    // Incluir peças selecionadas (se houver)
    createWorkOrderMutation.mutate({ ...submitData, selectedParts });
  };

  const handleChange = (field: string, value: string) => {
    // MÓDULO CLEAN
    if (currentModule === 'clean') {
      // Se mudar o site, resetar zona, serviço e checklist
      if (field === 'siteId') {
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          zoneId: "",
          serviceId: "",
          checklistTemplateId: ""
        }));
        return;
      }
      
      // Se mudar a zona, resetar serviço e checklist
      if (field === 'zoneId') {
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          serviceId: "",
          checklistTemplateId: ""
        }));
        return;
      }
      
      // Se mudar o serviço, resetar checklist
      if (field === 'serviceId') {
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          checklistTemplateId: ""
        }));
        return;
      }
    }
    
    // MÓDULO MANUTENÇÃO
    if (currentModule === 'maintenance') {
      // Se mudar o site, resetar zona, equipamento e checklist
      if (field === 'siteId') {
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          zoneId: "",
          equipmentId: "",
          maintenanceChecklistTemplateId: ""
        }));
        return;
      }
      
      // Se mudar a zona, resetar equipamento e checklist
      if (field === 'zoneId') {
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          equipmentId: "",
          maintenanceChecklistTemplateId: ""
        }));
        return;
      }
      
      // Se mudar o equipamento, resetar checklist
      if (field === 'equipmentId') {
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          maintenanceChecklistTemplateId: ""
        }));
        return;
      }
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="create-work-order-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Nova Ordem de Serviço</DialogTitle>
          <DialogDescription>
            Preencha as informações para criar uma nova ordem de serviço
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Informações Básicas */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Informações Básicas
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Limpeza do banheiro masculino"
                  value={formData.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  data-testid="input-title"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Tipo de OS</Label>
                <Select value={formData.type} onValueChange={(value) => handleChange("type", value)}>
                  <SelectTrigger data-testid="select-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="programada">Programada</SelectItem>
                    <SelectItem value="corretiva_interna">Corretiva Interna</SelectItem>
                    <SelectItem value="corretiva_publica">Corretiva Pública</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select value={formData.priority} onValueChange={(value) => handleChange("priority", value)}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned">Responsável</Label>
                <Select value={formData.assignedUserId} onValueChange={(value) => handleChange("assignedUserId", value)}>
                  <SelectTrigger data-testid="select-assigned-user">
                    <SelectValue placeholder="Selecione um responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Não atribuído</SelectItem>
                    {(users as any[] || [])
                      .filter((user: any) => user.role === "operador" || user.role === "supervisor_site")
                      .map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            {user.name}
                          </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva detalhes sobre a ordem de serviço..."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                data-testid="textarea-description"
                rows={3}
              />
            </div>
          </div>

          {/* Local e Campos Específicos do Módulo */}
          <div className={`space-y-4 p-4 rounded-lg border ${
            currentModule === 'maintenance' ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'
          }`}>
            <h4 className={`font-semibold flex items-center gap-2 ${
              currentModule === 'maintenance' ? 'text-orange-900' : 'text-green-900'
            }`}>
              <MapPin className="w-4 h-4" />
              {currentModule === 'maintenance' ? 'Local e Equipamento' : 'Local e Serviços'}
            </h4>
            
            {/* Módulo CLEAN */}
            {currentModule === 'clean' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site">Local *</Label>
                  <Select value={formData.siteId} onValueChange={(value) => handleChange("siteId", value)}>
                    <SelectTrigger data-testid="select-site">
                      <SelectValue placeholder="Selecione um local" />
                    </SelectTrigger>
                    <SelectContent>
                      {!sites ? (
                        <SelectItem value="loading" disabled>Carregando locais...</SelectItem>
                      ) : Array.isArray(sites) && sites.length > 0 ? (
                        (sites as any[]).map((site: any) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-sites" disabled>Nenhum local cadastrado</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zone">Zona *</Label>
                  <Select 
                    value={formData.zoneId} 
                    onValueChange={(value) => handleChange("zoneId", value)}
                    disabled={!formData.siteId}
                  >
                    <SelectTrigger data-testid="select-zone">
                      <SelectValue placeholder={!formData.siteId ? "Primeiro selecione um local" : "Selecione uma zona"} />
                    </SelectTrigger>
                    <SelectContent>
                      {!zonesForSite ? (
                        <SelectItem value="loading" disabled>Carregando zonas...</SelectItem>
                      ) : Array.isArray(zonesForSite) && zonesForSite.length > 0 ? (
                        (zonesForSite as any[]).map((zone: any) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </SelectItem>
                        ))
                      ) : formData.siteId ? (
                        <SelectItem value="no-zones" disabled>Nenhuma zona neste local</SelectItem>
                      ) : (
                        <SelectItem value="select-site" disabled>Selecione um local primeiro</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formData.siteId && (!zonesForSite || (zonesForSite as any[]).length === 0) && (
                    <p className="text-xs text-green-600">Não há zonas cadastradas neste local</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="service">Serviço *</Label>
                  <Select 
                    value={formData.serviceId} 
                    onValueChange={(value) => handleChange("serviceId", value)}
                    disabled={!formData.zoneId}
                  >
                    <SelectTrigger data-testid="select-service">
                      <SelectValue placeholder={!formData.zoneId ? "Primeiro selecione uma zona" : "Selecione um serviço"} />
                    </SelectTrigger>
                    <SelectContent>
                      {!services ? (
                        <SelectItem value="loading" disabled>Carregando serviços...</SelectItem>
                      ) : (services as any[] || []).length > 0 ? (
                        (services as any[]).map((service: any) => (
                          <SelectItem key={service.id} value={service.id}>
                            <div>
                              <div className="font-medium">{service.name}</div>
                              {service.description && (
                                <div className="text-xs text-gray-500">{service.description}</div>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      ) : formData.zoneId ? (
                        <SelectItem value="no-services" disabled>Nenhum serviço cadastrado</SelectItem>
                      ) : (
                        <SelectItem value="select-zone" disabled>Selecione uma zona primeiro</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formData.zoneId && (!services || (services as any[]).length === 0) && (
                    <p className="text-xs text-green-600">Não há serviços cadastrados</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checklist">Checklist *</Label>
                  <Select 
                    value={formData.checklistTemplateId} 
                    onValueChange={(value) => handleChange("checklistTemplateId", value)}
                    disabled={!formData.serviceId}
                  >
                    <SelectTrigger data-testid="select-checklist">
                      <SelectValue placeholder={!formData.serviceId ? "Primeiro selecione um serviço" : "Selecione um checklist"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCleanChecklists.length > 0 ? (
                        filteredCleanChecklists.map((template: any) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div>
                              <div className="font-medium">{template.name}</div>
                              {template.description && (
                                <div className="text-xs text-gray-500">{template.description}</div>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      ) : formData.serviceId ? (
                        <SelectItem value="no-checklists" disabled>Nenhum checklist cadastrado para este serviço</SelectItem>
                      ) : (
                        <SelectItem value="select-service" disabled>Selecione um serviço primeiro</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formData.serviceId && filteredCleanChecklists.length === 0 && (
                    <p className="text-xs text-green-600">Não há checklists cadastrados para este serviço</p>
                  )}
                </div>
              </div>
            )}

            {/* Módulo MANUTENÇÃO */}
            {currentModule === 'maintenance' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="site">Local *</Label>
                  <Select value={formData.siteId} onValueChange={(value) => handleChange("siteId", value)}>
                    <SelectTrigger data-testid="select-site">
                      <SelectValue placeholder="Selecione um local" />
                    </SelectTrigger>
                    <SelectContent>
                      {!sites ? (
                        <SelectItem value="loading" disabled>Carregando locais...</SelectItem>
                      ) : Array.isArray(sites) && sites.length > 0 ? (
                        (sites as any[]).map((site: any) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-sites" disabled>Nenhum local cadastrado</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zone">Zona *</Label>
                  <Select 
                    value={formData.zoneId} 
                    onValueChange={(value) => handleChange("zoneId", value)}
                    disabled={!formData.siteId}
                  >
                    <SelectTrigger data-testid="select-zone">
                      <SelectValue placeholder={!formData.siteId ? "Primeiro selecione um local" : "Selecione uma zona"} />
                    </SelectTrigger>
                    <SelectContent>
                      {!zonesForSite ? (
                        <SelectItem value="loading" disabled>Carregando zonas...</SelectItem>
                      ) : Array.isArray(zonesForSite) && zonesForSite.length > 0 ? (
                        (zonesForSite as any[]).map((zone: any) => (
                          <SelectItem key={zone.id} value={zone.id}>
                            {zone.name}
                          </SelectItem>
                        ))
                      ) : formData.siteId ? (
                        <SelectItem value="no-zones" disabled>Nenhuma zona neste local</SelectItem>
                      ) : (
                        <SelectItem value="select-site" disabled>Selecione um local primeiro</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formData.siteId && (!zonesForSite || (zonesForSite as any[]).length === 0) && (
                    <p className="text-xs text-orange-600">Não há zonas cadastradas neste local</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="equipment">Equipamento *</Label>
                  <Select 
                    value={formData.equipmentId} 
                    onValueChange={(value) => handleChange("equipmentId", value)}
                    disabled={!formData.zoneId}
                  >
                    <SelectTrigger data-testid="select-equipment">
                      <SelectValue placeholder={!formData.zoneId ? "Primeiro selecione uma zona" : "Selecione um equipamento"} />
                    </SelectTrigger>
                    <SelectContent>
                      {!equipmentList ? (
                        <SelectItem value="loading" disabled>Carregando equipamentos...</SelectItem>
                      ) : filteredEquipment.length > 0 ? (
                        filteredEquipment
                          .filter((eq: any) => eq.status === 'operacional')
                          .map((equipment: any) => (
                            <SelectItem key={equipment.id} value={equipment.id}>
                              <div>
                                <div className="font-medium">{equipment.name}</div>
                                <div className="text-xs text-gray-500">
                                  {equipment.manufacturer} - {equipment.model}
                                </div>
                              </div>
                            </SelectItem>
                          ))
                      ) : formData.zoneId ? (
                        <SelectItem value="no-equipment" disabled>Nenhum equipamento nesta zona</SelectItem>
                      ) : (
                        <SelectItem value="select-zone" disabled>Selecione uma zona primeiro</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {formData.zoneId && filteredEquipment.length === 0 && (
                    <p className="text-xs text-orange-600">Não há equipamentos cadastrados nesta zona</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="checklist">Checklist de Manutenção *</Label>
                  <Select 
                    value={formData.maintenanceChecklistTemplateId} 
                    onValueChange={(value) => handleChange("maintenanceChecklistTemplateId", value)}
                    disabled={!formData.equipmentId}
                  >
                    <SelectTrigger data-testid="select-maintenance-checklist">
                      <SelectValue placeholder={!formData.equipmentId ? "Primeiro selecione um equipamento" : "Selecione um checklist"} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredMaintenanceChecklists.length > 0 ? (
                        filteredMaintenanceChecklists.map((template: any) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div>
                              <div className="font-medium">{template.name}</div>
                              <div className="text-xs text-gray-500">{template.description}</div>
                            </div>
                          </SelectItem>
                        ))
                      ) : formData.equipmentId ? (
                        <SelectItem value="no-checklist" disabled>Nenhum checklist para este equipamento</SelectItem>
                      ) : null}
                    </SelectContent>
                  </Select>
                  {formData.equipmentId && filteredMaintenanceChecklists.length === 0 && (
                    <p className="text-xs text-orange-600">Não há checklists disponíveis para este equipamento</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Seção de Peças - Apenas para Manutenção */}
          {currentModule === 'maintenance' && (
            <div className="space-y-4 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
              <h4 className="font-semibold text-purple-900 dark:text-purple-100 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Peças Necessárias (opcional)
              </h4>
              
              {/* Seleção de Peças */}
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <Label htmlFor="part-select" className="text-sm">Peça</Label>
                  <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                    <SelectTrigger data-testid="select-part">
                      <SelectValue placeholder="Selecione uma peça" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeParts.length > 0 ? (
                        activeParts.map((part: any) => (
                          <SelectItem key={part.id} value={part.id}>
                            <div className="flex items-center justify-between gap-2">
                              <span>{part.name}</span>
                              <Badge variant="secondary" className="text-xs">
                                {parseFloat(part.currentQuantity).toFixed(0)} {part.unit || 'un'}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-parts" disabled>Nenhuma peça disponível</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="w-24 space-y-1">
                  <Label htmlFor="part-quantity" className="text-sm">Qtd</Label>
                  <Input
                    id="part-quantity"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={partQuantity}
                    onChange={(e) => setPartQuantity(e.target.value)}
                    data-testid="input-part-quantity"
                  />
                </div>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddPart}
                  disabled={!selectedPartId}
                  data-testid="button-add-part"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {/* Lista de Peças Selecionadas */}
              {selectedParts.length > 0 && (
                <div className="space-y-2 mt-4">
                  <Label className="text-sm font-medium">Peças selecionadas:</Label>
                  <div className="space-y-2">
                    {selectedParts.map((part) => (
                      <div 
                        key={part.partId} 
                        className="flex items-center justify-between p-2 bg-background rounded-md border"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-purple-600" />
                          <span className="font-medium">{part.partName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={part.quantity}
                            onChange={(e) => handleUpdatePartQuantity(part.partId, parseFloat(e.target.value))}
                            className="w-20 text-center"
                            data-testid={`input-part-qty-${part.partId}`}
                          />
                          <span className="text-sm text-muted-foreground">{part.unit}</span>
                          <span className="text-xs text-muted-foreground">(disp: {part.available})</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePart(part.partId)}
                            data-testid={`button-remove-part-${part.partId}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeParts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhuma peça com estoque disponível. 
                  <a href="/parts-inventory" className="text-primary underline ml-1">Cadastrar peças</a>
                </p>
              )}
            </div>
          )}

          {/* Datas de Planejamento */}
          <div className="space-y-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <h4 className="font-semibold text-amber-900 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Datas de Planejamento
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduledDate">Data Agendada</Label>
                <Input
                  id="scheduledDate"
                  type="date"
                  value={formData.scheduledDate}
                  onChange={(e) => handleChange("scheduledDate", e.target.value)}
                  data-testid="input-scheduled-date"
                />
              </div>

              {/* Campos opcionais de horário */}
              <div className="space-y-2">
                <Label htmlFor="startTime">Horário de Início (opcional)</Label>
                <Input
                  id="startTime"
                  type="time"
                  placeholder="Ex: 08:00"
                  value={formData.startTime}
                  onChange={(e) => handleChange("startTime", e.target.value)}
                  data-testid="input-start-time"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endTime">Horário de Fim (opcional)</Label>
                <Input
                  id="endTime"
                  type="time"
                  placeholder="Ex: 18:00"
                  value={formData.endTime}
                  onChange={(e) => handleChange("endTime", e.target.value)}
                  data-testid="input-end-time"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dueDate">Data Limite</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleChange("dueDate", e.target.value)}
                  data-testid="input-due-date"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              disabled={createWorkOrderMutation.isPending}
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-create"
            >
              <Save className="w-4 h-4 mr-2" />
              {createWorkOrderMutation.isPending ? "Criando..." : "Criar OS"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}