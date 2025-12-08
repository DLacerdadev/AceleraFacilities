import { ModernCard, ModernCardContent, ModernCardHeader } from "@/components/ui/modern-card";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useModule } from "@/contexts/ModuleContext";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  Plus, 
  Edit, 
  Trash2,
  Wrench,
  RefreshCw,
  Settings,
  Package,
  Eye,
  Calendar,
  Clock,
  AlertCircle
} from "lucide-react";

interface EquipmentProps {
  customerId: string;
}

// Mapeamento de campos para nomes em português
const fieldLabels: Record<string, string> = {
  name: "Nome",
  equipmentType: "Tipo de Equipamento",
  siteId: "Local",
  zoneId: "Zona",
  manufacturer: "Fabricante",
  model: "Modelo",
  serialNumber: "Número de Série",
  installationDate: "Data de Instalação",
  warrantyExpiry: "Validade da Garantia",
  value: "Valor",
  status: "Status",
  description: "Descrição",
  customerId: "Cliente",
  companyId: "Empresa",
};

// Função para formatar erros de validação Zod em mensagens amigáveis
function formatValidationError(error: any): string {
  try {
    // Se o erro já é uma string simples, retorná-la
    if (typeof error === 'string') {
      return error;
    }

    // Tentar extrair a mensagem de erro
    const message = error?.message || error?.toString() || '';

    // Se a mensagem parece ser um JSON de erro Zod
    if (message.includes('"errors"') || message.includes('"issues"') || message.includes('ZodError')) {
      let errorData;
      
      // Tentar parsear o JSON da mensagem
      try {
        errorData = typeof message === 'string' ? JSON.parse(message) : message;
      } catch {
        // Se não conseguir parsear, tentar extrair informações
        const fieldMatch = message.match(/"path":\["([^"]+)"\]/);
        const expectedMatch = message.match(/"expected":"([^"]+)"/);
        
        if (fieldMatch) {
          const fieldName = fieldLabels[fieldMatch[1]] || fieldMatch[1];
          if (expectedMatch) {
            return `O campo "${fieldName}" está inválido. Esperado: ${expectedMatch[1]}`;
          }
          return `O campo "${fieldName}" está inválido ou incompleto.`;
        }
        
        // Se contiver "Expected string, received null"
        if (message.includes('Expected string, received null') || message.includes('Expected number, received null')) {
          return 'Preencha todos os campos obrigatórios.';
        }
        
        return 'Dados inválidos. Verifique os campos e tente novamente.';
      }

      // Processar o objeto de erro Zod
      const errors = errorData?.errors || errorData?.issues || [];
      
      if (errors.length > 0) {
        const errorMessages: string[] = [];
        
        for (const err of errors) {
          // Pegar o caminho do campo
          const path = err.path || [];
          const fieldPath = path.join('.');
          const fieldName = fieldLabels[fieldPath] || fieldLabels[path[path.length - 1]] || fieldPath;
          
          // Formatar mensagem baseada no código de erro
          if (err.code === 'invalid_type') {
            if (err.received === 'null' || err.received === 'undefined') {
              errorMessages.push(`O campo "${fieldName}" é obrigatório.`);
            } else {
              errorMessages.push(`O campo "${fieldName}" está com formato inválido.`);
            }
          } else if (err.code === 'too_small') {
            errorMessages.push(`O campo "${fieldName}" é obrigatório.`);
          } else if (err.code === 'invalid_string') {
            errorMessages.push(`O campo "${fieldName}" está com formato inválido.`);
          } else if (err.message) {
            errorMessages.push(`${fieldName}: ${err.message}`);
          }
        }
        
        if (errorMessages.length > 0) {
          // Remover duplicatas e retornar
          const uniqueMessages = Array.from(new Set(errorMessages));
          return uniqueMessages.slice(0, 3).join(' '); // Máximo 3 mensagens
        }
      }
    }

    // Se chegou aqui, tentar retornar a mensagem original mais limpa
    if (message.includes('Invalid data')) {
      return 'Dados inválidos. Verifique todos os campos obrigatórios.';
    }

    return message || 'Erro desconhecido. Tente novamente.';
  } catch {
    return 'Erro ao processar a solicitação. Tente novamente.';
  }
}

export default function Equipment({ customerId }: EquipmentProps) {
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const [, setLocation] = useLocation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<any>(null);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [selectedEquipmentForHistory, setSelectedEquipmentForHistory] = useState<any>(null);
  
  // Form states
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [equipmentName, setEquipmentName] = useState("");
  const [equipmentTypeId, setEquipmentTypeId] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [installationDate, setInstallationDate] = useState("");
  const [warrantyExpiry, setWarrantyExpiry] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("operacional");
  const [description, setDescription] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { toast } = useToast();

  // Fetch customer data
  const { data: customer } = useQuery({
    queryKey: [`/api/customers/${customerId}`],
    enabled: !!customerId,
  });

  // Fetch sites
  const { data: sites } = useQuery({
    queryKey: [`/api/customers/${customerId}/sites`, { module: currentModule }],
    enabled: !!customerId,
  });

  // Fetch zones for selected site
  const { data: zones } = useQuery({
    queryKey: [`/api/sites/${selectedSiteId}/zones`, { module: currentModule }],
    enabled: !!selectedSiteId,
  });

  // Fetch all zones for the customer (to display zone names in equipment list)
  const { data: allZones } = useQuery({
    queryKey: [`/api/customers/${customerId}/zones`],
    enabled: !!customerId,
  });

  // Fetch equipment
  const { data: equipment, isLoading } = useQuery({
    queryKey: [`/api/customers/${customerId}/equipment`],
    enabled: !!customerId,
  });

  // Fetch work order history for selected equipment
  const { data: workOrderHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: [`/api/equipment/${selectedEquipmentForHistory?.id}/work-orders`],
    enabled: !!selectedEquipmentForHistory?.id && isHistoryDialogOpen,
  });

  // Fetch equipment categories
  const companyId = (customer as any)?.companyId;
  const { data: equipmentCategories = [] } = useQuery<any[]>({
    queryKey: [`/api/companies/${companyId}/equipment-categories`, { module: currentModule }],
    enabled: !!companyId,
  });

  // Redirect if not in maintenance module
  useEffect(() => {
    if (currentModule !== 'maintenance') {
      setLocation('/');
    }
  }, [currentModule, setLocation]);

  const createEquipmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/equipment", data);
    },
    onSuccess: () => {
      toast({ title: "Equipamento criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/equipment`] });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = formatValidationError(error);
      console.error('[CREATE EQUIPMENT ERROR]', { error, formattedMessage: errorMessage });
      toast({ 
        title: "Erro ao criar equipamento",
        description: errorMessage,
        variant: "destructive",
        duration: 6000
      });
    },
  });

  const updateEquipmentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/equipment/${data.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Equipamento atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/equipment`] });
      setIsEditDialogOpen(false);
      setEditingEquipment(null);
      resetForm();
    },
    onError: (error: any) => {
      const errorMessage = formatValidationError(error);
      console.error('[UPDATE EQUIPMENT ERROR]', { error, formattedMessage: errorMessage });
      toast({ 
        title: "Erro ao atualizar equipamento",
        description: errorMessage,
        variant: "destructive",
        duration: 6000
      });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/equipment/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Equipamento excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/equipment`] });
    },
    onError: (error: any) => {
      const errorMessage = formatValidationError(error);
      console.error('[DELETE EQUIPMENT ERROR]', { error, formattedMessage: errorMessage });
      toast({ 
        title: "Erro ao excluir equipamento",
        description: errorMessage,
        variant: "destructive",
        duration: 6000
      });
    },
  });

  const resetForm = () => {
    setSelectedSiteId("");
    setSelectedZoneId("");
    setEquipmentName("");
    setEquipmentTypeId("");
    setManufacturer("");
    setModel("");
    setSerialNumber("");
    setInstallationDate("");
    setWarrantyExpiry("");
    setValue("");
    setStatus("operacional");
    setDescription("");
  };

  const handleCreate = () => {
    const companyId = (customer as any)?.companyId;
    if (!companyId || !selectedSiteId) {
      toast({ 
        title: "Preencha todos os campos obrigatórios", 
        variant: "destructive" 
      });
      return;
    }

    createEquipmentMutation.mutate({
      companyId,
      customerId,
      siteId: selectedSiteId,
      zoneId: selectedZoneId || null,
      name: equipmentName,
      equipmentTypeId,
      manufacturer: manufacturer || null,
      model: model || null,
      serialNumber: serialNumber || null,
      installationDate: installationDate || null,
      warrantyExpiry: warrantyExpiry || null,
      value: value ? parseFloat(value) : null,
      status,
      description: description || null,
      module: currentModule,
    });
  };

  const handleEdit = (equip: any) => {
    setEditingEquipment(equip);
    setSelectedSiteId(equip.siteId);
    setSelectedZoneId(equip.zoneId || "");
    setEquipmentName(equip.name);
    setEquipmentTypeId(equip.equipmentTypeId);
    setManufacturer(equip.manufacturer || "");
    setModel(equip.model || "");
    setSerialNumber(equip.serialNumber || "");
    setInstallationDate(equip.installationDate || "");
    setWarrantyExpiry(equip.warrantyExpiry || "");
    setValue(equip.value || "");
    setStatus(equip.status);
    setDescription(equip.description || "");
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    const companyId = (customer as any)?.companyId;
    if (!editingEquipment || !companyId) return;

    updateEquipmentMutation.mutate({
      id: editingEquipment.id,
      companyId,
      customerId,
      siteId: selectedSiteId,
      zoneId: selectedZoneId || null,
      name: equipmentName,
      equipmentTypeId,
      manufacturer: manufacturer || null,
      model: model || null,
      serialNumber: serialNumber || null,
      installationDate: installationDate || null,
      warrantyExpiry: warrantyExpiry || null,
      value: value ? parseFloat(value) : null,
      status,
      description: description || null,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Tem certeza que deseja excluir este equipamento?")) {
      deleteEquipmentMutation.mutate(id);
    }
  };

  const handleViewHistory = (equip: any) => {
    setSelectedEquipmentForHistory(equip);
    setIsHistoryDialogOpen(true);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast({ title: "🔄 Atualizando lista..." });
    await queryClient.invalidateQueries({ queryKey: [`/api/customers/${customerId}/equipment`] });
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Get site and zone names for display
  const getSiteName = (siteId: string) => {
    if (!Array.isArray(sites)) return "N/A";
    return sites.find((s: any) => s.id === siteId)?.name || "N/A";
  };

  const getZoneName = (zoneId: string | null) => {
    if (!zoneId) return "N/A";
    if (!Array.isArray(allZones)) return "N/A";
    return allZones.find((z: any) => z.id === zoneId)?.name || "N/A";
  };

  return (
    <>
      <ModernPageHeader 
        title="Equipamentos"
        description="Gerencie equipamentos e ativos de manutenção"
        icon={Wrench}
        stats={[
          { 
            label: "Total de Equipamentos", 
            value: Array.isArray(equipment) ? equipment.length : 0,
            icon: Package
          },
          {
            label: "Operacionais",
            value: Array.isArray(equipment) ? equipment.filter((e: any) => e.status === 'operacional').length : 0,
            icon: Settings
          }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button 
              variant="default"
              className={cn("flex items-center gap-2", theme.buttons.primary)}
              style={theme.buttons.primaryStyle}
              size="sm"
              onClick={() => setIsCreateDialogOpen(true)}
              data-testid="button-create-equipment-header"
            >
              <Plus className="w-4 h-4" />
              Novo Equipamento
            </Button>
            <Button 
              variant="outline"
              onClick={handleRefresh}
              size="sm"
              disabled={isRefreshing}
              data-testid="button-refresh-equipment"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
      />
      
      <div className={cn("flex-1 overflow-y-auto p-4 space-y-3", theme.gradients.section)}>
        <ModernCard variant="gradient">
          <ModernCardHeader icon={<Wrench className="w-6 h-6" />}>
            Lista de Equipamentos
          </ModernCardHeader>
          <ModernCardContent>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Equipamento</DialogTitle>
                  <DialogDescription>
                    Cadastre um novo equipamento no sistema
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="site">Local *</Label>
                      <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                        <SelectTrigger data-testid="select-site">
                          <SelectValue placeholder="Selecione um local" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(sites) && sites.map((site: any) => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zone">Zona (Opcional)</Label>
                      <Select value={selectedZoneId} onValueChange={setSelectedZoneId} disabled={!selectedSiteId}>
                        <SelectTrigger data-testid="select-zone">
                          <SelectValue placeholder="Selecione uma zona" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(zones) && zones.map((zone: any) => (
                            <SelectItem key={zone.id} value={zone.id}>
                              {zone.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Equipamento *</Label>
                      <Input
                        id="name"
                        data-testid="input-equipment-name"
                        value={equipmentName}
                        onChange={(e) => setEquipmentName(e.target.value)}
                        placeholder="Ex: Ar Condicionado"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo de Equipamento *</Label>
                      <Select value={equipmentTypeId} onValueChange={setEquipmentTypeId}>
                        <SelectTrigger data-testid="select-equipment-type">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.isArray(equipmentCategories) && equipmentCategories.filter((c: any) => c.isActive).map((category: any) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))}
                          {(!Array.isArray(equipmentCategories) || equipmentCategories.length === 0) && (
                            <>
                              <SelectItem value="hvac">HVAC</SelectItem>
                              <SelectItem value="eletrico">Elétrico</SelectItem>
                              <SelectItem value="hidraulico">Hidráulico</SelectItem>
                              <SelectItem value="mecanico">Mecânico</SelectItem>
                              <SelectItem value="eletronico">Eletrônico</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="operacional">Operacional</SelectItem>
                          <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                          <SelectItem value="inoperante">Inoperante</SelectItem>
                          <SelectItem value="aposentado">Aposentado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="manufacturer">Fabricante</Label>
                      <Input
                        id="manufacturer"
                        data-testid="input-manufacturer"
                        value={manufacturer}
                        onChange={(e) => setManufacturer(e.target.value)}
                        placeholder="Ex: Samsung"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="model">Modelo</Label>
                      <Input
                        id="model"
                        data-testid="input-model"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="Ex: AR9000"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="serialNumber">Número de Série</Label>
                      <Input
                        id="serialNumber"
                        data-testid="input-serial-number"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        placeholder="SN123456"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="installationDate">Data de Instalação</Label>
                      <Input
                        id="installationDate"
                        type="date"
                        data-testid="input-installation-date"
                        value={installationDate}
                        onChange={(e) => setInstallationDate(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="warrantyExpiry">Vencimento da Garantia</Label>
                      <Input
                        id="warrantyExpiry"
                        type="date"
                        data-testid="input-warranty-expiry"
                        value={warrantyExpiry}
                        onChange={(e) => setWarrantyExpiry(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="value">Valor do Equipamento (R$)</Label>
                      <Input
                        id="value"
                        type="number"
                        step="0.01"
                        min="0"
                        data-testid="input-value"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      data-testid="input-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Informações adicionais sobre o equipamento"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="default"
                    onClick={handleCreate}
                    disabled={createEquipmentMutation.isPending}
                    data-testid="button-save"
                    className={theme.buttons.primary}
                    style={theme.buttons.primaryStyle}
                  >
                    {createEquipmentMutation.isPending ? "Criando..." : "Criar Equipamento"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
                <p className="mt-4 text-gray-600">Carregando equipamentos...</p>
              </div>
            ) : !Array.isArray(equipment) || equipment.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 text-lg font-medium">Nenhum equipamento cadastrado</p>
                <p className="text-gray-400 text-sm mt-1">Clique em "Novo Equipamento" para começar</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Local</TableHead>
                    <TableHead>Zona</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fabricante</TableHead>
                    <TableHead>Modelo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(equipment) && equipment.map((equip: any) => (
                    <TableRow key={equip.id} data-testid={`row-equipment-${equip.id}`}>
                      <TableCell className="font-mono text-sm">
                        {equip.serialNumber || "-"}
                      </TableCell>
                      <TableCell className="font-medium">{equip.name}</TableCell>
                      <TableCell className="font-semibold text-green-700">
                        {equip.value 
                          ? new Intl.NumberFormat('pt-BR', { 
                              style: 'currency', 
                              currency: 'BRL' 
                            }).format(parseFloat(equip.value)) 
                          : "-"}
                      </TableCell>
                      <TableCell>{getSiteName(equip.siteId)}</TableCell>
                      <TableCell>{getZoneName(equip.zoneId)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                          equip.status === 'operacional' ? 'bg-green-100 text-green-800' :
                          equip.status === 'em_manutencao' ? 'bg-yellow-100 text-yellow-800' :
                          equip.status === 'inoperante' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {equip.status === 'operacional' ? 'Operacional' :
                           equip.status === 'em_manutencao' ? 'Em Manutenção' :
                           equip.status === 'inoperante' ? 'Inoperante' :
                           'Aposentado'}
                        </span>
                      </TableCell>
                      <TableCell>{equip.manufacturer || "-"}</TableCell>
                      <TableCell>{equip.model || "-"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewHistory(equip)}
                            data-testid={`button-view-history-${equip.id}`}
                            title="Visualizar histórico"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(equip)}
                            data-testid={`button-edit-${equip.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(equip.id)}
                            data-testid={`button-delete-${equip.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

        {/* Edit Dialog - Similar structure to create dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Equipamento</DialogTitle>
              <DialogDescription>
                Atualize as informações do equipamento
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-site">Local *</Label>
                  <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um local" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(sites) && sites.map((site: any) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-zone">Zona (Opcional)</Label>
                  <Select value={selectedZoneId} onValueChange={setSelectedZoneId} disabled={!selectedSiteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma zona" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(zones) && zones.map((zone: any) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Equipamento *</Label>
                  <Input
                    value={equipmentName}
                    onChange={(e) => setEquipmentName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Equipamento *</Label>
                  <Select value={equipmentTypeId} onValueChange={setEquipmentTypeId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(equipmentCategories) && equipmentCategories.filter((c: any) => c.isActive).map((category: any) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                      {(!Array.isArray(equipmentCategories) || equipmentCategories.length === 0) && (
                        <>
                          <SelectItem value="hvac">HVAC</SelectItem>
                          <SelectItem value="eletrico">Elétrico</SelectItem>
                          <SelectItem value="hidraulico">Hidráulico</SelectItem>
                          <SelectItem value="mecanico">Mecânico</SelectItem>
                          <SelectItem value="eletronico">Eletrônico</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operacional">Operacional</SelectItem>
                      <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                      <SelectItem value="inoperante">Inoperante</SelectItem>
                      <SelectItem value="aposentado">Aposentado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fabricante</Label>
                  <Input
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Modelo</Label>
                  <Input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Número de Série</Label>
                  <Input
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de Instalação</Label>
                  <Input
                    type="date"
                    value={installationDate}
                    onChange={(e) => setInstallationDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Vencimento da Garantia</Label>
                  <Input
                    type="date"
                    value={warrantyExpiry}
                    onChange={(e) => setWarrantyExpiry(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor do Equipamento (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  setEditingEquipment(null);
                  resetForm();
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={updateEquipmentMutation.isPending}
                className={theme.buttons.primary}
                style={theme.buttons.primaryStyle}
              >
                {updateEquipmentMutation.isPending ? "Atualizando..." : "Atualizar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Work Order History Dialog */}
        <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Histórico de Ordens de Serviço
              </DialogTitle>
              <DialogDescription>
                {selectedEquipmentForHistory && (
                  <div className="mt-2 space-y-1">
                    <p className="font-medium text-base">
                      {selectedEquipmentForHistory.name}
                    </p>
                    <div className="flex gap-4 text-sm">
                      {selectedEquipmentForHistory.manufacturer && (
                        <span>Fabricante: {selectedEquipmentForHistory.manufacturer}</span>
                      )}
                      {selectedEquipmentForHistory.model && (
                        <span>Modelo: {selectedEquipmentForHistory.model}</span>
                      )}
                      {selectedEquipmentForHistory.serialNumber && (
                        <span>Série: {selectedEquipmentForHistory.serialNumber}</span>
                      )}
                    </div>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              {isLoadingHistory ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mx-auto"></div>
                  <p className="mt-4 text-gray-600">Carregando histórico...</p>
                </div>
              ) : !Array.isArray(workOrderHistory) || workOrderHistory.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 text-lg font-medium">Nenhuma ordem de serviço encontrada</p>
                  <p className="text-gray-400 text-sm mt-1">
                    Este equipamento ainda não possui histórico de manutenção
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workOrderHistory.map((wo: any) => (
                    <div
                      key={wo.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                      data-testid={`work-order-${wo.id}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg">
                              #{wo.number}
                            </span>
                            <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                              wo.status === 'concluida' ? 'bg-green-100 text-green-800' :
                              wo.status === 'em_execucao' ? 'bg-blue-100 text-blue-800' :
                              wo.status === 'pausada' ? 'bg-yellow-100 text-yellow-800' :
                              wo.status === 'vencida' ? 'bg-red-100 text-red-800' :
                              wo.status === 'cancelada' ? 'bg-gray-100 text-gray-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {wo.status === 'concluida' ? 'Concluída' :
                               wo.status === 'em_execucao' ? 'Em Execução' :
                               wo.status === 'pausada' ? 'Pausada' :
                               wo.status === 'vencida' ? 'Vencida' :
                               wo.status === 'cancelada' ? 'Cancelada' :
                               'Aberta'}
                            </span>
                            {wo.priority && (
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                wo.priority === 'critica' ? 'bg-red-100 text-red-800' :
                                wo.priority === 'alta' ? 'bg-orange-100 text-orange-800' :
                                wo.priority === 'media' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {wo.priority === 'critica' ? 'Crítica' :
                                 wo.priority === 'alta' ? 'Alta' :
                                 wo.priority === 'media' ? 'Média' :
                                 'Baixa'}
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-gray-900">{wo.title}</h4>
                          {wo.description && (
                            <p className="text-sm text-gray-600 mt-1">{wo.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 pt-3 border-t">
                        {wo.scheduledDate && (
                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div className="text-sm">
                              <p className="text-gray-500">Agendado</p>
                              <p className="font-medium">
                                {new Date(wo.scheduledDate).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        )}
                        
                        {wo.startedAt && (
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div className="text-sm">
                              <p className="text-gray-500">Iniciado</p>
                              <p className="font-medium">
                                {new Date(wo.startedAt).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        )}

                        {wo.completedAt && (
                          <div className="flex items-start gap-2">
                            <Clock className="h-4 w-4 text-green-600 mt-0.5" />
                            <div className="text-sm">
                              <p className="text-gray-500">Concluído</p>
                              <p className="font-medium text-green-700">
                                {new Date(wo.completedAt).toLocaleDateString('pt-BR')}
                              </p>
                            </div>
                          </div>
                        )}

                        {wo.type && (
                          <div className="flex items-start gap-2">
                            <Wrench className="h-4 w-4 text-gray-400 mt-0.5" />
                            <div className="text-sm">
                              <p className="text-gray-500">Tipo</p>
                              <p className="font-medium">
                                {wo.type === 'programada' ? 'Programada' :
                                 wo.type === 'corretiva_interna' ? 'Corretiva Interna' :
                                 'Corretiva Pública'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {wo.observations && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs text-gray-500 uppercase font-medium mb-1">Observações</p>
                          <p className="text-sm text-gray-700">{wo.observations}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => setIsHistoryDialogOpen(false)}
                data-testid="button-close-history"
              >
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
