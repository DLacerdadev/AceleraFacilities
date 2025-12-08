import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MapPin, Building2, Clock, CheckCircle, AlertCircle, Calendar, User, QrCode, Flag, PlayCircle, PauseCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

// Get base URL for API requests (absolute URL for APK, relative for web)
const getBaseUrl = (): string => {
  if (Capacitor.isNativePlatform()) {
    // URL de produção: https://facilities.grupoopus.com
    return import.meta.env.VITE_API_BASE_URL || 'https://facilities.grupoopus.com';
  }
  return '';
};

export default function MobileWorkOrderDetails() {
  const [, params] = useRoute("/mobile/work-order-details/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [comments, setComments] = useState<any[]>([]);
  const [isResuming, setIsResuming] = useState(false);

  useEffect(() => {
    if (params?.id) {
      loadWorkOrder(params.id);
    }
  }, [params?.id]);

  const loadWorkOrder = async (id: string) => {
    setIsLoading(true);
    try {
      const baseUrl = getBaseUrl();
      const response = await fetch(`${baseUrl}/api/work-orders/${id}`);
      if (!response.ok) throw new Error('Work order não encontrada');
      const data = await response.json();
      setWorkOrder(data);

      // Buscar comentários para histórico
      try {
        const commentsResponse = await fetch(`${baseUrl}/api/work-orders/${id}/comments`);
        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          setComments(commentsData);
        }
      } catch (err) {
        console.error('Erro ao buscar comentários:', err);
      }
    } catch (error) {
      console.error('Erro ao carregar work order:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a ordem de serviço.",
        variant: "destructive",
      });
      setLocation('/mobile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResumeExecution = async () => {
    if (!workOrder) return;
    
    setIsResuming(true);
    try {
      const authStr = localStorage.getItem('acelera_auth');
      const token = localStorage.getItem('acelera_token');
      
      if (!authStr || !token) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado. Faça login novamente.",
          variant: "destructive",
        });
        return;
      }

      const authData = JSON.parse(authStr);
      const user = authData.user;

      console.log('Tentando retomar OS com token:', token ? 'Token presente' : 'Token ausente');

      const baseUrl = getBaseUrl();

      // Retomar execução - mudar status para em_execucao
      const response = await fetch(`${baseUrl}/api/work-orders/${workOrder.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'em_execucao',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
        console.error('Erro na resposta:', response.status, errorData);
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      }

      // Criar comentário de retomada
      await fetch(`${baseUrl}/api/work-orders/${workOrder.id}/comments`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user?.id,
          comment: `▶️ ${user?.name || 'Operador'} retomou a execução da OS`,
        }),
      });

      toast({
        title: "✅ Execução Retomada",
        description: "A ordem de serviço foi retomada com sucesso.",
      });

      // Redirecionar para página de execução
      setTimeout(() => {
        setLocation(`/mobile/work-order/${workOrder.id}`);
      }, 1000);
    } catch (error) {
      console.error('Erro ao retomar OS:', error);
      toast({
        title: "Erro",
        description: "Não foi possível retomar a ordem de serviço.",
        variant: "destructive",
      });
    } finally {
      setIsResuming(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open': return 'Disponível';
      case 'in_progress': return 'Em Andamento';
      case 'completed': return 'Concluída';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Média';
      case 'low': return 'Baixa';
      default: return priority;
    }
  };

  // Formata DATE (scheduledDate, dueDate) - apenas data, sem hora
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
    return dateString;
  };

  // Formata TIMESTAMP (createdAt, completedAt, startedAt) - data e hora
  const formatDateTime = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">Ordem de serviço não encontrada</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 shadow-lg">
        <div className="flex items-center mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setLocation('/mobile')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-bold ml-4">Detalhes da OS</h1>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Work Order Info */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-xl">{workOrder.title}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-semibold">OS #{workOrder.number}</span>
                </div>
              </div>
              <Badge className={`${getStatusColor(workOrder.status)} text-white`}>
                {getStatusLabel(workOrder.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Description */}
            {workOrder.description && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Descrição:</p>
                <p className="text-sm text-gray-600">{workOrder.description}</p>
              </div>
            )}

            {/* Location */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Building2 className="w-4 h-4" />
              <span>{workOrder.site?.name || 'Local não especificado'}</span>
            </div>

            {workOrder.zone && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4" />
                <span>{workOrder.zone.name}</span>
              </div>
            )}

            {/* Priority */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Prioridade:</span>
              <Badge className={`${getPriorityColor(workOrder.priority)} text-white`}>
                {getPriorityLabel(workOrder.priority)}
              </Badge>
            </div>

            {/* Dates */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Criada em:</span>
                <span className="text-gray-600">{formatDateTime(workOrder.createdAt)}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Prazo:</span>
                <span className="text-gray-600">{formatDate(workOrder.dueDate)}</span>
              </div>

              {workOrder.completedAt && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-gray-700">Concluída em:</span>
                  <span className="text-gray-600">{formatDateTime(workOrder.completedAt)}</span>
                </div>
              )}
            </div>

            {/* Operator */}
            {workOrder.assignedOperator && (
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-gray-700">Operador:</span>
                <span className="text-gray-600">{workOrder.assignedOperator.name}</span>
              </div>
            )}

            {/* Type */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-700">Tipo:</span>
              <span className="text-gray-600 capitalize">{workOrder.type.replace('_', ' ')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Histórico da Ordem */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-blue-900">
              <Clock className="w-5 h-5" />
              Histórico da Ordem
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Abertura da OS */}
            <div className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <Flag className="w-4 h-4 text-white" />
                </div>
                {comments.length > 0 && <div className="w-0.5 h-full bg-blue-300 mt-1"></div>}
              </div>
              <div className={`flex-1 ${comments.length > 0 ? 'pb-4' : ''}`}>
                <p className="font-semibold text-slate-900">OS Criada</p>
                <p className="text-sm text-slate-600">
                  {formatDateTime(workOrder.createdAt)}
                </p>
              </div>
            </div>

            {/* Histórico de comentários (mudanças de status) */}
            {comments.map((comment, index) => {
              const isLastItem = index === comments.length - 1;
              let icon = <PlayCircle className="w-4 h-4 text-white" />;
              let bgColor = "bg-green-500";
              
              if (comment.comment.includes('pausou')) {
                icon = <PauseCircle className="w-4 h-4 text-white" />;
                bgColor = "bg-orange-500";
              } else if (comment.comment.includes('retomou') || comment.comment.includes('iniciou')) {
                icon = <PlayCircle className="w-4 h-4 text-white" />;
                bgColor = "bg-blue-500";
              } else if (comment.comment.includes('finalizou') || comment.comment.includes('concluiu')) {
                icon = <CheckCircle className="w-4 h-4 text-white" />;
                bgColor = "bg-green-600";
              }

              return (
                <div key={comment.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full ${bgColor} flex items-center justify-center`}>
                      {icon}
                    </div>
                    {!isLastItem && <div className="w-0.5 h-full bg-blue-300 mt-1"></div>}
                  </div>
                  <div className={`flex-1 ${!isLastItem ? 'pb-4' : ''}`}>
                    <p className="font-semibold text-slate-900">{comment.comment.split('\n')[0]}</p>
                    <p className="text-sm text-slate-600">
                      {formatDateTime(comment.createdAt)}
                    </p>
                    {comment.user?.name && (
                      <p className="text-xs text-slate-500 mt-1">Por: {comment.user.name}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Resume Button - Só aparece se O.S está pausada */}
        {workOrder.status === 'pausada' && (
          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <Button 
                onClick={handleResumeExecution}
                disabled={isResuming}
                data-testid="button-resume-execution"
                className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 h-16 text-lg font-semibold disabled:opacity-50"
                size="lg"
              >
                <div className="flex items-center space-x-3 justify-center">
                  <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
                    <PlayCircle className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <div className="text-lg font-bold">
                      {isResuming ? 'Retomando...' : '▶️ Retomar Execução'}
                    </div>
                    <div className="text-sm opacity-90">Continuar com a OS pausada</div>
                  </div>
                </div>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* QR Scanner Button */}
        <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <Button 
              onClick={() => setLocation('/mobile/qr-scanner')}
              data-testid="button-qr-scanner"
              className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30 h-16 text-lg font-semibold"
              size="lg"
            >
              <div className="flex items-center space-x-3 justify-center">
                <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
                  <QrCode className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="text-lg font-bold">Escanear QR Code</div>
                  <div className="text-sm opacity-90">Iniciar execução da ordem</div>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
