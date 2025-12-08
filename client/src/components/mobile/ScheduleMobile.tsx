import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Clock, MapPin, Plus, RefreshCw } from "lucide-react";

interface ScheduleMobileProps {
  customerId: string;
}

export default function ScheduleMobile({ customerId }: ScheduleMobileProps) {
  const [frequencyFilter, setFrequencyFilter] = useState("todas");
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { data: activities, isLoading, refetch } = useQuery({
    queryKey: ["/api/customers", customerId, "cleaning-activities"],
    enabled: !!customerId,
  });

  const handleRefresh = () => {
    refetch();
    setLastUpdate(new Date());
  };

  const filteredActivities = (activities as any[])?.filter((activity: any) => {
    return frequencyFilter === "todas" || activity.frequency === frequencyFilter;
  }) || [];

  const totalDiaria = (activities as any[])?.filter((a: any) => a.frequency === 'diaria').length || 0;
  const totalSemanal = (activities as any[])?.filter((a: any) => a.frequency === 'semanal').length || 0;
  const totalMensal = (activities as any[])?.filter((a: any) => a.frequency === 'mensal').length || 0;

  const getFrequencyBadge = (frequency: string, id?: string) => {
    const testId = id ? `badge-frequency-${frequency}-${id}` : `badge-frequency-${frequency}`;
    switch (frequency) {
      case "diaria":
        return <Badge className="bg-blue-500 text-white text-xs" data-testid={testId}>Diária</Badge>;
      case "semanal":
        return <Badge className="bg-green-500 text-white text-xs" data-testid={testId}>Semanal</Badge>;
      case "mensal":
        return <Badge className="bg-purple-500 text-white text-xs" data-testid={testId}>Mensal</Badge>;
      case "turno":
        return <Badge className="bg-orange-500 text-white text-xs" data-testid={testId}>Por Turno</Badge>;
      default:
        return <Badge className="bg-gray-500 text-white text-xs" data-testid={testId}>{frequency}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="animate-pulse space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
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
            <h2 className="text-lg font-semibold">Cronograma</h2>
            <p className="text-sm text-gray-600" data-testid="text-last-update-schedule">
              Atualizado: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh} data-testid="button-refresh-schedule">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button size="sm" className="bg-blue-600" data-testid="button-new-activity" disabled>
              <Plus className="w-4 h-4 mr-2" />
              Nova
            </Button>
          </div>
        </div>

        {/* Filtro */}
        <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
          <SelectTrigger className="w-full" data-testid="select-frequency-filter">
            <SelectValue placeholder="Frequência" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas" data-testid="select-item-frequency-todas">Todas</SelectItem>
            <SelectItem value="diaria" data-testid="select-item-frequency-diaria">Diária</SelectItem>
            <SelectItem value="semanal" data-testid="select-item-frequency-semanal">Semanal</SelectItem>
            <SelectItem value="mensal" data-testid="select-item-frequency-mensal">Mensal</SelectItem>
            <SelectItem value="turno" data-testid="select-item-frequency-turno">Por Turno</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="p-4 grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 border-0 shadow-lg" data-testid="card-stats-diaria">
          <CardContent className="p-3 text-center">
            <Calendar className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-xl font-bold text-white" data-testid="text-count-diaria">{totalDiaria}</p>
            <p className="text-xs text-white/80">Diárias</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 border-0 shadow-lg" data-testid="card-stats-semanal">
          <CardContent className="p-3 text-center">
            <Calendar className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-xl font-bold text-white" data-testid="text-count-semanal">{totalSemanal}</p>
            <p className="text-xs text-white/80">Semanais</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 border-0 shadow-lg" data-testid="card-stats-mensal">
          <CardContent className="p-3 text-center">
            <Calendar className="w-5 h-5 text-white mx-auto mb-1" />
            <p className="text-xl font-bold text-white" data-testid="text-count-mensal">{totalMensal}</p>
            <p className="text-xs text-white/80">Mensais</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-600 mb-3">{filteredActivities.length} atividades programadas</p>
        
        {filteredActivities.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              Nenhuma atividade encontrada
            </CardContent>
          </Card>
        ) : (
          filteredActivities.map((activity: any) => (
            <Card key={activity.id} className="hover:shadow-md transition-shadow" data-testid={`card-activity-${activity.id}`}>
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 mb-1" data-testid={`text-activity-name-${activity.id}`}>
                        {activity.name || 'Sem nome'}
                      </p>
                      {getFrequencyBadge(activity.frequency, activity.id)}
                    </div>
                  </div>

                  {/* Detalhes */}
                  <div className="space-y-2 text-sm">
                    {activity.description && (
                      <p className="text-gray-600" data-testid={`text-activity-description-${activity.id}`}>
                        {activity.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span data-testid={`text-activity-zone-${activity.id}`}>
                        {activity.zoneName || 'Local não especificado'}
                      </span>
                    </div>

                    {activity.time && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span data-testid={`text-activity-time-${activity.id}`}>{activity.time}</span>
                      </div>
                    )}
                  </div>

                  {activity.isActive ? (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs" data-testid={`badge-status-active-${activity.id}`}>Ativo</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 text-xs" data-testid={`badge-status-inactive-${activity.id}`}>Inativo</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
