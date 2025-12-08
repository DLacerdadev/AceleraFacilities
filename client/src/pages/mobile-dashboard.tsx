import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthState, canOnlyViewOwnWorkOrders } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrCode, ClipboardList, Clock, CheckCircle, AlertCircle, Camera, User, LogOut, MapPin, Calendar, Filter, Play, Zap, ChevronLeft, ChevronRight, Building } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { logout } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
import { useModule } from "@/contexts/ModuleContext";
import { useClient } from "@/contexts/ClientContext";
import { MobileHeader } from "@/components/mobile-header";
import PullToRefresh from "react-simple-pull-to-refresh";
import { Capacitor } from "@capacitor/core";
import { isToday } from "date-fns";

interface WorkOrder {
  id: string;
  number: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  type: string;
  assignedUserId: string | null;
  siteName: string;
  zoneName: string;
  dueDate: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

type FilterType = 'pendentes_dia' | 'minhas_os';

export default function MobileDashboard() {
  const { currentModule } = useModule();
  const { activeClientId, setActiveClientId, activeClient, customers } = useClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = getAuthState();
  const [activeFilter, setActiveFilter] = useState<FilterType>('pendentes_dia');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPageAvailable, setCurrentPageAvailable] = useState(0);
  const [currentPageCompleted, setCurrentPageCompleted] = useState(0);
  const ITEMS_PER_PAGE = 5;
  
  // Verificar se é customer_user (usuário de cliente) - não pode trocar de cliente
  const isCustomerUser = (user as any)?.userType === 'customer_user';
  
  // Get customerId - usar activeClientId do contexto ou fallback para customerId/assignedClientId do user
  const effectiveCustomerId = activeClientId || (user ? ((user as any).customerId || (user as any).assignedClientId) : null);
  
  // Get current location context from localStorage (set by QR scanner)
  const currentLocation = JSON.parse(localStorage.getItem('current-location') || 'null');
  
  // Helper function to fetch work orders with specific params
  const fetchWorkOrders = async (assignedToValue: string) => {
    const params = new URLSearchParams();
    
    if (currentModule) {
      params.append('module', currentModule);
    }
    if (currentLocation?.zoneId) {
      params.append('zoneId', currentLocation.zoneId);
    }
    params.append('assignedTo', assignedToValue);
    params.append('limit', '1000'); // Buscar até 1000 registros para garantir que todas as O.S. sejam retornadas
    
    let url = `/api/customers/${effectiveCustomerId}/work-orders?${params.toString()}`;
    
    if (Capacitor.isNativePlatform()) {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://facilities.grupoopus.com';
      url = baseUrl + url;
    }
    
    const token = localStorage.getItem("acelera_token");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const response = await fetch(url, {
      headers,
      credentials: "include"
    });
    
    if (!response.ok) throw new Error('Failed to fetch work orders');
    return response.json();
  };
  
  // Query 1: Minhas (atribuídas ao usuário)
  const { data: myResponse, isLoading: isLoadingMy } = useQuery({
    queryKey: ["/api/customers", effectiveCustomerId, "work-orders-my", { module: currentModule, userId: user?.id, zoneId: currentLocation?.zoneId }],
    enabled: !!effectiveCustomerId && !!user,
    queryFn: () => fetchWorkOrders(user!.id)
  });
  
  // Query 2: Disponíveis (não atribuídas)
  const { data: availableResponse, isLoading: isLoadingAvailable } = useQuery({
    queryKey: ["/api/customers", effectiveCustomerId, "work-orders-available", { module: currentModule, zoneId: currentLocation?.zoneId }],
    enabled: !!effectiveCustomerId && !!user,
    queryFn: () => fetchWorkOrders('nao_atribuido')
  });
  
  const isLoading = isLoadingAvailable || isLoadingMy;
  
  // Dados das queries separados
  const myData = (myResponse?.data || []) as WorkOrder[];
  const availableData = (availableResponse?.data || []) as WorkOrder[];
  
  // Contar manualmente de myData pq precisa filtrar por status específico
  const myPendingCount = myData.filter((wo: WorkOrder) => wo.status === 'aberta' || wo.status === 'vencida').length;
  const myPausedCount = myData.filter((wo: WorkOrder) => wo.status === 'pausada').length;
  
  // ✅ CORRIGIDO: Contar TODAS as O.S. concluídas do mês atual, independente do filtro de data
  const getCurrentMonthCompletedCount = () => {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    // Definir horário para 23:59:59.999 para incluir O.S. concluídas em qualquer horário do último dia
    lastDayOfMonth.setHours(23, 59, 59, 999);
    
    return myData.filter((wo: WorkOrder) => {
      if (wo.status !== 'concluida') return false;
      if (!wo.completedAt) return false;
      
      const completedDate = new Date(wo.completedAt);
      return completedDate >= firstDayOfMonth && completedDate <= lastDayOfMonth;
    }).length;
  };
  
  const myCompletedCount = getCurrentMonthCompletedCount();
  
  // Status counts: Usar os contadores reais da API (não limitados pela paginação)
  // Para "Minhas O.S.", usamos os statusCounts de myResponse que contém todos os status
  // Para "Disponíveis", usamos os statusCounts de availableResponse
  const statusCounts = {
    abertas: availableResponse?.statusCounts?.abertas || 0,  // TODAS as abertas sem atribuição (para card de Disponíveis)
    pendentes: (myResponse?.statusCounts?.abertas || 0) + (myResponse?.statusCounts?.vencidas || 0),  // Minhas abertas + vencidas (usando contador da API)
    vencidas: myResponse?.statusCounts?.vencidas || 0,
    pausadas: myResponse?.statusCounts?.pausadas || 0,  // Usando contador da API
    concluidas: myResponse?.statusCounts?.concluidas || 0  // Todas as minhas concluídas (usando contador da API)
  };
  
  // Combinar dados: disponíveis + minhas para exibição nos cards
  const allWorkOrders = [
    ...availableData,
    ...myData
  ];
  
  const workOrders = allWorkOrders;
  
  // Verificar se o usuário é colaborador
  if (!user || !canOnlyViewOwnWorkOrders(user)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-slate-600">Redirecionando...</p>
        </div>
      </div>
    );
  }

  // If no customer assigned, show error
  if (!effectiveCustomerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso Negado</h2>
            <p className="text-slate-600">
              Seu usuário não está associado a nenhum cliente. Entre em contato com o administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === NOVOS FILTROS SIMPLIFICADOS ===
  
  // O.S. Disponíveis (não atribuídas, abertas)
  const allAvailableOrders = useMemo(() => {
    return workOrders
      .filter(wo => !wo.assignedUserId && wo.status !== 'concluida' && wo.status !== 'cancelada' && wo.status !== 'pausada')
      .sort((a, b) => b.number - a.number);
  }, [workOrders]);

  // Pendentes Hoje - O.S. DISPONÍVEIS (não atribuídas) com data de hoje
  const pendentesHoje = useMemo(() => {
    return allAvailableOrders
      .filter(wo => {
        const orderDate = new Date(wo.dueDate || wo.createdAt);
        return isToday(orderDate);
      });
  }, [allAvailableOrders]);

  // Minhas O.S. - Todas atribuidas ao operador (qualquer status exceto concluida/cancelada)
  const minhasOS = useMemo(() => {
    if (!user) return [];
    return workOrders
      .filter(wo => {
        const assignedIds = (wo as any).assignedUserIds || [];
        const isAssignedToMe = assignedIds.includes(user.id) || wo.assignedUserId === user.id;
        const isActive = wo.status !== 'concluida' && wo.status !== 'cancelada';
        return isAssignedToMe && isActive;
      })
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { 'em_execucao': 0, 'pausada': 1, 'aberta': 2 };
        const aOrder = statusOrder[a.status] ?? 3;
        const bOrder = statusOrder[b.status] ?? 3;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return b.number - a.number;
      });
  }, [workOrders, user]);

  // Lista filtrada baseada no filtro ativo (para exibição principal)
  const filteredOrders = activeFilter === 'pendentes_dia' ? pendentesHoje : minhasOS;

  // Paginação para lista filtrada
  const totalPagesFiltered = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedFilteredOrders = filteredOrders.slice(
    currentPageAvailable * ITEMS_PER_PAGE,
    (currentPageAvailable + 1) * ITEMS_PER_PAGE
  );

  // Compatibilidade com código existente
  const availableOrders = allAvailableOrders;
  const totalPagesAvailable = totalPagesFiltered;
  const paginatedAvailableOrders = paginatedFilteredOrders;
  
  // Minhas em Execução - O.S que o colaborador trabalhou
  const myInProgressOrders = useMemo(() => {
    if (!user) return [];
    return workOrders.filter(wo => {
      const assignedIds = (wo as any).assignedUserIds || [];
      const isAssignedToMe = assignedIds.includes(user.id) || wo.assignedUserId === user.id;
      return isAssignedToMe && wo.status === 'em_execucao';
    }).sort((a, b) => b.number - a.number);
  }, [workOrders, user]);
  
  const myPendingOrders = useMemo(() => {
    if (!user) return [];
    return workOrders.filter(wo => {
      const assignedIds = (wo as any).assignedUserIds || [];
      const isAssignedToMe = assignedIds.includes(user.id) || wo.assignedUserId === user.id;
      return isAssignedToMe && 
        wo.status !== 'concluida' && 
        wo.status !== 'cancelada' && 
        wo.status !== 'pausada' && 
        wo.status !== 'em_execucao';
    }).sort((a, b) => b.number - a.number);
  }, [workOrders, user]);
  
  const myPausedOrders = useMemo(() => {
    return workOrders.filter(wo => wo.status === 'pausada').sort((a, b) => b.number - a.number);
  }, [workOrders]);
  
  // O.S. Concluídas
  const myCompletedOrdersAll = useMemo(() => {
    if (!user) return [];
    return workOrders.filter(wo => {
      const assignedIds = (wo as any).assignedUserIds || [];
      const isAssignedToMe = assignedIds.includes(user.id) || wo.assignedUserId === user.id;
      return isAssignedToMe && wo.status === 'concluida';
    }).sort((a, b) => b.number - a.number);
  }, [workOrders, user]);
  
  // Paginação para O.S. Concluídas
  const totalPagesCompleted = Math.ceil(myCompletedOrdersAll.length / ITEMS_PER_PAGE);
  const paginatedCompletedOrders = myCompletedOrdersAll.slice(
    currentPageCompleted * ITEMS_PER_PAGE,
    (currentPageCompleted + 1) * ITEMS_PER_PAGE
  );
  const myCompletedOrders = paginatedCompletedOrders;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Invalidar ambas as queries
    await Promise.all([
      queryClient.invalidateQueries({ 
        queryKey: ["/api/customers", effectiveCustomerId, "work-orders-available"] 
      }),
      queryClient.invalidateQueries({ 
        queryKey: ["/api/customers", effectiveCustomerId, "work-orders-my"] 
      })
    ]);
    setTimeout(() => setIsRefreshing(false), 1000);
    toast({
      title: "Atualizado!",
      description: "Lista de ordens de serviço atualizada.",
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
      setLocation("/login");
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro no logout",
        description: "Houve um problema ao fazer logout.",
        variant: "destructive",
      });
    }
  };

  const handleQrScanner = () => {
    setLocation("/mobile/qr-scanner");
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'aberta': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'em_andamento': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'concluida': return 'bg-green-100 text-green-800 border-green-200';
      case 'pausada': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'cancelada': return 'bg-red-100 text-red-800 border-red-200';
      case 'vencida': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'baixa': return 'bg-green-500';
      case 'media': return 'bg-yellow-500';
      case 'alta': return 'bg-orange-500';
      case 'critica': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Formata DATE (scheduledDate, dueDate) - apenas data, sem hora
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
    return dateString;
  };

  // Formata TIMESTAMP (createdAt, completedAt, startedAt) - data e hora
  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600">Carregando suas ordens de serviço...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 overflow-x-hidden">
      {/* Header Mobile com indicador de módulo */}
      <MobileHeader
        title={user.name}
        subtitle="Colaborador"
        actions={
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleLogout}
            className="text-white hover:bg-white/20"
          >
            <LogOut className="w-5 h-5" />
          </Button>
        }
      />

      {/* Seletor de Cliente - Apenas para usuários admin (não customer_user) */}
      {!isCustomerUser && customers.length > 0 && (
        <div className="px-4 py-3 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
            Cliente Ativo
          </label>
          <Select value={activeClientId} onValueChange={setActiveClientId}>
            <SelectTrigger 
              data-testid="mobile-customer-selector" 
              className="w-full bg-white shadow-sm border-slate-300 hover:border-blue-400 transition-colors h-11"
            >
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4 text-slate-500" />
                <SelectValue placeholder="Selecione um cliente" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      {/* Nome do cliente fixo para customer_user */}
      {isCustomerUser && activeClient && (
        <div className="px-4 py-3 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-slate-900">{activeClient.name}</span>
          </div>
        </div>
      )}

      <PullToRefresh onRefresh={handleRefresh}>
        <div className="p-4 space-y-6">
        {/* 🔥 CARD PERMANENTE: Minhas O.S em Execução - SEMPRE VISÍVEL */}
        <Card className={`border-0 shadow-2xl ${
          myInProgressOrders.length > 0 
            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' 
            : 'bg-gradient-to-r from-slate-400 to-slate-500 text-white'
        }`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white font-bold flex items-center gap-2">
                <Zap className="w-6 h-6" />
                {myInProgressOrders.length > 0 ? '🔥 Em Execução Agora' : 'Minhas Execuções'}
              </CardTitle>
              <Badge className="bg-white/30 text-white border-white/50 font-bold px-3 py-1 text-base">
                {myInProgressOrders.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {myInProgressOrders.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Play className="w-8 h-8 text-white/80" />
                </div>
                <p className="text-white/90 font-medium mb-1">Nenhuma O.S em execução</p>
                <p className="text-white/70 text-sm">Escaneie um QR Code para iniciar uma tarefa</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-white/90 text-sm font-medium mb-3">
                  Você iniciou {myInProgressOrders.length} {myInProgressOrders.length === 1 ? 'tarefa' : 'tarefas'}:
                </p>
                {myInProgressOrders.map((wo) => (
                  <div
                    key={wo.id}
                    onClick={() => setLocation(`/mobile/work-order-details/${wo.id}`)}
                    className="bg-white/20 backdrop-blur-md rounded-lg p-4 cursor-pointer hover:bg-white/30 transition-all active:scale-95 border border-white/30"
                    data-testid={`card-in-progress-${wo.id}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-white/40 text-white border-white/60 font-bold text-xs">
                            OS #{wo.number}
                          </Badge>
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(wo.priority)} animate-pulse`}></div>
                        </div>
                        <h3 className="text-white font-bold text-base break-words">{wo.title}</h3>
                        <div className="flex items-center space-x-2 text-sm text-white/90 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span>{wo.siteName} - {wo.zoneName}</span>
                        </div>
                      </div>
                      <Play className="w-6 h-6 text-white/80 flex-shrink-0" />
                    </div>
                    <div className="flex items-center justify-between text-xs text-white/90 mt-2">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Prazo: {formatDate(wo.dueDate)}</span>
                      </div>
                      <span className="capitalize bg-white/20 px-2 py-0.5 rounded">{wo.type.replace('_', ' ')}</span>
                    </div>
                    {wo.startedAt && (
                      <div className="flex items-center gap-1 text-xs text-white/80 mt-2 pt-2 border-t border-white/20">
                        <Clock className="w-3 h-3" />
                        <span>Iniciado: {formatDateTime(wo.startedAt)}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filtros Simplificados */}
        <Card className="bg-white/90 backdrop-blur-sm border-white/30 shadow-lg">
          <CardContent className="p-3">
            <div className="flex gap-2">
              <Button
                variant={activeFilter === 'pendentes_dia' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('pendentes_dia')}
                className={`flex-1 ${activeFilter === 'pendentes_dia' 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                }`}
                data-testid="filter-pendentes-dia"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Pendentes Hoje
              </Button>
              
              <Button
                variant={activeFilter === 'minhas_os' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveFilter('minhas_os')}
                className={`flex-1 ${activeFilter === 'minhas_os' 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'border-blue-200 text-blue-700 hover:bg-blue-50'
                }`}
                data-testid="filter-minhas-os"
              >
                <User className="w-4 h-4 mr-2" />
                Minhas O.S.
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Location Context */}
        {currentLocation && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <MapPin className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Local Ativo</p>
                  <p className="text-xs text-blue-700">{currentLocation.zoneName}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem('current-location');
                      window.location.reload();
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 p-0 h-auto mt-1"
                  >
                    Ver todas as OS
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="space-y-3">
          {/* Card Especial: Em Execução */}
          {myInProgressOrders.length > 0 && (
            <Card 
              className="bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0 shadow-xl cursor-pointer hover:shadow-2xl transition-all active:scale-95"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              data-testid="card-em-execucao"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 bg-white/30 rounded-full flex items-center justify-center">
                      <Zap className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{myInProgressOrders.length}</p>
                      <p className="text-sm font-medium opacity-90">🔥 Em Execução</p>
                    </div>
                  </div>
                  <Play className="w-8 h-8 text-white/70" />
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* Grid de Cards Normais */}
          <div className="grid grid-cols-2 gap-3">
            <Card 
              className="bg-white/80 backdrop-blur-sm border-white/20 cursor-pointer hover:shadow-lg transition-shadow active:scale-95"
              onClick={() => {
                setActiveFilter('pendentes_dia');
                setTimeout(() => {
                  document.getElementById('disponiveis-section')?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                  });
                }, 100);
              }}
              data-testid="card-disponiveis"
            >
              <CardContent className="p-3">
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                  </div>
                  <p className="text-xl font-bold text-slate-900">{statusCounts.abertas}</p>
                  <p className="text-xs text-slate-600 text-center">Disponíveis</p>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="bg-white/80 backdrop-blur-sm border-white/20 cursor-pointer hover:shadow-lg transition-shadow active:scale-95"
              onClick={() => {
                setActiveFilter('minhas_os');
                setTimeout(() => {
                  document.getElementById('disponiveis-section')?.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                  });
                }, 100);
              }}
              data-testid="card-pendentes"
            >
              <CardContent className="p-3">
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <ClipboardList className="w-5 h-5 text-blue-600" />
                  </div>
                  <p className="text-xl font-bold text-slate-900">{statusCounts.pendentes}</p>
                  <p className="text-xs text-slate-600 text-center">Pendentes</p>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="bg-white/80 backdrop-blur-sm border-white/20 cursor-pointer hover:shadow-lg transition-shadow active:scale-95"
              onClick={() => {
                document.getElementById('pausadas-section')?.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'start' 
                });
              }}
              data-testid="card-pausadas"
            >
              <CardContent className="p-3">
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-xl font-bold text-slate-900">{statusCounts.pausadas}</p>
                  <p className="text-xs text-slate-600 text-center">Pausadas</p>
                </div>
              </CardContent>
            </Card>
            
            <Card 
              className="bg-white/80 backdrop-blur-sm border-white/20 cursor-pointer hover:shadow-lg transition-shadow active:scale-95"
              onClick={() => {
                document.getElementById('concluidas-section')?.scrollIntoView({ 
                  behavior: 'smooth', 
                  block: 'start' 
                });
              }}
              data-testid="card-concluidas"
            >
              <CardContent className="p-3">
                <div className="flex flex-col items-center justify-center space-y-1">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-xl font-bold text-slate-900">{statusCounts.concluidas}</p>
                  <p className="text-xs text-slate-600 text-center">Concluídas</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* QR Scanner Button */}
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <Button 
              onClick={handleQrScanner}
              data-testid="button-qr-scanner"
              className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 h-16 text-lg font-semibold"
              size="lg"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
                  <QrCode className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">Escanear QR Code</div>
                  <div className="text-sm opacity-90">Iniciar nova ordem de serviço</div>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* Work Orders List - Baseada no Filtro Ativo */}
        <div className="space-y-4" id="disponiveis-section" data-section="pendentes-section">
          <h2 className={`text-xl font-bold flex items-center gap-2 ${
            activeFilter === 'pendentes_dia' ? 'text-orange-900' : 'text-blue-900'
          }`}>
            {activeFilter === 'pendentes_dia' ? (
              <>
                <AlertCircle className="w-6 h-6" />
                OS Disponíveis Hoje ({filteredOrders.length})
              </>
            ) : (
              <>
                <User className="w-6 h-6" />
                Minhas O.S. ({filteredOrders.length})
              </>
            )}
          </h2>

          {filteredOrders.length === 0 ? (
            <Card className="bg-white/80 backdrop-blur-sm border-white/20">
              <CardContent className="p-6 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 mb-2">
                  {activeFilter === 'pendentes_dia' ? 'Nenhuma O.S. disponível hoje!' : 'Nenhuma O.S. atribuída a você!'}
                </h3>
                <p className="text-slate-600">
                  {activeFilter === 'pendentes_dia' 
                    ? 'Não há ordens de serviço disponíveis para hoje.'
                    : 'Você não tem ordens de serviço atribuídas no momento.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            paginatedFilteredOrders.map((workOrder) => (
              <Card key={workOrder.id} className={`backdrop-blur-sm shadow-lg ${
                activeFilter === 'pendentes_dia' 
                  ? 'bg-orange-50/80 border-orange-200' 
                  : 'bg-blue-50/80 border-blue-200'
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`text-white font-bold ${
                          activeFilter === 'pendentes_dia' 
                            ? 'bg-orange-600 border-orange-700' 
                            : 'bg-blue-600 border-blue-700'
                        }`}>
                          OS #{workOrder.number}
                        </Badge>
                      </div>
                      <CardTitle className={`text-lg break-words ${
                        activeFilter === 'pendentes_dia' ? 'text-orange-900' : 'text-blue-900'
                      }`}>{workOrder.title}</CardTitle>
                      <div className={`flex items-center space-x-2 text-sm ${
                        activeFilter === 'pendentes_dia' ? 'text-orange-700' : 'text-blue-700'
                      }`}>
                        <MapPin className="w-4 h-4" />
                        <span>{workOrder.siteName} - {workOrder.zoneName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <div className={`w-3 h-3 rounded-full ${getPriorityColor(workOrder.priority)}`}></div>
                      <Badge variant="outline" className={`${
                        activeFilter === 'pendentes_dia' 
                          ? 'bg-orange-100 text-orange-800 border-orange-200' 
                          : getStatusColor(workOrder.status)
                      }`}>
                        {activeFilter === 'pendentes_dia' ? 'Disponível' : workOrder.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className={`mb-3 ${
                    activeFilter === 'pendentes_dia' ? 'text-orange-800' : 'text-blue-800'
                  }`}>{workOrder.description}</p>
                  <div className={`flex items-center justify-between text-sm mb-3 ${
                    activeFilter === 'pendentes_dia' ? 'text-orange-600' : 'text-blue-600'
                  }`}>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>Prazo: {formatDate(workOrder.dueDate)}</span>
                    </div>
                    <span className="font-medium capitalize">{workOrder.type.replace('_', ' ')}</span>
                  </div>
                  <Button 
                    className={`w-full ${
                      activeFilter === 'pendentes_dia' 
                        ? 'bg-orange-600 hover:bg-orange-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    data-testid={`button-view-order-${workOrder.id}`}
                    onClick={() => setLocation(`/mobile/work-order-details/${workOrder.id}`)}
                  >
                    Ver Detalhes
                  </Button>
                </CardContent>
              </Card>
            ))
          )}

          {/* Pagination Controls */}
          {totalPagesFiltered > 1 && (
            <div className="flex items-center justify-between gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPageAvailable(Math.max(0, currentPageAvailable - 1))}
                disabled={currentPageAvailable === 0}
                className={`bg-white/80 ${
                  activeFilter === 'pendentes_dia' 
                    ? 'border-orange-200 hover:bg-orange-50' 
                    : 'border-blue-200 hover:bg-blue-50'
                }`}
                data-testid="button-prev-available"
              >
                <ChevronLeft className="w-4 h-4" />
                Anterior
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPagesFiltered }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPageAvailable(index)}
                    className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                      currentPageAvailable === index
                        ? (activeFilter === 'pendentes_dia' ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white')
                        : (activeFilter === 'pendentes_dia' ? 'bg-white/80 text-orange-900 hover:bg-orange-100' : 'bg-white/80 text-blue-900 hover:bg-blue-100')
                    }`}
                    data-testid={`button-page-available-${index}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPageAvailable(Math.min(totalPagesFiltered - 1, currentPageAvailable + 1))}
                disabled={currentPageAvailable === totalPagesFiltered - 1}
                className={`bg-white/80 ${
                  activeFilter === 'pendentes_dia' 
                    ? 'border-orange-200 hover:bg-orange-50' 
                    : 'border-blue-200 hover:bg-blue-50'
                }`}
                data-testid="button-next-available"
              >
                Próximo
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Work Orders List - Pausadas */}
        {myPausedOrders.length > 0 && (
          <div className="space-y-4" id="pausadas-section">
            <h2 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              <Clock className="w-6 h-6" />
              OSs Pausadas ({myPausedOrders.length})
            </h2>

            {myPausedOrders.map((workOrder) => (
              <Card key={workOrder.id} className="bg-amber-50/80 backdrop-blur-sm border-amber-200 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-amber-600 text-white border-amber-700 font-bold">
                          OS #{workOrder.number}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-amber-900 break-words">{workOrder.title}</CardTitle>
                      <div className="flex items-center space-x-2 text-sm text-amber-700">
                        <MapPin className="w-4 h-4" />
                        <span>{workOrder.siteName} - {workOrder.zoneName}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <div className={`w-3 h-3 rounded-full ${getPriorityColor(workOrder.priority)}`}></div>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200">
                        Pausada
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-amber-800 mb-3">{workOrder.description}</p>
                  <div className="flex items-center justify-between text-sm text-amber-600 mb-3">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>Prazo: {formatDate(workOrder.dueDate)}</span>
                    </div>
                    <span className="font-medium capitalize">{workOrder.type.replace('_', ' ')}</span>
                  </div>
                  <Button 
                    className="w-full bg-amber-600 hover:bg-amber-700" 
                    data-testid={`button-view-order-${workOrder.id}`}
                    onClick={() => setLocation(`/mobile/work-order-details/${workOrder.id}`)}
                  >
                    Retomar OS
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Work Orders List - Minhas Concluídas */}
        {myCompletedOrdersAll.length > 0 && (
          <div className="space-y-4" id="concluidas-section">
            <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle className="w-6 h-6" />
              Minhas Concluídas ({myCompletedOrdersAll.length})
            </h2>

            {myCompletedOrders.map((workOrder) => (
              <Card key={workOrder.id} className="bg-emerald-50/80 backdrop-blur-sm border-emerald-200 shadow-lg">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-emerald-600 text-white border-emerald-700 font-bold">
                          OS #{workOrder.number}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-emerald-900 break-words">{workOrder.title}</CardTitle>
                      <div className="flex items-center space-x-2 text-sm text-emerald-700">
                        <MapPin className="w-4 h-4" />
                        <span>{workOrder.siteName} - {workOrder.zoneName}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                      Concluída
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-emerald-800 mb-3 text-sm">{workOrder.description}</p>
                  <div className="flex items-center justify-between text-sm text-emerald-600">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>Concluída em: {formatDateTime(workOrder.completedAt || workOrder.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Pagination Controls for Completed Orders */}
            {totalPagesCompleted > 1 && (
              <div className="flex items-center justify-between gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageCompleted(Math.max(0, currentPageCompleted - 1))}
                  disabled={currentPageCompleted === 0}
                  className="bg-white/80 border-emerald-200 hover:bg-emerald-50"
                  data-testid="button-prev-completed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPagesCompleted }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentPageCompleted(index)}
                      className={`w-8 h-8 rounded text-sm font-medium transition-colors ${
                        currentPageCompleted === index
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/80 text-emerald-900 hover:bg-emerald-100'
                      }`}
                      data-testid={`button-page-completed-${index}`}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPageCompleted(Math.min(totalPagesCompleted - 1, currentPageCompleted + 1))}
                  disabled={currentPageCompleted === totalPagesCompleted - 1}
                  className="bg-white/80 border-emerald-200 hover:bg-emerald-50"
                  data-testid="button-next-completed"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
      </PullToRefresh>
    </div>
  );
}