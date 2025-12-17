import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ClipboardList, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Users,
  TrendingUp,
  Calendar,
  Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { ModernCard } from "@/components/ui/modern-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { WorkOrder } from "@shared/schema";

export default function ThirdPartyDashboard() {
  const { user } = useAuth();
  const theme = useModuleTheme();

  const { data: workOrders = [], isLoading: loadingWorkOrders } = useQuery<WorkOrder[]>({
    queryKey: ['/api/third-party-portal/work-orders'],
    enabled: !!user?.thirdPartyCompanyId,
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
    queryKey: ['/api/third-party-portal/stats'],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const { data: companyInfo } = useQuery<{
    id: string;
    name: string;
    customerName: string;
    customerId: string;
  }>({
    queryKey: ['/api/third-party-portal/company-info'],
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

  const upcomingWorkOrders = workOrders
    .filter(wo => wo.status === 'aberta' || wo.status === 'em_execucao')
    .slice(0, 5);

  if (loadingWorkOrders || loadingStats) {
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
          <h1 className="text-2xl font-bold">Portal de Terceiros</h1>
          <p className="text-muted-foreground">
            {companyInfo?.name} - Cliente: {companyInfo?.customerName}
          </p>
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
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em Execução
            </CardTitle>
            <Clock className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats?.inProgress || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Concluídas
            </CardTitle>
            <CheckCircle className="w-4 h-4 text-chart-2" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-chart-2">{stats?.completed || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Vencidas
            </CardTitle>
            <AlertCircle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.overdue || 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
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
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingWorkOrders.map((wo) => (
                      <TableRow key={wo.id} data-testid={`row-wo-${wo.id}`}>
                        <TableCell className="font-medium">{wo.title}</TableCell>
                        <TableCell>{getPriorityBadge(wo.priority)}</TableCell>
                        <TableCell>
                          {wo.dueDate ? format(new Date(wo.dueDate), "dd/MM/yyyy", { locale: ptBR }) : '-'}
                        </TableCell>
                        <TableCell>{getStatusBadge(wo.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </ModernCard>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Equipe</CardTitle>
              <Users className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Usuários</span>
                  <span className="font-bold">{stats?.usersCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Equipes</span>
                  <span className="font-bold">{stats?.teamsCount || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium">Produtividade</CardTitle>
              <TrendingUp className="w-4 h-4 text-chart-2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taxa de conclusão</span>
                  <span className="font-bold text-chart-2">
                    {stats?.total ? Math.round((stats.completed / stats.total) * 100) : 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">No prazo</span>
                  <span className="font-bold">
                    {stats?.total ? Math.round(((stats.total - stats.overdue) / stats.total) * 100) : 0}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
