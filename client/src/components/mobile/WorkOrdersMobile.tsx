import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, AlertTriangle, CheckCircle2, Search, Plus, Eye, Filter, RefreshCw, ChevronDown, X, MapPin, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Helper para parsear data local sem conversão de timezone
const parseLocalDate = (dateString: string | null): Date | null => {
  if (!dateString) return null;
  
  // Se a data já tem horário, usar como está
  if (dateString.includes('T') || dateString.includes(' ')) {
    return new Date(dateString);
  }
  
  // Para datas sem horário (YYYY-MM-DD), criar data local
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

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
          className="w-full justify-between font-normal"
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
      <PopoverContent className="w-full p-2" align="start">
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

interface WorkOrdersMobileProps {
  customerId: string;
}

export default function WorkOrdersMobile({ customerId }: WorkOrdersMobileProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: workOrdersResponse, isLoading, refetch } = useQuery<{
    data: any[];
    statusCounts?: {
      abertas: number;
      vencidas: number;
      pausadas: number;
      concluidas: number;
      em_execucao: number;
      canceladas: number;
    };
    pagination?: any;
  }>({
    queryKey: ["/api/customers", customerId, "work-orders"],
    enabled: !!customerId,
  });

  // Extrair dados da resposta paginada
  const workOrders = workOrdersResponse?.data || [];
  const statusCounts = workOrdersResponse?.statusCounts;

  const { data: zones } = useQuery({
    queryKey: ["/api/customers", customerId, "zones"],
    enabled: !!customerId,
  });

  const handleRefresh = () => {
    refetch();
    setLastUpdate(new Date());
    toast({ title: "Atualizado!" });
  };

  const filteredWorkOrders = workOrders.filter((wo: any) => {
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(wo.status);
    const matchesZone = zoneFilter.length === 0 || zoneFilter.includes(wo.zoneId);
    const matchesSearch = wo.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wo.number?.toString().includes(searchTerm);
    return matchesStatus && matchesZone && matchesSearch;
  });

  // Usar statusCounts da API para contagens precisas (totais reais, não limitados pela paginação)
  const totalAbertas = statusCounts?.abertas || workOrders.filter((wo: any) => 
    wo.status === 'aberta' || wo.status === 'atrasada'
  ).length || 0;
  
  const totalVencidas = statusCounts?.vencidas || workOrders.filter((wo: any) => 
    wo.status === 'vencida'
  ).length || 0;
  
  const totalConcluidas = statusCounts?.concluidas || workOrders.filter((wo: any) => 
    wo.status === 'concluida'
  ).length || 0;

  const getZoneName = (zoneId: string) => {
    const zone = (zones as any[])?.find((z: any) => z.id === zoneId);
    return zone?.name || "N/A";
  };

  const getStatusBadge = (status: string, id?: string) => {
    const testId = id ? `badge-status-${status}-${id}` : `badge-status-${status}`;
    switch (status) {
      case "vencida":
        return <Badge className="bg-red-500 text-white text-xs" data-testid={testId}>Vencida</Badge>;
      case "concluida":
        return <Badge className="bg-green-500 text-white text-xs" data-testid={testId}>Concluída</Badge>;
      case "cancelada":
        return <Badge className="bg-gray-500 text-white text-xs" data-testid={testId}>Cancelada</Badge>;
      default:
        return <Badge className="bg-blue-500 text-white text-xs" data-testid={testId}>Aberta</Badge>;
    }
  };

  const getPriorityBadge = (priority: string, id?: string) => {
    const testId = id ? `badge-priority-${priority}-${id}` : `badge-priority-${priority}`;
    switch (priority) {
      case "critica":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs" data-testid={testId}>Crítica</Badge>;
      case "alta":
        return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs" data-testid={testId}>Alta</Badge>;
      case "media":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs" data-testid={testId}>Média</Badge>;
      default:
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs" data-testid={testId}>Baixa</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header com atualização */}
      <div className="bg-white border-b p-4 space-y-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600" data-testid="text-last-update">
            Última atualização: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            className="flex items-center gap-2"
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </Button>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar por ID ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-2 gap-2">
          <MultiSelect
            options={[
              { value: "aberta", label: "Abertas" },
              { value: "vencida", label: "Vencidas" },
              { value: "concluida", label: "Concluídas" },
              { value: "cancelada", label: "Canceladas" }
            ]}
            selected={statusFilter}
            onChange={setStatusFilter}
            placeholder="Todos os Status"
            testId="select-status-filter"
          />

          <MultiSelect
            options={(zones as any[] || []).map((zone: any) => ({
              value: zone.id,
              label: zone.name
            }))}
            selected={zoneFilter}
            onChange={setZoneFilter}
            placeholder="Todas as Zonas"
            testId="select-zone-filter"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-4 grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg" data-testid="card-stats-abertas">
          <CardContent className="p-4 text-center">
            <Clock className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-2xl font-bold text-white" data-testid="text-count-abertas">{totalAbertas}</p>
            <p className="text-xs text-white/80">Abertas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 border-0 shadow-lg" data-testid="card-stats-vencidas">
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-2xl font-bold text-white" data-testid="text-count-vencidas">{totalVencidas}</p>
            <p className="text-xs text-white/80">Vencidas</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-lg" data-testid="card-stats-concluidas">
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-6 h-6 text-white mx-auto mb-2" />
            <p className="text-2xl font-bold text-white" data-testid="text-count-concluidas">{totalConcluidas}</p>
            <p className="text-xs text-white/80">Concluídas</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de OS */}
      <div className="p-4 space-y-3">
        <h2 className="text-lg font-semibold mb-3">Ordens de Serviço</h2>
        {filteredWorkOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              Nenhuma ordem de serviço encontrada
            </CardContent>
          </Card>
        ) : (
          filteredWorkOrders.map((wo: any) => (
            <Card key={wo.id} className="hover:shadow-md transition-shadow" data-testid={`card-workorder-${wo.id}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono text-sm font-semibold text-blue-600" data-testid={`text-workorder-number-${wo.id}`}>
                        #{wo.number || wo.id?.slice(0, 3)}
                      </p>
                      <p className="font-medium text-gray-900 mt-1" data-testid={`text-workorder-title-${wo.id}`}>
                        {wo.title || 'Sem título'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {getStatusBadge(wo.status, wo.id)}
                    </div>
                  </div>

                  {/* Local (Zona) - Destaque */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {wo.site?.name && (
                      <Badge variant="outline" className="flex items-center gap-1 text-xs" data-testid={`badge-site-${wo.id}`}>
                        <Building2 className="w-3 h-3" />
                        {wo.site.name}
                      </Badge>
                    )}
                    {wo.zone?.name && (
                      <Badge variant="outline" className="flex items-center gap-1 text-xs" data-testid={`badge-zone-${wo.id}`}>
                        <MapPin className="w-3 h-3" />
                        {wo.zone.name}
                      </Badge>
                    )}
                  </div>

                  {/* Detalhes */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Tipo</p>
                      <p className="font-medium" data-testid={`text-workorder-type-${wo.id}`}>
                        {wo.orderType === 'programada' ? 'Programada' : 
                         wo.orderType === 'corretiva_interna' ? 'Corretiva' : 'Pública'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Prioridade</p>
                      <div className="mt-0.5">
                        {getPriorityBadge(wo.priority, wo.id)}
                      </div>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Data</p>
                      <p className="font-medium text-blue-600" data-testid={`text-workorder-date-${wo.id}`}>
                        {wo.scheduledDate ? parseLocalDate(wo.scheduledDate)?.toLocaleDateString('pt-BR') : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Status</p>
                      <p className="font-medium" data-testid={`text-workorder-status-${wo.id}`}>
                        {wo.status === 'aberta' ? 'Aberta' : 
                         wo.status === 'pausada' ? 'Pausada' :
                         wo.status === 'concluida' ? 'Concluída' : 
                         wo.status === 'vencida' ? 'Vencida' : wo.status}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
