import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Users,
  TrendingUp,
  Calendar,
  Loader2,
  RefreshCcw,
  BarChart3,
  Zap,
  Target,
  ArrowUp,
  ArrowDown,
  Building
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { useModule } from "@/contexts/ModuleContext";
import { ModernCard } from "@/components/ui/modern-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { WorkOrder } from "@shared/schema";
import { useState } from "react";

export default function ThirdPartyDashboard() {
  const { user } = useAuth();
  const theme = useModuleTheme();
  const { currentModule } = useModule();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("total");

  const { data: workOrders = [], isLoading: loadingWorkOrders } = useQuery<WorkOrder[]>({
    queryKey: ['/api/third-party-portal/work-orders', { module: currentModule, _cacheKey: user?.thirdPartyCompanyId }],
    enabled: !!user?.thirdPartyCompanyId && !!currentModule,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: stats, isLoading: loadingStats } = useQuery<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
    usersCount: number;
    teamsCount: number;
  }>({
    queryKey: ['/api/third-party-portal/stats', user?.thirdPartyCompanyId],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: companyInfo } = useQuery<{
    id: string;
    name: string;
    customerName: string;
    customerId: string;
  }>({
    queryKey: ['/api/third-party-portal/company-info', user?.thirdPartyCompanyId],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aberta':
        return <Badge variant="outline">Aberta</Badge>;
      case 'em_execucao':
        return <Badge className="bg-blue-500/10 text-blue-600">Em Execução</Badge>;
      case 'pausada':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Pausada</Badge>;
      case 'concluida':
        return <Badge className="bg-chart-2/10 text-chart-2">Concluída</Badge>;
      case 'vencida':
        return <Badge className="bg-red-500/10 text-red-600">Vencida</Badge>;
      case 'cancelada':
        return <Badge variant="outline" className="text-muted-foreground">Cancelada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critica':
        return <Badge className="bg-red-500/10 text-red-600">Crítica</Badge>;
      case 'alta':
        return <Badge className="bg-orange-500/10 text-orange-600">Alta</Badge>;
      case 'media':
        return <Badge className="bg-yellow-500/10 text-yellow-600">Média</Badge>;
      case 'baixa':
        return <Badge className="bg-chart-2/10 text-chart-2">Baixa</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/work-orders', user?.thirdPartyCompanyId, currentModule] });
    queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/stats', user?.thirdPartyCompanyId] });
    queryClient.invalidateQueries({ queryKey: ['/api/third-party-portal/company-info', user?.thirdPartyCompanyId] });
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const upcomingWorkOrders = workOrders
    .filter(wo => wo.status === 'aberta' || wo.status === 'em_execucao')
    .slice(0, 5);

  const efficiency = stats?.total && stats.total > 0 
    ? Math.round((stats.completed / stats.total) * 100) 
    : 0;

  const slaCompliance = stats?.total && stats.total > 0 
    ? Math.round(((stats.total - stats.overdue) / stats.total) * 100) 
    : 0;

  if (loadingWorkOrders || loadingStats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 dark:from-slate-900 dark:via-slate-800/40 dark:to-slate-900/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-r-blue-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Carregando dados...</p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Preparando seu dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 dark:from-slate-900 dark:via-slate-800/40 dark:to-slate-900/20">
      {/* Modern Glassmorphic Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/60 dark:border-slate-700/60 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {companyInfo?.name} - Cliente: {companyInfo?.customerName}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40 h-10 border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm" data-testid="select-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="ontem">Ontem</SelectItem>
                  <SelectItem value="semana">Esta Semana</SelectItem>
                  <SelectItem value="mes">Este Mês</SelectItem>
                  <SelectItem value="total">Total</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="sm"
                className="h-10 border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm"
                onClick={handleRefresh}
                data-testid="button-refresh"
              >
                <RefreshCcw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-6 py-4 space-y-6">
        {/* Modern KPI Cards with Glassmorphism */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Eficiência Operacional */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 dark:bg-slate-800/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Eficiência Operacional</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent mb-3">
                    {efficiency}%
                  </p>
                  <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${efficiency}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SLA Compliance */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 dark:bg-slate-800/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">SLA Compliance</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-3">
                    {slaCompliance}%
                  </p>
                  <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${slaCompliance}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* OS Concluídas */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 dark:bg-slate-800/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">OS Concluídas</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent mb-3">
                    {stats?.completed || 0}
                  </p>
                  <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${efficiency}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Total: {stats?.total || 0}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* OS Vencidas */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500 to-red-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 dark:bg-slate-800/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <AlertTriangle className="w-7 h-7 text-white" />
                  </div>
                  {(stats?.overdue || 0) > 0 && (
                    <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-0 shadow-sm backdrop-blur-sm">
                      Atenção
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">O.S Vencidas</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent mb-3">
                    {stats?.overdue || 0}
                  </p>
                  <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${stats?.total ? ((stats.overdue || 0) / stats.total) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Ordens com prazo expirado
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Second Row - Team Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Users Count */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 dark:bg-slate-800/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <Users className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Usuários Ativos</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-700 bg-clip-text text-transparent">
                      {stats?.usersCount || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Teams Count */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 dark:bg-slate-800/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                    <Building className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Equipes</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-amber-700 bg-clip-text text-transparent">
                      {stats?.teamsCount || 0}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Work Orders Table */}
        <ModernCard variant="gradient">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Ordens de Serviço Programadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingWorkOrders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma ordem de serviço programada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Prazo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcomingWorkOrders.map((wo) => (
                    <TableRow key={wo.id} data-testid={`row-work-order-${wo.id}`}>
                      <TableCell className="font-medium">{wo.title}</TableCell>
                      <TableCell>{getStatusBadge(wo.status)}</TableCell>
                      <TableCell>{getPriorityBadge(wo.priority)}</TableCell>
                      <TableCell>
                        {wo.dueDate 
                          ? format(new Date(wo.dueDate), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </ModernCard>
      </div>
    </div>
  );
}
