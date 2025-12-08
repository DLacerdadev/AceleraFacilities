import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useClient } from "@/contexts/ClientContext";
import { useModule } from "@/contexts/ModuleContext";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { useAuth } from "@/hooks/useAuth";
import { ModernCard, ModernCardHeader, ModernCardContent } from "@/components/ui/modern-card";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { 
  Plus, 
  Eye, 
  Search, 
  Trash2, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Calendar,
  Filter,
  Edit,
  ChevronDown,
  X,
  MapPin,
  PauseCircle,
  ClipboardList,
  XCircle
} from "lucide-react";
import WorkOrderModal from "@/components/work-order-modal";
import CreateWorkOrderModal from "@/components/create-work-order-modal";
import CancelWorkOrderDialog from "@/components/CancelWorkOrderDialog";
import { cn } from "@/lib/utils";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder: string;
  testId?: string;
}

function MultiSelect({ options, selected, onChange, placeholder, testId }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  
  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const option = options.find(o => o.value === selected[0]);
      return option?.label || placeholder;
    }
    return `${selected.length} selecionados`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between font-normal"
          data-testid={testId}
        >
          <span className="truncate">{getDisplayText()}</span>
          <div className="flex items-center gap-1">
            {selected.length > 0 && (
              <X 
                className="h-4 w-4 opacity-50 hover:opacity-100" 
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
                }}
              />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-2" align="start">
        <div className="space-y-2">
          {options.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-2 hover:bg-gray-100 p-2 rounded cursor-pointer"
              onClick={() => toggleOption(option.value)}
              data-testid={`${testId}-option-${option.value}`}
            >
              <Checkbox
                checked={selected.includes(option.value)}
                onCheckedChange={() => toggleOption(option.value)}
              />
              <label className="text-sm cursor-pointer flex-1">
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function WorkOrders() {
  const { activeClientId } = useClient();
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const { canDeleteWorkOrders } = useAuth();
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string[]>([]);
  const [responsibleFilter, setResponsibleFilter] = useState<string>("todos");
  const [typeFilter, setTypeFilter] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [workOrderToCancel, setWorkOrderToCancel] = useState<{ id: string; title: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Resetar página para 1 quando qualquer filtro mudar
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, zoneFilter, responsibleFilter, typeFilter, searchTerm]);

  // Construir query params com filtros para enviar ao backend
  const queryParams: Record<string, string> = {
    module: currentModule,
    includeAll: 'true',
    page: currentPage.toString(),
    limit: '50'
  };
  
  // Adicionar filtros se estiverem ativos
  if (statusFilter.length > 0) {
    queryParams.statusList = statusFilter.join(',');
  }
  if (zoneFilter.length > 0) {
    queryParams.zoneIds = zoneFilter.join(',');
  }
  if (responsibleFilter !== 'todos') {
    queryParams.assignedTo = responsibleFilter;
  }
  if (typeFilter !== 'todos') {
    queryParams.orderType = typeFilter;
  }
  if (searchTerm.trim()) {
    queryParams.searchTerm = searchTerm.trim();
  }

  const { data: workOrdersResponse, isLoading, refetch } = useQuery<{
    data: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
    statusCounts: { abertas: number; vencidas: number; pausadas: number; concluidas: number };
  }>({
    queryKey: ["/api/customers", activeClientId, "work-orders", queryParams],
    enabled: !!activeClientId,
  });

  // Extrair dados, paginação e contadores da resposta
  const workOrders = workOrdersResponse?.data || [];
  const pagination = workOrdersResponse?.pagination;
  const statusCounts = workOrdersResponse?.statusCounts || { abertas: 0, vencidas: 0, pausadas: 0, concluidas: 0 };

  const { data: zones } = useQuery({
    queryKey: ["/api/customers", activeClientId, "zones", { module: currentModule }],
    enabled: !!activeClientId,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/customers", activeClientId, "users"],
    enabled: !!activeClientId,
  });

  const deleteWorkOrderMutation = useMutation({
    mutationFn: async (workOrderId: string) => {
      return await apiRequest("DELETE", `/api/customers/${activeClientId}/work-orders/${workOrderId}`);
    },
    onSuccess: () => {
      toast({ title: "Ordem de serviço deletada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "work-orders"] });
    },
    onError: (error: any) => {
      console.error("[DELETE WO MUTATION ERROR]", error);
      toast({ 
        title: "Erro ao deletar ordem de serviço", 
        description: error?.message || "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  const cancelWorkOrderMutation = useMutation({
    mutationFn: async ({ workOrderId, reason }: { workOrderId: string; reason: string }) => {
      return await apiRequest("PUT", `/api/work-orders/${workOrderId}`, {
        status: 'cancelada',
        cancellationReason: reason
      });
    },
    onSuccess: () => {
      toast({ title: "Ordem de serviço cancelada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "work-orders"] });
      setCancelDialogOpen(false);
      setWorkOrderToCancel(null);
    },
    onError: () => {
      toast({ 
        title: "Erro ao cancelar ordem de serviço", 
        variant: "destructive" 
      });
    },
  });

  const handleDeleteWorkOrder = (workOrderId: string, workOrderTitle: string) => {
    if (window.confirm(`Tem certeza que deseja deletar a OS "${workOrderTitle}"? Esta ação não pode ser desfeita.`)) {
      deleteWorkOrderMutation.mutate(workOrderId);
    }
  };

  const handleCancelWorkOrder = (workOrderId: string, workOrderTitle: string) => {
    setWorkOrderToCancel({ id: workOrderId, title: workOrderTitle });
    setCancelDialogOpen(true);
  };

  const handleConfirmCancel = (reason: string) => {
    if (workOrderToCancel) {
      cancelWorkOrderMutation.mutate({ 
        workOrderId: workOrderToCancel.id, 
        reason 
      });
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    refetch();
    setLastUpdate(new Date());
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aberta":
        return <Badge className="bg-blue-600 text-white border-0">Aberta</Badge>;
      case "em_execucao":
        return <Badge className="bg-yellow-600 text-white border-0">Em Execução</Badge>;
      case "pausada":
        return <Badge className="bg-orange-600 text-white border-0">Pausada</Badge>;
      case "vencida":
        return <Badge className="bg-red-600 text-white border-0">Vencida</Badge>;
      case "concluida":
        return <Badge className="bg-green-600 text-white border-0">Concluída</Badge>;
      case "cancelada":
        return <Badge className="bg-gray-500 text-white border-0">Cancelada</Badge>;
      default:
        return <Badge className="bg-blue-600 text-white border-0">Aberta</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critica":
        return <Badge className="bg-red-500 text-white border-0">Crítica</Badge>;
      case "alta":
        return <Badge className="bg-orange-500 text-white border-0">Alta</Badge>;
      case "media":
        return <Badge className="bg-yellow-500 text-white border-0">Média</Badge>;
      default:
        return <Badge className="bg-blue-500 text-white border-0">Baixa</Badge>;
    }
  };

  const getTypeLabel = (orderType: string) => {
    switch (orderType) {
      case "programada":
        return "Programada";
      case "corretiva_interna":
        return "Corretiva Interna";
      case "corretiva_publica":
        return "Corretiva Pública";
      default:
        return "N/A";
    }
  };

  // Os filtros (status, zona, tipo, busca) agora são aplicados no BACKEND
  // Apenas o filtro por período ainda é aplicado no frontend
  const filteredWorkOrders = (workOrders || []).filter((wo: any) => {
    // Filtro por período (data agendada) - ainda no frontend
    if (startDate && wo.scheduledDate) {
      const woDate = new Date(wo.scheduledDate);
      const filterStart = new Date(startDate);
      if (woDate < filterStart) return false;
    }
    
    if (endDate && wo.scheduledDate) {
      const woDate = new Date(wo.scheduledDate);
      const filterEnd = new Date(endDate);
      filterEnd.setHours(23, 59, 59, 999);
      if (woDate > filterEnd) return false;
    }
    
    return true;
  });

  // Usar contadores do backend (já considera TODOS os registros, não apenas a página atual)
  const totalAbertas = statusCounts.abertas;
  const totalVencidas = statusCounts.vencidas;
  const totalPausadas = statusCounts.pausadas;
  const totalConcluidas = statusCounts.concluidas;

  // Descrição dinâmica baseada no módulo
  const headerDescription = currentModule === 'maintenance' 
    ? "Gerenciamento de ordens de serviço de manutenção" 
    : "Gerenciamento de ordens de serviço de limpeza";

  if (isLoading) {
    return (
      <div className={cn("flex-1 flex items-center justify-center", theme.gradients.page)}>
        <div className="text-center">
          <div className={cn(
            "w-16 h-16 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4",
            theme.borders.primary
          )}></div>
          <p className="text-slate-600 font-medium">Carregando ordens de serviço...</p>
        </div>
      </div>
    );
  }

  const getZoneName = (zoneId: string) => {
    const zone = (zones as any[])?.find((z: any) => z.id === zoneId);
    return zone?.name || "N/A";
  };

  const getUserName = (userId: string) => {
    const user = (users as any[])?.find((u: any) => u.id === userId);
    return user?.name || "Não atribuído";
  };

  // 🔥 NOVO: Função para mostrar múltiplos responsáveis
  const getUserNames = (userIds: string[] | null | undefined) => {
    if (!userIds || userIds.length === 0) return "Não atribuído";
    
    const names = userIds.map(id => {
      const user = (users as any[])?.find((u: any) => u.id === id);
      return user?.name || id.slice(0, 8);
    });
    
    return names.join(", ");
  };

  // Formata data sem problemas de timezone
  const formatDateOnly = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    // Se já é uma string no formato YYYY-MM-DD, formata diretamente
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
    // Fallback para conversão normal
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <>
      <ModernPageHeader 
        title="Ordens de Serviço"
        description={headerDescription}
        icon={ClipboardList}
        actions={
          <>
            <Button 
              onClick={handleRefresh}
              className={cn("flex items-center gap-2", theme.buttons.primary)}
              style={theme.buttons.primaryStyle}
              size="sm"
              disabled={isRefreshing}
              data-testid="button-refresh"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              Atualizar
            </Button>
            <Button 
              onClick={() => setShowCreateModal(true)} 
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              data-testid="button-create-work-order"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova OS
            </Button>
          </>
        }
      />
      
      <main className={cn("flex-1 overflow-auto p-4", theme.gradients.page)}>
        <div className="w-full px-6 space-y-3">
          {/* Estatísticas e Filtros Integrados */}
          <ModernCard variant="gradient">
            <ModernCardContent>
              {/* Cards de Estatísticas - Clicáveis para filtrar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <button
                  onClick={() => {
                    setStatusFilter(statusFilter.includes('aberta') ? [] : ['aberta']);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-all hover-elevate active-elevate-2 cursor-pointer",
                    statusFilter.includes('aberta') && "ring-2 ring-offset-2",
                    currentModule === 'maintenance' ? 'ring-orange-500' : 'ring-blue-500'
                  )}
                  data-testid="button-filter-abertas"
                >
                  <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", 
                    currentModule === 'maintenance' ? 'bg-orange-50' : 'bg-blue-50'
                  )}>
                    <Clock className={cn("w-7 h-7", 
                      currentModule === 'maintenance' ? 'text-orange-600' : 'text-blue-600'
                    )} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground font-medium">Abertas</p>
                    <p className={cn("text-3xl font-bold", 
                      currentModule === 'maintenance' ? 'text-orange-600' : 'text-blue-600'
                    )}>
                      {totalAbertas}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setStatusFilter(statusFilter.includes('vencida') ? [] : ['vencida']);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-all hover-elevate active-elevate-2 cursor-pointer",
                    statusFilter.includes('vencida') && "ring-2 ring-red-500 ring-offset-2"
                  )}
                  data-testid="button-filter-vencidas"
                >
                  <div className="w-14 h-14 bg-red-50 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground font-medium">Vencidas</p>
                    <p className="text-3xl font-bold text-red-600">
                      {totalVencidas}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setStatusFilter(statusFilter.includes('pausada') ? [] : ['pausada']);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-all hover-elevate active-elevate-2 cursor-pointer",
                    statusFilter.includes('pausada') && "ring-2 ring-offset-2",
                    currentModule === 'maintenance' ? 'ring-orange-500' : 'ring-blue-500'
                  )}
                  data-testid="button-filter-pausadas"
                >
                  <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center",
                    currentModule === 'maintenance' ? 'bg-orange-50' : 'bg-blue-50'
                  )}>
                    <PauseCircle className={cn("w-7 h-7",
                      currentModule === 'maintenance' ? 'text-orange-600' : 'text-blue-600'
                    )} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground font-medium">Pausadas</p>
                    <p className="text-3xl font-bold text-foreground">
                      {totalPausadas}
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setStatusFilter(statusFilter.includes('concluida') ? [] : ['concluida']);
                  }}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg transition-all hover-elevate active-elevate-2 cursor-pointer",
                    statusFilter.includes('concluida') && "ring-2 ring-green-500 ring-offset-2"
                  )}
                  data-testid="button-filter-concluidas"
                >
                  <div className="w-14 h-14 bg-green-50 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-muted-foreground font-medium">Concluídas</p>
                    <p className="text-3xl font-bold text-green-600">
                      {totalConcluidas}
                    </p>
                  </div>
                </button>
              </div>

              {/* Filters Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t">
                <Select 
                  value={statusFilter.length === 0 ? "todos" : statusFilter.length === 1 ? statusFilter[0] : "multiplos"}
                  onValueChange={(value) => {
                    if (value === "todos") {
                      setStatusFilter([]);
                    } else {
                      setStatusFilter([value]);
                    }
                  }}
                >
                  <SelectTrigger className="w-full" data-testid="select-status-filter">
                    <SelectValue placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Status</SelectItem>
                    <SelectItem value="aberta">Abertas</SelectItem>
                    <SelectItem value="em_execucao">Em Execução</SelectItem>
                    <SelectItem value="pausada">Pausadas</SelectItem>
                    <SelectItem value="vencida">Vencidas</SelectItem>
                    <SelectItem value="concluida">Concluídas</SelectItem>
                    <SelectItem value="cancelada">Canceladas</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={zoneFilter.length === 0 ? "todas" : zoneFilter.length === 1 ? zoneFilter[0] : "multiplas"}
                  onValueChange={(value) => {
                    if (value === "todas") {
                      setZoneFilter([]);
                    } else {
                      setZoneFilter([value]);
                    }
                  }}
                >
                  <SelectTrigger className="w-full" data-testid="select-zone-filter">
                    <SelectValue placeholder="Todas as Zonas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Zonas</SelectItem>
                    {(zones as any[] || []).map((zone: any) => (
                      <SelectItem key={zone.id} value={zone.id}>
                        {zone.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={responsibleFilter} onValueChange={setResponsibleFilter}>
                  <SelectTrigger className="w-full" data-testid="select-responsible-filter">
                    <SelectValue placeholder="Todos os Responsáveis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Responsáveis</SelectItem>
                    <SelectItem value="nao_atribuido">Não Atribuído</SelectItem>
                    {(users as any[] || []).map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full" data-testid="select-type-filter">
                    <SelectValue placeholder="Todos os Tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Tipos</SelectItem>
                    <SelectItem value="programada">Programada</SelectItem>
                    <SelectItem value="corretiva_interna">Corretiva Interna</SelectItem>
                    <SelectItem value="corretiva_publica">Corretiva Pública</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </ModernCardContent>
          </ModernCard>

          {/* Tabela de Ordens de Serviço */}
          <ModernCard>
            <ModernCardHeader icon={<ClipboardList className={cn("w-5 h-5", theme.text.primary)} />}>
              Lista de Ordens de Serviço
            </ModernCardHeader>
            <ModernCardContent>
              
              {filteredWorkOrders.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">Nenhuma ordem de serviço encontrada</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">ID</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Tipo</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Zona</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Título</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Responsável</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Prioridade</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Data Agendada</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Data de Conclusão</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWorkOrders.map((wo: any) => (
                        <tr 
                          key={wo.id} 
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          data-testid={`row-work-order-${wo.id}`}
                        >
                          <td className="py-3 px-4 text-sm font-medium text-gray-900" data-testid={`text-id-${wo.id}`}>
                            #{wo.number || wo.id?.slice(0, 3)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600" data-testid={`text-type-${wo.id}`}>
                            {getTypeLabel(wo.type)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600" data-testid={`text-zone-${wo.id}`}>
                            {getZoneName(wo.zoneId)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-900" data-testid={`text-title-${wo.id}`}>
                            {wo.title || 'Sem título'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600" data-testid={`text-operator-${wo.id}`}>
                            {getUserNames(wo.assignedUserIds) || getUserName(wo.assignedUserId)}
                          </td>
                          <td className="py-3 px-4" data-testid={`badge-priority-${wo.id}`}>
                            {getPriorityBadge(wo.priority)}
                          </td>
                          <td className="py-3 px-4" data-testid={`badge-status-${wo.id}`}>
                            {getStatusBadge(wo.status)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600" data-testid={`text-date-${wo.id}`}>
                            {formatDateOnly(wo.scheduledDate)}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600" data-testid={`text-completed-${wo.id}`}>
                            {wo.completedAt ? new Date(wo.completedAt).toLocaleDateString('pt-BR') : ''}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedWorkOrder(wo.id)}
                                className={cn(
                                  "hover:scale-110 transition-transform",
                                  theme.text.primary,
                                  `hover:${theme.backgrounds.light}`
                                )}
                                data-testid={`button-view-${wo.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {wo.status !== 'cancelada' && wo.status !== 'concluida' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCancelWorkOrder(wo.id, wo.title)}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 hover:scale-110 transition-transform"
                                  data-testid={`button-cancel-${wo.id}`}
                                  title="Cancelar OS"
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              )}
                              {canDeleteWorkOrders && wo.status !== 'concluida' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteWorkOrder(wo.id, wo.title)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:scale-110 transition-transform"
                                  data-testid={`button-delete-${wo.id}`}
                                  title="Excluir OS (apenas admin)"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Controles de Paginação */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} ordens de serviço
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!pagination.hasPreviousPage}
                      data-testid="button-prev-page"
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {pagination.page} de {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                      disabled={!pagination.hasNextPage}
                      data-testid="button-next-page"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </ModernCardContent>
          </ModernCard>
        </div>
      </main>

      {selectedWorkOrder && (
        <WorkOrderModal
          workOrderId={selectedWorkOrder}
          onClose={() => setSelectedWorkOrder(null)}
        />
      )}
      {showCreateModal && activeClientId && (
        <CreateWorkOrderModal
          customerId={activeClientId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "work-orders"] });
          }}
        />
      )}
      {workOrderToCancel && (
        <CancelWorkOrderDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          onConfirm={handleConfirmCancel}
          workOrderTitle={workOrderToCancel.title}
          isPending={cancelWorkOrderMutation.isPending}
        />
      )}
    </>
  );
}
