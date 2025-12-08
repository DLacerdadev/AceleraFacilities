import React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useClient } from "@/contexts/ClientContext";
import { useModule } from "@/contexts/ModuleContext";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  MapPin,
  Calendar,
  RefreshCcw,
  Download,
  Building,
  Target,
  Award,
  Activity,
  Gauge,
  BarChart3,
  Zap,
  Star,
  ArrowUp,
  ArrowDown
} from "lucide-react";

export default function Dashboard() {
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>("total");
  const [selectedSite, setSelectedSite] = React.useState<string>("todos");
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { activeClientId } = useClient();
  const { currentModule } = useModule();

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [`/api/customers/${activeClientId}/dashboard-stats/${selectedPeriod}/${selectedSite}?module=${currentModule}`],
    enabled: !!activeClientId,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: [`/api/customers/${activeClientId}/analytics/${selectedPeriod}/${selectedSite}?module=${currentModule}`],
    enabled: !!activeClientId,
  });

  const { data: workOrdersResponse } = useQuery<{
    data: any[];
    pagination?: any;
    statusCounts?: any;
  }>({
    queryKey: ["/api/customers", activeClientId, "work-orders", { module: currentModule }],
    enabled: !!activeClientId,
  });
  
  // Extrair dados da resposta paginada
  const workOrders = workOrdersResponse?.data || [];

  const { data: sites } = useQuery({
    queryKey: ["/api/customers", activeClientId, "sites", { module: currentModule }],
    enabled: !!activeClientId,
  });

  const { data: goals } = useQuery({
    queryKey: ["/api/customers", activeClientId, "dashboard-goals", { module: currentModule }],
    enabled: !!activeClientId,
  });

  const { data: zones } = useQuery({
    queryKey: ["/api/customers", activeClientId, "zones", { module: currentModule }],
    enabled: !!activeClientId,
  });

  // Helper function to get goal value by type
  const getGoalValue = (goalType: string): number | null => {
    if (!goals) return null;
    const goal = (goals as any[]).find((g: any) => g.goalType === goalType);
    return goal ? parseFloat(goal.goalValue) : null;
  };


  if (statsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
            <div className="absolute inset-0 w-20 h-20 border-4 border-transparent border-r-blue-400 rounded-full animate-spin mx-auto" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
          </div>
          <div>
            <p className="text-base font-semibold text-slate-900">Carregando dados...</p>
            <p className="text-sm text-slate-500 mt-1">Preparando seu dashboard</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50/40 to-slate-100/20">
      {/* Modern Glassmorphic Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-white/90 border-b border-slate-200/60 shadow-sm">
        <div className="w-full px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Dashboard
                </h1>
                <p className="text-sm text-slate-600">Visão completa do sistema em tempo real</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-40 h-10 border-slate-200 bg-white/60 backdrop-blur-sm hover:bg-white transition-all">
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

              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="w-48 h-10 border-slate-200 bg-white/60 backdrop-blur-sm hover:bg-white transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Locais</SelectItem>
                  {(sites as any[] || []).map((site: any) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button 
                variant="outline" 
                size="sm"
                className="h-10 border-slate-200 bg-white/60 backdrop-blur-sm hover:bg-white hover:scale-105 transition-all duration-200"
                onClick={() => {
                  setIsRefreshing(true);
                  if (activeClientId) {
                    queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId] });
                  }
                  setTimeout(() => setIsRefreshing(false), 1000);
                }}
                data-testid="button-refresh"
              >
                <RefreshCcw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>

              <Button 
                variant="outline" 
                size="sm"
                className="h-10 border-slate-200 bg-white/60 backdrop-blur-sm hover:bg-white hover:scale-105 transition-all duration-200"
                onClick={() => {
                  const exportData = {
                    periodo: selectedPeriod,
                    local: selectedSite === 'todos' ? 'Todos os Locais' : (sites as any[] || []).find((s: any) => s.id === selectedSite)?.name || 'N/A',
                    data_export: new Date().toLocaleString('pt-BR'),
                    kpis: {
                      eficiencia: (stats as any)?.efficiency || 0,
                      sla_compliance: (stats as any)?.slaCompliance || 0,
                      os_abertas: (stats as any)?.openWorkOrders || 0,
                      os_concluidas: (stats as any)?.completedWorkOrders || 0,
                      os_vencidas: (stats as any)?.overdueWorkOrders || 0,
                      area_limpa: (stats as any)?.areaCleanedToday || 0,
                      operadores_ativos: (stats as any)?.activeOperators || 0,
                      indice_qualidade: (stats as any)?.qualityIndex || 0
                    }
                  };
                  
                  const csvContent = `data:text/csv;charset=utf-8,` +
                    `Período,${exportData.periodo}\n` +
                    `Local,${exportData.local}\n` +
                    `Data de Exportação,${exportData.data_export}\n` +
                    `\n` +
                    `Métrica,Valor\n` +
                    `Eficiência Operacional,${exportData.kpis.eficiencia}%\n` +
                    `SLA Compliance,${exportData.kpis.sla_compliance}%\n` +
                    `OS Abertas,${exportData.kpis.os_abertas}\n` +
                    `OS Concluídas,${exportData.kpis.os_concluidas}\n` +
                    `OS Vencidas,${exportData.kpis.os_vencidas}\n` +
                    `Área Limpa (m²),${exportData.kpis.area_limpa}\n` +
                    `Operadores Ativos,${exportData.kpis.operadores_ativos}\n` +
                    `Índice de Qualidade,${exportData.kpis.indice_qualidade}/10`;
                  
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `dashboard_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                data-testid="button-exportar"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <div className="w-full px-6 py-4 space-y-3">
        {/* Modern KPI Cards with Glassmorphism */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Eficiência Operacional */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <Zap className="w-7 h-7 text-white" />
                  </div>
                  {(() => {
                    const goalValue = getGoalValue('eficiencia_operacional');
                    if (!goalValue) return null;
                    const currentValue = (stats as any)?.efficiency || 0;
                    const diff = currentValue - goalValue;
                    return diff >= 0 ? (
                      <Badge className="bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border-0 shadow-sm backdrop-blur-sm">
                        <ArrowUp className="w-3 h-3 mr-1" />
                        +{diff.toFixed(1)}%
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-0 shadow-sm backdrop-blur-sm">
                        <ArrowDown className="w-3 h-3 mr-1" />
                        {diff.toFixed(1)}%
                      </Badge>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Eficiência Operacional</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent mb-3">
                    {(stats as any)?.efficiency || 0}%
                  </p>
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${(stats as any)?.efficiency || 0}%` }}
                    ></div>
                  </div>
                  {(() => {
                    const goalValue = getGoalValue('eficiencia_operacional');
                    if (!goalValue) return null;
                    return (
                      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Meta: {goalValue}%
                      </p>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* SLA Compliance */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  {(() => {
                    const goalValue = getGoalValue('sla_compliance');
                    if (!goalValue) return null;
                    const currentValue = (stats as any)?.slaCompliance || 0;
                    const diff = currentValue - goalValue;
                    return diff >= 0 ? (
                      <Badge className="bg-blue-500/10 text-blue-700 hover:bg-blue-500/20 border-0 shadow-sm backdrop-blur-sm">
                        <ArrowUp className="w-3 h-3 mr-1" />
                        +{diff.toFixed(1)}%
                      </Badge>
                    ) : (
                      <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-0 shadow-sm backdrop-blur-sm">
                        <ArrowDown className="w-3 h-3 mr-1" />
                        {diff.toFixed(1)}%
                      </Badge>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">SLA Compliance</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent mb-3">
                    {(stats as any)?.slaCompliance || 0}%
                  </p>
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${(stats as any)?.slaCompliance || 0}%` }}
                    ></div>
                  </div>
                  {(() => {
                    const goalValue = getGoalValue('sla_compliance');
                    if (!goalValue) return null;
                    return (
                      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Meta: {goalValue}%
                      </p>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* OS Concluídas */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <CheckCircle className="w-7 h-7 text-white" />
                  </div>
                  {(() => {
                    const goalValue = getGoalValue('os_concluidas_mes');
                    const currentValue = (stats as any)?.completedWorkOrders || 0;
                    if (goalValue && goalValue > 0) {
                      const diff = currentValue - goalValue;
                      return diff >= 0 ? (
                        <Badge className="bg-purple-500/10 text-purple-700 hover:bg-purple-500/20 border-0 shadow-sm backdrop-blur-sm">
                          <ArrowUp className="w-3 h-3 mr-1" />
                          +{diff}
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-0 shadow-sm backdrop-blur-sm">
                          <ArrowDown className="w-3 h-3 mr-1" />
                          {diff}
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">OS Concluídas</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent mb-3">
                    {(stats as any)?.completedWorkOrders || 0}
                  </p>
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${(stats as any)?.efficiency || 0}%` }}
                    ></div>
                  </div>
                  {(() => {
                    const goalValue = getGoalValue('os_concluidas_mes');
                    const totalOrders = ((stats as any)?.completedWorkOrders || 0) + ((stats as any)?.openWorkOrders || 0);
                    return goalValue ? (
                      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Meta: {goalValue}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                        <Activity className="w-3 h-3" />
                        Total: {totalOrders}
                      </p>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Índice de Qualidade */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl opacity-0 group-hover:opacity-100 blur transition duration-300"></div>
            <Card className="relative border-0 shadow-lg hover:shadow-2xl transition-all duration-300 backdrop-blur-sm bg-white/90 overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent rounded-bl-full"></div>
              <CardContent className="p-4 relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <Star className="w-7 h-7 text-white" />
                  </div>
                  {(() => {
                    const completedOrders = (stats as any)?.completedWorkOrders || 0;
                    const qualityIndex = (stats as any)?.qualityIndex;
                    
                    if (completedOrders === 0 || qualityIndex === null || qualityIndex === undefined) {
                      return null;
                    }
                    
                    const goalValue = getGoalValue('indice_qualidade');
                    const diff = goalValue ? qualityIndex - goalValue : 0;
                    
                    return goalValue && diff >= 0 ? (
                      <Badge className="bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border-0 shadow-sm backdrop-blur-sm">
                        <ArrowUp className="w-3 h-3 mr-1" />
                        +{diff.toFixed(1)}
                      </Badge>
                    ) : goalValue && diff < 0 ? (
                      <Badge className="bg-red-500/10 text-red-700 hover:bg-red-500/20 border-0 shadow-sm backdrop-blur-sm">
                        <ArrowDown className="w-3 h-3 mr-1" />
                        {diff.toFixed(1)}
                      </Badge>
                    ) : null;
                  })()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-600 mb-2">Índice de Qualidade</p>
                  {(() => {
                    const completedOrders = (stats as any)?.completedWorkOrders || 0;
                    const qualityIndex = (stats as any)?.qualityIndex;
                    
                    if (completedOrders === 0 || qualityIndex === null || qualityIndex === undefined) {
                      return <p className="text-4xl font-bold text-slate-400 mb-3">N/A</p>;
                    }
                    
                    return (
                      <p className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-amber-700 bg-clip-text text-transparent mb-3">
                        {qualityIndex}<span className="text-xl text-slate-500">/10</span>
                      </p>
                    );
                  })()}
                  <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-gradient-to-r from-amber-500 to-amber-600 rounded-full transition-all duration-500 shadow-sm"
                      style={{ width: `${((stats as any)?.completedWorkOrders || 0) > 0 ? ((stats as any)?.qualityIndex || 0) * 10 : 0}%` }}
                    ></div>
                  </div>
                  {(() => {
                    const goalValue = getGoalValue('indice_qualidade');
                    const ratedCount = (stats as any)?.ratedCount || 0;
                    const completedOrders = (stats as any)?.completedWorkOrders || 0;
                    
                    if (completedOrders === 0) {
                      return <p className="text-xs text-slate-500 mt-3">Sem avaliações</p>;
                    }
                    
                    return goalValue ? (
                      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        Meta: {goalValue}/10 • {ratedCount} avaliações
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        {ratedCount} avaliações
                      </p>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modern Charts with Glassmorphism */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Performance Trend */}
          <Card className="border-0 shadow-lg backdrop-blur-sm bg-white/90 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                Tendência de Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={(analytics as any)?.daily || []}>
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tickFormatter={(value) => {
                      if (!value) return '';
                      const date = new Date(value);
                      return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
                    }}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={{ stroke: '#e2e8f0' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="efficiency" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    fill="url(#colorGradient)"
                    name="Eficiência %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card className="border-0 shadow-lg backdrop-blur-sm bg-white/90 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500"></div>
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-sm">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                Distribuição de Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={(analytics as any)?.statusBreakdown?.map((item: any) => ({
                      name: item.status === 'concluida' ? 'Concluídas' : 
                            item.status === 'aberta' ? 'Abertas' : 
                            item.status === 'vencida' ? 'Vencidas' : item.status,
                      value: item.count,
                      percentage: item.percentage
                    })) || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {((analytics as any)?.statusBreakdown || []).map((entry: any, index: number) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={
                          entry.status === 'concluida' ? '#10b981' :
                          entry.status === 'em_andamento' ? '#3b82f6' :
                          entry.status === 'aberta' ? '#f59e0b' :
                          entry.status === 'vencida' ? '#ef4444' : '#6b7280'
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(12px)',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-6 grid grid-cols-2 gap-3">
                {((analytics as any)?.statusBreakdown || []).map((item: any, index: number) => (
                  <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/50 backdrop-blur-sm hover:bg-slate-100/80 transition-all">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0 shadow-sm" 
                      style={{ 
                        backgroundColor: 
                          item.status === 'concluida' ? '#10b981' :
                          item.status === 'em_andamento' ? '#3b82f6' :
                          item.status === 'aberta' ? '#f59e0b' :
                          item.status === 'vencida' ? '#ef4444' : '#6b7280'
                      }}
                    />
                    <span className="text-xs font-medium text-slate-700">
                      {item.status === 'concluida' ? 'Concluídas' : 
                       item.status === 'aberta' ? 'Abertas' : 
                       item.status === 'vencida' ? 'Vencidas' : item.status}: {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sites Overview with Modern Design */}
        <Card className="border-0 shadow-xl backdrop-blur-xl bg-gradient-to-br from-white via-white to-slate-50/30 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600"></div>
          <CardHeader className="border-b border-slate-100/50 bg-gradient-to-br from-white/80 via-slate-50/40 to-transparent backdrop-blur-sm pb-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-4 ring-blue-50">
                  <Building className="w-5 h-5 text-white" />
                </div>
                <span className="bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Performance por Local
                </span>
              </CardTitle>
              <Badge className="bg-white text-slate-700 border border-slate-200 shadow-sm px-3 py-1.5">
                {(sites as any[] || []).length} {(sites as any[] || []).length === 1 ? 'Local' : 'Locais'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 bg-gradient-to-br from-transparent to-slate-50/20">
            <div className="space-y-4">
              {(sites as any[] || []).map((site: any) => {
                // Get all zone IDs for this site
                const siteZoneIds = (zones as any[] || [])
                  .filter((z: any) => z.siteId === site.id)
                  .map((z: any) => z.id);
                
                // Filter work orders by zones that belong to this site
                const siteWorkOrders = (workOrders as any[] || []).filter((wo: any) => 
                  siteZoneIds.includes(wo.zoneId)
                );
                
                const totalOS = siteWorkOrders.length;
                const concluidas = siteWorkOrders.filter((wo: any) => wo.status === 'concluida').length;
                const taxaConclusao = totalOS > 0 ? Math.round((concluidas / totalOS) * 100) : 0;
                
                return (
                  <div 
                    key={site.id}
                    className="space-y-2"
                    data-testid={`site-progress-${site.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-slate-700">{site.name}</div>
                      <div className="text-sm font-bold text-slate-900">{taxaConclusao}%</div>
                    </div>
                    <div className="relative h-3 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className={`absolute h-full rounded-full transition-all duration-700 ease-out ${
                          taxaConclusao >= 80 ? 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600' :
                          taxaConclusao >= 60 ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600' :
                          taxaConclusao >= 40 ? 'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600' : 
                          'bg-gradient-to-r from-red-400 via-red-500 to-red-600'
                        }`}
                        style={{ width: `${taxaConclusao}%` }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {(sites as any[] || []).length === 0 && (
                <div className="text-center py-12 bg-gradient-to-br from-slate-50/80 to-white rounded-2xl backdrop-blur-sm border-2 border-dashed border-slate-200">
                  <Building className="w-16 h-16 text-slate-300 mx-auto mb-3 opacity-50" />
                  <p className="text-slate-600 text-sm font-semibold">Nenhum local cadastrado</p>
                  <p className="text-slate-400 text-xs mt-1">Adicione locais para visualizar métricas de performance</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Zone Performance with Modern Design */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Top Zones */}
          <Card className="border-0 shadow-lg backdrop-blur-sm bg-white/90 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500"></div>
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                Top Zonas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {(() => {
                  const zonesWithStats = (zones as any[] || []).map((zone: any) => {
                    const zoneWorkOrders = (workOrders as any[] || []).filter((wo: any) => wo.zoneId === zone.id);
                    const total = zoneWorkOrders.length;
                    const concluidas = zoneWorkOrders.filter((wo: any) => wo.status === 'concluida').length;
                    const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;
                    return { ...zone, totalOS: total, concluidas, taxa };
                  })
                  .filter(z => z.totalOS > 0)
                  .sort((a, b) => b.taxa - a.taxa)
                  .slice(0, 5);

                  if (zonesWithStats.length === 0) {
                    return (
                      <div className="text-center py-12 bg-slate-50/50 rounded-2xl backdrop-blur-sm">
                        <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 text-sm font-medium">Nenhuma zona com OSs</p>
                      </div>
                    );
                  }

                  return zonesWithStats.map((zone: any, index: number) => (
                    <div 
                      key={zone.id} 
                      className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-slate-50 to-white hover:from-blue-50/50 hover:to-white transition-all duration-200 border border-slate-200/50 hover:border-blue-300/50 shadow-sm hover:shadow-md group"
                      data-testid={`top-zone-${zone.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg transform group-hover:scale-110 transition-transform ${
                          index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 shadow-yellow-500/30' :
                          index === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-500/30' :
                          index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-500 shadow-orange-500/30' :
                          'bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-emerald-500/30'
                        }`}>
                          #{index + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{zone.name}</div>
                          <div className="text-xs text-slate-500">
                            {zone.concluidas}/{zone.totalOS} OSs concluídas
                          </div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
                        {zone.taxa}%
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Attention Zones */}
          <Card className="border-0 shadow-lg backdrop-blur-sm bg-white/90 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-orange-500 to-amber-500"></div>
            <CardHeader className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-transparent">
              <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-white" />
                </div>
                Zonas de Atenção
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-3">
                {(() => {
                  const zonesWithStats = (zones as any[] || []).map((zone: any) => {
                    const zoneWorkOrders = (workOrders as any[] || []).filter((wo: any) => wo.zoneId === zone.id);
                    const total = zoneWorkOrders.length;
                    const vencidas = zoneWorkOrders.filter((wo: any) => wo.status === 'vencida').length;
                    const abertas = zoneWorkOrders.filter((wo: any) => wo.status === 'aberta').length;
                    return { ...zone, totalOS: total, vencidas, abertas };
                  })
                  .filter(z => z.vencidas > 0)
                  .sort((a, b) => b.vencidas - a.vencidas)
                  .slice(0, 5);

                  if (zonesWithStats.length === 0) {
                    return (
                      <div className="text-center py-12 bg-gradient-to-br from-emerald-50 to-green-50/50 rounded-2xl backdrop-blur-sm border border-emerald-200/50">
                        <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                        <p className="text-emerald-600 font-semibold text-sm">Tudo em dia!</p>
                        <p className="text-emerald-600/70 text-xs mt-1">Nenhuma zona com OSs vencidas</p>
                      </div>
                    );
                  }

                  return zonesWithStats.map((zone: any) => (
                    <div 
                      key={zone.id} 
                      className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-red-50/50 to-white hover:from-red-50 hover:to-white transition-all duration-200 border border-red-200/50 hover:border-red-300 shadow-sm hover:shadow-md group"
                      data-testid={`attention-zone-${zone.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transform group-hover:scale-110 transition-transform">
                          <AlertTriangle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm group-hover:text-red-600 transition-colors">{zone.name}</div>
                          <div className="text-xs text-slate-500">
                            {zone.vencidas} vencidas • {zone.abertas} abertas
                          </div>
                        </div>
                      </div>
                      <div className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">
                        {zone.vencidas}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
