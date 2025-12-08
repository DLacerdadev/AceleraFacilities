import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Date picker component would be imported here if needed
import { Separator } from "@/components/ui/separator";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  MapPin,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Target,
  Zap,
  Award,
  RefreshCcw,
  Download,
  Settings,
  Building,
  ClipboardList
} from "lucide-react";

interface DashboardProps {
  companyId: string;
}

export default function Dashboard({ companyId }: DashboardProps) {
  const [dateRange, setDateRange] = React.useState<any>(null);
  const [selectedSite, setSelectedSite] = React.useState<string>("todos");
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>("hoje");

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/companies", companyId, "dashboard-stats"],
    enabled: !!companyId,
  });

  const { data: workOrders } = useQuery({
    queryKey: ["/api/companies", companyId, "work-orders"],
    enabled: !!companyId,
  });

  const { data: sites } = useQuery({
    queryKey: ["/api/companies", companyId, "sites"],
    enabled: !!companyId,
  });

  // Mock data for charts (in production this would come from APIs)
  const productivityData = [
    { name: 'Seg', eficiencia: 85, sla: 92, qualidade: 88 },
    { name: 'Ter', eficiencia: 88, sla: 85, qualidade: 91 },
    { name: 'Qua', eficiencia: 92, sla: 89, qualidade: 89 },
    { name: 'Qui', eficiencia: 87, sla: 94, qualidade: 92 },
    { name: 'Sex', eficiencia: 90, sla: 88, qualidade: 90 },
    { name: 'Sáb', eficiencia: 78, sla: 82, qualidade: 85 },
    { name: 'Dom', eficiencia: 75, sla: 79, qualidade: 83 }
  ];

  const statusDistribution = [
    { name: 'Concluídas', value: 68, color: '#10b981' },
    { name: 'Em Andamento', value: 22, color: '#3b82f6' },
    { name: 'Pendentes', value: 7, color: '#f59e0b' },
    { name: 'Atrasadas', value: 3, color: '#ef4444' }
  ];

  const sitePerformance = [
    { site: 'Escritório Administrativo', os_concluidas: 45, eficiencia: 87, sla: 92 },
    { site: 'Fábrica Principal', os_concluidas: 68, eficiencia: 75, sla: 88 },
    { site: 'Centro Logístico', os_concluidas: 32, eficiencia: 93, sla: 95 },
    { site: 'Laboratório', os_concluidas: 24, eficiencia: 89, sla: 91 }
  ];

  const monthlyTrend = [
    { mes: 'Jan', os_total: 320, os_concluidas: 298, sla_medio: 89 },
    { mes: 'Fev', os_total: 285, os_concluidas: 267, sla_medio: 91 },
    { mes: 'Mar', os_total: 310, os_concluidas: 295, sla_medio: 88 },
    { mes: 'Abr', os_total: 298, os_concluidas: 287, sla_medio: 92 },
    { mes: 'Mai', os_total: 325, os_concluidas: 312, sla_medio: 94 },
    { mes: 'Jun', os_total: 342, os_concluidas: 324, sla_medio: 92 }
  ];

  if (statsLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Modern Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Dashboard Analytics</h1>
                  <p className="text-sm text-slate-600">Visão geral das operações em tempo real</p>
                </div>
              </div>
            </div>
            
            {/* Filters and Controls */}
            <div className="flex items-center space-x-3">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-36">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="ontem">Ontem</SelectItem>
                  <SelectItem value="semana">Esta Semana</SelectItem>
                  <SelectItem value="mes">Este Mês</SelectItem>
                  <SelectItem value="trimestre">Trimestre</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="w-48">
                  <Building className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Unidades</SelectItem>
                  {(sites as any[] || []).map((site: any) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>

              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Eficiência Operacional */}
          <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-emerald-700">Eficiência Operacional</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-emerald-900">87.5%</span>
                    <div className="flex items-center text-sm text-emerald-600">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      +5.2%
                    </div>
                  </div>
                  <p className="text-xs text-emerald-600">vs. semana anterior</p>
                </div>
                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                  <Target className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SLA Compliance */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-blue-700">SLA Compliance</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-blue-900">92.3%</span>
                    <div className="flex items-center text-sm text-blue-600">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      +2.1%
                    </div>
                  </div>
                  <p className="text-xs text-blue-600">meta: 90%</p>
                </div>
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ordens de Serviço */}
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-purple-700">OS Concluídas Hoje</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-purple-900">156</span>
                    <div className="flex items-center text-sm text-red-600">
                      <TrendingDown className="w-4 h-4 mr-1" />
                      -3.2%
                    </div>
                  </div>
                  <p className="text-xs text-purple-600">de 169 programadas</p>
                </div>
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Qualidade */}
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-orange-700">Índice de Qualidade</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold text-orange-900">9.1/10</span>
                    <div className="flex items-center text-sm text-orange-600">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      +0.3
                    </div>
                  </div>
                  <p className="text-xs text-orange-600">avaliações do mês</p>
                </div>
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                  <Award className="w-6 h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Performance Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <span>Performance Semanal</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={productivityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                    }} 
                  />
                  <Legend />
                  <Bar dataKey="eficiencia" fill="#3b82f6" name="Eficiência %" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sla" fill="#10b981" name="SLA %" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="qualidade" fill="#f59e0b" name="Qualidade %" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <PieChartIcon className="w-5 h-5 text-green-600" />
                <span>Status das OS</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={statusDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value}%`, 'Percentual']}
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                {statusDistribution.map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm text-slate-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-medium">{item.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Site Performance and Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Site Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building className="w-5 h-5 text-purple-600" />
                <span>Performance por Unidade</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sitePerformance} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" />
                  <YAxis dataKey="site" type="category" width={120} stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="os_concluidas" fill="#8b5cf6" name="OS Concluídas" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                <span>Tendência Mensal</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#ffffff', 
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="os_total" 
                    stackId="1" 
                    stroke="#6366f1" 
                    fill="#6366f1" 
                    fillOpacity={0.6}
                    name="OS Total"
                  />
                  <Area 
                    type="monotone" 
                    dataKey="os_concluidas" 
                    stackId="2" 
                    stroke="#10b981" 
                    fill="#10b981" 
                    fillOpacity={0.8}
                    name="OS Concluídas"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions and Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Alertas Críticos */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <span>Alertas e Notificações</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">SLA Crítico - Banheiro Administrativo</p>
                    <p className="text-xs text-red-600">Vencido há 2h 15min • OS #4521</p>
                  </div>
                  <Badge variant="destructive">Crítico</Badge>
                </div>
                
                <div className="flex items-center space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-900">Operador Ausente - Turno Noite</p>
                    <p className="text-xs text-yellow-600">Maria Santos não marcou presença • Site Produção</p>
                  </div>
                  <Badge className="bg-yellow-500 text-white">Atenção</Badge>
                </div>

                <div className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">Meta de Eficiência Atingida</p>
                    <p className="text-xs text-blue-600">Centro Logístico superou 95% • Parabéns!</p>
                  </div>
                  <Badge className="bg-blue-500 text-white">Sucesso</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full justify-start" variant="outline">
                <ClipboardList className="w-4 h-4 mr-2" />
                Nova OS
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Users className="w-4 h-4 mr-2" />
                Operadores
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <MapPin className="w-4 h-4 mr-2" />
                Planta da Unidade
              </Button>
              <Button className="w-full justify-start" variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}