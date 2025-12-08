import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useModule } from "@/contexts/ModuleContext";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { useLocation } from "wouter";
import { 
  Plus, 
  Calendar, 
  Clock, 
  MapPin,
  Eye,
  Edit,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  User,
  Timer,
  Save,
  Settings,
  Building2
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";

export default function CleaningSchedule() {
  const { activeClientId } = useClient();
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [viewMode, setViewMode] = useState<"monthly" | "list">("monthly");
  const [siteFilter, setSiteFilter] = useState("todos");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDayDetailsModal, setShowDayDetailsModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedActivities, setSelectedActivities] = useState<any[]>([]);
  const [showActivityDetailsModal, setShowActivityDetailsModal] = useState(false);
  const [showEditActivityModal, setShowEditActivityModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([]);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [metricsModalType, setMetricsModalType] = useState<'active' | 'daily' | 'weekly' | 'locations' | null>(null);

  // Removido: geração automática que estava criando OSs excessivamente

  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/customers", activeClientId, "cleaning-activities"],
    enabled: !!activeClientId,
  });

  // Removido: useEffect que estava gerando OSs automaticamente a cada carregamento

  const { data: sites } = useQuery({
    queryKey: ["/api/customers", activeClientId, "sites", { module: currentModule }],
    enabled: !!activeClientId,
  });

  const { data: zones } = useQuery({
    queryKey: ["/api/customers", activeClientId, "zones", { module: currentModule }],
    enabled: !!activeClientId,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/customers", activeClientId, "users"],
    enabled: !!activeClientId,
  });

  const { data: services } = useQuery({
    queryKey: ["/api/customers", activeClientId, "services"],
    enabled: !!activeClientId,
  });

  // Redirect if not in clean module
  useEffect(() => {
    if (currentModule !== 'clean') {
      setLocation('/');
    }
  }, [currentModule, setLocation]);

  // Mutation para gerar OSs manualmente
  const generateWorkOrdersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/scheduler/regenerate-monthly-maintenance', {});
      return response;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "work-orders"] });
      toast({
        title: "OSs geradas com sucesso!",
        description: `${data.totalGenerated} ordens de serviço foram criadas para o próximo mês.`,
      });
    },
    onError: () => {
      toast({
        title: "Erro ao gerar OSs",
        description: "Ocorreu um erro ao gerar as ordens de serviço.",
        variant: "destructive",
      });
    },
  });

  // Mutation to delete cleaning activity
  const deleteCleaningActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      await apiRequest('DELETE', `/api/cleaning-activities/${activityId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "cleaning-activities"] });
      toast({
        title: "Atividade excluída",
        description: "A atividade de limpeza foi removida com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir a atividade.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteActivity = async (activity: any) => {
    if (confirm(`Deseja realmente excluir a atividade "${activity.name}"? Esta ação não pode ser desfeita.`)) {
      await deleteCleaningActivityMutation.mutateAsync(activity.id);
    }
  };

  const getFrequencyBadge = (frequency: string) => {
    switch (frequency) {
      case "diaria":
        return <Badge className="bg-chart-2/10 text-chart-2">Diária</Badge>;
      case "semanal":
        return <Badge className="bg-chart-4/10 text-chart-4">Semanal</Badge>;
      case "mensal":
        return <Badge className="bg-primary/10 text-primary">Mensal</Badge>;
      case "trimestral":
        return <Badge className="bg-indigo-100/80 text-indigo-700">Trimestral</Badge>;
      case "semestral":
        return <Badge className="bg-violet-100/80 text-violet-700">Semestral</Badge>;
      case "anual":
        return <Badge className="bg-rose-100/80 text-rose-700">Anual</Badge>;
      case "turno":
        return <Badge className="bg-chart-1/10 text-chart-1">Por Turno</Badge>;
      default:
        return <Badge variant="outline">Personalizada</Badge>;
    }
  };

  // Função para gerar o calendário mensal
  const generateMonthCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayOfWeek = firstDay.getDay(); // 0 = domingo
    const daysInMonth = lastDay.getDate();
    
    const calendar = [];
    let day = 1;
    
    // Criar as semanas do mês
    for (let week = 0; week < 6; week++) {
      const weekDays = [];
      
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        if (week === 0 && dayOfWeek < firstDayOfWeek) {
          // Dias vazios antes do primeiro dia do mês
          weekDays.push(null);
        } else if (day > daysInMonth) {
          // Dias vazios depois do último dia do mês
          weekDays.push(null);
        } else {
          // Dias válidos do mês
          weekDays.push(day);
          day++;
        }
      }
      
      calendar.push(weekDays);
      
      // Se todos os dias do mês já foram adicionados, parar
      if (day > daysInMonth) break;
    }
    
    return calendar;
  };

  // Função para obter zona por ID
  const getZoneName = (zoneId: string) => {
    const zone = (zones as any[] || []).find((z: any) => z.id === zoneId);
    return zone?.name || 'Local não encontrado';
  };

  // Função para obter nomes de múltiplas zonas (compatível com campos antigos e novos)
  const getZoneNames = (activity: any) => {
    // Usar zone_ids (snake_case) ou zoneIds (camelCase) - novo formato
    const zoneIds = activity.zone_ids || activity.zoneIds;
    if (zoneIds && Array.isArray(zoneIds) && zoneIds.length > 0) {
      const names = zoneIds
        .map((id: string) => {
          const zone = (zones as any[] || []).find((z: any) => z.id === id);
          return zone?.name;
        })
        .filter(Boolean);
      return names.join(', ') || 'Zonas não encontradas';
    }
    
    // Fallback para formato antigo com zone_id/zoneId único
    const zoneId = activity.zone_id || activity.zoneId;
    if (zoneId) {
      return getZoneName(zoneId);
    }
    
    return 'Sem zona';
  };

  // Função para obter nomes de múltiplos sites
  const getSiteNames = (activity: any) => {
    // Usar site_ids (snake_case) ou siteIds (camelCase) - novo formato
    const siteIds = activity.site_ids || activity.siteIds;
    if (siteIds && Array.isArray(siteIds) && siteIds.length > 0) {
      const names = siteIds
        .map((id: string) => {
          const site = (sites as any[] || []).find((s: any) => s.id === id);
          return site?.name;
        })
        .filter(Boolean);
      return names.join(', ') || 'Sites não encontrados';
    }
    
    // Fallback para formato antigo com site_id/siteId único
    const siteId = activity.site_id || activity.siteId;
    if (siteId) {
      const site = (sites as any[] || []).find((s: any) => s.id === siteId);
      return site?.name || 'Site não encontrado';
    }
    
    return 'Sem site';
  };

  // Função para obter responsável por ID
  const getAssignedUserName = (userId: string) => {
    const user = (users as any[] || []).find((u: any) => u.id === userId);
    return user?.name || 'Não atribuído';
  };

  // Função para obter SLA baseado no tipo de atividade
  const getSLAForActivity = (activity: any) => {
    return `${activity.slaMinutes || 60}min`;
  };

  // Função para obter serviços relacionados a uma zona
  const getServicesForZone = (zoneId: string) => {
    return (services as any[] || []).filter((s: any) => s.zoneId === zoneId);
  };

  // Função para calcular próxima data de execução
  const getNextExecutionDate = (activity: any) => {
    const now = new Date();
    const lastExecution = activity.lastExecutedAt ? new Date(activity.lastExecutedAt) : null;
    
    if (!lastExecution) return 'Nunca executado';
    
    let nextDate = new Date(lastExecution);
    
    switch (activity.frequency) {
      case 'diaria':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'semanal':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'mensal':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'trimestral':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'semestral':
        nextDate.setMonth(nextDate.getMonth() + 6);
        break;
      case 'anual':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        return 'Frequência personalizada';
    }
    
    return nextDate.toLocaleDateString('pt-BR');
  };

  // Função para obter atividades de um dia específico
  const getActivitiesForDay = (day: number) => {
    if (!activities) return [];
    
    return (activities as any[]).filter((activity: any) => {
      // Criar a data do dia que estamos verificando
      const checkDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      checkDate.setHours(0, 0, 0, 0);
      
      // Verificar se a atividade já começou (startDate)
      if (activity.startDate) {
        // Parse startDate como string YYYY-MM-DD em timezone local
        const [year, month, dayOfMonth] = activity.startDate.split('-').map(Number);
        const startDate = new Date(year, month - 1, dayOfMonth);
        startDate.setHours(0, 0, 0, 0);
        
        if (checkDate < startDate) return false;
      }
      
      // Verificar se a atividade já terminou (endDate)
      if (activity.endDate) {
        const [year, month, dayOfMonth] = activity.endDate.split('-').map(Number);
        const endDate = new Date(year, month - 1, dayOfMonth);
        endDate.setHours(23, 59, 59, 999);
        
        if (checkDate > endDate) return false;
      }
      
      if (activity.frequency === 'diaria') return true;
      if (activity.frequency === 'semanal') {
        const dayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay();
        const weekDays = activity.frequencyConfig?.weekDays || [];
        const dayMap: Record<string, number> = {
          'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3,
          'quinta': 4, 'sexta': 5, 'sabado': 6
        };
        return weekDays.some((d: string) => dayMap[d] === dayOfWeek);
      }
      if (activity.frequency === 'mensal') {
        // Atividades mensais aparecem apenas no dia configurado
        return day === (activity.frequencyConfig?.monthDay || 1);
      }
      if (activity.frequency === 'trimestral') {
        // Atividades trimestrais aparecem no dia configurado, a cada 3 meses
        const startDate = new Date(activity.startDate);
        const currentMonth = currentDate.getMonth();
        const startMonth = startDate.getMonth();
        const monthDiff = (currentMonth - startMonth + 12) % 12;
        return monthDiff % 3 === 0 && day === (activity.frequencyConfig?.monthDay || 1);
      }
      if (activity.frequency === 'semestral') {
        // Atividades semestrais aparecem no dia configurado, a cada 6 meses
        const startDate = new Date(activity.startDate);
        const currentMonth = currentDate.getMonth();
        const startMonth = startDate.getMonth();
        const monthDiff = (currentMonth - startMonth + 12) % 12;
        return monthDiff % 6 === 0 && day === (activity.frequencyConfig?.monthDay || 1);
      }
      if (activity.frequency === 'anual') {
        // Atividades anuais aparecem no dia/mês configurado
        const startDate = new Date(activity.startDate);
        const currentMonth = currentDate.getMonth();
        const startMonth = startDate.getMonth();
        return currentMonth === startMonth && day === (activity.frequencyConfig?.monthDay || 1);
      }
      if (activity.frequency === 'turno') {
        // Atividades por turno aparecem apenas nos dias da semana configurados
        const turnWeekDays = activity.frequencyConfig?.weekDays || [];
        if (turnWeekDays.length === 0) {
          // Se não houver dias configurados, mostrar todos os dias (retrocompatibilidade)
          return true;
        }
        
        // Verificar se o dia atual está nos dias configurados
        const dayOfWeek = currentDate.getDay(); // 0 = domingo
        const dayMap = {
          'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3,
          'quinta': 4, 'sexta': 5, 'sabado': 6
        };
        
        return turnWeekDays.some((weekDay: string) => 
          dayMap[weekDay as keyof typeof dayMap] === dayOfWeek
        );
      }
      if (activity.frequency === 'custom') {
        // Frequência personalizada: verificar se existe quantidade > 0 para este dia
        const customFreq = activity.frequencyConfig?.customFrequency || {};
        const dayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).getDay();
        const dayMap = {
          'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3,
          'quinta': 4, 'sexta': 5, 'sabado': 6
        };
        
        // Encontrar o nome do dia da semana
        for (const [dayName, dayNum] of Object.entries(dayMap)) {
          if (dayNum === dayOfWeek && customFreq[dayName as keyof typeof customFreq] && customFreq[dayName as keyof typeof customFreq] > 0) {
            return true;
          }
        }
        return false;
      }
      return false;
    });
  };

  // Função para navegar pelos meses
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  // Função para abrir detalhes do dia
  const openDayDetails = (day: number) => {
    const dayActivities = getActivitiesForDay(day);
    setSelectedDay(day);
    setSelectedActivities(dayActivities);
    setShowDayDetailsModal(true);
  };

  // Função para formatar data selecionada
  const getSelectedDateFormatted = () => {
    if (!selectedDay) return '';
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay);
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <>
        <Header title="Plano de Limpeza" description="Gerenciamento de atividades programadas" />
        <div className="flex-1 flex items-center justify-center">
          <div>Carregando plano de limpeza...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header 
        title="Plano de Limpeza" 
        description="Gerenciamento de atividades de limpeza programadas"
      >
        <div className="flex items-center space-x-2">
          <Select value={viewMode} onValueChange={(value: "monthly" | "list") => setViewMode(value)}>
            <SelectTrigger className="w-32" data-testid="select-view-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              <SelectItem value="list">Lista</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            className={theme.buttons.primary}
            style={theme.buttons.primaryStyle}
            onClick={() => setShowCreateModal(true)}
            data-testid="button-create-activity"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Atividade
          </Button>
        </div>
      </Header>
      
      <main className="flex-1 overflow-auto p-4 bg-muted/30">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Select value={siteFilter} onValueChange={setSiteFilter}>
                <SelectTrigger className="w-48" data-testid="select-site-filter">
                  <SelectValue placeholder="Filtrar por local" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Locais</SelectItem>
                  {(sites as any[])?.map((site: any) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select defaultValue="todas">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas Frequências</SelectItem>
                  <SelectItem value="diaria">Diária</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="trimestral">Trimestral</SelectItem>
                  <SelectItem value="semestral">Semestral</SelectItem>
                  <SelectItem value="anual">Anual</SelectItem>
                  <SelectItem value="turno">Por Turno</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="ativas">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativas">Ativas</SelectItem>
                  <SelectItem value="inativas">Inativas</SelectItem>
                  <SelectItem value="todas">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards - Modernizado e Interativo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card 
            className="bg-gradient-to-br from-blue-50 via-blue-100/50 to-white border-blue-200/50 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover-elevate"
            onClick={() => {
              setMetricsModalType('active');
              setShowMetricsModal(true);
            }}
            data-testid="card-active-activities"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600 mb-1">Atividades Ativas</p>
                  <p className="text-3xl font-bold text-blue-900">
                    {(activities as any[])?.filter((a: any) => a.isActive).length || 0}
                  </p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                  <Calendar className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-emerald-50 via-emerald-100/50 to-white border-emerald-200/50 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover-elevate"
            onClick={() => {
              setMetricsModalType('daily');
              setShowMetricsModal(true);
            }}
            data-testid="card-daily-activities"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-emerald-600 mb-1">Diárias</p>
                  <p className="text-3xl font-bold text-emerald-900">
                    {(activities as any[])?.filter((a: any) => a.frequency === 'diaria').length || 0}
                  </p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                  <Clock className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-violet-50 via-violet-100/50 to-white border-violet-200/50 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover-elevate"
            onClick={() => {
              setMetricsModalType('weekly');
              setShowMetricsModal(true);
            }}
            data-testid="card-weekly-activities"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-violet-600 mb-1">Semanais</p>
                  <p className="text-3xl font-bold text-violet-900">
                    {(activities as any[])?.filter((a: any) => a.frequency === 'semanal').length || 0}
                  </p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                  <Clock className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="bg-gradient-to-br from-amber-50 via-amber-100/50 to-white border-amber-200/50 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover-elevate"
            onClick={() => {
              setMetricsModalType('locations');
              setShowMetricsModal(true);
            }}
            data-testid="card-locations-covered"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-600 mb-1">Locais Cobertos</p>
                  <p className="text-3xl font-bold text-amber-900">
                    {new Set((activities as any[])?.map((a: any) => a.zoneId)).size || 0}
                  </p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform">
                  <MapPin className="w-7 h-7 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar Views or Activities List */}
        {viewMode === "monthly" ? (
          <Card className="bg-white border-0 shadow-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-8 shadow-inner">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg border border-white/30">
                    <Calendar className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-1">Calendário de Limpeza</h2>
                    <p className="text-blue-100 text-sm font-medium">Atividades programadas por data</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigateMonth('prev')}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/40 h-10 w-10 p-0 rounded-xl transition-all shadow-md"
                    data-testid="button-prev-month"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <span className="font-bold text-xl min-w-52 text-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                    {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigateMonth('next')}
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:border-white/40 h-10 w-10 p-0 rounded-xl transition-all shadow-md"
                    data-testid="button-next-month"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              {/* Legenda - Modernizada */}
              <div className="flex flex-wrap gap-4 mb-8 p-6 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-2xl border border-slate-200/50 shadow-sm">
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-blue-100">
                  <div className="w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full shadow-sm"></div>
                  <span className="text-sm font-semibold text-slate-700">Diárias</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-emerald-100">
                  <div className="w-3 h-3 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full shadow-sm"></div>
                  <span className="text-sm font-semibold text-slate-700">Semanais</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-purple-100">
                  <div className="w-3 h-3 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full shadow-sm"></div>
                  <span className="text-sm font-semibold text-slate-700">Mensais</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-indigo-100">
                  <div className="w-3 h-3 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full shadow-sm"></div>
                  <span className="text-sm font-semibold text-slate-700">Trimestrais</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-violet-100">
                  <div className="w-3 h-3 bg-gradient-to-br from-violet-400 to-violet-600 rounded-full shadow-sm"></div>
                  <span className="text-sm font-semibold text-slate-700">Semestrais</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-rose-100">
                  <div className="w-3 h-3 bg-gradient-to-br from-rose-400 to-rose-600 rounded-full shadow-sm"></div>
                  <span className="text-sm font-semibold text-slate-700">Anuais</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-sm border border-orange-100">
                  <div className="w-3 h-3 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full shadow-sm"></div>
                  <span className="text-sm font-semibold text-slate-700">Por Turno</span>
                </div>
              </div>

              {/* Cabeçalho da semana - Modernizado */}
              <div className="grid grid-cols-7 gap-3 mb-4">
                {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(day => (
                  <div key={day} className="p-4 text-center font-bold text-sm text-slate-800 bg-gradient-to-br from-slate-100 to-slate-50 rounded-xl border border-slate-200 shadow-sm">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendário - Modernizado */}
              <div className="grid grid-cols-7 gap-3">
                {generateMonthCalendar().map((week, weekIndex) => 
                  week.map((day, dayIndex) => {
                    const dayActivities = day ? getActivitiesForDay(day) : [];
                    const isToday = day && 
                      day === new Date().getDate() && 
                      currentDate.getMonth() === new Date().getMonth() && 
                      currentDate.getFullYear() === new Date().getFullYear();
                    
                    return (
                      <div 
                        key={`${weekIndex}-${dayIndex}`} 
                        className={`rounded-2xl p-4 min-h-36 transition-all duration-300 ${
                          day 
                            ? `bg-gradient-to-br from-white to-slate-50/50 hover:from-blue-50/30 hover:to-slate-50 hover:shadow-xl cursor-pointer border-2 ${
                                isToday 
                                  ? 'shadow-lg ring-4 ring-blue-400 ring-opacity-30 border-blue-500 bg-gradient-to-br from-blue-50 to-white' 
                                  : 'border-slate-200/60 shadow-sm hover:border-blue-300'
                              }` 
                            : 'bg-gradient-to-br from-slate-100/50 to-slate-50 border border-slate-100'
                        }`}
                        onClick={() => day && openDayDetails(day)}
                        data-testid={`calendar-day-${day}`}
                      >
                        {day && (
                          <>
                            <div className={`text-xl font-bold mb-3 flex items-center justify-between ${
                              isToday ? 'text-blue-600' : 'text-slate-800'
                            }`}>
                              <span>{day}</span>
                              {isToday && (
                                <span className="text-xs text-white bg-blue-500 px-2 py-1 rounded-full font-semibold shadow-sm">Hoje</span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {dayActivities.slice(0, 3).map((activity: any, index: number) => {
                                const getActivityColor = (freq: string) => {
                                  switch (freq) {
                                    case 'diaria': return 'bg-gradient-to-r from-blue-50 to-blue-100 border-l-blue-500 text-blue-800 hover:from-blue-100 hover:to-blue-150';
                                    case 'semanal': return 'bg-gradient-to-r from-emerald-50 to-emerald-100 border-l-emerald-500 text-emerald-800 hover:from-emerald-100 hover:to-emerald-150';
                                    case 'mensal': return 'bg-gradient-to-r from-purple-50 to-purple-100 border-l-purple-500 text-purple-800 hover:from-purple-100 hover:to-purple-150';
                                    case 'trimestral': return 'bg-gradient-to-r from-indigo-50 to-indigo-100 border-l-indigo-500 text-indigo-800 hover:from-indigo-100 hover:to-indigo-150';
                                    case 'semestral': return 'bg-gradient-to-r from-violet-50 to-violet-100 border-l-violet-500 text-violet-800 hover:from-violet-100 hover:to-violet-150';
                                    case 'anual': return 'bg-gradient-to-r from-rose-50 to-rose-100 border-l-rose-500 text-rose-800 hover:from-rose-100 hover:to-rose-150';
                                    case 'turno': return 'bg-gradient-to-r from-orange-50 to-orange-100 border-l-orange-500 text-orange-800 hover:from-orange-100 hover:to-orange-150';
                                    default: return 'bg-gradient-to-r from-gray-50 to-gray-100 border-l-gray-500 text-gray-800 hover:from-gray-100 hover:to-gray-150';
                                  }
                                };

                                return (
                                  <div 
                                    key={activity.id + index} 
                                    className={`text-xs p-3 rounded-xl border-l-4 ${getActivityColor(activity.frequency)} shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer transform hover:scale-105`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDayDetails(day);
                                    }}
                                    data-testid={`activity-card-${activity.id}`}
                                  >
                                    <div className="font-bold mb-1.5 leading-tight">
                                      {activity.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs opacity-80">
                                      <MapPin className="w-3 h-3" />
                                      <span className="truncate">{getZoneNames(activity)}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs opacity-80 mt-1">
                                      <Clock className="w-3 h-3" />
                                      {getSLAForActivity(activity)}
                                    </div>
                                  </div>
                                );
                              })}
                              {dayActivities.length > 3 && (
                                <div 
                                  className="text-xs text-slate-700 text-center py-2.5 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl font-semibold border-2 border-dashed border-slate-300 cursor-pointer hover:from-slate-200 hover:to-slate-100 hover:border-slate-400 transition-all shadow-sm hover:shadow-md"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDayDetails(day);
                                  }}
                                  data-testid={`more-activities-${day}`}
                                >
                                  +{dayActivities.length - 3} mais atividades
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Lista de Atividades de Limpeza</CardTitle>
            </CardHeader>
            <CardContent>
            {!activities || (activities as any[]).length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhuma atividade cadastrada</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Crie sua primeira atividade de limpeza para começar
                </p>
                <Button 
                  className={`mt-4 ${theme.buttons.primary}`}
                  style={theme.buttons.primaryStyle}
                  onClick={() => setShowCreateModal(true)}
                  data-testid="button-create-first-activity"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeira Atividade
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {(activities as any[]).map((activity: any) => (
                  <div 
                    key={activity.id} 
                    className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">
                            {activity.name}
                          </h3>
                          {getFrequencyBadge(activity.frequency)}
                          {activity.isActive ? (
                            <Badge className="bg-chart-2/10 text-chart-2">Ativa</Badge>
                          ) : (
                            <Badge variant="outline">Inativa</Badge>
                          )}
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3">
                          {activity.description || "Sem descrição"}
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <MapPin className="w-4 h-4" />
                            <span>Zonas: {getZoneNames(activity)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Building2 className="w-4 h-4" />
                            <span>Sites: {getSiteNames(activity)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>SLA: {getSLAForActivity(activity)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <User className="w-4 h-4" />
                            <span>Responsável: {getAssignedUserName(activity.assignedUserId)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Calendar className="w-4 h-4" />
                            <span>Próxima: {getNextExecutionDate(activity)}</span>
                          </div>
                          {activity.estimatedHours && (
                            <div className="flex items-center space-x-1">
                              <Timer className="w-4 h-4" />
                              <span>Estimativa: {activity.estimatedHours}h</span>
                            </div>
                          )}
                          {getServicesForZone(activity.zoneId).length > 0 && (
                            <div className="flex items-center space-x-1">
                              <span>🔧</span>
                              <span>{getServicesForZone(activity.zoneId).length} serviços vinculados</span>
                            </div>
                          )}
                        </div>
                        
                        {/* Show linked services */}
                        {getServicesForZone(activity.zoneId).length > 0 && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <h5 className="text-sm font-medium text-gray-900 mb-2">Serviços Vinculados:</h5>
                            <div className="flex flex-wrap gap-2">
                              {getServicesForZone(activity.zoneId).map((service: any) => (
                                <Badge key={service.id} variant="outline" className="text-xs">
                                  {service.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-view-activity-${activity.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-edit-activity-${activity.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-copy-activity-${activity.id}`}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleDeleteActivity(activity)}
                          disabled={deleteCleaningActivityMutation.isPending}
                          data-testid={`button-delete-activity-${activity.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Modal de Detalhes do Dia - Design Compacto */}
        <Dialog open={showDayDetailsModal} onOpenChange={setShowDayDetailsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-bold text-blue-800 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {getSelectedDateFormatted()}
              </DialogTitle>
              <DialogDescription>
                {selectedActivities.length > 0 
                  ? `${selectedActivities.length} atividade(s) programada(s) para este dia`
                  : "Nenhuma atividade programada para este dia"
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              {selectedActivities.length > 0 ? (
                selectedActivities.map((activity: any, index: number) => {
                  const getActivityColorClass = (freq: string) => {
                    switch (freq) {
                      case 'diaria': return 'border-l-blue-500 bg-blue-50/30';
                      case 'semanal': return 'border-l-green-500 bg-green-50/30';
                      case 'mensal': return 'border-l-purple-500 bg-purple-50/30';
                      case 'trimestral': return 'border-l-indigo-500 bg-indigo-50/30';
                      case 'semestral': return 'border-l-violet-500 bg-violet-50/30';
                      case 'anual': return 'border-l-rose-500 bg-rose-50/30';
                      case 'turno': return 'border-l-orange-500 bg-orange-50/30';
                      default: return 'border-l-gray-500 bg-gray-50/30';
                    }
                  };

                  return (
                    <div key={activity.id + index} className={`border-l-4 ${getActivityColorClass(activity.frequency)} p-3 rounded-lg bg-white/50`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedForDeletion.includes(activity.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedForDeletion([...selectedForDeletion, activity.id]);
                              } else {
                                setSelectedForDeletion(selectedForDeletion.filter(id => id !== activity.id));
                              }
                            }}
                            className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">
                                {activity.name}
                              </h3>
                              {getFrequencyBadge(activity.frequency)}
                            </div>
                            
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {getZoneNames(activity)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {getSLAForActivity(activity)}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {getAssignedUserName(activity.assignedUserId || '')}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 ml-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Abrir modal de detalhes da atividade
                              setSelectedActivity(activity);
                              setShowActivityDetailsModal(true);
                            }}
                            data-testid={`button-view-activity-${activity.id}`}
                            className="h-7 w-7 p-0"
                            title="Ver Detalhes"
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Abrir modal de edição da atividade
                              setSelectedActivity(activity);
                              setShowEditActivityModal(true);
                            }}
                            data-testid={`button-edit-activity-${activity.id}`}
                            className="h-7 w-7 p-0"
                            title="Editar"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                // Duplicar atividade via API
                                const response = await apiRequest('POST', `/api/companies/${activeClientId}/cleaning-activities`, {
                                  name: `${activity.name} (Cópia)`,
                                  description: activity.description,
                                  frequency: activity.frequency,
                                  zoneId: activity.zoneId,
                                  serviceId: activity.serviceId,
                                  isActive: activity.isActive
                                });
                                
                                if (response.ok) {
                                  toast({
                                    title: "Atividade Duplicada",
                                    description: `"${activity.name}" foi duplicada com sucesso!`,
                                  });
                                  // Recarregar dados
                                  queryClient.invalidateQueries({ queryKey: ["/api/companies", activeClientId, "cleaning-activities"] });
                                } else {
                                  throw new Error('Erro ao duplicar');
                                }
                              } catch (error) {
                                toast({
                                  title: "Erro ao Duplicar",
                                  description: "Não foi possível duplicar a atividade",
                                  variant: "destructive"
                                });
                              }
                            }}
                            data-testid={`button-copy-activity-${activity.id}`}
                            className="h-7 w-7 p-0"
                            title="Duplicar"
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (window.confirm(`Tem certeza que deseja deletar "${activity.name}"?`)) {
                                try {
                                  const response = await apiRequest('DELETE', `/api/cleaning-activities/${activity.id}`);
                                  if (response.ok) {
                                    toast({
                                      title: "Atividade Deletada",
                                      description: `"${activity.name}" foi removida com sucesso!`,
                                    });
                                    // Recarregar dados
                                    queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "cleaning-activities"] });
                                  } else {
                                    throw new Error('Erro ao deletar');
                                  }
                                } catch (error) {
                                  toast({
                                    title: "Erro ao Deletar",
                                    description: "Não foi possível deletar a atividade",
                                    variant: "destructive"
                                  });
                                }
                              }
                            }}
                            data-testid={`button-delete-activity-${activity.id}`}
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                            title="Deletar"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Nenhuma atividade programada
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Este dia não possui atividades de limpeza agendadas.
                  </p>
                  <Button 
                    onClick={() => {
                      setShowDayDetailsModal(false);
                      setShowCreateModal(true);
                    }}
                    data-testid="button-create-activity-for-day"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Atividade
                  </Button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t text-sm">
              <div className="text-gray-500">
                {selectedActivities.length > 0 && (
                  `Total: ${selectedActivities.reduce((acc, activity) => acc + (activity.estimatedDuration || 30), 0)}min`
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {selectedActivities.length > 0 && (
                  <>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={async () => {
                        if (window.confirm(`Tem certeza que deseja deletar TODAS as ${selectedActivities.length} atividade(s) deste dia?`)) {
                          try {
                            const allIds = selectedActivities.map(a => a.id);
                            await Promise.all(
                              allIds.map(id => apiRequest('DELETE', `/api/cleaning-activities/${id}`))
                            );
                            toast({
                              title: "Atividades Deletadas",
                              description: `${selectedActivities.length} atividade(s) foram removidas com sucesso!`,
                            });
                            queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "cleaning-activities"] });
                            setSelectedForDeletion([]);
                            setShowDayDetailsModal(false);
                          } catch (error) {
                            toast({
                              title: "Erro ao Deletar",
                              description: "Não foi possível deletar as atividades",
                              variant: "destructive"
                            });
                          }
                        }
                      }}
                      data-testid="button-delete-all-day"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Deletar Todas ({selectedActivities.length})
                    </Button>
                    
                    {selectedForDeletion.length > 0 && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={async () => {
                          if (window.confirm(`Tem certeza que deseja deletar ${selectedForDeletion.length} atividade(s) selecionada(s)?`)) {
                            try {
                              await Promise.all(
                                selectedForDeletion.map(id => apiRequest('DELETE', `/api/cleaning-activities/${id}`))
                              );
                              toast({
                                title: "Atividades Deletadas",
                                description: `${selectedForDeletion.length} atividade(s) selecionada(s) foram removidas com sucesso!`,
                              });
                              queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "cleaning-activities"] });
                              setSelectedForDeletion([]);
                            } catch (error) {
                              toast({
                                title: "Erro ao Deletar",
                                description: "Não foi possível deletar as atividades selecionadas",
                                variant: "destructive"
                              });
                            }
                          }
                        }}
                        data-testid="button-delete-selected"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Deletar Selecionadas ({selectedForDeletion.length})
                      </Button>
                    )}
                  </>
                )}
                
                <Button variant="outline" size="sm" onClick={() => setShowDayDetailsModal(false)}>
                  Fechar
                </Button>
                
                {selectedActivities.length > 0 && (
                  <Button 
                    className={theme.buttons.primary}
                    style={theme.buttons.primaryStyle}
                    size="sm"
                    onClick={() => {
                      setShowDayDetailsModal(false);
                      setShowCreateModal(true);
                    }}
                    data-testid="button-add-more-activities"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Nova Atividade
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Criação de Atividade */}
        {showCreateModal && (
          <CreateCleaningActivityModal
            activeClientId={activeClientId}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              queryClient.invalidateQueries({ queryKey: ["/api/companies", activeClientId, "cleaning-activities"] });
            }}
          />
        )}

        {/* Modal de Edição de Atividade */}
        {showEditActivityModal && selectedActivity && (
          <CreateCleaningActivityModal
            activeClientId={activeClientId}
            editingActivity={selectedActivity}
            onClose={() => {
              setShowEditActivityModal(false);
              setSelectedActivity(null);
            }}
            onSuccess={() => {
              setShowEditActivityModal(false);
              setSelectedActivity(null);
              queryClient.invalidateQueries({ queryKey: ["/api/companies", activeClientId, "cleaning-activities"] });
            }}
          />
        )}

        {/* Modal de Detalhes da Atividade */}
        <Dialog open={showActivityDetailsModal} onOpenChange={setShowActivityDetailsModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">Detalhes da Atividade</DialogTitle>
              <DialogDescription>
                Informações completas sobre a atividade selecionada.
              </DialogDescription>
            </DialogHeader>
            {selectedActivity && (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedActivity.name}</h3>
                  {selectedActivity.description && (
                    <p className="text-sm text-gray-600 mt-1">{selectedActivity.description}</p>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Frequência:</span>
                    <p className="text-gray-600">{selectedActivity.frequency === 'diaria' ? 'Diária' : 
                                                  selectedActivity.frequency === 'semanal' ? 'Semanal' : 
                                                  selectedActivity.frequency === 'mensal' ? 'Mensal' :
                                                  selectedActivity.frequency === 'turno' ? 'Por Turno' : 'Personalizada'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Status:</span>
                    <p className="text-gray-600">{selectedActivity.isActive ? 'Ativa' : 'Inativa'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Local:</span>
                    <p className="text-gray-600">{getZoneName(selectedActivity.zoneId)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">SLA:</span>
                    <p className="text-gray-600">{getSLAForActivity(selectedActivity)}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium text-gray-700">Responsável:</span>
                    <p className="text-gray-600">{getAssignedUserName(selectedActivity.assignedUserId || '')}</p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Métricas */}
        <Dialog open={showMetricsModal} onOpenChange={setShowMetricsModal}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {metricsModalType === 'active' && (
                  <>
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Atividades Ativas
                  </>
                )}
                {metricsModalType === 'daily' && (
                  <>
                    <Clock className="w-5 h-5 text-emerald-600" />
                    Atividades Diárias
                  </>
                )}
                {metricsModalType === 'weekly' && (
                  <>
                    <Clock className="w-5 h-5 text-violet-600" />
                    Atividades Semanais
                  </>
                )}
                {metricsModalType === 'locations' && (
                  <>
                    <MapPin className="w-5 h-5 text-amber-600" />
                    Locais Cobertos
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                Detalhes das métricas selecionadas
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {metricsModalType === 'locations' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array.from(new Set((activities as any[])?.map((a: any) => a.zoneId) || [])).map((zoneId: any) => {
                    const zoneName = getZoneName(zoneId);
                    const activitiesInZone = (activities as any[])?.filter((a: any) => a.zoneId === zoneId) || [];
                    
                    return (
                      <Card key={zoneId} className="hover-elevate">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <MapPin className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-sm mb-1 truncate">{zoneName}</h4>
                              <p className="text-xs text-muted-foreground">
                                {activitiesInZone.length} atividade(s)
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {activitiesInZone.slice(0, 3).map((act: any) => (
                                  <Badge key={act.id} variant="outline" className="text-xs">
                                    {act.name}
                                  </Badge>
                                ))}
                                {activitiesInZone.length > 3 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{activitiesInZone.length - 3}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {(() => {
                    const filteredActivities = metricsModalType === 'active'
                      ? (activities as any[])?.filter((a: any) => a.isActive) || []
                      : metricsModalType === 'daily'
                      ? (activities as any[])?.filter((a: any) => a.frequency === 'diaria') || []
                      : metricsModalType === 'weekly'
                      ? (activities as any[])?.filter((a: any) => a.frequency === 'semanal') || []
                      : [];

                    return filteredActivities.length > 0 ? (
                      filteredActivities.map((activity: any) => (
                        <Card key={activity.id} className="hover-elevate">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <h3 className="font-semibold text-sm truncate">{activity.name}</h3>
                                  {getFrequencyBadge(activity.frequency)}
                                  {activity.isActive ? (
                                    <Badge className="bg-chart-2/10 text-chart-2 text-xs">Ativa</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs">Inativa</Badge>
                                  )}
                                </div>
                                
                                {activity.description && (
                                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                    {activity.description}
                                  </p>
                                )}
                                
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {getZoneNames(activity)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {getSLAForActivity(activity)}
                                  </span>
                                  {activity.assignedUserId && (
                                    <span className="flex items-center gap-1">
                                      <User className="w-3 h-3" />
                                      {getAssignedUserName(activity.assignedUserId)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedActivity(activity);
                                    setShowActivityDetailsModal(true);
                                    setShowMetricsModal(false);
                                  }}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-view-${activity.id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedActivity(activity);
                                    setShowEditActivityModal(true);
                                    setShowMetricsModal(false);
                                  }}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-edit-${activity.id}`}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleDeleteActivity(activity)}
                                  disabled={deleteCleaningActivityMutation.isPending}
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-delete-${activity.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-muted-foreground">Nenhuma atividade encontrada</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}

// Componente MultiSelect reutilizável
function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  disabled,
  required,
  "data-testid": dataTestId
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (vals: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
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

  const clearAll = () => {
    onChange([]);
  };

  const selectedLabels = options
    .filter(opt => value.includes(opt.value))
    .map(opt => opt.label)
    .join(", ");

  const allSelected = options.length > 0 && value.length === options.length;

  return (
    <div className="space-y-2">
      <Label>{label} {required && "*"}</Label>
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
          {options.length > 0 && (
            <div className="flex gap-2 p-2 border-b bg-muted/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={selectAll}
                disabled={disabled || allSelected}
                data-testid="button-select-all"
              >
                Selecionar Todos
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={clearAll}
                disabled={disabled || value.length === 0}
                data-testid="button-clear-all"
              >
                Limpar
              </Button>
            </div>
          )}
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

// Componente de Modal para Criação/Edição de Atividade de Limpeza
interface CreateCleaningActivityModalProps {
  activeClientId: string;
  onClose: () => void;
  onSuccess: () => void;
  editingActivity?: any; // Se fornecido, modal está em modo de edição
}

function CreateCleaningActivityModal({ activeClientId, onClose, onSuccess, editingActivity }: CreateCleaningActivityModalProps) {
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const isEditMode = !!editingActivity;
  
  const [formData, setFormData] = useState({
    name: editingActivity?.name || "",
    description: editingActivity?.description || "",
    frequency: editingActivity?.frequency || "diaria",
    startDate: editingActivity?.startDate || "",
    frequencyConfig: editingActivity?.frequencyConfig || {
      weekDays: [] as string[], // para semanal: ["domingo", "segunda", ...]
      monthDay: 1, // para mensal: dia do mês (1-31)
      turnShifts: [] as string[], // para turno: ["manha", "tarde", "noite"]
      timesPerDay: 1, // para diaria: quantas vezes por dia
      customFrequency: { // para personalizada: { "segunda": 5, "terca": 3, ... }
        domingo: 0,
        segunda: 0,
        terca: 0,
        quarta: 0,
        quinta: 0,
        sexta: 0,
        sabado: 0
      } as Record<string, number>
    },
    serviceId: editingActivity?.serviceId || "",
    siteIds: editingActivity?.siteIds || [] as string[], // MULTI-SELEÇÃO de locais
    zoneIds: editingActivity?.zoneIds || [] as string[], // MULTI-SELEÇÃO de zonas
    checklistTemplateId: editingActivity?.checklistTemplateId || "",
    // Campos opcionais de horário
    startTime: editingActivity?.startTime || "",
    endTime: editingActivity?.endTime || "",
    isActive: editingActivity?.isActive !== undefined ? editingActivity.isActive : true
  });

  const { data: services } = useQuery({
    queryKey: ["/api/customers", activeClientId, "services"],
    enabled: !!activeClientId,
  });

  const { data: sites } = useQuery({
    queryKey: ["/api/customers", activeClientId, "sites", { module: currentModule }],
    enabled: !!activeClientId,
  });

  const { data: zones } = useQuery({
    queryKey: ["/api/customers", activeClientId, "zones", { module: currentModule }],
    enabled: !!activeClientId,
  });

  const { data: checklistTemplates } = useQuery({
    queryKey: ["/api/customers", activeClientId, "checklist-templates"],
    enabled: !!activeClientId,
  });



  // Filtrar zonas baseado nos locais selecionados
  const filteredZones = useMemo(() => {
    if (formData.siteIds.length === 0 || !zones) return [];
    return (zones as any[]).filter((zone: any) => formData.siteIds.includes(zone.siteId));
  }, [zones, formData.siteIds]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Limpar zonas quando locais mudam
      if (field === 'siteIds') {
        // Remover zonas que não pertencem mais aos locais selecionados
        const validZoneIds = (zones as any[])
          ?.filter((zone: any) => value.includes(zone.siteId))
          .map((zone: any) => zone.id) || [];
        newData.zoneIds = newData.zoneIds.filter((zoneId: string) => validZoneIds.includes(zoneId));
      }
      
      // Reset frequency config quando muda frequência
      if (field === 'frequency') {
        newData.frequencyConfig = {
          weekDays: [],
          monthDay: 1,
          turnShifts: [],
          timesPerDay: 1,
          customFrequency: {
            domingo: 0,
            segunda: 0,
            terca: 0,
            quarta: 0,
            quinta: 0,
            sexta: 0,
            sabado: 0
          }
        };
      }
      
      return newData;
    });
  };

  const handleFrequencyConfigChange = (configField: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      frequencyConfig: {
        ...prev.frequencyConfig,
        [configField]: value
      }
    }));
  };

  const updateActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      const cleanedData = {
        name: data.name,
        description: data.description,
        frequency: data.frequency,
        frequencyConfig: data.frequencyConfig,
        serviceId: data.serviceId,
        siteIds: data.siteIds,
        zoneIds: data.zoneIds,
        checklistTemplateId: data.checklistTemplateId,
        startDate: data.startDate,
        startTime: data.startTime === "" ? null : data.startTime,
        endTime: data.endTime === "" ? null : data.endTime,
        isActive: data.isActive,
      };
      
      const response = await apiRequest("PATCH", `/api/customers/${activeClientId}/cleaning-activities/${editingActivity.id}`, cleanedData);
      return await response.json();
    },
    onSuccess: () => {
      toast({ 
        title: "Atividade atualizada com sucesso!"
      });
      
      queryClient.invalidateQueries({ 
        queryKey: ["/api/customers", activeClientId, "cleaning-activities"] 
      });
      
      onSuccess();
    },
    onError: () => {
      toast({ 
        title: "Erro ao atualizar atividade", 
        variant: "destructive" 
      });
    },
  });

  const createActivityMutation = useMutation({
    mutationFn: async (data: any) => {
      // Get companyId from first selected site
      const firstSite = (sites as any[])?.find(s => s.id === data.siteIds[0]);
      const companyId = firstSite?.companyId || "company-opus-default";
      
      // Create single activity with multiple sites and zones
      const submitData = {
        name: data.name,
        description: data.description,
        frequency: data.frequency,
        frequencyConfig: data.frequencyConfig,
        serviceId: data.serviceId,
        siteIds: data.siteIds,  // Array of site IDs
        zoneIds: data.zoneIds,  // Array of zone IDs
        checklistTemplateId: data.checklistTemplateId,
        startDate: data.startDate,
        startTime: data.startTime,
        endTime: data.endTime,
        isActive: data.isActive,
        companyId,
        customerId: activeClientId,
        module: currentModule,
      };
      
      const response = await apiRequest("POST", `/api/customers/${activeClientId}/cleaning-activities`, submitData);
      const created = await response.json();
      
      return { 
        activity: created,
        companyId
      };
    },
    onSuccess: async (result: any) => {
      toast({ 
        title: "Atividade de limpeza criada com sucesso!"
      });
      
      // Invalidar cache para mostrar a nova atividade na lista
      queryClient.invalidateQueries({ 
        queryKey: ["/api/customers", activeClientId, "cleaning-activities"] 
      });
      
      // Gerar ordens de trabalho automaticamente
      const companyId = result.companyId || "company-opus-default";
      
      // Determinar janela de tempo baseada na atividade criada
      const activity = result.activity;
      const activities = [activity];
      
      // DEBUG: Ver estrutura das atividades retornadas
      console.log('[DEBUG] Primeira atividade:', JSON.stringify(activities[0], null, 2));
      
      // Tentar ambos formatos: camelCase e snake_case
      const startDates = activities
        .map((a: any) => {
          const date = a.startDate || a.start_date;
          return date ? new Date(date) : null;
        })
        .filter((d: any): d is Date => d !== null);
      
      // Validar que há pelo menos uma startDate válida
      if (startDates.length === 0) {
        toast({
          title: "Erro ao gerar OSs",
          description: "Todas as atividades precisam ter uma data de início válida",
          variant: "destructive"
        });
        onSuccess();
        return;
      }
      
      // windowStart = menor startDate das atividades criadas
      const windowStart = new Date(Math.min(...startDates.map(d => d.getTime())));
      
      // windowEnd = final do mês atual (último dia do mês às 23:59:59)
      const now = new Date();
      const windowEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      console.log(`[GERADOR OS] Gerando OSs da data inicial até final do mês atual: ${windowStart.toISOString()} até ${windowEnd.toISOString()}`);
      
      try {
        const response = await apiRequest("POST", "/api/scheduler/generate-work-orders", {
          companyId,
          windowStart: windowStart.toISOString(),
          windowEnd: windowEnd.toISOString()
        });
        
        const data = await response.json();
        console.log("Resposta da geração de OSs:", data);
        
        // Invalidar cache das ordens de trabalho também
        queryClient.invalidateQueries({ 
          queryKey: ["/api/customers", activeClientId, "work-orders"] 
        });
        
        toast({ 
          title: "Ordens de trabalho geradas!", 
          description: `${data.generatedOrders || 0} OSs criadas automaticamente`
        });
      } catch (error) {
        console.error("Erro ao gerar ordens:", error);
        console.error("Detalhes do erro:", {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          stringified: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
        
        let errorMessage = "As OSs precisarão ser geradas manualmente";
        if (error instanceof Error && error.message) {
          errorMessage = error.message;
        }
        
        toast({
          title: "Erro ao gerar OSs automáticas",
          description: errorMessage,
          variant: "destructive"
        });
      }
      
      onSuccess();
    },
    onError: () => {
      toast({ 
        title: "Erro ao criar atividade de limpeza", 
        variant: "destructive" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.serviceId || formData.siteIds.length === 0 || formData.zoneIds.length === 0 || !formData.startDate || !formData.checklistTemplateId) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios: nome, serviço, pelo menos um local, pelo menos uma zona, checklist e data de início",
        variant: "destructive"
      });
      return;
    }

    // Validar configuração de frequência
    if (formData.frequency === "diaria" && formData.frequencyConfig.timesPerDay < 1) {
      toast({
        title: "Frequência diária inválida",
        description: "Informe quantas vezes por dia a atividade deve ser realizada",
        variant: "destructive"
      });
      return;
    }

    if (formData.frequency === "semanal" && formData.frequencyConfig.weekDays.length === 0) {
      toast({
        title: "Dias da semana obrigatórios",
        description: "Selecione pelo menos um dia da semana",
        variant: "destructive"
      });
      return;
    }

    if (formData.frequency === "turno" && formData.frequencyConfig.turnShifts.length === 0) {
      toast({
        title: "Turnos obrigatórios", 
        description: "Selecione pelo menos um turno",
        variant: "destructive"
      });
      return;
    }

    if (formData.frequency === "turno" && formData.frequencyConfig.weekDays.length === 0) {
      toast({
        title: "Dias da semana obrigatórios",
        description: "Selecione pelo menos um dia da semana para as atividades por turno",
        variant: "destructive"
      });
      return;
    }

    if (formData.frequency === "custom") {
      const customValues = Object.values(formData.frequencyConfig.customFrequency || {});
      const hasAnyDay = customValues.some((v: number) => v > 0);
      if (!hasAnyDay) {
        toast({
          title: "Frequência personalizada inválida",
          description: "Configure pelo menos um dia com quantidade maior que zero",
          variant: "destructive"
        });
        return;
      }
    }

    if (isEditMode) {
      updateActivityMutation.mutate(formData);
    } else {
      createActivityMutation.mutate(formData);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="create-activity-modal">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {isEditMode ? "Editar Atividade de Limpeza" : "Nova Atividade de Limpeza"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? "Modifique as informações da atividade abaixo"
              : "Preencha as informações para criar uma nova atividade de limpeza programada"}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações Básicas */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Informações Básicas
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Atividade *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Limpeza dos banheiros"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  data-testid="input-name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequency">Frequência</Label>
                <Select value={formData.frequency} onValueChange={(value) => handleChange("frequency", value)}>
                  <SelectTrigger data-testid="select-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diaria">Diária</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="semestral">Semestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                    <SelectItem value="turno">Por Turno</SelectItem>
                    <SelectItem value="custom">Personalizada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Data de Início *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                  data-testid="input-start-date"
                  required
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

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva detalhes da atividade de limpeza..."
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  data-testid="textarea-description"
                  rows={3}
                />
              </div>

              {/* Configuração de Frequência */}
              {formData.frequency === "diaria" && (
                <div key="daily-config" className="space-y-2">
                  <Label htmlFor="timesPerDay">Quantas vezes por dia? *</Label>
                  <Select 
                    key="times-per-day-select"
                    value={formData.frequencyConfig.timesPerDay.toString()} 
                    onValueChange={(value) => handleFrequencyConfigChange("timesPerDay", parseInt(value))}
                  >
                    <SelectTrigger data-testid="select-times-per-day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 vez por dia</SelectItem>
                      <SelectItem value="2">2 vezes por dia</SelectItem>
                      <SelectItem value="3">3 vezes por dia</SelectItem>
                      <SelectItem value="4">4 vezes por dia</SelectItem>
                      <SelectItem value="5">5 vezes por dia</SelectItem>
                      <SelectItem value="6">6 vezes por dia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.frequency === "semanal" && (
                <div key="weekly-config" className="md:col-span-2 space-y-3">
                  <Label>Dias da Semana *</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {[
                      { key: "domingo", label: "Dom" },
                      { key: "segunda", label: "Seg" },
                      { key: "terca", label: "Ter" },
                      { key: "quarta", label: "Qua" },
                      { key: "quinta", label: "Qui" },
                      { key: "sexta", label: "Sex" },
                      { key: "sabado", label: "Sáb" }
                    ].map(day => (
                      <label key={day.key} className="flex flex-col items-center space-y-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.frequencyConfig.weekDays.includes(day.key)}
                          onChange={(e) => {
                            const newWeekDays = e.target.checked
                              ? [...formData.frequencyConfig.weekDays, day.key]
                              : formData.frequencyConfig.weekDays.filter(d => d !== day.key);
                            handleFrequencyConfigChange("weekDays", newWeekDays);
                          }}
                          className="rounded"
                        />
                        <span className="text-xs">{day.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {formData.frequency === "mensal" && (
                <div key="monthly-config" className="space-y-2">
                  <Label htmlFor="monthDay">Dia do Mês *</Label>
                  <Select 
                    value={formData.frequencyConfig.monthDay.toString()} 
                    onValueChange={(value) => handleFrequencyConfigChange("monthDay", parseInt(value))}
                  >
                    <SelectTrigger data-testid="select-month-day">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                        <SelectItem key={day} value={day.toString()}>
                          Dia {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(formData.frequency === "trimestral" || formData.frequency === "semestral" || formData.frequency === "anual") && (
                <div key="periodic-config" className="space-y-2">
                  <Label htmlFor="executionDate">
                    {formData.frequency === "trimestral" && "Data Inicial de Execução (repete a cada 3 meses) *"}
                    {formData.frequency === "semestral" && "Data Inicial de Execução (repete a cada 6 meses) *"}
                    {formData.frequency === "anual" && "Data de Execução Anual *"}
                  </Label>
                  <Input
                    id="executionDate"
                    type="date"
                    value={formData.startDate || ""}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      handleChange("startDate", e.target.value);
                      handleFrequencyConfigChange("monthDay", date.getDate());
                    }}
                    className="w-full"
                    data-testid="input-execution-date"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.frequency === "trimestral" && "A atividade será executada nesta data e se repetirá a cada 3 meses"}
                    {formData.frequency === "semestral" && "A atividade será executada nesta data e se repetirá a cada 6 meses"}
                    {formData.frequency === "anual" && "A atividade será executada anualmente nesta data"}
                  </p>
                </div>
              )}

              {formData.frequency === "turno" && (
                <>
                  <div key="shift-config" className="md:col-span-2 space-y-3">
                    <Label>Turnos *</Label>
                    <div className="flex gap-4">
                      {[
                        { key: "manha", label: "Manhã" },
                        { key: "tarde", label: "Tarde" },
                        { key: "noite", label: "Noite" }
                      ].map(shift => (
                        <label key={shift.key} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.frequencyConfig.turnShifts.includes(shift.key)}
                            onChange={(e) => {
                              const newTurnShifts = e.target.checked
                                ? [...formData.frequencyConfig.turnShifts, shift.key]
                                : formData.frequencyConfig.turnShifts.filter(s => s !== shift.key);
                              handleFrequencyConfigChange("turnShifts", newTurnShifts);
                            }}
                            className="rounded"
                          />
                          <span>{shift.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  <div key="shift-weekdays-config" className="md:col-span-2 space-y-3">
                    <Label>Dias da Semana *</Label>
                    <div className="grid grid-cols-7 gap-2">
                      {[
                        { key: "domingo", label: "Dom" },
                        { key: "segunda", label: "Seg" },
                        { key: "terca", label: "Ter" },
                        { key: "quarta", label: "Qua" },
                        { key: "quinta", label: "Qui" },
                        { key: "sexta", label: "Sex" },
                        { key: "sabado", label: "Sáb" }
                      ].map(day => (
                        <label key={day.key} className="flex flex-col items-center space-y-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.frequencyConfig.weekDays.includes(day.key)}
                            onChange={(e) => {
                              const newWeekDays = e.target.checked
                                ? [...formData.frequencyConfig.weekDays, day.key]
                                : formData.frequencyConfig.weekDays.filter(d => d !== day.key);
                              handleFrequencyConfigChange("weekDays", newWeekDays);
                            }}
                            className="rounded"
                          />
                          <span className="text-xs">{day.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Selecione os dias da semana em que as atividades dos turnos escolhidos devem ocorrer
                    </p>
                  </div>
                </>
              )}

              {formData.frequency === "custom" && (
                <div key="custom-config" className="md:col-span-2 space-y-3">
                  <Label>Quantidade de Execuções por Dia da Semana *</Label>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "segunda", label: "Segunda" },
                      { key: "terca", label: "Terça" },
                      { key: "quarta", label: "Quarta" },
                      { key: "quinta", label: "Quinta" },
                      { key: "sexta", label: "Sexta" },
                      { key: "sabado", label: "Sábado" },
                      { key: "domingo", label: "Domingo" }
                    ].map(day => (
                      <div key={day.key} className="space-y-1">
                        <Label className="text-xs">{day.label}</Label>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          value={formData.frequencyConfig.customFrequency?.[day.key] || 0}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            handleFrequencyConfigChange("customFrequency", {
                              ...formData.frequencyConfig.customFrequency,
                              [day.key]: value
                            });
                          }}
                          placeholder="0"
                          data-testid={`input-custom-${day.key}`}
                          className="h-9"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Informe quantas vezes por semana a atividade deve ser realizada em cada dia (0 = não executar)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Local e Configurações */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Local e Configurações
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="serviceId">Serviço *</Label>
                <Select value={formData.serviceId} onValueChange={(value) => handleChange("serviceId", value)}>
                  <SelectTrigger data-testid="select-service">
                    <SelectValue placeholder="Selecione o serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    {(services as any[])?.filter((s: any) => s.module === 'clean').map((service: any) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <MultiSelect
                  label="Local"
                  options={(sites as any[])?.filter((s: any) => s.module === 'clean').map((site: any) => ({
                    value: site.id,
                    label: site.name
                  })) || []}
                  value={formData.siteIds}
                  onChange={(value) => handleChange("siteIds", value)}
                  placeholder="Selecione um ou mais locais"
                  required
                  data-testid="multiselect-sites"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <MultiSelect
                  label="Zona"
                  options={filteredZones?.map((zone: any) => ({
                    value: zone.id,
                    label: zone.name
                  })) || []}
                  value={formData.zoneIds}
                  onChange={(value) => handleChange("zoneIds", value)}
                  placeholder={formData.siteIds.length > 0 ? "Selecione uma ou mais zonas" : "Selecione ao menos um local"}
                  disabled={!formData.siteIds || formData.siteIds.length === 0}
                  required
                  data-testid="multiselect-zones"
                />
              </div>

              {/* Checklist - OBRIGATÓRIO quando houver serviço e zonas selecionadas */}
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="checklistTemplateId">Checklist (obrigatório)</Label>
                <Select 
                  value={formData.checklistTemplateId} 
                  onValueChange={(value) => handleChange("checklistTemplateId", value)}
                  disabled={!formData.serviceId || formData.zoneIds.length === 0}
                >
                  <SelectTrigger data-testid="select-checklist">
                    <SelectValue 
                      placeholder={
                        !formData.serviceId || formData.zoneIds.length === 0
                          ? "Selecione serviço e zonas primeiro"
                          : "Selecione um checklist"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {(checklistTemplates as any[])
                      ?.filter((ct: any) => {
                        const matchModule = ct.module === 'clean';
                        const matchService = !ct.serviceId || ct.serviceId === formData.serviceId;
                        const matchZone = !ct.zoneId || formData.zoneIds.includes(ct.zoneId);
                        const matchSite = !ct.siteId || formData.siteIds.includes(ct.siteId);
                        return matchModule && matchService && matchSite && matchZone;
                      })
                      .map((template: any) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="isActive">Status</Label>
                <Select 
                  value={formData.isActive ? "true" : "false"} 
                  onValueChange={(value) => handleChange("isActive", value === "true")}
                >
                  <SelectTrigger data-testid="select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Ativa</SelectItem>
                    <SelectItem value="false">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel"
            >
              Cancelar
            </Button>
            <Button 
              className={theme.buttons.primary}
              style={theme.buttons.primaryStyle}
              type="submit" 
              disabled={isEditMode ? updateActivityMutation.isPending : createActivityMutation.isPending}
              data-testid="button-submit"
            >
              {(isEditMode ? updateActivityMutation.isPending : createActivityMutation.isPending) ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  {isEditMode ? "Salvando..." : "Criando..."}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditMode ? "Salvar Alterações" : "Criar Atividade"}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
