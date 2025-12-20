import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Target, 
  Loader2,
  Info
} from "lucide-react";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { useAuth } from "@/hooks/useAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OperationalScope {
  id: string;
  name: string;
  moduleId: string;
  description: string | null;
  customerId: string;
  status: string;
  slaHours: number | null;
  slaWarningPercent: number | null;
  slaCriticalPercent: number | null;
}

export default function ThirdPartyOperationalScopes() {
  const { user } = useAuth();
  const theme = useModuleTheme();

  const { data: scopes = [], isLoading: loadingScopes } = useQuery<OperationalScope[]>({
    queryKey: ['/api/third-party-portal/operational-scopes'],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const getModuleName = (moduleId: string) => {
    switch (moduleId) {
      case 'clean': return 'Limpeza';
      case 'maintenance': return 'Manutenção';
      default: return moduleId;
    }
  };

  const getModuleBadgeClass = (moduleId: string) => {
    switch (moduleId) {
      case 'clean': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'maintenance': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  if (loadingScopes) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Escopos Operacionais</h1>
          <p className="text-muted-foreground">
            Visualize os escopos de trabalho atribuídos à sua empresa
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Escopos Atribuídos pelo Cliente</AlertTitle>
        <AlertDescription>
          Os escopos operacionais são definidos pelo cliente e atribuídos à sua empresa. 
          Você pode utilizar estes escopos para organizar suas equipes e ordens de serviço.
        </AlertDescription>
      </Alert>

      {scopes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum escopo atribuído</h3>
            <p className="text-muted-foreground text-center max-w-md">
              O cliente ainda não atribuiu escopos operacionais para sua empresa.
              Entre em contato com o cliente para solicitar a atribuição de escopos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" style={theme.styles.color} />
              Escopos Ativos ({scopes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>SLA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scopes.map((scope) => (
                  <TableRow key={scope.id} data-testid={`row-scope-${scope.id}`}>
                    <TableCell className="font-medium">{scope.name}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="secondary" 
                        className={getModuleBadgeClass(scope.moduleId)}
                      >
                        {getModuleName(scope.moduleId)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-xs truncate">
                      {scope.description || '-'}
                    </TableCell>
                    <TableCell>
                      {scope.slaHours ? (
                        <span className="text-sm">
                          {scope.slaHours}h
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
