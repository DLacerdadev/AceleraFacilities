import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { ModernCard } from "@/components/ui/modern-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useClient } from "@/contexts/ClientContext";
import { useModule } from "@/contexts/ModuleContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useModuleTheme } from "@/hooks/use-module-theme";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { 
  Download, 
  FileText, 
  TrendingUp, 
  Clock, 
  Target,
  Users,
  MapPin,
  Calendar,
  BarChart3,
  PieChart,
  AlertCircle,
  FileSpreadsheet,
  Download as DownloadIcon,
  RefreshCw,
  Activity,
  Timer,
  CheckCircle2,
  Building2,
  Zap,
  Wrench,
  Package,
  Truck
} from "lucide-react";

// Types for report data
interface MetricsData {
  completedWorkOrders?: number;
  completedWorkOrdersChange?: string;
  averageSLA?: number;
  averageSLAChange?: string;
  totalAreaCleaned?: number;
  totalAreaCleanedChange?: string;
  averageExecutionTime?: number;
  averageExecutionTimeChange?: string;
  period?: string;
}

interface WorkOrderStatusData {
  status: string;
  label: string;
  count: number;
  color: string;
}

interface SLAPerformanceData {
  totalSLA?: number;
  categories?: {
    category: string;
    label: string;
    percentage: number;
  }[];
}

export default function Reports() {
  const { activeClientId } = useClient();
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const [dateRange, setDateRange] = useState("30");
  const [selectedReportType, setSelectedReportType] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([new Date().getMonth() + 1]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // API Queries with proper array-based keys
  const { data: reportsMetrics, isLoading: isLoadingMetrics, error: errorMetrics, refetch: refetchMetrics } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "metrics", { period: dateRange, module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/metrics?period=${dateRange}&module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId,
  });

  const { data: workOrdersStatus, isLoading: isLoadingStatus, error: errorStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "work-orders-status", { period: dateRange, module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/work-orders-status?period=${dateRange}&module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId,
  });

  const { data: slaPerformance, isLoading: isLoadingSLA, error: errorSLA, refetch: refetchSLA } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "sla-performance", { period: dateRange, module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/sla-performance?period=${dateRange}&module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId,
  });

  // NOVAS QUERIES ESPECÍFICAS PARA CADA TIPO DE RELATÓRIO
  const { data: generalReport, isLoading: isLoadingGeneral, refetch: refetchGeneral } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "general", { period: dateRange, module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/general?period=${dateRange}&module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId,
  });

  const { data: slaAnalysis, isLoading: isLoadingSLAAnalysis, refetch: refetchSLAAnalysis } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "sla-analysis", { period: dateRange, module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/sla-analysis?period=${dateRange}&module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId,
  });

  const { data: productivityReport, isLoading: isLoadingProductivity, refetch: refetchProductivity } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "productivity", { period: dateRange, module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/productivity?period=${dateRange}&module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId,
  });

  const { data: operatorPerformance, isLoading: isLoadingOperators, refetch: refetchOperators } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "operators", { period: dateRange, module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/operators?period=${dateRange}&module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId,
  });

  const { data: locationAnalysis, isLoading: isLoadingLocations, refetch: refetchLocations } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "locations", { period: dateRange, module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/locations?period=${dateRange}&module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId,
  });

  const { data: temporalAnalysis, isLoading: isLoadingTemporal, refetch: refetchTemporal } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "temporal", { period: dateRange, module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/temporal?period=${dateRange}&module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId,
  });

  const { data: assetReport, isLoading: isLoadingAssets, refetch: refetchAssets } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "assets", { module: currentModule }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/assets?module=${currentModule}`).then(res => res.json()),
    enabled: !!activeClientId && currentModule === 'maintenance', // Only for maintenance module
  });

  // Monthly Cost Report Query - fetches data for all selected months
  const { data: monthlyCostReport, isLoading: isLoadingMonthlyCost, refetch: refetchMonthlyCost } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "monthly-cost", { year: selectedYear, months: selectedMonths }],
    queryFn: async () => {
      // Fetch data for all selected months and aggregate
      const results = await Promise.all(
        selectedMonths.map(month => 
          fetch(`/api/customers/${activeClientId}/reports/monthly-cost?year=${selectedYear}&month=${month}`).then(res => res.json())
        )
      );
      
      // Aggregate results from multiple months
      if (results.length === 1) return results[0];
      
      const aggregated: any = {
        summary: {
          totalLaborCost: 0,
          totalPartsCost: 0,
          totalExternalCost: 0,
          totalCost: 0,
          workOrderCount: 0,
          averageCostPerOrder: 0
        },
        workOrders: [],
        partsUsage: []
      };
      
      const partsMap = new Map();
      
      results.forEach(result => {
        if (result.summary) {
          aggregated.summary.totalLaborCost += result.summary.totalLaborCost || 0;
          aggregated.summary.totalPartsCost += result.summary.totalPartsCost || 0;
          aggregated.summary.totalExternalCost += result.summary.totalExternalCost || 0;
          aggregated.summary.totalCost += result.summary.totalCost || 0;
          aggregated.summary.workOrderCount += result.summary.workOrderCount || 0;
        }
        if (result.workOrders) {
          aggregated.workOrders.push(...result.workOrders);
        }
        if (result.partsUsage) {
          result.partsUsage.forEach((part: any) => {
            if (partsMap.has(part.partId)) {
              const existing = partsMap.get(part.partId);
              existing.totalQuantity += part.totalQuantity || 0;
              existing.totalCost += part.totalCost || 0;
            } else {
              partsMap.set(part.partId, { ...part });
            }
          });
        }
      });
      
      aggregated.partsUsage = Array.from(partsMap.values());
      aggregated.summary.averageCostPerOrder = aggregated.summary.workOrderCount > 0 
        ? aggregated.summary.totalCost / aggregated.summary.workOrderCount 
        : 0;
      
      return aggregated;
    },
    enabled: !!activeClientId && currentModule === 'maintenance' && selectedMonths.length > 0,
  });

  // Replenishment Orders Report Query (Pedidos de Reabastecimento)
  const { data: replenishmentReport, isLoading: isLoadingReplenishment, refetch: refetchReplenishment } = useQuery({
    queryKey: ["/api/customers", activeClientId, "reports", "replenishment", { period: dateRange }],
    queryFn: () => fetch(`/api/customers/${activeClientId}/reports/replenishment?period=${dateRange}`).then(res => res.json()),
    enabled: !!activeClientId && currentModule === 'maintenance',
  });

  // Helper function to safely access nested properties
  const safeGet = (obj: any, key: string, defaultValue: any = 0) => {
    return obj && typeof obj === 'object' && key in obj ? obj[key] : defaultValue;
  };

  // Refresh all data
  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      const refetchPromises = [
        refetchMetrics(),
        refetchStatus(),
        refetchSLA(),
        refetchGeneral(),
        refetchSLAAnalysis(),
        refetchProductivity(),
        refetchOperators(),
        refetchLocations(),
        refetchTemporal()
      ];
      
      // Only refetch assets, monthly cost, and replenishment for maintenance module
      if (currentModule === 'maintenance') {
        refetchPromises.push(refetchAssets());
        refetchPromises.push(refetchMonthlyCost());
        refetchPromises.push(refetchReplenishment());
      }
      
      await Promise.all(refetchPromises);
      toast({
        title: "✅ Dados atualizados!",
        description: "Todas as informações foram atualizadas com sucesso.",
      });
    } catch (error) {
      toast({
        title: "❌ Erro ao atualizar",
        description: "Não foi possível atualizar os dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Generate and download report
  const generateReport = async (reportType: string, format: 'pdf' | 'csv' | 'excel') => {
    setIsGenerating(`${reportType}-${format}`);
    
    try {
      // Get the appropriate data based on report type
      let reportData: any = {};
      let filename = `relatorio-${reportType}-${dateRange}dias`;

      // Module-specific suffix for report titles
      const moduleSuffix = currentModule === 'clean' ? 'Limpeza' : 'Manutenção';

      switch (reportType) {
        case 'geral':
          reportData = {
            metrics: reportsMetrics || {},
            workOrders: workOrdersStatus || [],
            slaData: slaPerformance || {},
            generalData: generalReport || {},
            period: `${dateRange} dias`,
            generatedAt: new Date().toISOString(),
            reportType: `Relatório Geral - ${moduleSuffix}`,
            module: currentModule
          };
          break;
        case 'sla':
          reportData = {
            slaData: slaPerformance || {},
            slaAnalysisData: slaAnalysis || {},
            period: `${dateRange} dias`,
            generatedAt: new Date().toISOString(),
            reportType: `Relatório de SLA - ${moduleSuffix}`,
            module: currentModule
          };
          break;
        case 'produtividade':
          reportData = {
            ...(productivityReport || {}),
            period: `${dateRange} dias`,
            generatedAt: new Date().toISOString(),
            reportType: `Relatório de Produtividade - ${moduleSuffix}`,
            module: currentModule
          };
          break;
        case 'operadores':
          reportData = {
            ...(operatorPerformance || {}),
            period: `${dateRange} dias`,
            generatedAt: new Date().toISOString(),
            reportType: `Relatório de Operadores - ${moduleSuffix}`,
            module: currentModule
          };
          break;
        case 'locais':
          reportData = {
            ...(locationAnalysis || {}),
            period: `${dateRange} dias`,
            generatedAt: new Date().toISOString(),
            reportType: `Relatório por Locais - ${moduleSuffix}`,
            module: currentModule
          };
          break;
        case 'temporal':
          reportData = {
            ...(temporalAnalysis || {}),
            period: `${dateRange} dias`,
            generatedAt: new Date().toISOString(),
            reportType: `Relatório Temporal - ${moduleSuffix}`,
            module: currentModule
          };
          break;
        case 'patrimonio':
          reportData = {
            ...(assetReport || {}),
            period: 'Atual',
            generatedAt: new Date().toISOString(),
            reportType: `Relatório de Patrimônio - ${moduleSuffix}`,
            module: currentModule
          };
          break;
        case 'custos-mensais':
          const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                              'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
          const selectedMonthNames = selectedMonths.sort((a, b) => a - b).map(m => monthNames[m - 1]);
          const periodText = selectedMonths.length === 1 
            ? `${selectedMonthNames[0]} ${selectedYear}` 
            : `${selectedMonthNames.join(', ')} ${selectedYear}`;
          reportData = {
            ...(monthlyCostReport || {}),
            period: periodText,
            generatedAt: new Date().toISOString(),
            reportType: `Relatório de Custos Mensais - ${moduleSuffix}`,
            module: currentModule,
            year: selectedYear,
            months: selectedMonths
          };
          const monthsStr = selectedMonths.sort((a, b) => a - b).map(m => String(m).padStart(2, '0')).join('-');
          filename = `relatorio-custos-${selectedYear}-${monthsStr}`;
          break;
        case 'reabastecimento':
          reportData = {
            ...(replenishmentReport || {}),
            period: `${dateRange} dias`,
            generatedAt: new Date().toISOString(),
            reportType: `Relatório de Pedidos de Reabastecimento - ${moduleSuffix}`,
            module: currentModule
          };
          filename = `relatorio-reabastecimento-${dateRange}dias`;
          break;
      }

      if (format === 'csv') {
        generateCSV(reportData, filename);
      } else if (format === 'excel') {
        generateExcel(reportData, filename);
      } else {
        generatePDF(reportData, filename);
      }

      toast({
        title: "✅ Relatório gerado com sucesso!",
        description: `${reportType.charAt(0).toUpperCase() + reportType.slice(1)} em formato ${format.toUpperCase()} baixado.`,
      });

    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast({
        title: "❌ Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(null);
    }
  };

  // Generate CSV content and download
  const generateCSV = (data: any, filename: string) => {
    let csv = `Relatório,${data.reportType}\n`;
    csv += `Período,${data.period}\n`;
    csv += `Gerado em,${new Date(data.generatedAt).toLocaleString('pt-BR')}\n\n`;

    // Relatório de Produtividade
    if (data.productivity) {
      csv += "MÉTRICAS DE PRODUTIVIDADE\n";
      csv += `Métrica,Valor\n`;
      csv += `OS por Dia,${safeGet(data.productivity, 'workOrdersPerDay', 0)}\n`;
      csv += `Tempo Médio de Conclusão (min),${safeGet(data.productivity, 'averageCompletionTime', 0)}\n`;
      csv += `Área Limpa por Hora (m²/h),${safeGet(data.productivity, 'areaCleanedPerHour', 0)}\n`;
      csv += `Tarefas por Operador,${safeGet(data.productivity, 'tasksPerOperator', 0)}\n`;
      csv += `Score de Qualidade (%),${safeGet(data.productivity, 'qualityScore', 0)}\n\n`;
      
      csv += "MÉTRICAS DE EFICIÊNCIA\n";
      csv += `Métrica,Valor\n`;
      csv += `Utilização de Recursos (%),${safeGet(data.efficiency, 'resourceUtilization', 0)}\n`;
      csv += `Uptime de Equipamentos (%),${safeGet(data.efficiency, 'equipmentUptime', 0)}\n`;
      csv += `Desperdício de Material (%),${safeGet(data.efficiency, 'materialWaste', 0)}\n`;
      csv += `Consumo de Energia (kWh),${safeGet(data.efficiency, 'energyConsumption', 0)}\n`;
      csv += `Eficiência de Custo (%),${safeGet(data.efficiency, 'costEfficiency', 0)}\n\n`;
      
      if (data.trends && Array.isArray(data.trends)) {
        csv += "TENDÊNCIAS MENSAIS\n";
        csv += "Mês,Produtividade (%),Eficiência (%)\n";
        data.trends.forEach((trend: any) => {
          csv += `${trend.month},${trend.productivity},${trend.efficiency}\n`;
        });
      }
    }

    // Relatório de Operadores
    if (data.operators) {
      if (data.operators.topPerformers && Array.isArray(data.operators.topPerformers)) {
        csv += "TOP PERFORMERS\n";
        csv += "Operador,Rank,Pontuação,Melhoria\n";
        data.operators.topPerformers.forEach((performer: any) => {
          csv += `${performer.name},${performer.rank},${performer.score},${performer.improvement}\n`;
        });
        csv += "\n";
      }
      
      if (data.operators.operators && Array.isArray(data.operators.operators)) {
        csv += "OPERADORES INDIVIDUAIS\n";
        csv += "Nome,Tarefas,Eficiência (%),Qualidade,Pontualidade (%),Experiência,Certificação\n";
        data.operators.operators.slice(0, 10).forEach((op: any) => {
          csv += `${op.name},${op.tasksCompleted},${op.efficiency},${op.qualityScore},${op.punctuality},${op.experienceLevel},${op.certification}\n`;
        });
      }
    }

    // Relatório de Locais
    if (data.locations) {
      if (data.locations.sites && Array.isArray(data.locations.sites)) {
        csv += "SITES\n";
        csv += "Nome,Zonas,OS Total,Concluídas,Eficiência (%),Área (m²),Utilização (%)\n";
        data.locations.sites.forEach((site: any) => {
          csv += `${site.name},${site.totalZones},${site.totalWorkOrders},${site.completedWorkOrders},${site.efficiency},${site.area},${site.utilizationRate}\n`;
        });
        csv += "\n";
      }
      
      if (data.locations.zones && Array.isArray(data.locations.zones)) {
        csv += "ZONAS\n";
        csv += "Nome,Site,OS Total,Concluídas,Tempo Médio (min),Prioridade,Última Limpeza\n";
        data.locations.zones.forEach((zone: any) => {
          csv += `${zone.name},${zone.siteName},${zone.totalWorkOrders},${zone.completedWorkOrders},${zone.averageTime},${zone.priority},${zone.lastCleaning}\n`;
        });
      }
    }

    // Relatório Temporal
    if (data.temporal) {
      if (data.temporal.historicalTrends && Array.isArray(data.temporal.historicalTrends)) {
        csv += "TENDÊNCIAS HISTÓRICAS\n";
        csv += "Período,OS Concluídas,SLA (%),Eficiência (%)\n";
        data.temporal.historicalTrends.forEach((trend: any) => {
          csv += `${trend.period},${trend.workOrders},${trend.sla},${trend.efficiency}\n`;
        });
      }
    }

    // Relatório de Custos Mensais
    if (data.summary && data.equipmentCosts) {
      csv += "RESUMO GERAL\n";
      csv += `Total de Manutenções,${data.summary.totalMaintenances || 0}\n`;
      csv += `Equipamentos Mantidos,${data.summary.uniqueEquipment || 0}\n`;
      csv += `Total de Peças Utilizadas,${data.summary.totalPartsUsed || 0}\n`;
      csv += `Custo Total,"R$ ${(data.summary.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"\n\n`;

      csv += "CUSTOS POR EQUIPAMENTO\n";
      csv += "Equipamento,Manutenções,Peças Utilizadas,Custo Total\n";
      if (Array.isArray(data.equipmentCosts)) {
        data.equipmentCosts.forEach((eq: any) => {
          const costFormatted = `R$ ${(eq.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          csv += `"${eq.equipmentName}",${eq.maintenanceCount},${eq.partsCount},"${costFormatted}"\n`;
        });
      }
      csv += "\n";

      csv += "PEÇAS UTILIZADAS\n";
      csv += "Código,Nome da Peça,Quantidade,Custo Unitário,Custo Total\n";
      if (Array.isArray(data.partsUsage)) {
        data.partsUsage.forEach((part: any) => {
          const unitCostFormatted = `R$ ${(part.unitCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          const totalCostFormatted = `R$ ${(part.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          csv += `"${part.partCode || '-'}","${part.partName}",${part.totalQuantity},"${unitCostFormatted}","${totalCostFormatted}"\n`;
        });
      }
      csv += "\n";

      csv += "DETALHES POR MANUTENÇÃO\n";
      csv += "Equipamento,OS,Data Conclusão,Peça,Quantidade,Custo Unitário,Custo Total\n";
      if (Array.isArray(data.equipmentCosts)) {
        data.equipmentCosts.forEach((eq: any) => {
          if (Array.isArray(eq.workOrders)) {
            eq.workOrders.forEach((wo: any) => {
              const completedDate = wo.completedAt ? new Date(wo.completedAt).toLocaleDateString('pt-BR') : '-';
              if (Array.isArray(wo.parts)) {
                wo.parts.forEach((part: any) => {
                  const unitCostFormatted = `R$ ${(part.unitCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const totalCostFormatted = `R$ ${(part.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  csv += `"${eq.equipmentName}","${wo.workOrderNumber}","${completedDate}","${part.partName}",${part.quantity},"${unitCostFormatted}","${totalCostFormatted}"\n`;
                });
              }
            });
          }
        });
      }
    }

    // Relatório de Patrimônio - Formato Hierárquico
    if (data.summary && data.sites) {
      csv += `Cliente: ${data.customer?.name || 'Não identificado'}\n`;
      csv += `Total Geral: R$ ${data.summary.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}\n`;
      csv += `${data.summary.totalEquipment || 0} equipamentos | ${data.summary.siteCount || 0} locais | ${data.summary.zoneCount || 0} zonas\n\n`;

      // Hierarquia: Locais → Zonas → Equipamentos
      if (Array.isArray(data.sites)) {
        csv += "PATRIMÔNIO HIERÁRQUICO\n\n";
        
        data.sites.forEach((site: any, siteIndex: number) => {
          const siteTotalFormatted = `R$ ${site.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
          csv += `${siteIndex + 1}. Local: ${site.siteName} — Total: ${siteTotalFormatted}\n`;
          
          if (Array.isArray(site.zones)) {
            site.zones.forEach((zone: any) => {
              const zoneTotalFormatted = `R$ ${zone.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
              csv += `  • Zona: ${zone.zoneName} — Total: ${zoneTotalFormatted}\n`;
              
              if (Array.isArray(zone.equipment)) {
                zone.equipment.forEach((equip: any) => {
                  const unitValueFormatted = `R$ ${equip.unitValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
                  const totalValueFormatted = `R$ ${equip.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
                  const quantity = equip.quantity || '—';
                  csv += `    ◦ ${equip.name} — Valor Unit.: ${unitValueFormatted} — Qtde: ${quantity} — Total: ${totalValueFormatted}\n`;
                });
              }
            });
          }
          csv += "\n";
        });
      }
    }

    // Relatório de Reabastecimento
    if (data.orders && Array.isArray(data.orders)) {
      csv += `RESUMO DE PEDIDOS DE REABASTECIMENTO\n`;
      csv += `Total de Pedidos,${data.summary?.totalOrders || 0}\n`;
      csv += `Pedidos Recebidos,${data.summary?.receivedOrders || 0}\n`;
      csv += `Pedidos Pendentes,${data.summary?.pendingOrders || 0}\n`;
      csv += `Valor Total,"R$ ${(data.summary?.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}"\n\n`;

      csv += `LISTA DE PEDIDOS\n`;
      csv += `ID,Fornecedor,Status,Data Criação,Data Envio,Data Recebimento,Valor Total\n`;
      data.orders.forEach((order: any) => {
        const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : '-';
        const shippedAt = order.shippedAt ? new Date(order.shippedAt).toLocaleDateString('pt-BR') : '-';
        const receivedAt = order.receivedAt ? new Date(order.receivedAt).toLocaleDateString('pt-BR') : '-';
        const statusLabel = order.status === 'pendente' ? 'Pendente' : 
                            order.status === 'confirmado' ? 'Confirmado' :
                            order.status === 'enviado' ? 'Enviado' :
                            order.status === 'recebido' ? 'Recebido' : order.status;
        const totalValue = `R$ ${(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        csv += `"${order.id}","${order.supplierName || '-'}","${statusLabel}","${createdAt}","${shippedAt}","${receivedAt}","${totalValue}"\n`;
      });
      csv += "\n";

      csv += `ITENS DOS PEDIDOS\n`;
      csv += `ID Pedido,Peça,Quantidade Solicitada,Quantidade Recebida,Custo Unitário,Custo Total\n`;
      data.orders.forEach((order: any) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            const unitCost = `R$ ${(item.unitCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const totalCost = `R$ ${(item.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            csv += `"${order.id}","${item.partName}",${item.quantityRequested},${item.quantityReceived || '-'},"${unitCost}","${totalCost}"\n`;
          });
        }
      });
    }

    // Dados gerais (para relatórios que ainda usam o formato antigo)
    if (data.metrics) {
      csv += "MÉTRICAS GERAIS\n";
      csv += `Métrica,Valor\n`;
      csv += `OS Concluídas,${safeGet(data.metrics, 'completedWorkOrders', 0)}\n`;
      csv += `SLA Médio,${safeGet(data.metrics, 'averageSLA', 0)}%\n`;
      csv += `Área Limpa (m²),${safeGet(data.metrics, 'totalAreaCleaned', 0)}\n`;
      csv += `Tempo Médio (min),${safeGet(data.metrics, 'averageExecutionTime', 0)}\n\n`;
    }

    if (data.workOrders && Array.isArray(data.workOrders)) {
      csv += "ORDENS DE SERVIÇO POR STATUS\n";
      csv += "Status,Quantidade\n";
      data.workOrders.forEach((wo: WorkOrderStatusData) => {
        csv += `${wo.label || wo.status},${wo.count}\n`;
      });
      csv += "\n";
    }

    if (data.slaData && safeGet(data.slaData, 'categories', null)) {
      csv += "PERFORMANCE SLA\n";
      csv += "Categoria,Percentual\n";
      safeGet(data.slaData, 'categories', []).forEach((cat: any) => {
        csv += `${cat.label},${cat.percentage}%\n`;
      });
    }

    downloadFile(csv, `${filename}.csv`, 'text/csv');
  };

  // Generate real Excel file and download
  const generateExcel = (data: any, filename: string) => {
    const workbook = XLSX.utils.book_new();

    // Create summary sheet with module-specific title
    const moduleTitle = currentModule === 'clean' ? 'LIMPEZA' : 'MANUTENÇÃO';
    const summaryData: any[][] = [
      [`GRUPO OPUS - RELATÓRIO DE ${moduleTitle}`],
      [''],
      ['Tipo', data.reportType],
      ['Período', data.period],
      ['Gerado em', new Date(data.generatedAt).toLocaleString('pt-BR')],
      ['']
    ];

    // Relatório de Produtividade
    if (data.productivity) {
      summaryData.push(['MÉTRICAS DE PRODUTIVIDADE']);
      summaryData.push(['']);
      summaryData.push(['Métrica', 'Valor']);
      summaryData.push(['OS por Dia', safeGet(data.productivity, 'workOrdersPerDay', 0)]);
      summaryData.push(['Tempo Médio de Conclusão (min)', safeGet(data.productivity, 'averageCompletionTime', 0)]);
      summaryData.push(['Área Limpa por Hora (m²/h)', safeGet(data.productivity, 'areaCleanedPerHour', 0)]);
      summaryData.push(['Tarefas por Operador', safeGet(data.productivity, 'tasksPerOperator', 0)]);
      summaryData.push(['Score de Qualidade (%)', safeGet(data.productivity, 'qualityScore', 0)]);
      summaryData.push(['']);
      summaryData.push(['MÉTRICAS DE EFICIÊNCIA']);
      summaryData.push(['']);
      summaryData.push(['Métrica', 'Valor']);
      summaryData.push(['Utilização de Recursos (%)', safeGet(data.efficiency, 'resourceUtilization', 0)]);
      summaryData.push(['Uptime de Equipamentos (%)', safeGet(data.efficiency, 'equipmentUptime', 0)]);
      summaryData.push(['Desperdício de Material (%)', safeGet(data.efficiency, 'materialWaste', 0)]);
      summaryData.push(['Consumo de Energia (kWh)', safeGet(data.efficiency, 'energyConsumption', 0)]);
      summaryData.push(['Eficiência de Custo (%)', safeGet(data.efficiency, 'costEfficiency', 0)]);
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
      
      // Tendências mensais
      if (data.trends && Array.isArray(data.trends)) {
        const trendsData: any[][] = [
          ['TENDÊNCIAS MENSAIS'],
          [''],
          ['Mês', 'Produtividade (%)', 'Eficiência (%)']
        ];
        data.trends.forEach((trend: any) => {
          trendsData.push([trend.month, trend.productivity, trend.efficiency]);
        });
        const trendsSheet = XLSX.utils.aoa_to_sheet(trendsData);
        XLSX.utils.book_append_sheet(workbook, trendsSheet, "Tendências Mensais");
      }
    }
    // Relatório de Operadores
    else if (data.operators) {
      if (data.operators.topPerformers && Array.isArray(data.operators.topPerformers)) {
        const topPerformersData: any[][] = [
          ['TOP PERFORMERS'],
          [''],
          ['Operador', 'Rank', 'Pontuação', 'Melhoria']
        ];
        data.operators.topPerformers.forEach((performer: any) => {
          topPerformersData.push([performer.name, performer.rank, performer.score, performer.improvement]);
        });
        const topPerformersSheet = XLSX.utils.aoa_to_sheet(topPerformersData);
        XLSX.utils.book_append_sheet(workbook, topPerformersSheet, "Top Performers");
      }
      
      if (data.operators.operators && Array.isArray(data.operators.operators)) {
        const operatorsData: any[][] = [
          ['OPERADORES INDIVIDUAIS'],
          [''],
          ['Nome', 'Tarefas', 'Eficiência (%)', 'Qualidade', 'Pontualidade (%)', 'Experiência', 'Certificação']
        ];
        data.operators.operators.forEach((op: any) => {
          operatorsData.push([op.name, op.tasksCompleted, op.efficiency, op.qualityScore, op.punctuality, op.experienceLevel, op.certification]);
        });
        const operatorsSheet = XLSX.utils.aoa_to_sheet(operatorsData);
        XLSX.utils.book_append_sheet(workbook, operatorsSheet, "Operadores");
      }
      
      const summarySheet = XLSX.utils.aoa_to_sheet([['Relatório de Operadores']]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
    }
    // Relatório de Locais
    else if (data.locations) {
      if (data.locations.sites && Array.isArray(data.locations.sites)) {
        const sitesData: any[][] = [
          ['LOCAIS'],
          [''],
          ['Nome', 'Zonas', 'OS Total', 'Concluídas', 'Eficiência (%)', 'Área (m²)', 'Utilização (%)']
        ];
        data.locations.sites.forEach((site: any) => {
          sitesData.push([site.name, site.totalZones, site.totalWorkOrders, site.completedWorkOrders, site.efficiency, site.area, site.utilizationRate]);
        });
        const sitesSheet = XLSX.utils.aoa_to_sheet(sitesData);
        XLSX.utils.book_append_sheet(workbook, sitesSheet, "Locais");
      }
      
      if (data.locations.zones && Array.isArray(data.locations.zones)) {
        const zonesData: any[][] = [
          ['ZONAS'],
          [''],
          ['Nome', 'Local', 'OS Total', 'Concluídas', 'Tempo Médio (min)', 'Prioridade', 'Última Limpeza']
        ];
        data.locations.zones.forEach((zone: any) => {
          zonesData.push([zone.name, zone.siteName, zone.totalWorkOrders, zone.completedWorkOrders, zone.averageTime, zone.priority, zone.lastCleaning]);
        });
        const zonesSheet = XLSX.utils.aoa_to_sheet(zonesData);
        XLSX.utils.book_append_sheet(workbook, zonesSheet, "Zonas");
      }
      
      const summarySheet = XLSX.utils.aoa_to_sheet([['Relatório por Locais']]);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");
    }
    // Relatório de Custos Mensais
    else if (data.summary && data.equipmentCosts) {
      const summaryData: any[][] = [
        [`GRUPO OPUS - RELATÓRIO DE CUSTOS MENSAIS`],
        [''],
        ['Período', data.period || ''],
        [''],
        ['RESUMO GERAL'],
        ['Total de Manutenções', data.summary.totalMaintenances || 0],
        ['Equipamentos Mantidos', data.summary.uniqueEquipment || 0],
        ['Total de Peças Utilizadas', data.summary.totalPartsUsed || 0],
        ['Custo Total', `R$ ${(data.summary.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

      // Equipment costs sheet
      const equipmentData: any[][] = [
        ['CUSTOS POR EQUIPAMENTO'],
        [''],
        ['Equipamento', 'Manutenções', 'Peças Utilizadas', 'Custo Total']
      ];
      if (Array.isArray(data.equipmentCosts)) {
        data.equipmentCosts.forEach((eq: any) => {
          equipmentData.push([
            eq.equipmentName,
            eq.maintenanceCount,
            eq.partsCount,
            `R$ ${(eq.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          ]);
        });
      }
      const equipmentSheet = XLSX.utils.aoa_to_sheet(equipmentData);
      XLSX.utils.book_append_sheet(workbook, equipmentSheet, "Custos por Equipamento");

      // Parts usage sheet
      const partsData: any[][] = [
        ['PEÇAS UTILIZADAS'],
        [''],
        ['Código', 'Nome da Peça', 'Quantidade', 'Custo Unitário', 'Custo Total']
      ];
      if (Array.isArray(data.partsUsage)) {
        data.partsUsage.forEach((part: any) => {
          partsData.push([
            part.partCode || '-',
            part.partName,
            part.totalQuantity,
            `R$ ${(part.unitCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            `R$ ${(part.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          ]);
        });
      }
      const partsSheet = XLSX.utils.aoa_to_sheet(partsData);
      XLSX.utils.book_append_sheet(workbook, partsSheet, "Peças Utilizadas");

      // Detailed breakdown sheet
      const detailsData: any[][] = [
        ['DETALHES POR MANUTENÇÃO'],
        [''],
        ['Equipamento', 'OS', 'Data Conclusão', 'Peça', 'Quantidade', 'Custo Unitário', 'Custo Total']
      ];
      if (Array.isArray(data.equipmentCosts)) {
        data.equipmentCosts.forEach((eq: any) => {
          if (Array.isArray(eq.workOrders)) {
            eq.workOrders.forEach((wo: any) => {
              const completedDate = wo.completedAt ? new Date(wo.completedAt).toLocaleDateString('pt-BR') : '-';
              if (Array.isArray(wo.parts)) {
                wo.parts.forEach((part: any) => {
                  detailsData.push([
                    eq.equipmentName,
                    wo.workOrderNumber,
                    completedDate,
                    part.partName,
                    part.quantity,
                    `R$ ${(part.unitCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    `R$ ${(part.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  ]);
                });
              }
            });
          }
        });
      }
      const detailsSheet = XLSX.utils.aoa_to_sheet(detailsData);
      XLSX.utils.book_append_sheet(workbook, detailsSheet, "Detalhes");
    }
    // Relatório de Patrimônio - Formato Hierárquico
    else if (data.summary && data.sites) {
      const patrimonioSummaryData: any[][] = [
        [`GRUPO OPUS - RELATÓRIO DE ${moduleTitle}`],
        [''],
        ['Cliente', data.customer?.name || 'Não identificado'],
        ['Total Geral', `R$ ${data.summary.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`],
        [''],
        ['RESUMO'],
        [`${data.summary.totalEquipment || 0} equipamentos | ${data.summary.siteCount || 0} locais | ${data.summary.zoneCount || 0} zonas`]
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(patrimonioSummaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

      if (Array.isArray(data.sites)) {
        // Sheet hierárquico completo
        const hierarchyData: any[][] = [
          ['PATRIMÔNIO HIERÁRQUICO'],
          [''],
          ['Hierarquia', 'Nome', 'Valor Unitário', 'Quantidade', 'Valor Total']
        ];
        
        data.sites.forEach((site: any, siteIndex: number) => {
          const siteTotalFormatted = `R$ ${site.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
          hierarchyData.push([`${siteIndex + 1}. Local`, site.siteName, '', '', siteTotalFormatted]);
          
          if (Array.isArray(site.zones)) {
            site.zones.forEach((zone: any) => {
              const zoneTotalFormatted = `R$ ${zone.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
              hierarchyData.push(['  • Zona', zone.zoneName, '', '', zoneTotalFormatted]);
              
              if (Array.isArray(zone.equipment)) {
                zone.equipment.forEach((equip: any) => {
                  const unitValueFormatted = `R$ ${equip.unitValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
                  const totalValueFormatted = `R$ ${equip.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
                  const quantity = equip.quantity || '—';
                  hierarchyData.push(['    ◦ Equipamento', equip.name, unitValueFormatted, quantity, totalValueFormatted]);
                });
              }
            });
          }
          hierarchyData.push(['', '', '', '', '']); // Linha em branco entre locais
        });
        
        const hierarchySheet = XLSX.utils.aoa_to_sheet(hierarchyData);
        XLSX.utils.book_append_sheet(workbook, hierarchySheet, "Patrimônio Completo");
      }
    }
    // Relatório de Reabastecimento
    else if (data.orders && Array.isArray(data.orders)) {
      const replenishmentSummaryData: any[][] = [
        [`GRUPO OPUS - RELATÓRIO DE PEDIDOS DE REABASTECIMENTO`],
        [''],
        ['Período', data.period || ''],
        [''],
        ['RESUMO'],
        ['Total de Pedidos', data.summary?.totalOrders || 0],
        ['Pedidos Recebidos', data.summary?.receivedOrders || 0],
        ['Pedidos Pendentes', data.summary?.pendingOrders || 0],
        ['Valor Total', `R$ ${(data.summary?.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(replenishmentSummaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

      const ordersData: any[][] = [
        ['LISTA DE PEDIDOS'],
        [''],
        ['ID', 'Fornecedor', 'Status', 'Data Criação', 'Data Envio', 'Data Recebimento', 'Valor Total']
      ];
      data.orders.forEach((order: any) => {
        const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : '-';
        const shippedAt = order.shippedAt ? new Date(order.shippedAt).toLocaleDateString('pt-BR') : '-';
        const receivedAt = order.receivedAt ? new Date(order.receivedAt).toLocaleDateString('pt-BR') : '-';
        const statusLabel = order.status === 'pendente' ? 'Pendente' : 
                            order.status === 'confirmado' ? 'Confirmado' :
                            order.status === 'enviado' ? 'Enviado' :
                            order.status === 'recebido' ? 'Recebido' : order.status;
        ordersData.push([
          order.id,
          order.supplierName || '-',
          statusLabel,
          createdAt,
          shippedAt,
          receivedAt,
          `R$ ${(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ]);
      });
      const ordersSheet = XLSX.utils.aoa_to_sheet(ordersData);
      XLSX.utils.book_append_sheet(workbook, ordersSheet, "Pedidos");

      const itemsData: any[][] = [
        ['ITENS DOS PEDIDOS'],
        [''],
        ['ID Pedido', 'Peça', 'Quantidade Solicitada', 'Quantidade Recebida', 'Custo Unitário', 'Custo Total']
      ];
      data.orders.forEach((order: any) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            itemsData.push([
              order.id,
              item.partName,
              item.quantityRequested,
              item.quantityReceived || '-',
              `R$ ${(item.unitCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `R$ ${(item.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ]);
          });
        }
      });
      const itemsSheet = XLSX.utils.aoa_to_sheet(itemsData);
      XLSX.utils.book_append_sheet(workbook, itemsSheet, "Itens");
    }
    // Dados gerais (para relatórios que ainda usam o formato antigo)
    else {
      summaryData.push(['RESUMO EXECUTIVO']);
      summaryData.push(['']);
      summaryData.push(['Métrica', 'Valor']);
      if (data.metrics) {
        summaryData.push(['OS Concluídas', safeGet(data.metrics, 'completedWorkOrders', 0)]);
        summaryData.push(['SLA Médio (%)', safeGet(data.metrics, 'averageSLA', 0)]);
        summaryData.push(['Área Limpa (m²)', safeGet(data.metrics, 'totalAreaCleaned', 0)]);
        summaryData.push(['Tempo Médio (min)', safeGet(data.metrics, 'averageExecutionTime', 0)]);
      }
      
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo");

      // Create work orders sheet if data exists
      if (data.workOrders && Array.isArray(data.workOrders)) {
        const workOrdersData = [
          ['ORDENS DE SERVIÇO POR STATUS'],
          [''],
          ['Status', 'Quantidade']
        ];
        
        data.workOrders.forEach((wo: WorkOrderStatusData) => {
          workOrdersData.push([wo.label || wo.status, wo.count.toString()]);
        });

        const workOrdersSheet = XLSX.utils.aoa_to_sheet(workOrdersData);
        XLSX.utils.book_append_sheet(workbook, workOrdersSheet, "Ordens de Serviço");
      }

      // Create SLA sheet if data exists
      if (data.slaData && safeGet(data.slaData, 'categories', null)) {
        const slaData = [
          ['PERFORMANCE SLA'],
          [''],
          ['SLA Total (%)', safeGet(data.slaData, 'totalSLA', 0)],
          [''],
          ['Categoria', 'Percentual (%)']
        ];
        
        safeGet(data.slaData, 'categories', []).forEach((cat: any) => {
          slaData.push([cat.label, cat.percentage]);
        });

        const slaSheet = XLSX.utils.aoa_to_sheet(slaData);
        XLSX.utils.book_append_sheet(workbook, slaSheet, "SLA Performance");
      }
    }

    // Download the Excel file
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  // Generate real PDF and download
  const generatePDF = (data: any, filename: string) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); // Navy blue
    doc.text('GRUPO OPUS', 20, 20);
    doc.setFontSize(16);
    doc.text(data.reportType, 20, 30);
    
    // Report info
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`Período: ${data.period}`, 20, 45);
    doc.text(`Gerado em: ${new Date(data.generatedAt).toLocaleString('pt-BR')}`, 20, 50);
    
    let yPosition = 65;

    // KPI Summary
    if (data.metrics) {
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('RESUMO EXECUTIVO', 20, yPosition);
      yPosition += 10;

      const kpiData = [
        ['Métrica', 'Valor'],
        ['OS Concluídas', safeGet(data.metrics, 'completedWorkOrders', 0).toString()],
        ['SLA Médio', `${safeGet(data.metrics, 'averageSLA', 0)}%`],
        ['Área Limpa', `${safeGet(data.metrics, 'totalAreaCleaned', 0)} m²`],
        ['Tempo Médio', `${safeGet(data.metrics, 'averageExecutionTime', 0)} min`]
      ];

      autoTable(doc, {
        head: [kpiData[0]],
        body: kpiData.slice(1),
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // Work Orders Table
    if (data.workOrders && Array.isArray(data.workOrders) && data.workOrders.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('ORDENS DE SERVIÇO', 20, yPosition);
      yPosition += 10;

      const workOrdersTableData = data.workOrders.map((wo: WorkOrderStatusData) => [
        wo.label || wo.status,
        wo.count.toString()
      ]);

      autoTable(doc, {
        head: [['Status', 'Quantidade']],
        body: workOrdersTableData,
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 20 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }

    // SLA Performance
    if (data.slaData && safeGet(data.slaData, 'categories', null)) {
      doc.setFontSize(14);
      doc.setTextColor(30, 58, 138);
      doc.text('PERFORMANCE SLA', 20, yPosition);
      yPosition += 5;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`SLA Total: ${safeGet(data.slaData, 'totalSLA', 0)}%`, 20, yPosition + 10);
      yPosition += 20;

      const slaTableData = safeGet(data.slaData, 'categories', []).map((cat: any) => [
        cat.label,
        `${cat.percentage}%`
      ]);

      autoTable(doc, {
        head: [['Categoria', 'Percentual']],
        body: slaTableData,
        startY: yPosition,
        theme: 'grid',
        headStyles: { fillColor: [30, 58, 138] },
        margin: { left: 20 }
      });
    }

    // Relatório de Custos Mensais
    if (data.summary && data.equipmentCosts) {
      // Summary section
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text('RESUMO GERAL', 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Período: ${data.period || ''}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Total de Manutenções: ${data.summary.totalMaintenances || 0}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Equipamentos Mantidos: ${data.summary.uniqueEquipment || 0}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Total de Peças Utilizadas: ${data.summary.totalPartsUsed || 0}`, 20, yPosition);
      yPosition += 8;
      doc.setTextColor(0, 128, 0);
      doc.text(`Custo Total: R$ ${(data.summary.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, yPosition);
      yPosition += 15;

      // Equipment costs table
      if (Array.isArray(data.equipmentCosts) && data.equipmentCosts.length > 0) {
        doc.setTextColor(30, 58, 138);
        doc.setFontSize(14);
        doc.text('CUSTOS POR EQUIPAMENTO', 20, yPosition);
        yPosition += 8;

        const equipmentTableData = data.equipmentCosts.map((eq: any) => [
          eq.equipmentName,
          String(eq.maintenanceCount),
          String(eq.partsCount),
          `R$ ${(eq.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Equipamento', 'Manutenções', 'Peças', 'Custo Total']],
          body: equipmentTableData,
          headStyles: { fillColor: [30, 58, 138] },
          margin: { left: 20 },
          styles: { fontSize: 9 }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }

      // Parts usage table
      if (Array.isArray(data.partsUsage) && data.partsUsage.length > 0) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setTextColor(30, 58, 138);
        doc.setFontSize(14);
        doc.text('PEÇAS UTILIZADAS', 20, yPosition);
        yPosition += 8;

        const partsTableData = data.partsUsage.map((part: any) => [
          part.partCode || '-',
          part.partName,
          String(part.totalQuantity),
          `R$ ${(part.unitCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          `R$ ${(part.totalCost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['Código', 'Peça', 'Qtd', 'Custo Unit.', 'Custo Total']],
          body: partsTableData,
          headStyles: { fillColor: [30, 58, 138] },
          margin: { left: 20 },
          styles: { fontSize: 9 }
        });
      }
    }

    // Relatório de Patrimônio - Formato Hierárquico
    if (data.summary && data.sites) {
      // Cliente e Total Geral
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text(`Cliente: ${data.customer?.name || 'Não identificado'}`, 20, yPosition);
      yPosition += 10;
      
      doc.setFontSize(14);
      doc.setTextColor(0, 128, 0);
      const totalGeral = `R$ ${data.summary.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
      doc.text(`Total Geral: ${totalGeral}`, 20, yPosition);
      yPosition += 15;

      // Resumo Executivo
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100);
      doc.text(`${data.summary.totalEquipment || 0} equipamentos | ${data.summary.siteCount || 0} locais | ${data.summary.zoneCount || 0} zonas`, 20, yPosition);
      yPosition += 15;

      // Hierarquia: Locais → Zonas → Equipamentos
      if (Array.isArray(data.sites) && data.sites.length > 0) {
        data.sites.forEach((site: any, siteIndex: number) => {
          // Verificar se precisa de nova página
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }

          // LOCAL
          doc.setFontSize(13);
          doc.setTextColor(30, 58, 138);
          const siteTotalFormatted = `R$ ${site.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
          doc.text(`${siteIndex + 1}. Local: ${site.siteName} — Total: ${siteTotalFormatted}`, 20, yPosition);
          yPosition += 8;

          // ZONAS dentro do local
          if (Array.isArray(site.zones) && site.zones.length > 0) {
            site.zones.forEach((zone: any, zoneIndex: number) => {
              // Verificar se precisa de nova página
              if (yPosition > 265) {
                doc.addPage();
                yPosition = 20;
              }

              // ZONA
              doc.setFontSize(11);
              doc.setTextColor(60, 60, 60);
              const zoneTotalFormatted = `R$ ${zone.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
              doc.text(`  • Zona: ${zone.zoneName} — Total: ${zoneTotalFormatted}`, 25, yPosition);
              yPosition += 7;

              // EQUIPAMENTOS dentro da zona
              if (Array.isArray(zone.equipment) && zone.equipment.length > 0) {
                zone.equipment.forEach((equip: any) => {
                  // Verificar se precisa de nova página
                  if (yPosition > 275) {
                    doc.addPage();
                    yPosition = 20;
                  }

                  const unitValueFormatted = `R$ ${equip.unitValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
                  const totalValueFormatted = `R$ ${equip.totalValue?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0,00'}`;
                  const quantity = equip.quantity || '—';
                  
                  doc.setFontSize(9);
                  doc.setTextColor(80, 80, 80);
                  doc.text(`    ◦ ${equip.name} — Valor Unit.: ${unitValueFormatted} — Qtde: ${quantity} — Total: ${totalValueFormatted}`, 30, yPosition);
                  yPosition += 5;
                });
              }
              yPosition += 2; // Espaço entre zonas
            });
          }
          yPosition += 5; // Espaço entre locais
        });
      }
    }

    // Relatório de Reabastecimento
    if (data.orders && Array.isArray(data.orders)) {
      doc.setFontSize(16);
      doc.setTextColor(30, 58, 138);
      doc.text('RESUMO DE PEDIDOS DE REABASTECIMENTO', 20, yPosition);
      yPosition += 10;

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total de Pedidos: ${data.summary?.totalOrders || 0}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Pedidos Recebidos: ${data.summary?.receivedOrders || 0}`, 20, yPosition);
      yPosition += 8;
      doc.text(`Pedidos Pendentes: ${data.summary?.pendingOrders || 0}`, 20, yPosition);
      yPosition += 8;
      doc.setTextColor(0, 128, 0);
      doc.text(`Valor Total: R$ ${(data.summary?.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 20, yPosition);
      yPosition += 15;

      if (data.orders.length > 0) {
        doc.setTextColor(30, 58, 138);
        doc.setFontSize(14);
        doc.text('LISTA DE PEDIDOS', 20, yPosition);
        yPosition += 8;

        const ordersTableData = data.orders.map((order: any) => {
          const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : '-';
          const statusLabel = order.status === 'pendente' ? 'Pendente' : 
                              order.status === 'confirmado' ? 'Confirmado' :
                              order.status === 'enviado' ? 'Enviado' :
                              order.status === 'recebido' ? 'Recebido' : order.status;
          return [
            order.id?.substring(0, 8) || '-',
            order.supplierName || '-',
            statusLabel,
            createdAt,
            `R$ ${(order.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          ];
        });

        autoTable(doc, {
          startY: yPosition,
          head: [['ID', 'Fornecedor', 'Status', 'Data', 'Valor']],
          body: ordersTableData,
          headStyles: { fillColor: [30, 58, 138] },
          margin: { left: 20 },
          styles: { fontSize: 9 }
        });
        yPosition = (doc as any).lastAutoTable.finalY + 15;
      }
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Página ${i} de ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10);
      doc.text('Relatório gerado automaticamente pelo sistema OPUS CLEAN', 20, doc.internal.pageSize.height - 10);
    }

    // Save the PDF
    doc.save(`${filename}.pdf`);
  };

  // Download file helper
  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Report type definitions
  const baseReportTypes = [
    {
      id: "geral",
      title: "Relatório Geral",
      description: "Visão completa das operações com todos os KPIs principais",
      icon: FileText,
      color: "bg-blue-500",
      gradient: "from-blue-50 to-blue-100"
    },
    {
      id: "sla",
      title: "Análise de SLA",
      description: "Performance detalhada de cumprimento de prazos",
      icon: Target,
      color: "bg-green-500",
      gradient: "from-green-50 to-green-100"
    },
    {
      id: "produtividade",
      title: "Produtividade",
      description: "Métricas de eficiência e produtividade operacional",
      icon: TrendingUp,
      color: "bg-purple-500",
      gradient: "from-purple-50 to-purple-100"
    },
    {
      id: "operadores",
      title: "Performance de Operadores",
      description: "Análise individual e comparativa dos operadores",
      icon: Users,
      color: "bg-orange-500",
      gradient: "from-orange-50 to-orange-100"
    },
    {
      id: "locais",
      title: "Análise por Locais",
      description: "Distribuição e performance por zona e site",
      icon: MapPin,
      color: "bg-indigo-500",
      gradient: "from-indigo-50 to-indigo-100"
    },
    {
      id: "temporal",
      title: "Análise Temporal",
      description: "Tendências e padrões ao longo do tempo",
      icon: Clock,
      color: "bg-red-500",
      gradient: "from-red-50 to-red-100"
    }
  ];

  // Add patrimonio and monthly cost reports only for maintenance module
  const reportTypes = currentModule === 'maintenance' 
    ? [
        ...baseReportTypes,
        {
          id: "patrimonio",
          title: "Relatório de Patrimônio",
          description: "Valor de equipamentos por local e zona",
          icon: Package,
          color: "bg-emerald-500",
          gradient: "from-emerald-50 to-emerald-100"
        },
        {
          id: "custos-mensais",
          title: "Custos Mensais",
          description: "Peças utilizadas, máquinas mantidas e custos por equipamento",
          icon: TrendingUp,
          color: "bg-amber-500",
          gradient: "from-amber-50 to-amber-100"
        },
        {
          id: "reabastecimento",
          title: "Pedidos de Reabastecimento",
          description: "Histórico de pedidos de peças aos fornecedores",
          icon: Truck,
          color: "bg-cyan-500",
          gradient: "from-cyan-50 to-cyan-100"
        }
      ]
    : baseReportTypes;

  // KPI Cards
  const kpiCards = [
    {
      title: "OS Concluídas",
      value: safeGet(reportsMetrics, 'completedWorkOrders', 0).toLocaleString(),
      change: safeGet(reportsMetrics, 'completedWorkOrdersChange', '0%'),
      trend: safeGet(reportsMetrics, 'completedWorkOrdersChange', '0%').startsWith('+') ? "up" : "down",
      icon: CheckCircle2,
      color: "text-green-600",
      bgColor: "bg-green-50",
      borderColor: "border-green-200"
    },
    {
      title: "SLA Médio",
      value: `${safeGet(reportsMetrics, 'averageSLA', 0)}%`,
      change: safeGet(reportsMetrics, 'averageSLAChange', '0%'),
      trend: safeGet(reportsMetrics, 'averageSLAChange', '0%').startsWith('+') ? "up" : "down",
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200"
    },
    {
      title: currentModule === 'maintenance' ? "Equipamentos Ativos" : "Área Limpa (m²)",
      value: currentModule === 'maintenance' 
        ? safeGet(reportsMetrics, 'activeEquipment', 0).toLocaleString()
        : safeGet(reportsMetrics, 'totalAreaCleaned', 0).toLocaleString(),
      change: currentModule === 'maintenance'
        ? safeGet(reportsMetrics, 'activeEquipmentChange', '0%')
        : safeGet(reportsMetrics, 'totalAreaCleanedChange', '0%'),
      trend: currentModule === 'maintenance'
        ? safeGet(reportsMetrics, 'activeEquipmentChange', '0%').startsWith('+') ? "up" : "down"
        : safeGet(reportsMetrics, 'totalAreaCleanedChange', '0%').startsWith('+') ? "up" : "down",
      icon: currentModule === 'maintenance' ? Wrench : Building2,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200"
    },
    {
      title: "Tempo Médio (min)",
      value: safeGet(reportsMetrics, 'averageExecutionTime', 0).toString(),
      change: safeGet(reportsMetrics, 'averageExecutionTimeChange', '0%'),
      trend: safeGet(reportsMetrics, 'averageExecutionTimeChange', '0%').startsWith('+') ? "up" : "down",
      icon: Timer,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200"
    }
  ];

  // COMPONENTES DE VISUALIZAÇÃO ESPECÍFICOS PARA CADA TIPO DE RELATÓRIO

  const GeneralReportView = ({ data }: { data: any }) => (
    <ModernCard variant="gradient">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <span>Relatório Geral - Visão Completa das Operações</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Overview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">📊 Visão Geral</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Total de OS:</span>
                <span className="font-semibold">{data.overview?.totalWorkOrders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Concluídas:</span>
                <span className="font-semibold text-green-600">{data.overview?.completedWorkOrders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Pendentes:</span>
                <span className="font-semibold text-amber-600">{data.overview?.pendingWorkOrders || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Taxa de Conclusão:</span>
                <span className="font-semibold text-blue-600">{data.overview?.completionRate || 0}%</span>
              </div>
            </div>
          </div>

          {/* Efficiency */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">⚡ Eficiência</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Eficiência Geral:</span>
                <span className="font-semibold">{data.efficiency?.overallEfficiency || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Índice de Qualidade:</span>
                <span className="font-semibold">{data.efficiency?.qualityIndex || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Utilização de Recursos:</span>
                <span className="font-semibold">{data.efficiency?.resourceUtilization || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Tempo Médio:</span>
                <span className="font-semibold">{data.efficiency?.averageCompletionTime || 0} min</span>
              </div>
            </div>
          </div>

          {/* Financial */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">💰 Financeiro</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Custo Total:</span>
                <span className="font-semibold">R$ {(data.financial?.totalCost || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Custo por OS:</span>
                <span className="font-semibold">R$ {(data.financial?.costPerWorkOrder || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Utilização do Orçamento:</span>
                <span className="font-semibold">{data.financial?.budgetUtilization || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Economia:</span>
                <span className="font-semibold text-green-600">R$ {(data.financial?.savings || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Compliance */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">🎯 Compliance</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">SLA Compliance:</span>
                <span className="font-semibold">{data.compliance?.slaCompliance || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Incidentes de Segurança:</span>
                <span className="font-semibold">{data.compliance?.safetyIncidents || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Score de Qualidade:</span>
                <span className="font-semibold">{data.compliance?.qualityScore || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Score de Auditoria:</span>
                <span className="font-semibold">{data.compliance?.auditScore || 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );

  const SLAAnalysisView = ({ data }: { data: any }) => (
    <ModernCard variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-green-600" />
          <span>Análise de SLA - Performance de Cumprimento de Prazos</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* SLA Breakdown */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">📋 Breakdown por Categoria</h3>
            <div className="space-y-3">
              {data.slaBreakdown?.map((item: any, index: number) => (
                <div key={index} className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{item.category}</span>
                    <span className="text-lg font-bold text-green-600">{item.percentage}%</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {item.met} de {item.total} cumpridos
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Time Distribution */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">⏱️ Distribuição de Tempo</h3>
            <div className="space-y-3">
              {data.timeDistribution?.map((item: any, index: number) => (
                <div key={index} className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium">{item.range}</span>
                    <span className="text-lg font-bold text-blue-600">{item.percentage}%</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    {item.count} ordens de serviço
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${item.percentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-amber-50 p-4 rounded-lg mt-4">
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Tempo Médio de Resposta:</span>
                <span className="font-semibold">{data.averageResponseTime || "N/A"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">Alertas Críticos:</span>
                <span className="font-semibold text-red-600">{data.criticalAlerts || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );

  const ProductivityReportView = ({ data }: { data: any }) => (
    <ModernCard variant="gradient">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          <span>Produtividade - Métricas de Eficiência Operacional</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Productivity Metrics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">📈 Métricas de Produtividade</h3>
            <div className="space-y-3">
              {[
                { label: "OS por Dia", value: data.productivity?.workOrdersPerDay, unit: "" },
                { label: "Tempo Médio de Conclusão", value: data.productivity?.averageCompletionTime, unit: " min" },
                { label: "Área Limpa por Hora", value: data.productivity?.areaCleanedPerHour, unit: " m²/h" },
                { label: "Tarefas por Operador", value: data.productivity?.tasksPerOperator, unit: "" },
                { label: "Score de Qualidade", value: data.productivity?.qualityScore, unit: "%" }
              ].map((metric, index) => (
                <div key={index} className="bg-purple-50 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">{metric.label}:</span>
                    <span className="font-semibold text-purple-700">{metric.value || 0}{metric.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Efficiency Metrics */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">⚡ Métricas de Eficiência</h3>
            <div className="space-y-3">
              {[
                { label: "Utilização de Recursos", value: data.efficiency?.resourceUtilization, unit: "%" },
                { label: "Uptime de Equipamentos", value: data.efficiency?.equipmentUptime, unit: "%" },
                { label: "Desperdício de Material", value: data.efficiency?.materialWaste, unit: "%" },
                { label: "Consumo de Energia", value: data.efficiency?.energyConsumption, unit: " kWh" },
                { label: "Eficiência de Custo", value: data.efficiency?.costEfficiency, unit: "%" }
              ].map((metric, index) => (
                <div key={index} className="bg-green-50 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">{metric.label}:</span>
                    <span className="font-semibold text-green-700">{metric.value || 0}{metric.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trends */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">📊 Tendências Mensais</h3>
            <div className="space-y-3">
              {data.trends?.map((trend: any, index: number) => (
                <div key={index} className="bg-slate-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-slate-800 mb-2">{trend.month}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Produtividade:</span>
                      <span className="font-semibold">{trend.productivity}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Eficiência:</span>
                      <span className="font-semibold">{trend.efficiency}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );

  const OperatorPerformanceView = ({ data }: { data: any }) => (
    <ModernCard variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="w-5 h-5 text-orange-600" />
          <span>Performance de Operadores - Análise Individual</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Team Stats */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">👥 Estatísticas da Equipe</h3>
            <div className="space-y-3">
              {[
                { label: "Total de Operadores", value: data.teamStats?.totalOperators },
                { label: "Eficiência Média", value: `${data.teamStats?.averageEfficiency || 0}%` },
                { label: "Top Performer", value: data.teamStats?.topPerformer || "N/A" },
                { label: "Precisam Melhoria", value: data.teamStats?.improvementNeeded },
                { label: "Treinamento Concluído", value: data.teamStats?.trainingCompleted }
              ].map((stat, index) => (
                <div key={index} className="bg-orange-50 p-3 rounded-lg">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">{stat.label}:</span>
                    <span className="font-semibold text-orange-700">{stat.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rankings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">🏆 Ranking</h3>
            <div className="space-y-3">
              {data.rankings?.map((rank: any, index: number) => (
                <div key={index} className="bg-slate-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg font-bold text-slate-700">#{rank.position}</span>
                      <span className="font-medium">{rank.operator}</span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">{rank.score}</span>
                  </div>
                  <div className="text-sm text-slate-600">
                    Melhoria: <span className={`font-semibold ${rank.improvement.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {rank.improvement}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Individual Operators */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">👤 Operadores Individuais</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.operators?.slice(0, 5).map((op: any, index: number) => (
                <div key={index} className="bg-slate-50 p-3 rounded-lg">
                  <div className="font-medium text-slate-800 mb-2">{op.name}</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Tarefas:</span>
                      <span className="font-semibold">{op.tasksCompleted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Eficiência:</span>
                      <span className="font-semibold">{op.efficiency}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Qualidade:</span>
                      <span className="font-semibold">{op.qualityScore}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Pontualidade:</span>
                      <span className="font-semibold">{op.punctuality}%</span>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between items-center">
                    <span className="text-xs text-slate-600">{op.experienceLevel}</span>
                    <span className={`text-xs px-2 py-1 rounded ${op.certification === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {op.certification}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );

  const LocationAnalysisView = ({ data }: { data: any }) => (
    <ModernCard variant="gradient">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-indigo-600" />
          <span>Análise por Locais - Distribuição por Zona e Site</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Sites */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">🏢 Sites</h3>
            <div className="space-y-3">
              {data.sites?.map((site: any, index: number) => (
                <div key={index} className="bg-indigo-50 p-4 rounded-lg">
                  <div className="font-medium text-slate-800 mb-2">{site.name}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Zonas:</span>
                      <span className="font-semibold">{site.totalZones}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">OS Total:</span>
                      <span className="font-semibold">{site.totalWorkOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Concluídas:</span>
                      <span className="font-semibold text-green-600">{site.completedWorkOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Eficiência:</span>
                      <span className="font-semibold text-blue-600">{site.efficiency}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Área:</span>
                      <span className="font-semibold">{site.area} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Utilização:</span>
                      <span className="font-semibold">{site.utilizationRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Zones */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">📍 Zonas</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.zones?.map((zone: any, index: number) => (
                <div key={index} className="bg-slate-50 p-3 rounded-lg">
                  <div className="font-medium text-slate-800 mb-1">{zone.name}</div>
                  <div className="text-xs text-slate-600 mb-2">{zone.siteName}</div>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">OS Total:</span>
                      <span className="font-semibold">{zone.totalWorkOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Concluídas:</span>
                      <span className="font-semibold">{zone.completedWorkOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Tempo Médio:</span>
                      <span className="font-semibold">{zone.averageTime} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Prioridade:</span>
                      <span className={`font-semibold ${zone.priority === 'Alta' ? 'text-red-600' : zone.priority === 'Média' ? 'text-amber-600' : 'text-green-600'}`}>
                        {zone.priority}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    Última limpeza: {zone.lastCleaning}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );

  const TemporalAnalysisView = ({ data }: { data: any }) => (
    <ModernCard variant="glass">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="w-5 h-5 text-red-600" />
          <span>Análise Temporal - Tendências e Padrões</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Historical Trends */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">📈 Tendências Históricas</h3>
            <div className="space-y-3">
              {data.trends?.map((trend: any, index: number) => (
                <div key={index} className="bg-red-50 p-4 rounded-lg">
                  <div className="font-medium text-slate-800 mb-2">{trend.period}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Work Orders:</span>
                      <span className="font-semibold">{trend.workOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Eficiência:</span>
                      <span className="font-semibold text-blue-600">{trend.efficiency}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Custo:</span>
                      <span className="font-semibold">R$ {trend.cost}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Weekly Patterns */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">📅 Padrões Semanais</h3>
            <div className="space-y-3">
              {data.patterns?.map((pattern: any, index: number) => (
                <div key={index} className="bg-slate-50 p-3 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-slate-800">{pattern.day}</span>
                    <span className="text-sm font-semibold text-blue-600">{pattern.avgWorkOrders} OS</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    Pico: {pattern.peak}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Forecasts */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800">🔮 Previsões</h3>
            <div className="space-y-3">
              {data.forecasts?.map((forecast: any, index: number) => (
                <div key={index} className="bg-green-50 p-4 rounded-lg">
                  <div className="font-medium text-slate-800 mb-2">{forecast.period}</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Previsão:</span>
                      <span className="font-semibold text-green-600">{forecast.predicted} OS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Confiança:</span>
                      <span className="font-semibold">{forecast.confidence}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${forecast.confidence}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </ModernCard>
  );

  // Monthly Cost Report View
  const MonthlyCostReportView = ({ data, months, year, isLoading }: { data: any; months: number[]; year: number; isLoading: boolean }) => {
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const sortedMonths = months.sort((a, b) => a - b);
    const periodLabel = months.length === 1 
      ? `${monthNames[sortedMonths[0] - 1]} ${year}`
      : `${sortedMonths.map(m => monthNames[m - 1]).join(', ')} ${year}`;
    
    if (isLoading) {
      return (
        <ModernCard variant="glass">
          <CardContent className="py-8">
            <div className="flex items-center justify-center space-x-3">
              <RefreshCw className="w-6 h-6 animate-spin text-amber-600" />
              <span className="text-slate-600">Carregando dados de custos...</span>
            </div>
          </CardContent>
        </ModernCard>
      );
    }

    const summary = data?.summary || {};
    const equipmentCosts = data?.equipmentCosts || [];
    const partsUsage = data?.partsUsage || [];

    return (
      <ModernCard variant="glass">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            <span>Custos de Manutenção - {periodLabel}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-amber-50 p-4 rounded-lg">
              <div className="text-sm text-amber-700 font-medium">Total de Manutenções</div>
              <div className="text-2xl font-bold text-amber-900">{summary.totalMaintenances || 0}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-700 font-medium">Equipamentos Mantidos</div>
              <div className="text-2xl font-bold text-blue-900">{summary.uniqueEquipment || 0}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-sm text-purple-700 font-medium">Peças Utilizadas</div>
              <div className="text-2xl font-bold text-purple-900">{(summary.totalPartsUsed || 0).toLocaleString('pt-BR')}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-green-700 font-medium">Custo Total</div>
              <div className="text-2xl font-bold text-green-900">
                {(summary.totalCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </div>

          {equipmentCosts.length === 0 && partsUsage.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Wrench className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma manutenção com uso de peças registrada neste período.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Equipment Costs */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-600" />
                  Custos por Equipamento
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {equipmentCosts.map((eq: any, index: number) => (
                    <div key={index} className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-slate-800">{eq.equipmentName}</span>
                        <span className="font-bold text-green-700">
                          {(eq.totalCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div className="flex gap-4 text-sm text-slate-600">
                        <span>{eq.maintenanceCount} manutenções</span>
                        <span>{eq.partsCount} peças</span>
                      </div>
                      {eq.workOrders && eq.workOrders.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                          {eq.workOrders.map((wo: any, woIndex: number) => (
                            <div key={woIndex} className="text-xs bg-white p-2 rounded border border-slate-100">
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium">OS: {wo.workOrderNumber}</span>
                                <span className="text-slate-500">
                                  {wo.completedAt ? new Date(wo.completedAt).toLocaleDateString('pt-BR') : '-'}
                                </span>
                              </div>
                              {wo.parts && wo.parts.length > 0 && (
                                <div className="space-y-1">
                                  {wo.parts.map((part: any, partIndex: number) => (
                                    <div key={partIndex} className="flex justify-between text-slate-600">
                                      <span>{part.partName} (x{part.quantity})</span>
                                      <span>{(part.totalCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Parts Usage */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  Peças Utilizadas
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {partsUsage.map((part: any, index: number) => (
                    <div key={index} className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-slate-800">{part.partName}</div>
                          {part.partCode && (
                            <div className="text-xs text-slate-500">Código: {part.partCode}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-700">
                            {(part.totalCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                          <div className="text-xs text-slate-500">
                            {part.totalQuantity}x @ {(part.unitCost || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </ModernCard>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50/30 to-white">
      <div className="w-full px-6 py-6">
        <ModernPageHeader 
          title="Relatórios" 
          description="Análise detalhada de desempenho e métricas" 
          icon={BarChart3}
          actions={
            <>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40" data-testid="select-date-range">
                  <Calendar className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                  <SelectItem value="365">Último ano</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={refreshData}
                className={theme.buttons.primary}
                style={theme.buttons.primaryStyle}
                size="sm"
                disabled={isRefreshing}
                data-testid="button-refresh-data"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                Atualizar
              </Button>
            </>
          }
        />
      
        <div className="space-y-3">
        {/* KPI Dashboard */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900">Dashboard de KPIs</h2>
            <Badge variant="outline" className="text-slate-600">
              Últimos {dateRange} dias
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {isLoadingMetrics ? (
              Array.from({ length: 4 }).map((_, i) => (
                <ModernCard key={i} variant={i % 2 === 0 ? "gradient" : "glass"}>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Skeleton className="h-4 w-24 mb-3" />
                        <Skeleton className="h-8 w-20 mb-2" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="w-12 h-12 rounded-full" />
                    </div>
                  </CardContent>
                </ModernCard>
              ))
            ) : errorMetrics ? (
              <div className="col-span-full">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Erro ao carregar métricas: {errorMetrics.message}
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              kpiCards.map((kpi, index) => {
                const Icon = kpi.icon;
                return (
                  <ModernCard key={kpi.title} variant={index % 2 === 0 ? "gradient" : "glass"} className={`${kpi.borderColor} border-l-4`}>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-600 mb-1">{kpi.title}</p>
                          <p className="text-3xl font-bold text-slate-900 mb-2" data-testid={`kpi-value-${kpi.title.toLowerCase().replace(/\s+/g, '-')}`}>
                            {kpi.value}
                          </p>
                          <div className="flex items-center">
                            <TrendingUp className={`w-3 h-3 mr-1 ${kpi.trend === 'up' ? 'text-green-500' : 'text-red-500'}`} />
                            <p className={`text-xs font-medium ${kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                              {kpi.change} vs. período anterior
                            </p>
                          </div>
                        </div>
                        <div className={`w-14 h-14 ${kpi.bgColor} rounded-xl flex items-center justify-center`}>
                          <Icon className={`w-7 h-7 ${kpi.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </ModernCard>
                );
              })
            )}
          </div>
        </div>

        <Separator className="my-8" />

        {/* Report Generation Section */}
        <div className="mb-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Geração de Relatórios</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Selecione o tipo de relatório e formato desejado para gerar análises detalhadas dos dados
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {reportTypes.map((report, index) => {
              const Icon = report.icon;
              const isSelected = selectedReportType === report.id;
              
              return (
                <div 
                  key={report.id}
                  className="cursor-pointer"
                  onClick={() => setSelectedReportType(isSelected ? null : report.id)}
                >
                  <ModernCard 
                    variant={index % 2 === 0 ? "gradient" : "glass"}
                    className={`transition-all duration-300 transform hover:-translate-y-1 ${
                      isSelected ? "ring-2 ring-blue-500 shadow-2xl scale-105" : ""
                    }`}
                  >
                  <CardContent>
                    <div className={`w-full h-32 rounded-lg bg-gradient-to-br ${report.gradient} mb-4 flex items-center justify-center`}>
                      <Icon className={`w-12 h-12 text-white p-2 ${report.color} rounded-lg`} />
                    </div>
                    
                    <h3 className="text-lg font-bold text-slate-900 mb-2">
                      {report.title}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                      {report.description}
                    </p>
                    
                    {isSelected && (
                      <div className="space-y-3 mt-4 pt-4 border-t border-slate-200">
                        {/* Month/Year selector for custos-mensais report */}
                        {report.id === 'custos-mensais' && (
                          <div className="mb-4 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                              Selecione o período:
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    className="w-full justify-between text-left font-normal"
                                    data-testid="select-months"
                                  >
                                    <span className="truncate">
                                      {selectedMonths.length === 0 
                                        ? "Selecione meses" 
                                        : selectedMonths.length === 1 
                                          ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][selectedMonths[0] - 1]
                                          : `${selectedMonths.length} meses`}
                                    </span>
                                    <ChevronDown className="h-4 w-4 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2" align="start">
                                  <div className="space-y-1 max-h-64 overflow-y-auto">
                                    {[
                                      { value: 1, label: 'Janeiro' },
                                      { value: 2, label: 'Fevereiro' },
                                      { value: 3, label: 'Março' },
                                      { value: 4, label: 'Abril' },
                                      { value: 5, label: 'Maio' },
                                      { value: 6, label: 'Junho' },
                                      { value: 7, label: 'Julho' },
                                      { value: 8, label: 'Agosto' },
                                      { value: 9, label: 'Setembro' },
                                      { value: 10, label: 'Outubro' },
                                      { value: 11, label: 'Novembro' },
                                      { value: 12, label: 'Dezembro' },
                                    ].map((month) => (
                                      <label
                                        key={month.value}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent"
                                      >
                                        <Checkbox
                                          checked={selectedMonths.includes(month.value)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedMonths([...selectedMonths, month.value]);
                                            } else {
                                              setSelectedMonths(selectedMonths.filter(m => m !== month.value));
                                            }
                                          }}
                                        />
                                        <span className="text-sm">{month.label}</span>
                                      </label>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <Select 
                                value={String(selectedYear)} 
                                onValueChange={(v) => setSelectedYear(parseInt(v))}
                              >
                                <SelectTrigger data-testid="select-year">
                                  <SelectValue placeholder="Ano" />
                                </SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(year => (
                                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        )}
                        <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                          Escolha o formato:
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 text-xs py-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateReport(report.id, 'pdf');
                            }}
                            disabled={isGenerating === `${report.id}-pdf`}
                            data-testid={`button-generate-${report.id}-pdf`}
                          >
                            {isGenerating === `${report.id}-pdf` ? (
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <FileText className="w-3 h-3 mr-1" />
                            )}
                            PDF
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 text-xs py-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateReport(report.id, 'csv');
                            }}
                            disabled={isGenerating === `${report.id}-csv`}
                            data-testid={`button-generate-${report.id}-csv`}
                          >
                            {isGenerating === `${report.id}-csv` ? (
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="w-3 h-3 mr-1" />
                            )}
                            CSV
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            className="flex-1 text-xs py-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              generateReport(report.id, 'excel');
                            }}
                            disabled={isGenerating === `${report.id}-excel`}
                            data-testid={`button-generate-${report.id}-excel`}
                          >
                            {isGenerating === `${report.id}-excel` ? (
                              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <FileSpreadsheet className="w-3 h-3 mr-1" />
                            )}
                            Excel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </ModernCard>
                </div>
              );
            })}
          </div>

          {/* VISUALIZAÇÕES ESPECÍFICAS PARA CADA TIPO DE RELATÓRIO */}
          {selectedReportType && (
            <div className="mt-8">
              {selectedReportType === 'geral' && generalReport && (
                <GeneralReportView data={generalReport} />
              )}
              {selectedReportType === 'sla' && slaAnalysis && (
                <SLAAnalysisView data={slaAnalysis} />
              )}
              {selectedReportType === 'produtividade' && productivityReport && (
                <ProductivityReportView data={productivityReport} />
              )}
              {selectedReportType === 'operadores' && operatorPerformance && (
                <OperatorPerformanceView data={operatorPerformance} />
              )}
              {selectedReportType === 'locais' && locationAnalysis && (
                <LocationAnalysisView data={locationAnalysis} />
              )}
              {selectedReportType === 'temporal' && temporalAnalysis && (
                <TemporalAnalysisView data={temporalAnalysis} />
              )}
              {selectedReportType === 'custos-mensais' && monthlyCostReport && (
                <MonthlyCostReportView 
                  data={monthlyCostReport} 
                  months={selectedMonths} 
                  year={selectedYear}
                  isLoading={isLoadingMonthlyCost}
                />
              )}
            </div>
          )}
        </div>

        <Separator className="my-8" />

        {/* Analytics Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          {/* Work Orders Chart */}
          <ModernCard variant="gradient">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="w-5 h-5" />
                  <span>Ordens de Serviço por Status</span>
                </CardTitle>
                <Button 
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  size="sm" 
                  onClick={() => generateReport('geral', 'csv')}
                  data-testid="button-export-work-orders-csv"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {isLoadingStatus ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <Skeleton className="w-4 h-4 rounded" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                        <Skeleton className="h-4 w-8" />
                      </div>
                    ))}
                  </div>
                ) : errorStatus ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Erro ao carregar dados de status: {errorStatus.message}
                    </AlertDescription>
                  </Alert>
                ) : workOrdersStatus && Array.isArray(workOrdersStatus) && workOrdersStatus.length > 0 ? (
                  workOrdersStatus.map((status: WorkOrderStatusData) => (
                    <div key={status.status} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors" data-testid={`status-item-${status.status}`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 ${status.color} rounded-full`}></div>
                        <span className="text-sm font-medium text-slate-700">{status.label}</span>
                      </div>
                      <Badge variant="secondary" className="font-bold" data-testid={`status-count-${status.status}`}>
                        {status.count}
                      </Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Activity className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Nenhum dado disponível</p>
                  </div>
                )}
              </div>
            </CardContent>
          </ModernCard>

          {/* SLA Performance Chart */}
          <ModernCard variant="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5" />
                  <span>Performance de SLA</span>
                </CardTitle>
                <Button 
                  className={theme.buttons.primary}
                  style={theme.buttons.primaryStyle}
                  size="sm" 
                  onClick={() => generateReport('sla', 'csv')}
                  data-testid="button-export-sla-csv"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {isLoadingSLA ? (
                  <div>
                    <div className="text-center mb-6">
                      <Skeleton className="h-16 w-24 mx-auto mb-2" />
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </div>
                    <div className="space-y-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <Skeleton className="h-4 w-20" />
                          <div className="flex items-center space-x-2">
                            <Skeleton className="w-24 h-3 rounded-full" />
                            <Skeleton className="h-4 w-10" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : errorSLA ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Erro ao carregar dados de SLA: {errorSLA.message}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div>
                    <div className="text-center mb-6 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                      <div className="text-5xl font-bold text-green-600 mb-2" data-testid="sla-total-average">
                        {safeGet(slaPerformance, 'totalSLA', 0)}%
                      </div>
                      <div className="text-sm font-medium text-slate-600">SLA Médio Geral</div>
                    </div>
                    
                    <div className="space-y-4">
                      {slaPerformance && safeGet(slaPerformance, 'categories', null) && Array.isArray(safeGet(slaPerformance, 'categories', [])) ? (
                        safeGet(slaPerformance, 'categories', []).map((category: any) => (
                          <div key={category.category} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg" data-testid={`sla-category-${category.category}`}>
                            <span className="text-sm font-medium text-slate-700">{category.label}</span>
                            <div className="flex items-center space-x-3">
                              <div className="w-32 h-3 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    category.category === 'onTime' ? 'bg-green-500' :
                                    category.category === 'atRisk' ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  }`}
                                  style={{ width: `${Math.min(category.percentage, 100)}%` }}
                                ></div>
                              </div>
                              <Badge variant="outline" className="font-bold" data-testid={`sla-percentage-${category.category}`}>
                                {category.percentage}%
                              </Badge>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8">
                          <Target className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                          <p className="text-sm text-slate-500">Nenhum dado disponível</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </ModernCard>
        </div>

        {/* Quick Export Options */}
        <ModernCard variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className={cn("w-5 h-5", theme.text.primary)} />
              <span>Exportação Rápida</span>
            </CardTitle>
            <p className="text-sm text-slate-600 mt-1">Baixe relatórios prontos em diferentes formatos</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Relatório Completo PDF */}
              <button
                onClick={() => generateReport('geral', 'pdf')}
                disabled={isGenerating === 'geral-pdf'}
                data-testid="button-quick-export-all-pdf"
                className={cn(
                  "group relative bg-white rounded-xl border-2 border-slate-200 p-4 transition-all duration-300",
                  "hover:border-slate-300 hover:shadow-lg hover:-translate-y-1",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                )}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
                    "bg-gradient-to-br from-red-50 to-orange-50 group-hover:from-red-100 group-hover:to-orange-100"
                  )}>
                    {isGenerating === 'geral-pdf' ? (
                      <RefreshCw className="w-7 h-7 text-red-600 animate-spin" />
                    ) : (
                      <FileText className="w-7 h-7 text-red-600" />
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-slate-900">Relatório Completo</h3>
                    <p className="text-xs text-slate-500 mt-1">Formato PDF</p>
                  </div>
                </div>
              </button>
              
              {/* Análise SLA CSV */}
              <button
                onClick={() => generateReport('sla', 'csv')}
                disabled={isGenerating === 'sla-csv'}
                data-testid="button-quick-export-sla-csv"
                className={cn(
                  "group relative bg-white rounded-xl border-2 border-slate-200 p-4 transition-all duration-300",
                  "hover:border-slate-300 hover:shadow-lg hover:-translate-y-1",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                )}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
                    "bg-gradient-to-br from-emerald-50 to-green-50 group-hover:from-emerald-100 group-hover:to-green-100"
                  )}>
                    {isGenerating === 'sla-csv' ? (
                      <RefreshCw className="w-7 h-7 text-emerald-600 animate-spin" />
                    ) : (
                      <Target className="w-7 h-7 text-emerald-600" />
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-slate-900">Análise SLA</h3>
                    <p className="text-xs text-slate-500 mt-1">Formato CSV</p>
                  </div>
                </div>
              </button>
              
              {/* Produtividade Excel */}
              <button
                onClick={() => generateReport('produtividade', 'excel')}
                disabled={isGenerating === 'produtividade-excel'}
                data-testid="button-quick-export-productivity-excel"
                className={cn(
                  "group relative bg-white rounded-xl border-2 border-slate-200 p-4 transition-all duration-300",
                  "hover:border-slate-300 hover:shadow-lg hover:-translate-y-1",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                )}
              >
                <div className="flex flex-col items-center space-y-3">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
                    "bg-gradient-to-br from-violet-50 to-purple-50 group-hover:from-violet-100 group-hover:to-purple-100"
                  )}>
                    {isGenerating === 'produtividade-excel' ? (
                      <RefreshCw className="w-7 h-7 text-violet-600 animate-spin" />
                    ) : (
                      <TrendingUp className="w-7 h-7 text-violet-600" />
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="font-semibold text-slate-900">Produtividade</h3>
                    <p className="text-xs text-slate-500 mt-1">Formato Excel</p>
                  </div>
                </div>
              </button>
            </div>
            
            {/* Informações adicionais */}
            <div className="mt-6 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-lg border border-slate-200">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                  <Download className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">Downloads Instantâneos</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Relatórios gerados com dados dos últimos <span className="font-semibold">{dateRange} dias</span> • 
                    Processamento automático em tempo real
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </ModernCard>
        </div>
      </div>
    </div>
  );
}