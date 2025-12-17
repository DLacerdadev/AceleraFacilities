import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  FileText, 
  Download,
  Calendar,
  TrendingUp,
  Users,
  ClipboardList,
  Loader2,
  BarChart3
} from "lucide-react";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { ModernCard } from "@/components/ui/modern-card";
import { useAuth } from "@/hooks/useAuth";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ThirdPartyReports() {
  const { user } = useAuth();
  const theme = useModuleTheme();
  
  const [period, setPeriod] = useState("30");
  const [reportType, setReportType] = useState("productivity");

  const { data: reportData, isLoading } = useQuery<{
    summary: {
      totalWorkOrders: number;
      completedWorkOrders: number;
      completionRate: number;
      onTimeRate: number;
      averageCompletionTime: number;
    };
    byUser: Array<{
      userId: string;
      userName: string;
      completed: number;
      inProgress: number;
      overdue: number;
    }>;
    byTeam: Array<{
      teamId: string;
      teamName: string;
      completed: number;
      inProgress: number;
      overdue: number;
    }>;
  }>({
    queryKey: ['/api/third-party-portal/reports', period, reportType],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const handleExport = async () => {
    try {
      const response = await fetch(`/api/third-party-portal/reports/export?period=${period}&type=${reportType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-${reportType}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }
    } catch (error) {
      console.error('Error exporting report:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho da sua equipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40" data-testid="select-report-period">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            onClick={handleExport}
            data-testid="button-export-report"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de O.S.
            </CardTitle>
            <ClipboardList className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData?.summary.totalWorkOrders || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concluídas
            </CardTitle>
            <TrendingUp className="w-4 h-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">
              {reportData?.summary.completedWorkOrders || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Taxa de Conclusão
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {reportData?.summary.completionRate || 0}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              No Prazo
            </CardTitle>
            <Calendar className="w-4 h-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {reportData?.summary.onTimeRate || 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ModernCard variant="gradient">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Desempenho por Usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!reportData?.byUser || reportData.byUser.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum dado disponível</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="text-center">Concluídas</TableHead>
                    <TableHead className="text-center">Em Progresso</TableHead>
                    <TableHead className="text-center">Atrasadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.byUser.map((item) => (
                    <TableRow key={item.userId}>
                      <TableCell className="font-medium">{item.userName}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-chart-2/10 text-chart-2">{item.completed}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-500/10 text-blue-600">{item.inProgress}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-red-500/10 text-red-600">{item.overdue}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </ModernCard>

        <ModernCard variant="gradient">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Desempenho por Equipe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!reportData?.byTeam || reportData.byTeam.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma equipe cadastrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipe</TableHead>
                    <TableHead className="text-center">Concluídas</TableHead>
                    <TableHead className="text-center">Em Progresso</TableHead>
                    <TableHead className="text-center">Atrasadas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.byTeam.map((item) => (
                    <TableRow key={item.teamId}>
                      <TableCell className="font-medium">{item.teamName}</TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-chart-2/10 text-chart-2">{item.completed}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-blue-500/10 text-blue-600">{item.inProgress}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-red-500/10 text-red-600">{item.overdue}</Badge>
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
