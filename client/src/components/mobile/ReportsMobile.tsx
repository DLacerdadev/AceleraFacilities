import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, TrendingUp, Clock, Target, Users, Download, RefreshCw } from "lucide-react";

interface ReportsMobileProps {
  customerId: string;
}

export default function ReportsMobile({ customerId }: ReportsMobileProps) {
  const [period, setPeriod] = useState("mes");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { data: metrics, isLoading, refetch } = useQuery({
    queryKey: ["/api/customers", customerId, "reports/metrics"],
    enabled: !!customerId,
  });

  const handleRefresh = () => {
    refetch();
    setLastUpdate(new Date());
  };

  const reportMetrics = [
    { 
      title: "Taxa de Conclusão", 
      value: `${(metrics as any)?.completionRate || 0}%`, 
      icon: Target,
      color: "text-green-600",
      bg: "bg-green-50",
      trend: "+5%"
    },
    { 
      title: "Tempo Médio", 
      value: `${(metrics as any)?.avgTime || 0}h`, 
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
      trend: "-2h"
    },
    { 
      title: "Conformidade SLA", 
      value: `${(metrics as any)?.slaCompliance || 0}%`, 
      icon: TrendingUp,
      color: "text-purple-600",
      bg: "bg-purple-50",
      trend: "+8%"
    },
    { 
      title: "Operadores Ativos", 
      value: (metrics as any)?.activeOperators || 0, 
      icon: Users,
      color: "text-orange-600",
      bg: "bg-orange-50",
      trend: "+2"
    },
  ];

  const reportTypes = [
    { title: "Ordens de Serviço", description: "Análise de OS por status, prioridade e tipo", icon: BarChart3, color: "text-blue-600" },
    { title: "Performance SLA", description: "Conformidade e tempo de resposta", icon: Target, color: "text-green-600" },
    { title: "Produtividade", description: "Análise de tempo e eficiência", icon: TrendingUp, color: "text-purple-600" },
    { title: "Operadores", description: "Desempenho por operador", icon: Users, color: "text-orange-600" },
  ];

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b p-4 space-y-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Relatórios</h2>
            <p className="text-sm text-gray-600" data-testid="text-last-update-reports">
              Atualizado: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} data-testid="button-refresh-reports">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Filtro de Período */}
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full" data-testid="select-period-filter">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje" data-testid="select-item-period-hoje">Hoje</SelectItem>
            <SelectItem value="semana" data-testid="select-item-period-semana">Esta Semana</SelectItem>
            <SelectItem value="mes" data-testid="select-item-period-mes">Este Mês</SelectItem>
            <SelectItem value="ano" data-testid="select-item-period-ano">Este Ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Métricas */}
      <div className="p-4 grid grid-cols-2 gap-3">
        {reportMetrics.map((metric) => (
          <Card key={metric.title} className="border-0 shadow-sm" data-testid={`card-metric-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div className={`w-10 h-10 ${metric.bg} rounded-lg flex items-center justify-center`}>
                  <metric.icon className={`w-5 h-5 ${metric.color}`} />
                </div>
                <span className="text-xs font-semibold text-green-600" data-testid={`text-trend-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {metric.trend}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900" data-testid={`text-value-${metric.title.toLowerCase().replace(/\s+/g, '-')}`}>
                {metric.value}
              </p>
              <p className="text-xs text-gray-600 mt-1">{metric.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tipos de Relatórios */}
      <div className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Relatórios Disponíveis</h3>
        
        {reportTypes.map((report) => (
          <Card key={report.title} className="hover:shadow-md transition-shadow" data-testid={`card-report-${report.title.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl flex items-center justify-center shrink-0">
                    <report.icon className={`w-6 h-6 ${report.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900" data-testid={`text-report-title-${report.title.toLowerCase().replace(/\s+/g, '-')}`}>
                      {report.title}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="shrink-0" data-testid={`button-download-${report.title.toLowerCase().replace(/\s+/g, '-')}`} disabled>
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Export Section */}
      <div className="p-4">
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <p className="font-semibold mb-1">Exportar Relatórios</p>
                <p className="text-sm text-white/80">Baixe relatórios completos em PDF ou Excel</p>
              </div>
              <Button size="sm" className="bg-white text-blue-600 hover:bg-gray-100" data-testid="button-export-all" disabled>
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
