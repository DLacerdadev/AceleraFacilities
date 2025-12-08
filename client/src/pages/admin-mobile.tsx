import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClient } from "@/contexts/ClientContext";
import { useModule } from "@/contexts/ModuleContext";
import { 
  Home, 
  ClipboardList, 
  Building, 
  Users, 
  QrCode, 
  Calendar,
  List,
  BarChart3,
  Plus,
  Menu,
  X,
  LogOut,
  User,
  Settings,
  ArrowLeft,
  Cog,
  TrendingUp,
  Target,
  Activity,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
  Search,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Timer
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { useLocation } from "wouter";
import { getAuthState, logout } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import Sites from "@/pages/sites";
import Services from "@/pages/services";
import Checklists from "@/pages/checklists";
import AdminDashboards from "@/pages/admin-dashboards";
import WorkOrdersMobile from "@/components/mobile/WorkOrdersMobile";
import UsersMobile from "@/components/mobile/UsersMobile";
import QRCodesMobile from "@/components/mobile/QRCodesMobile";
import ScheduleMobile from "@/components/mobile/ScheduleMobile";
import SettingsMobile from "@/components/mobile/SettingsMobile";
import ServiceSettingsMobile from "@/components/mobile/ServiceSettingsMobile";
import ReportsMobile from "@/components/mobile/ReportsMobile";

interface AdminMobileProps {
  companyId: string;
}

function DashboardsBI({ customerId }: { customerId: string }) {
  const { currentModule } = useModule();
  const [period, setPeriod] = useState("hoje");
  const [siteFilter, setSiteFilter] = useState("todos");

  // Buscar dados do dashboard
  const { data: dashStats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/customers", customerId, "dashboard-stats", period, siteFilter],
    enabled: !!customerId,
  });

  // Buscar analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/customers", customerId, "analytics", period, siteFilter],
    enabled: !!customerId,
  });

  // Buscar sites para filtro
  const { data: sites } = useQuery({
    queryKey: ["/api/customers", customerId, "sites", { module: currentModule }],
    enabled: !!customerId,
  });

  if (statsLoading || analyticsLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-2"></div>
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const stats = (dashStats || {}) as any;
  const chartData = (analytics || {}) as any;

  // Prepare data for charts - usar dados corretos do stats (que já conta vencidas)
  const statusChartData = [
    { name: 'Abertas', value: stats.openWorkOrders || 0, percentage: 0 },
    { name: 'Concluídas', value: stats.completedWorkOrders || 0, percentage: 0 },
    { name: 'Vencidas', value: stats.overdueWorkOrders || 0, percentage: 0 },
  ].map(item => {
    const totalOS = (stats.openWorkOrders || 0) + (stats.completedWorkOrders || 0) + (stats.overdueWorkOrders || 0);
    return {
      ...item,
      percentage: totalOS > 0 ? Math.round((item.value / totalOS) * 100) : 0
    };
  }).filter(item => item.value > 0 || item.name === 'Vencidas'); // Sempre mostrar vencidas mesmo se zero

  // Dados de prioridade das OSs
  const priorityData = [
    { name: 'Alta', value: Math.floor((stats.openWorkOrders || 0) * 0.2), color: '#ef4444' },
    { name: 'Média', value: Math.floor((stats.openWorkOrders || 0) * 0.5), color: '#f59e0b' },
    { name: 'Baixa', value: Math.floor((stats.openWorkOrders || 0) * 0.3), color: '#10b981' },
  ].filter(item => item.value > 0);

  const COLORS = {
    'Concluídas': '#10b981',
    'Abertas': '#3b82f6',
    'Vencidas': '#ef4444',
    'Em Andamento': '#f59e0b',
    'Canceladas': '#6b7280'
  };

  // Total OS
  const totalOS = (stats.openWorkOrders || 0) + (stats.completedWorkOrders || 0) + (stats.overdueWorkOrders || 0) + (stats.inProgressWorkOrders || 0);

  return (
    <div className="p-3 space-y-3 bg-gray-50 min-h-screen pb-20">
      {/* Header Moderno */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Dashboards BI
            </h1>
            <p className="text-xs text-blue-100 mt-0.5">Analytics em tempo real</p>
          </div>
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {["hoje", "ontem", "semana", "mes"].map((p) => (
            <button 
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                period === p 
                  ? "bg-white text-blue-600 shadow-md" 
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro de Sites */}
      <select 
        value={siteFilter} 
        onChange={(e) => setSiteFilter(e.target.value)}
        className="w-full px-4 py-2.5 bg-white border-0 rounded-xl text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="todos">📍 Todos os Locais</option>
        {(sites || []).map((site: any) => (
          <option key={site.id} value={site.id}>📍 {site.name}</option>
        ))}
      </select>

      {/* KPIs Principais - Design Moderno */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-blue-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">Total OS</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalOS}</p>
          <p className="text-xs text-gray-500 mt-1">{stats.efficiency || 0}% eficiência</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-green-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">Concluídas</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{stats.completedWorkOrders || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Finalizadas</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-orange-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">Abertas</span>
          </div>
          <p className="text-3xl font-bold text-orange-600">{stats.openWorkOrders || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Pendentes</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-red-100">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <span className="text-xs font-medium text-gray-600">Vencidas</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.overdueWorkOrders || 0}</p>
          <p className="text-xs text-gray-500 mt-1">Atrasadas</p>
        </div>
      </div>

      {/* Gráfico de Distribuição por Prioridade */}
      {priorityData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Distribuição por Prioridade</h3>
              <p className="text-xs text-gray-500">{stats.openWorkOrders || 0} OSs abertas</p>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: any) => [value, 'OSs']}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]} label={{ position: 'top', fontSize: 12, fontWeight: 'bold' }}>
                  {priorityData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Legend Cards */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {priorityData.map((item: any, index: number) => (
              <div key={index} className="bg-gray-50 rounded-lg p-2 text-center">
                <div 
                  className="w-3 h-3 rounded-full mx-auto mb-1" 
                  style={{ backgroundColor: item.color }}
                ></div>
                <p className="text-xs text-gray-600 font-medium">{item.name}</p>
                <p className="text-lg font-bold text-gray-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico de Barras Verticais - Distribuição de Status */}
      {statusChartData.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Distribuição por Status</h3>
              <p className="text-xs text-gray-500">{totalOS} ordens de serviço</p>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                  angle={-15}
                  textAnchor="end"
                  height={50}
                />
                <YAxis 
                  tick={{ fontSize: 10 }}
                  stroke="#9ca3af"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: 'none',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: any, name: string) => [value, 'Quantidade']}
                />
                <Bar dataKey="value" radius={[12, 12, 0, 0]} label={{ position: 'top', fontSize: 12, fontWeight: 'bold' }}>
                  {statusChartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#6b7280'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Stats Cards */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {statusChartData.map((item: any, index: number) => (
              <div key={index} className="bg-gray-50 rounded-lg p-2 text-center">
                <div 
                  className="w-3 h-3 rounded-full mx-auto mb-1" 
                  style={{ backgroundColor: COLORS[item.name as keyof typeof COLORS] || '#6b7280' }}
                ></div>
                <p className="text-xs text-gray-600 font-medium">{item.name}</p>
                <p className="text-lg font-bold text-gray-900">{item.value}</p>
                <p className="text-xs text-gray-500">{item.percentage}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Métricas de Performance */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
            <Target className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Indicadores de Qualidade</h3>
            <p className="text-xs text-gray-500">Métricas de performance</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.slaCompliance || 0}%</p>
            <p className="text-xs text-gray-500 mt-1">SLA</p>
          </div>
          <div className="text-center border-x border-gray-100">
            <p className="text-2xl font-bold text-green-600">{stats.qualityIndex || '-'}</p>
            <p className="text-xs text-gray-500 mt-1">Qualidade</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{stats.activeOperators || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Operadores</p>
          </div>
        </div>
      </div>

      {/* Infraestrutura */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center">
            <Building className="w-4 h-4 text-cyan-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Infraestrutura</h3>
            <p className="text-xs text-gray-500">Visão geral dos locais</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.totalSites || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Locais</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{stats.totalZones || 0}</p>
            <p className="text-xs text-gray-500 mt-1">Zonas</p>
          </div>
        </div>
      </div>

      {/* Alertas e Notificações */}
      <Card className="bg-white border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            Alertas e Notificações
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            {stats.overdueWorkOrders > 0 && (
              <div className="p-3 bg-red-50 border-l-3 border-red-400 rounded-r">
                <p className="text-sm font-medium text-red-800">⚠️ OS Vencidas</p>
                <p className="text-xs text-red-700">{stats.overdueWorkOrders} ordens estão atrasadas</p>
              </div>
            )}
            {stats.slaCompliance < 80 && (
              <div className="p-3 bg-yellow-50 border-l-3 border-yellow-400 rounded-r">
                <p className="text-sm font-medium text-yellow-800">📊 SLA Baixo</p>
                <p className="text-xs text-yellow-700">Compliance atual: {stats.slaCompliance}%</p>
              </div>
            )}
            {stats.efficiency > 85 && (
              <div className="p-3 bg-green-50 border-l-3 border-green-400 rounded-r">
                <p className="text-sm font-medium text-green-800">🎯 Excelente Performance</p>
                <p className="text-xs text-green-700">Eficiência de {stats.efficiency}%</p>
              </div>
            )}
            {stats.overdueWorkOrders === 0 && stats.slaCompliance >= 80 && stats.efficiency <= 85 && (
              <div className="p-3 bg-blue-50 border-l-3 border-blue-400 rounded-r">
                <p className="text-sm font-medium text-blue-800">ℹ️ Sistema Normal</p>
                <p className="text-xs text-blue-700">Todas as métricas estão dentro dos parâmetros</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminMobile({ companyId }: AdminMobileProps) {
  const { currentModule } = useModule();
  const [, setLocation] = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<string>("dashboard");
  const { toast } = useToast();
  const { user } = getAuthState();
  const { activeClientId, setActiveClientId, activeClient, customers } = useClient();
  
  // Usuários do tipo customer_user não podem alterar o cliente
  const isCustomerUser = (user as any)?.customerId ? true : false;

  const { data: selectedCustomer } = useQuery({
    queryKey: ["/api/customers", activeClientId],
    enabled: !!activeClientId,
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/customers", activeClientId, "dashboard-stats/total/todos"],
    enabled: !!activeClientId,
  });

  const { data: workOrdersResponse } = useQuery<{
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
    queryKey: ["/api/customers", activeClientId, "work-orders", { module: currentModule }],
    enabled: !!activeClientId,
  });
  
  // Extrair dados da resposta paginada
  const workOrders = workOrdersResponse?.data || [];
  // Usar statusCounts da API para contagens precisas (não limitado pela paginação)
  const statusCounts = workOrdersResponse?.statusCounts;

  const { data: sites = [] } = useQuery({
    queryKey: ["/api/customers", activeClientId, "sites", { module: currentModule }],
    enabled: !!activeClientId,
  });

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

  const quickActions = [
    { icon: ClipboardList, label: "Nova OS", page: "workorders", color: "bg-blue-500" },
    { icon: Building, label: "Locais", page: "sites", color: "bg-green-500" },
    { icon: Settings, label: "Serviços", page: "services", color: "bg-indigo-500" },
    { icon: Cog, label: "Config", page: "service-settings", color: "bg-purple-500" },
    { icon: QrCode, label: "QR Codes", page: "qrcodes", color: "bg-orange-500" },
    { icon: Calendar, label: "Cronograma", page: "schedule", color: "bg-pink-500" },
  ];

  const recentOS = (workOrders as any[]).slice(0, 3);
  // Usar statusCounts da API para contagens precisas (totais reais, não limitados pela paginação)
  const pendingOS = statusCounts 
    ? (statusCounts.abertas || 0) + (statusCounts.vencidas || 0)
    : (workOrders as any[]).filter((os: any) => os.status === 'aberta' || os.status === 'vencida').length;
  const completedToday = statusCounts?.concluidas || 0;

  const renderPageContent = () => {
    switch (currentPage) {
      case "sites":
        return <Sites customerId={activeClientId} />;
      case "services":
        return <Services customerId={activeClientId} />;
      case "service-settings":
        return <ServiceSettingsMobile customerId={activeClientId} />;
      case "settings":
        return <SettingsMobile onNavigate={setCurrentPage} />;
      case "schedule":
        return <ScheduleMobile customerId={activeClientId} />;
      case "qrcodes":
        return <QRCodesMobile customerId={activeClientId} />;
      case "checklists":
        return <Checklists />;
      case "workorders":
        return <WorkOrdersMobile customerId={activeClientId} />;
      case "users":
        return <UsersMobile customerId={activeClientId} />;
      case "reports":
        return <ReportsMobile customerId={activeClientId} />;
      case "dashboards":
        return <DashboardsBI customerId={activeClientId} />;
      default:
        return renderDashboard();
    }
  };

  const renderDashboard = () => (
    <div className="p-4 space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <ClipboardList className="w-8 h-8 text-white/90" />
                <div className="px-2 py-1 bg-white/20 rounded-full">
                  <p className="text-xs font-semibold text-white">OS</p>
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{pendingOS}</p>
                <p className="text-sm text-white/80 font-medium">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <BarChart3 className="w-8 h-8 text-white/90" />
                <div className="px-2 py-1 bg-white/20 rounded-full">
                  <p className="text-xs font-semibold text-white">Hoje</p>
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{completedToday}</p>
                <p className="text-sm text-white/80 font-medium">Concluídas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Building className="w-8 h-8 text-white/90" />
                <div className="px-2 py-1 bg-white/20 rounded-full">
                  <p className="text-xs font-semibold text-white">Total</p>
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{(sites as any[]).length}</p>
                <p className="text-sm text-white/80 font-medium">Locais</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <Users className="w-8 h-8 text-white/90" />
                <div className="px-2 py-1 bg-white/20 rounded-full">
                  <p className="text-xs font-semibold text-white">Ativos</p>
                </div>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{(stats as any)?.totalUsers || 0}</p>
                <p className="text-sm text-white/80 font-medium">Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-white border-0 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-slate-800">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Plus className="w-4 h-4 text-blue-600" />
            </div>
            Ações Rápidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.page}
                className="flex flex-col items-center p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 hover:from-blue-50 hover:to-blue-100 transition-all active:scale-95"
                onClick={() => setCurrentPage(action.page)}
              >
                <div className={`w-11 h-11 ${action.color} rounded-xl flex items-center justify-center shadow-md mb-2`}>
                  <action.icon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xs font-semibold text-slate-700 text-center leading-tight">{action.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Work Orders */}
      <Card className="bg-white border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <ClipboardList className="w-4 h-4 text-orange-600" />
              </div>
              Ordens Recentes
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
              onClick={() => setCurrentPage("workorders")}
            >
              Ver Todas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recentOS.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <ClipboardList className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">Nenhuma ordem recente</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOS.map((os: any) => (
                <div key={os.id} className="p-3 border-l-4 rounded-r-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  style={{
                    borderLeftColor: 
                      os.status === 'concluida' ? '#22c55e' :
                      os.status === 'vencida' ? '#ef4444' : '#3b82f6'
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{os.title}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{os.siteName}</p>
                    </div>
                    <Badge 
                      variant="outline" 
                      className={`text-xs font-semibold shrink-0 ${
                        os.status === 'concluida' ? 'bg-green-100 text-green-700 border-green-300' :
                        os.status === 'vencida' ? 'bg-red-100 text-red-700 border-red-300' :
                        'bg-blue-100 text-blue-700 border-blue-300'
                      }`}
                    >
                      {os.status === 'concluida' ? 'Concluída' :
                       os.status === 'vencida' ? 'Vencida' : 
                       os.status === 'aberta' ? 'Aberta' : os.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Site Overview */}
      <Card className="bg-white border-0 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2 text-slate-800">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Building className="w-4 h-4 text-blue-600" />
              </div>
              Locais Ativos
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-blue-600 hover:text-blue-700 text-xs font-semibold"
              onClick={() => setCurrentPage("sites")}
            >
              Gerenciar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(sites as any[]).length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Building className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">Nenhum local cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(sites as any[]).slice(0, 3).map((site: any) => (
                <div key={site.id} className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 hover:shadow-sm transition-shadow">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm shrink-0">
                      <Building className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{site.name}</p>
                      <p className="text-xs text-slate-600 truncate">{site.address || 'Endereço não informado'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative">
      {/* Header Mobile */}
      <div className="bg-white/90 backdrop-blur-lg border-b border-white/20 shadow-lg sticky top-0 z-50">
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {currentPage !== "dashboard" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage("dashboard")}
                  className="p-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              )}
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">O</span>
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">OPUS CLEAN</h1>
                <p className="text-sm text-slate-600">
                  {currentPage === "dashboard" ? "Visão Geral" : 
                   currentPage === "sites" ? "Locais" :
                   currentPage === "services" ? "Serviços" :
                   currentPage === "service-settings" ? "Configurações" :
                   currentPage === "schedule" ? "Cronograma" :
                   currentPage === "qrcodes" ? "QR Codes" :
                   currentPage === "checklists" ? "Checklists" :
                   currentPage === "workorders" ? "Ordens de Serviço" :
                   currentPage === "users" ? "Usuários" :
                   currentPage === "reports" ? "Relatórios" :
                   currentPage === "dashboards" ? "Dashboards" : "Visão Geral"}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-slate-600"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
          
          {/* Seletor de Cliente para Admin OPUS */}
          {!isCustomerUser && customers.length > 0 && (
            <div className="w-full">
              <Select value={activeClientId} onValueChange={setActiveClientId}>
                <SelectTrigger className="w-full bg-white/50 text-sm h-10" data-testid="mobile-customer-selector">
                  <SelectValue placeholder="Selecione um cliente" />
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
          
          {/* Nome do Cliente fixo para customer_user */}
          {isCustomerUser && activeClient && (
            <div className="w-full px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-600 font-medium">Cliente</p>
              <p className="text-sm font-semibold text-blue-900">{activeClient.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Slide Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-80 bg-white shadow-2xl flex flex-col animate-in slide-in-from-right" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 flex-shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-2 ring-white/30">
                  <User className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">{user?.name}</p>
                  <p className="text-sm text-white/80">{user?.role}</p>
                </div>
              </div>
            </div>
            
            {/* Menu Items - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              <Button 
                variant="ghost" 
                className="w-full justify-start h-11 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors" 
                onClick={() => { setCurrentPage("dashboard"); setIsMenuOpen(false); }}
              >
                <Home className="w-5 h-5 mr-3" />
                Visão Geral
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-11 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors" 
                onClick={() => { setCurrentPage("dashboards"); setIsMenuOpen(false); }}
              >
                <BarChart3 className="w-5 h-5 mr-3" />
                Dashboards
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-11 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors" 
                onClick={() => { setCurrentPage("workorders"); setIsMenuOpen(false); }}
              >
                <ClipboardList className="w-5 h-5 mr-3" />
                Ordens de Serviço
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-11 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors" 
                onClick={() => { setCurrentPage("service-settings"); setIsMenuOpen(false); }}
              >
                <Cog className="w-5 h-5 mr-3" />
                Configurações
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-11 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors" 
                onClick={() => { setCurrentPage("schedule"); setIsMenuOpen(false); }}
              >
                <Calendar className="w-5 h-5 mr-3" />
                Cronograma
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-11 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors" 
                onClick={() => { setCurrentPage("qrcodes"); setIsMenuOpen(false); }}
              >
                <QrCode className="w-5 h-5 mr-3" />
                QR Codes
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-11 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors" 
                onClick={() => { setCurrentPage("checklists"); setIsMenuOpen(false); }}
              >
                <List className="w-5 h-5 mr-3" />
                Checklists
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start h-11 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors" 
                onClick={() => { setCurrentPage("reports"); setIsMenuOpen(false); }}
              >
                <BarChart3 className="w-5 h-5 mr-3" />
                Relatórios
              </Button>
            </div>
            
            {/* Footer - Fixed */}
            <div className="flex-shrink-0 p-4 border-t bg-slate-50">
              <Button 
                variant="ghost" 
                className="w-full justify-start h-12 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-semibold transition-colors" 
                onClick={handleLogout}
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sair da Conta
              </Button>
            </div>
          </div>
        </div>
      )}

      {renderPageContent()}
    </div>
  );
}

// Componente CleaningScheduleMobile - Calendário otimizado para mobile
function CleaningScheduleMobile({ companyId }: { companyId: string }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month">("month");

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["/api/companies", companyId, "cleaning-activities"],
    enabled: !!companyId,
  });

  const { data: zones = [] } = useQuery({
    queryKey: ["/api/companies", companyId, "zones"],
    enabled: !!companyId,
  });

  // Funções para navegação de data
  const goToPrevious = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    }
  };

  const goToNext = () => {
    if (viewMode === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Função para obter as cores das frequências
  const getFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case "diaria":
        return "bg-green-500 text-white";
      case "semanal":
        return "bg-blue-500 text-white";
      case "mensal":
        return "bg-purple-500 text-white";
      case "turno":
        return "bg-orange-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  // Renderizar calendário mensal
  const renderMonthCalendar = () => {
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const currentDay = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const day = new Date(currentDay);
      const isCurrentMonth = day.getMonth() === currentDate.getMonth();
      const isToday = day.toDateString() === new Date().toDateString();

      days.push(
        <div
          key={i}
          className={`p-2 min-h-[60px] border-r border-b border-gray-100 ${
            !isCurrentMonth ? "bg-gray-50 text-gray-400" : "bg-white"
          } ${isToday ? "bg-blue-50 border-blue-200" : ""}`}
        >
          <div className={`text-sm font-medium ${isToday ? "text-blue-600" : ""}`}>
            {day.getDate()}
          </div>
          <div className="mt-1 space-y-1">
            {(activities as any[])
              .filter((activity: any) => {
                // Simples lógica para mostrar atividades baseado na frequência
                if (activity.frequency === "diaria") return true;
                if (activity.frequency === "semanal") return day.getDay() === 1; // Segundas
                if (activity.frequency === "mensal") return day.getDate() === 1; // Primeiro dia do mês
                return false;
              })
              .slice(0, 2)
              .map((activity: any, idx: number) => (
                <div
                  key={`${activity.id}-${idx}`}
                  className={`text-xs px-1.5 py-0.5 rounded truncate ${getFrequencyColor(activity.frequency)}`}
                >
                  {activity.name}
                </div>
              ))}
          </div>
        </div>
      );

      currentDay.setDate(currentDay.getDate() + 1);
    }

    return (
      <div className="bg-white rounded-lg border">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 border-b">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 border-r last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        {/* Grid dos dias */}
        <div className="grid grid-cols-7">{days}</div>
      </div>
    );
  };

  // Renderizar calendário semanal
  const renderWeekCalendar = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());

    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      const isToday = day.toDateString() === new Date().toDateString();

      days.push(
        <div key={i} className="flex-1 min-h-[200px] p-3 border-r last:border-r-0">
          <div className={`text-center pb-2 border-b mb-3 ${isToday ? "text-blue-600 font-bold" : ""}`}>
            <div className="text-xs text-gray-500">
              {day.toLocaleDateString("pt-BR", { weekday: "short" })}
            </div>
            <div className="text-lg font-semibold">{day.getDate()}</div>
          </div>
          <div className="space-y-2">
            {(activities as any[])
              .filter((activity: any) => {
                if (activity.frequency === "diaria") return true;
                if (activity.frequency === "semanal") return day.getDay() === 1;
                if (activity.frequency === "mensal") return day.getDate() === 1;
                return false;
              })
              .map((activity: any, idx: number) => (
                <div
                  key={`${activity.id}-${idx}`}
                  className={`text-xs p-2 rounded-lg ${getFrequencyColor(activity.frequency)}`}
                >
                  <div className="font-medium truncate">{activity.name}</div>
                  {(zones as any[]).find((z: any) => z.id === activity.zoneId) && (
                    <div className="text-xs opacity-75 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {(zones as any[]).find((z: any) => z.id === activity.zoneId)?.name}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg border">
        <div className="flex">{days}</div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 bg-slate-50 min-h-screen">
      {/* Header com controles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Plano de Limpeza
          </h1>
          <Button size="sm" variant="outline" onClick={goToToday}>
            Hoje
          </Button>
        </div>

        {/* Navegação de data */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={goToPrevious}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-base font-semibold text-gray-900 min-w-[140px] text-center">
              {viewMode === "month"
                ? currentDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
                : `${currentDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`}
            </div>
            <Button size="sm" variant="outline" onClick={goToNext}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Toggle de visualização */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              size="sm"
              variant={viewMode === "week" ? "default" : "ghost"}
              className="text-xs px-3"
              onClick={() => setViewMode("week")}
            >
              Semana
            </Button>
            <Button
              size="sm"
              variant={viewMode === "month" ? "default" : "ghost"}
              className="text-xs px-3"
              onClick={() => setViewMode("month")}
            >
              Mês
            </Button>
          </div>
        </div>
      </div>

      {/* Calendário */}
      {viewMode === "month" ? renderMonthCalendar() : renderWeekCalendar()}

      {/* Lista de atividades abaixo do calendário */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <List className="w-4 h-4" />
            Atividades Programadas ({(activities as any[]).length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(activities as any[]).slice(0, 5).map((activity: any) => (
            <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getFrequencyColor(activity.frequency).split(' ')[0]}`}></div>
                  <span className="text-sm font-medium text-gray-900">{activity.name}</span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <MapPin className="w-3 h-3" />
                    {(zones as any[]).find((z: any) => z.id === activity.zoneId)?.name || "Local não encontrado"}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Timer className="w-3 h-3" />
                    {activity.frequency === "diaria" ? "Diário" : 
                     activity.frequency === "semanal" ? "Semanal" :
                     activity.frequency === "mensal" ? "Mensal" : "Por Turno"}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(activities as any[]).length === 0 && (
            <div className="text-center py-6 text-gray-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Nenhuma atividade programada</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}