import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useModule } from "@/contexts/ModuleContext";
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
  Area,
  AreaChart
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Users,
  Building,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Filter,
  RefreshCw
} from "lucide-react";

interface AdminDashboardsProps {
  companyId: string;
}

export default function AdminDashboards({ companyId }: AdminDashboardsProps) {
  const { currentModule } = useModule();
  const [timeFilter, setTimeFilter] = useState("7d");
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: analytics = {}, isLoading } = useQuery({
    queryKey: ["/api/companies", companyId, "analytics", timeFilter, "todos"],
    enabled: !!companyId,
  });

  const { data: workOrders = [] } = useQuery({
    queryKey: ["/api/companies", companyId, "work-orders", { module: currentModule }],
    enabled: !!companyId,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["/api/companies", companyId, "sites", { module: currentModule }],
    enabled: !!companyId,
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Invalidar todas as queries do dashboard para forçar atualização
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "work-orders"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "sites"] })
    ]);
    
    setRefreshing(false);
  };

  // Dados mockados para demonstração estilo Power BI
  const statusData = [
    { name: "Concluídas", value: 45, color: "#10b981" },
    { name: "Em Andamento", value: 23, color: "#f59e0b" },
    { name: "Abertas", value: 32, color: "#3b82f6" },
    { name: "Vencidas", value: 12, color: "#ef4444" }
  ];

  const monthlyData = [
    { month: "Jan", completed: 120, pending: 45, overdue: 8 },
    { month: "Fev", completed: 135, pending: 38, overdue: 12 },
    { month: "Mar", completed: 148, pending: 52, overdue: 6 },
    { month: "Abr", completed: 162, pending: 41, overdue: 9 },
    { month: "Mai", completed: 158, pending: 47, overdue: 15 },
    { month: "Jun", completed: 175, pending: 39, overdue: 7 }
  ];

  const performanceData = [
    { day: "Seg", efficiency: 85, target: 90 },
    { day: "Ter", efficiency: 92, target: 90 },
    { day: "Qua", efficiency: 88, target: 90 },
    { day: "Qui", efficiency: 94, target: 90 },
    { day: "Sex", efficiency: 87, target: 90 },
    { day: "Sáb", efficiency: 82, target: 90 },
    { day: "Dom", efficiency: 79, target: 90 }
  ];

  const siteData = (sites as any[]).map((site: any, index: number) => ({
    name: site.name,
    orders: Math.floor(Math.random() * 50) + 10,
    efficiency: Math.floor(Math.random() * 30) + 70,
    alerts: Math.floor(Math.random() * 5)
  }));

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-slate-200 rounded-lg"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 bg-slate-200 rounded-lg"></div>
            <div className="h-32 bg-slate-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 space-y-4 bg-background overflow-auto">
      {/* Header com Filtros */}
      <div className="space-y-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboards BI</h1>
          <p className="text-sm text-muted-foreground">Analytics avançado e monitoramento em tempo real</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-center sm:justify-start">
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 horas</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">3 meses</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleRefresh}
              disabled={refreshing}
              className={`flex-1 sm:flex-none transition-all duration-300 ${refreshing ? 'scale-95 bg-primary/5' : 'hover:scale-105'}`}
              data-testid="button-refresh-dashboard"
            >
              <RefreshCw className={`w-4 h-4 mr-2 transition-transform duration-500 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </Button>
            <Button size="sm" variant="outline" className="flex-1 sm:flex-none">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total OS</p>
                <p className="text-2xl font-bold mt-1">112</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span className="text-sm">+12% este mês</span>
                </div>
              </div>
              <Activity className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Concluídas</p>
                <p className="text-2xl font-bold mt-1">89</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="w-4 h-4 mr-1" />
                  <span className="text-sm">79.5% taxa</span>
                </div>
              </div>
              <CheckCircle className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-100 text-sm font-medium">Pendentes</p>
                <p className="text-2xl font-bold mt-1">23</p>
                <div className="flex items-center mt-2">
                  <Clock className="w-4 h-4 mr-1" />
                  <span className="text-sm">20.5% total</span>
                </div>
              </div>
              <Clock className="w-8 h-8 text-yellow-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-100 text-sm font-medium">Vencidas</p>
                <p className="text-2xl font-bold mt-1">7</p>
                <div className="flex items-center mt-2">
                  <TrendingDown className="w-4 h-4 mr-1" />
                  <span className="text-sm">-3 vs ontem</span>
                </div>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <PieChartIcon className="w-3 h-3" />
              Status das OS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex justify-center relative">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx={70}
                    cy={70}
                    innerRadius={35}
                    outerRadius={55}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {/* Centro do gráfico com valor total */}
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">
                    {statusData.reduce((acc, curr) => acc + curr.value, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total OS</div>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {statusData.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: item.color }}
                    ></div>
                    <span>{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{item.value}</span>
                    <span className="text-gray-500 ml-1">
                      {Math.round((item.value / statusData.reduce((acc, curr) => acc + curr.value, 0)) * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              Tendência Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="month" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Bar dataKey="completed" fill="#10b981" radius={4} />
                <Bar dataKey="pending" fill="#f59e0b" radius={4} />
                <Bar dataKey="overdue" fill="#ef4444" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Performance e Sites */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Performance Semanal */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              Performance Semanal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={120}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="day" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[70, 100]}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="efficiency"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  radius={4}
                />
                <Line
                  type="monotone"
                  dataKey="target"
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance por Local */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <Building className="w-3 h-3" />
              Performance por Local
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {siteData.slice(0, 4).map((site, index) => (
                <div key={index} className="flex items-center justify-between p-1.5 bg-slate-50 rounded">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-slate-900 truncate">{site.name}</p>
                    <p className="text-xs text-slate-600">{site.orders} OS</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-semibold text-slate-900">{site.efficiency}%</p>
                    <div 
                      className={`w-1.5 h-6 rounded-full ${
                        site.efficiency >= 90 ? 'bg-green-500' :
                        site.efficiency >= 80 ? 'bg-yellow-500' :
                        'bg-red-500'
                      }`}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertas e Insights */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Alertas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            <div className="p-2 bg-yellow-50 border-l-2 border-yellow-400 rounded-r">
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-yellow-600" />
                <div>
                  <p className="text-xs font-semibold text-yellow-800">SLA em Risco</p>
                  <p className="text-xs text-yellow-700">3 OS podem vencer hoje</p>
                </div>
              </div>
            </div>
            
            <div className="p-2 bg-green-50 border-l-2 border-green-400 rounded-r">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-green-600" />
                <div>
                  <p className="text-xs font-semibold text-green-800">Performance Alta</p>
                  <p className="text-xs text-green-700">12% acima da meta</p>
                </div>
              </div>
            </div>
            
            <div className="p-2 bg-blue-50 border-l-2 border-blue-400 rounded-r">
              <div className="flex items-center gap-1">
                <Users className="w-3 h-3 text-blue-600" />
                <div>
                  <p className="text-xs font-semibold text-blue-800">Equipe Ativa</p>
                  <p className="text-xs text-blue-700">8 operadores em campo</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}