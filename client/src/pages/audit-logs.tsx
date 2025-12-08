import Header from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  Search, 
  Calendar, 
  Clock, 
  User,
  Activity,
  Filter,
  Download,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";

interface AuditLogsProps {
  companyId: string;
}

export default function AuditLogs({ companyId }: AuditLogsProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState("todas");
  const [userFilter, setUserFilter] = useState("todos");
  const [dateFilter, setDateFilter] = useState("todos");
  
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ["/api/companies", companyId, "audit-logs"],
    enabled: !!companyId,
  });

  const { data: users } = useQuery({
    queryKey: ["/api/companies", companyId, "users"],
    enabled: !!companyId,
  });

  const getActionBadge = (action: string) => {
    switch (action.toLowerCase()) {
      case "create":
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Criação</Badge>;
      case "update":
        return <Badge className="bg-blue-100 text-blue-800"><Info className="w-3 h-3 mr-1" />Atualização</Badge>;
      case "delete":
        return <Badge className="bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1" />Exclusão</Badge>;
      case "login":
        return <Badge className="bg-purple-100 text-purple-800"><User className="w-3 h-3 mr-1" />Login</Badge>;
      case "logout":
        return <Badge className="bg-gray-100 text-gray-800"><User className="w-3 h-3 mr-1" />Logout</Badge>;
      default:
        return <Badge variant="outline"><Activity className="w-3 h-3 mr-1" />{action}</Badge>;
    }
  };

  const getEntityName = (entityType: string, entityId: string) => {
    // Simplified entity name resolution - in real implementation would lookup actual entities
    return `${entityType}#${entityId.slice(0, 8)}`;
  };

  const getUserName = (userId: string) => {
    const user = (users as any[] || []).find((u: any) => u.id === userId);
    return user?.name || 'Usuário não encontrado';
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  const filteredLogs = (auditLogs as any[] || []).filter((log: any) => {
    const matchesSearch = searchTerm === "" || 
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getUserName(log.userId).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAction = actionFilter === "todas" || log.action.toLowerCase() === actionFilter;
    const matchesUser = userFilter === "todos" || log.userId === userFilter;
    
    return matchesSearch && matchesAction && matchesUser;
  });

  return (
    <>
      <Header />
      <main className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Logs de Auditoria</h1>
            <p className="text-muted-foreground mt-2">
              Histórico completo de todas as ações realizadas no sistema
            </p>
          </div>
          <Button variant="outline" data-testid="button-export-logs">
            <Download className="w-4 h-4 mr-2" />
            Exportar Logs
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Pesquisar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar por ação, entidade ou usuário..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                    data-testid="input-search-logs"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Tipo de Ação</label>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger data-testid="select-action-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas as Ações</SelectItem>
                    <SelectItem value="create">Criação</SelectItem>
                    <SelectItem value="update">Atualização</SelectItem>
                    <SelectItem value="delete">Exclusão</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Usuário</label>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger data-testid="select-user-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Usuários</SelectItem>
                    {(users as any[] || []).map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Período</label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger data-testid="select-date-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Períodos</SelectItem>
                    <SelectItem value="hoje">Hoje</SelectItem>
                    <SelectItem value="semana">Última Semana</SelectItem>
                    <SelectItem value="mes">Último Mês</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Logs</p>
                  <p className="text-2xl font-bold text-foreground">
                    {filteredLogs.length}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Criações</p>
                  <p className="text-2xl font-bold text-green-600">
                    {filteredLogs.filter((log: any) => log.action === 'create').length}
                  </p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Atualizações</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {filteredLogs.filter((log: any) => log.action === 'update').length}
                  </p>
                </div>
                <Info className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Exclusões</p>
                  <p className="text-2xl font-bold text-red-600">
                    {filteredLogs.filter((log: any) => log.action === 'delete').length}
                  </p>
                </div>
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs List */}
        <Card>
          <CardHeader>
            <CardTitle>Registro de Atividades</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">Carregando logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum log encontrado</p>
                <p className="text-sm text-muted-foreground mt-2">
                  {searchTerm || actionFilter !== "todas" || userFilter !== "todos" 
                    ? "Tente ajustar os filtros de pesquisa"
                    : "Ações do sistema aparecerão aqui"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log: any) => {
                  const { date, time } = formatTimestamp(log.timestamp);
                  
                  return (
                    <div 
                      key={log.id} 
                      className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            {getActionBadge(log.action)}
                            <span className="text-sm font-medium text-foreground">
                              {log.entityType} • {getEntityName(log.entityType, log.entityId)}
                            </span>
                          </div>
                          
                          {log.details && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {log.details}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-6 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{getUserName(log.userId)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{date}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{time}</span>
                            </div>
                          </div>
                        </div>
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          data-testid={`button-view-log-${log.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}