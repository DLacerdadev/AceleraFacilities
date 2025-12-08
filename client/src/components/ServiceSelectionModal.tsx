import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Building2, X, Wrench, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Capacitor } from "@capacitor/core";

// Get API base URL for mobile
function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return import.meta.env.VITE_API_BASE_URL || 'https://facilities.grupoopus.com';
  }
  return '';
}

interface ServiceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  resolvedContext: any;
  scannedQrCode: string;
  onServiceSelect: (serviceId: string, workOrderId?: string) => void;
}

// Helper para parsear data local sem conversão de timezone
const parseLocalDate = (dateString: string | null): Date | null => {
  if (!dateString) return null;
  
  // Se a data já tem horário (ISO format com T)
  if (dateString.includes('T')) {
    return parseISO(dateString);
  }
  
  // Se tem espaço e hora (timestamp com espaço)
  if (dateString.includes(' ')) {
    try {
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {}
  }
  
  // Para datas sem horário (YYYY-MM-DD), criar data local
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export default function ServiceSelectionModal({
  isOpen,
  onClose,
  resolvedContext,
  scannedQrCode,
  onServiceSelect,
}: ServiceSelectionModalProps) {
  const { toast } = useToast();
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<string>("");
  const [isLoadingServices, setIsLoadingServices] = useState(true);
  const [availableWorkOrders, setAvailableWorkOrders] = useState<any[]>([]);
  const [isLoadingWorkOrders, setIsLoadingWorkOrders] = useState(false);
  const [dateFilter, setDateFilter] = useState<'today' | 'paused'>('today');
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && resolvedContext?.customer?.id) {
      loadServices();
      // Load work orders automatically when modal opens (don't wait for service selection)
      loadWorkOrdersForZone();
    }
  }, [isOpen, resolvedContext]);

  useEffect(() => {
    if (selectedService && resolvedContext?.zone?.id) {
      loadWorkOrdersForService(selectedService);
    }
  }, [selectedService, resolvedContext]);

  const loadServices = async () => {
    setIsLoadingServices(true);
    try {
      const module = resolvedContext?.qrPoint?.module || 'clean';
      const baseUrl = getApiBaseUrl();
      
      // Carregar apenas serviços (não precisamos filtrar por work orders)
      const servicesResponse = await fetch(`${baseUrl}/api/customers/${resolvedContext.customer.id}/services?module=${module}`);
      
      if (servicesResponse.ok) {
        const allServices = await servicesResponse.json();
        
        // Mostrar TODOS os serviços do módulo atual
        const filteredServices = allServices.filter((s: any) => s.module === module);
        
        console.log('[SERVICE MODAL] Serviços disponíveis:', filteredServices.length, 'Total:', allServices.length);
        setServices(filteredServices || []);
      }
    } catch (error) {
      console.error('Erro ao carregar serviços:', error);
    } finally {
      setIsLoadingServices(false);
    }
  };

  const loadWorkOrdersForZone = async () => {
    setIsLoadingWorkOrders(true);
    setSelectedWorkOrder(null);
    try {
      const module = resolvedContext?.qrPoint?.module || 'clean';
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/customers/${resolvedContext.customer.id}/work-orders?module=${module}&zoneId=${resolvedContext.zone?.id}`);
      if (response.ok) {
        const workOrdersResponse = await response.json();
        
        // Extrair work orders da estrutura paginada { data: [...], pagination: {...} }
        const allWorkOrders = workOrdersResponse.data || workOrdersResponse;
        
        // Filtrar work orders da zona atual com qualquer status (aberta, em_execucao, pausada)
        const filtered = allWorkOrders.filter((wo: any) => 
          wo.zoneId === resolvedContext.zone.id &&
          wo.module === module &&
          (wo.status === 'aberta' || wo.status === 'em_execucao' || wo.status === 'pausada')
        );
        
        console.log('[SERVICE MODAL] Work orders disponíveis - Zona:', resolvedContext.zone.name, 'Módulo:', module, 'Total:', filtered.length, 'Raw totals:', allWorkOrders.length);
        setAvailableWorkOrders(filtered);
      }
    } catch (error) {
      console.error('Erro ao carregar work orders:', error);
    } finally {
      setIsLoadingWorkOrders(false);
    }
  };

  const loadWorkOrdersForService = async (serviceId: string) => {
    // Quando um serviço é selecionado, não recarregue - use os que já foram carregados
    // Apenas reset a seleção de work order individual
    setSelectedWorkOrder(null);
  };

  const filteredWorkOrders = availableWorkOrders.filter((wo) => {
    if (dateFilter === 'paused') {
      return wo.status === 'pausada';
    } else if (dateFilter === 'today') {
      // Obter hoje em formato local YYYY-MM-DD
      const today = new Date();
      const todayString = today.getFullYear() + '-' + 
                         String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(today.getDate()).padStart(2, '0');
      
      // Extrair apenas YYYY-MM-DD da scheduledDate (ignora hora/timezone)
      const scheduledDateOnly = wo.scheduledDate ? wo.scheduledDate.substring(0, 10) : '';
      const match = scheduledDateOnly === todayString;
      
      if (availableWorkOrders.length <= 5) {
        console.log('[FILTER TODAY]', {
          wo_number: wo.number,
          wo_scheduledDate: wo.scheduledDate,
          scheduledDateOnly,
          todayString,
          match
        });
      }
      
      return match;
    }
    return true;
  });
  
  // Debug: Log resultado da filtragem
  if (selectedService && availableWorkOrders.length > 0) {
    console.log('[FILTER RESULT]', {
      dateFilter,
      availableCount: availableWorkOrders.length,
      filteredCount: filteredWorkOrders.length
    });
  }

  const selectedServiceData = services.find(s => s.id === selectedService);

  const handleExecuteExisting = () => {
    if (!selectedWorkOrder) {
      toast({
        title: "Selecione uma OS",
        description: "Escolha uma ordem de serviço para executar",
        variant: "destructive",
      });
      return;
    }
    console.log("✅ Executando OS existente:", selectedWorkOrder);
    onServiceSelect(selectedService, selectedWorkOrder);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <Card className="w-full max-w-lg max-h-[90vh] bg-white shadow-2xl flex flex-col">
        <CardHeader className="relative pb-4 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4"
            onClick={onClose}
            data-testid="button-close-modal"
          >
            <X className="w-5 h-5" />
          </Button>
          
          <CardTitle className="text-2xl font-bold text-slate-900">
            Executar Serviço
          </CardTitle>
          
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Building2 className="w-4 h-4" />
              <span className="font-medium">{resolvedContext?.site?.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4" />
              <span className="font-medium">{resolvedContext?.zone?.name}</span>
            </div>
            {resolvedContext?.qrPoint && (
              <Badge variant="outline" className="text-xs">
                Ponto: {resolvedContext.qrPoint.name || resolvedContext.qrPoint.code}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 overflow-y-auto flex-1">
          {/* Selecionar Serviço */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">
              Selecione o Serviço
            </h3>
            
            {isLoadingServices ? (
              <div className="text-center py-4 text-slate-500">
                Carregando serviços...
              </div>
            ) : services.length === 0 ? (
              <div className="text-center py-4 text-slate-500">
                Nenhum serviço disponível
              </div>
            ) : (
              <Select value={selectedService} onValueChange={setSelectedService}>
                <SelectTrigger data-testid="select-service" className="w-full">
                  <SelectValue placeholder="Escolha o tipo de serviço" />
                </SelectTrigger>
                <SelectContent className="z-[99999]">
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Mostrar lista de work orders após selecionar serviço */}
          {selectedService && (
            <div className="space-y-4 border-t pt-4">
              {isLoadingWorkOrders ? (
                <div className="text-center py-4 text-slate-500">
                  Buscando ordens de serviço...
                </div>
              ) : availableWorkOrders.length === 0 ? (
                <div className="border rounded-lg p-6 bg-blue-50 border-blue-200 text-center space-y-4">
                  <AlertCircle className="w-12 h-12 text-blue-500 mx-auto" />
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-1">
                      Nenhuma OS Disponível
                    </h4>
                    <p className="text-sm text-slate-600">
                      Não há ordens de serviço pendentes neste local ({resolvedContext?.zone?.name}).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg p-4 space-y-3 bg-amber-50 border-amber-200">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-amber-600" />
                    <h4 className="font-semibold text-slate-900">
                      Selecione a Ordem de Serviço
                    </h4>
                  </div>
                  
                  <p className="text-sm text-slate-600">
                    Encontramos {availableWorkOrders.length} ordem(ns) pendente(s) em <strong>{resolvedContext?.zone?.name}</strong>
                  </p>
                  
                  {/* Filtros por data */}
                  <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="today" className="text-xs">
                        Hoje
                      </TabsTrigger>
                      <TabsTrigger value="paused" className="text-xs">
                        Pausadas
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                  
                  {/* Lista de OS */}
                  {filteredWorkOrders.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-sm">
                      {dateFilter === 'today' && 'Nenhuma ordem agendada para hoje'}
                      {dateFilter === 'paused' && 'Nenhuma ordem pausada'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {filteredWorkOrders.map((wo) => {
                        const isSelected = selectedWorkOrder === wo.id;
                        const scheduledDate = parseLocalDate(wo.scheduledDate);
                        const isToday = scheduledDate && 
                          scheduledDate.toDateString() === new Date().toDateString();
                        
                        return (
                          <button
                            key={wo.id}
                            onClick={() => setSelectedWorkOrder(wo.id)}
                            className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                              isSelected 
                                ? 'border-amber-600 bg-white shadow-md' 
                                : 'border-slate-200 bg-white hover:border-amber-300'
                            }`}
                            data-testid={`wo-card-${wo.id}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <span className="font-semibold text-slate-900">
                                    OS #{wo.number}
                                  </span>
                                  {wo.status === 'pausada' && (
                                    <Badge className="bg-orange-600 text-white text-xs">
                                      ⏸ PAUSADA
                                    </Badge>
                                  )}
                                  {isToday && (
                                    <Badge className="bg-green-600 text-white text-xs">
                                      HOJE
                                    </Badge>
                                  )}
                                  {wo.priority === 'alta' && (
                                    <Badge variant="destructive" className="text-xs">
                                      Urgente
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 truncate">
                                  {wo.title}
                                </p>
                                {scheduledDate && (
                                  <p className="text-xs text-slate-500 mt-1">
                                    Agendada: {format(scheduledDate, 'dd/MM/yyyy HH:mm')}
                                  </p>
                                )}
                              </div>
                              {isSelected && (
                                <div className="flex-shrink-0">
                                  <div className="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </div>
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  
                  <Button
                    onClick={handleExecuteExisting}
                    disabled={!selectedWorkOrder}
                    className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50"
                    data-testid="button-execute-existing"
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    Executar OS
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
