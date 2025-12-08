import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle, MapPin, Building2, AlertCircle, Camera, X, PauseCircle, Image as ImageIcon, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNetwork } from "@/contexts/NetworkContext";
import { useOfflineStorage } from "@/hooks/use-offline-storage";
import { nanoid } from "nanoid";
import { pickMultipleImages, promptForPicture, type CapturedPhoto } from "@/lib/camera-utils";
import { apiRequest } from "@/lib/queryClient";
import { Capacitor } from "@capacitor/core";

// Get base URL for API requests (absolute URL for APK, relative for web)
const getBaseUrl = (): string => {
  if (Capacitor.isNativePlatform()) {
    // URL de produção: https://facilities.grupoopus.com
    return import.meta.env.VITE_API_BASE_URL || 'https://facilities.grupoopus.com';
  }
  return '';
};

// Helper function to add JWT token to fetch requests
const authenticatedFetch = (url: string, options: RequestInit = {}): Promise<Response> => {
  const token = localStorage.getItem("acelera_token");
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  const fullUrl = getBaseUrl() + url;
  console.log('[MOBILE WO EXECUTE] Fetching:', fullUrl);
  
  return fetch(fullUrl, {
    ...options,
    headers,
  });
};

export default function MobileWorkOrderExecute() {
  const [, params] = useRoute("/mobile/work-order/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isOnline } = useNetwork();
  const { 
    createOfflineChecklistExecution,
    createOfflineAttachment 
  } = useOfflineStorage();
  
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState("");
  const [pausePhotos, setPausePhotos] = useState<CapturedPhoto[]>([]);
  const [isPausing, setIsPausing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // Carregar usuário do localStorage
    const authStr = localStorage.getItem('acelera_auth');
    if (authStr) {
      const authData = JSON.parse(authStr);
      setCurrentUser(authData.user);
    }
    
    if (params?.id) {
      loadWorkOrder(params.id);
    }
  }, [params?.id]);

  const loadWorkOrder = async (id: string) => {
    setIsLoading(true);
    try {
      // Buscar work order
      console.log('[MOBILE] Loading work order:', id);
      const woResponse = await authenticatedFetch(`/api/work-orders/${id}`);
      console.log('[MOBILE] Work order response status:', woResponse.status);
      if (!woResponse.ok) throw new Error('Work order não encontrada');
      const woData = await woResponse.json();
      console.log('[MOBILE] Work order data COMPLETA:', JSON.stringify(woData, null, 2));
      console.log('[MOBILE] workOrder.number:', woData.number);
      console.log('[MOBILE] workOrder.site:', woData.site);
      console.log('[MOBILE] workOrder.zone:', woData.zone);
      
      // Se a OS está aberta, iniciar execução automaticamente
      // ⚠️ NÃO iniciar automaticamente se status = 'pausada' - usuário deve retomar manualmente
      if (woData.status === 'aberta') {
        try {
          const authStr = localStorage.getItem('acelera_auth');
          if (authStr) {
            const authData = JSON.parse(authStr);
            const user = authData.user;
            
            if (user?.id) {
              // Mudar status para em_execucao e registrar início
              const updateResponse = await authenticatedFetch(`/api/work-orders/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  assignedUserId: user.id,
                  status: 'em_execucao',
                  startedAt: new Date().toISOString(),
                }),
              });
              
              if (updateResponse.ok) {
                const updatedWo = await updateResponse.json();
                woData.assignedUserId = updatedWo.assignedUserId;
                woData.status = updatedWo.status;
                woData.startedAt = updatedWo.startedAt;
                
                // Criar comentário de início
                await authenticatedFetch(`/api/work-orders/${id}/comments`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    userId: user.id,
                    comment: `⏯️ ${user.name} iniciou a execução da OS`,
                  }),
                });
              }
            }
          }
        } catch (assignError) {
          console.error('Erro ao iniciar OS:', assignError);
        }
      }
      
      setWorkOrder(woData);

      // Buscar checklist - rota diferente para Clean vs Maintenance
      let checklistData = null;
      
      if (woData.module === 'maintenance' && woData.maintenanceChecklistTemplateId) {
        // Para manutenção: buscar do maintenance_checklist_templates
        const checklistResponse = await authenticatedFetch(`/api/maintenance-checklist-templates/${woData.maintenanceChecklistTemplateId}`);
        if (checklistResponse.ok) {
          checklistData = await checklistResponse.json();
        }
      } else if (woData.module === 'clean' && woData.checklistTemplateId) {
        // Para clean: buscar o checklist template selecionado na criação da OS
        const checklistResponse = await authenticatedFetch(`/api/checklist-templates/${woData.checklistTemplateId}`);
        if (checklistResponse.ok) {
          checklistData = await checklistResponse.json();
        }
      } else if (woData.module === 'clean' && woData.serviceId) {
        // Fallback: buscar do service (caso OS antiga sem checklistTemplateId)
        const checklistResponse = await authenticatedFetch(`/api/services/${woData.serviceId}/checklist`);
        if (checklistResponse.ok) {
          checklistData = await checklistResponse.json();
        }
      }
      
      if (checklistData) {
        setChecklist(checklistData);
        
        // Inicializar respostas
        const initialAnswers: Record<string, any> = {};
        if (checklistData?.items) {
          checklistData.items.forEach((item: any) => {
            if (item.type === 'boolean') {
              initialAnswers[item.id] = undefined;
            } else if (item.type === 'photo') {
              initialAnswers[item.id] = [];
            } else if (item.type === 'checkbox') {
              initialAnswers[item.id] = [];
            } else {
              initialAnswers[item.id] = '';
            }
          });
        }
        setAnswers(initialAnswers);
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


  const handlePhotoUpload = async (itemId: string) => {
    // Buscar o item do checklist para verificar o limite máximo
    const checklistItem = checklist?.items?.find((item: any) => item.id === itemId);
    const maxPhotos = checklistItem?.validation?.photoMaxCount;
    
    const currentPhotos = answers[itemId] || [];
    const currentCount = currentPhotos.length;
    
    // Calcular quantas fotos ainda podem ser adicionadas
    const remainingSlots = maxPhotos ? maxPhotos - currentCount : Infinity;
    
    if (remainingSlots <= 0) {
      toast({
        title: "Limite atingido",
        description: `Você já atingiu o limite máximo de ${maxPhotos} foto(s).`,
        variant: "destructive",
      });
      return;
    }
    
    try {
      // Usar camera utils nativo/fallback automaticamente
      const photos = await pickMultipleImages({ 
        limit: remainingSlots,
        quality: 80 
      });
      
      if (photos.length === 0) return; // Cancelamento
      
      // Se recebeu mais fotos que o permitido, limitar
      const photosToAdd = photos.slice(0, remainingSlots);
      
      if (photos.length > remainingSlots) {
        toast({
          title: "Limite máximo",
          description: `Apenas ${remainingSlots} foto(s) foram adicionadas para respeitar o limite de ${maxPhotos} foto(s).`,
        });
      }
      
      setAnswers(prev => ({
        ...prev,
        [itemId]: [...currentPhotos, ...photosToAdd]
      }));
    } catch (error) {
      console.error('[PHOTO UPLOAD] Error:', error);
      toast({
        title: "Erro ao capturar fotos",
        description: "Não foi possível adicionar as fotos. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const removePhoto = (itemId: string, index: number) => {
    const currentPhotos = answers[itemId] || [];
    const updatedPhotos = currentPhotos.filter((_: any, i: number) => i !== index);
    
    setAnswers(prev => ({
      ...prev,
      [itemId]: updatedPhotos
    }));
  };

  const validateChecklist = () => {
    if (!checklist?.items) return true;
    
    for (const item of checklist.items) {
      if (item.required) {
        const answer = answers[item.id];
        
        if (item.type === 'boolean' && answer === undefined) {
          return false;
        }
        if (item.type === 'text' && (!answer || answer.trim() === '')) {
          return false;
        }
        if (item.type === 'photo') {
          const photos = answer || [];
          const minCount = item.validation?.photoMinCount || 0;
          if (photos.length < minCount) {
            return false;
          }
        }
        if (item.type === 'checkbox') {
          const selected = answer || [];
          const minChecked = item.validation?.minChecked || 0;
          if (selected.length < minChecked) {
            return false;
          }
        }
      }
      
      // Validar limites mesmo se não for required
      if (item.type === 'checkbox' && answers[item.id]) {
        const selected = answers[item.id] || [];
        const minChecked = item.validation?.minChecked || 0;
        const maxChecked = item.validation?.maxChecked;
        
        if (selected.length < minChecked || (maxChecked && selected.length > maxChecked)) {
          return false;
        }
      }
    }
    return true;
  };

  const convertPhotosToBase64 = async (photos: CapturedPhoto[]): Promise<string[]> => {
    // Fotos já estão em Base64 com dataUrl, apenas retornar
    return photos.map(photo => photo.dataUrl);
  };

  const handlePausePhotoUpload = async () => {
    try {
      const remainingSlots = 5 - pausePhotos.length;
      if (remainingSlots <= 0) {
        toast({
          title: "Limite de fotos atingido",
          description: "Você já selecionou o máximo de 5 fotos.",
          variant: "destructive",
        });
        return;
      }

      const photos = await pickMultipleImages({ limit: remainingSlots });
      if (photos && photos.length > 0) {
        const newPhotos = [...pausePhotos, ...photos].slice(0, 5);
        setPausePhotos(newPhotos);
      }
    } catch (error) {
      console.error('[PAUSE PHOTO] Error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Erro ao capturar fotos';
      
      if (!errorMsg.includes('cancelled') && !errorMsg.includes('cancelled photo')) {
        toast({
          title: "Erro ao capturar fotos",
          description: errorMsg || "Não foi possível capturar ou selecionar as fotos.",
          variant: "destructive",
        });
      }
    }
  };

  const handlePause = async () => {
    if (!pauseReason.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Por favor, informe o motivo da pausa.",
        variant: "destructive",
      });
      return;
    }

    setIsPausing(true);
    try {
      // Fotos de pausa já estão em Base64
      const photosBase64 = pausePhotos.length > 0 ? pausePhotos.map(p => p.dataUrl) : null;

      // Atualizar status da OS para pausada
      const response = await authenticatedFetch(`/api/work-orders/${workOrder.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'pausada',
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao pausar ordem de serviço');
      }

      // Criar comentário com motivo e fotos
      await authenticatedFetch(`/api/work-orders/${workOrder.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          comment: `⏸️ ${currentUser?.name || 'Operador'} pausou a OS\n\n📝 Motivo: ${pauseReason}`,
          attachments: photosBase64,
        }),
      });

      toast({
        title: "✅ OS Pausada",
        description: "A ordem de serviço foi pausada com sucesso.",
      });

      // Voltar para o scanner
      setTimeout(() => {
        setLocation('/mobile/qr-scanner');
      }, 1500);
    } catch (error) {
      console.error('Erro ao pausar OS:', error);
      toast({
        title: "Erro",
        description: "Não foi possível pausar a ordem de serviço.",
        variant: "destructive",
      });
    } finally {
      setIsPausing(false);
      setIsPauseModalOpen(false);
      setPauseReason("");
      setPausePhotos([]);
    }
  };

  const handleFinish = async () => {
    if (!validateChecklist()) {
      toast({
        title: "Checklist incompleto",
        description: "Preencha todos os itens obrigatórios antes de finalizar.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Converter fotos para base64 para salvar
      const checklistAnswers: Record<string, any> = {};
      const allPhotos: string[] = [];
      
      if (checklist?.items) {
        for (const item of checklist.items) {
          if (item.type === 'photo' && answers[item.id]?.length > 0) {
            // Converter fotos para base64
            const base64Photos = await convertPhotosToBase64(answers[item.id]);
            checklistAnswers[item.id] = {
              type: 'photo',
              photos: base64Photos,
              count: base64Photos.length
            };
            allPhotos.push(...base64Photos);
          } else {
            // Outros tipos de resposta
            checklistAnswers[item.id] = answers[item.id];
          }
        }
      }

      const completedAt = new Date().toISOString();

      // ============================================================================
      // MODO ONLINE: Enviar diretamente para o servidor
      // ============================================================================
      if (isOnline) {
        console.log('[FINISH ONLINE] Enviando PATCH para finalizar OS:', workOrder.id);
        console.log('[FINISH ONLINE] Dados do checklist:', checklistAnswers);
        
        const response = await authenticatedFetch(`/api/work-orders/${workOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'concluida',
            completedAt,
            checklistData: checklist ? checklistAnswers : null,
          }),
        });

        console.log('[FINISH ONLINE] Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[FINISH ONLINE] Erro na resposta:', errorText);
          throw new Error(`Erro ao finalizar: ${response.status} - ${errorText}`);
        }

        // Criar comentário automático com resumo da finalização e fotos
        try {
          let checklistSummary = '✅ OS Finalizada!\n\n📋 Checklist:\n';
          
          if (checklist?.items) {
            for (const item of checklist.items) {
              if (item.type === 'photo' && checklistAnswers[item.id]?.photos) {
                checklistSummary += `• ${item.label}: ${checklistAnswers[item.id].count} foto(s) anexada(s)\n`;
              } else if (item.type === 'checkbox') {
                const selectedOptions = checklistAnswers[item.id] || [];
                if (selectedOptions.length > 0) {
                  checklistSummary += `✓ ${item.label}: ${selectedOptions.join(', ')}\n`;
                } else {
                  checklistSummary += `○ ${item.label}: Nenhuma opção selecionada\n`;
                }
              } else if (item.type === 'boolean') {
                const answer = checklistAnswers[item.id];
                const symbol = answer === true ? '✓' : answer === false ? '✗' : '○';
                const text = answer === true ? 'SIM' : answer === false ? 'NÃO' : 'Não respondido';
                checklistSummary += `${symbol} ${item.label}: ${text}\n`;
              } else if (item.type === 'text' && checklistAnswers[item.id]) {
                checklistSummary += `• ${item.label}: ${checklistAnswers[item.id]}\n`;
              }
            }
          }

          // Upload photos first, get filenames (batch)
          let uploadedFilenames: string[] = [];
          if (allPhotos.length > 0) {
            try {
              const attachments = allPhotos.map((photoDataUrl: string) => {
                const formatMatch = photoDataUrl.match(/^data:image\/(\w+);base64,/);
                const format = formatMatch ? formatMatch[1] as 'jpg' | 'jpeg' | 'png' | 'webp' | 'heic' | 'pdf' : 'jpeg';
                return { base64: photoDataUrl, format };
              });

              const res = await apiRequest('POST', '/api/attachments/upload-base64-batch', {
                attachments,
              });
              const data = await res.json();
              uploadedFilenames = data.filenames;
              console.log('[FINISH ONLINE] Batch photos uploaded:', uploadedFilenames);
            } catch (uploadError) {
              console.error('[FINISH ONLINE] Batch photo upload failed:', uploadError);
              // Continue without photos if upload fails
            }
          }

          await authenticatedFetch(`/api/work-orders/${workOrder.id}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser?.id,
              comment: checklistSummary,
              attachments: uploadedFilenames,
            }),
          });
        } catch (commentError) {
          console.error('[FINISH ONLINE] Erro ao criar comentário:', commentError);
          // Não bloquear a finalização se comentário falhar
        }

        toast({
          title: "✅ OS Finalizada!",
          description: `OS #${workOrder.number} foi concluída com sucesso.`,
        });
      } 
      // ============================================================================
      // MODO OFFLINE: Salvar localmente para sincronização posterior
      // ============================================================================
      else {
        console.log('[FINISH OFFLINE] Salvando execução localmente');
        
        // 1. Criar checklist execution offline
        const executionLocalId = await createOfflineChecklistExecution({
          workOrderId: workOrder.id, // Pode ser serverId ou localId
          checklistTemplateId: checklist?.id || 'manual',
          executedBy: currentUser?.id,
          status: 'completed',
          itemsData: checklistAnswers, // Salvar todas as respostas
          executedAt: completedAt,
          syncStatus: 'pending',
          createdOffline: true,
          syncRetryCount: 0,
        });

        console.log('[FINISH OFFLINE] Checklist execution salva:', executionLocalId);

        // 2. Criar attachments separados para cada foto
        for (let i = 0; i < allPhotos.length; i++) {
          const photo = allPhotos[i];
          await createOfflineAttachment({
            workOrderId: workOrder.id,
            type: 'photo',
            url: photo, // base64 data URL
            fileName: `checklist_photo_${Date.now()}_${i}.jpg`,
            mimeType: 'image/jpeg',
            uploadedBy: currentUser?.id,
            syncStatus: 'pending',
            createdOffline: true,
            syncRetryCount: 0,
          });
        }

        console.log('[FINISH OFFLINE] Attachments salvos:', allPhotos.length);

        // 3. Marcar como concluída localmente (apenas log - sync handle status update)
        console.log('[FINISH OFFLINE] Execução salva - sync vai atualizar status da OS no servidor');

        toast({
          title: "📥 OS Salva Offline",
          description: `OS #${workOrder.number} será sincronizada automaticamente quando houver conexão.`,
        });
      }

      // Voltar para a página inicial do colaborador
      setTimeout(() => {
        setLocation('/mobile');
      }, 1500);
    } catch (error) {
      console.error('[FINISH] Erro ao finalizar work order:', error);
      console.error('[FINISH] Tipo do erro:', typeof error);
      console.error('[FINISH] Erro message:', error instanceof Error ? error.message : 'Sem mensagem');
      console.error('[FINISH] Erro stack:', error instanceof Error ? error.stack : 'Sem stack');
      
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível finalizar a ordem de serviço.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Carregando ordem de serviço...</p>
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="max-w-md mx-auto mt-8">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ordem não encontrada</h3>
            <Button onClick={() => setLocation('/mobile')} className="mt-4">
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="ghost" 
              onClick={() => setLocation('/mobile/qr-scanner')}
              className="p-2"
              data-testid="button-back"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <div className="flex-1 text-center">
              <h1 className="text-xl font-bold text-slate-900">Executar OS</h1>
              <p className="text-sm text-slate-600">OS #{workOrder.number}</p>
            </div>
            <div className="w-10"></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Informações da OS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalhes da Ordem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-slate-600 mb-1">Título</p>
              <p className="font-semibold text-slate-900">{workOrder.title}</p>
            </div>
            
            {workOrder.description && (
              <div>
                <p className="text-sm text-slate-600 mb-1">Descrição</p>
                <p className="text-slate-700">{workOrder.description}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {workOrder.site?.name && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {workOrder.site.name}
                </Badge>
              )}
              {workOrder.zone?.name && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {workOrder.zone.name}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Seletor de Checklist */}

        {/* Checklist */}
        {checklist && checklist.items && checklist.items.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                Checklist de Execução
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">
                {checklist.description || 'Preencha todos os itens obrigatórios'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {checklist.items.map((item: any, index: number) => (
                <div 
                  key={item.id} 
                  className="p-4 border rounded-lg bg-slate-50"
                  data-testid={`checklist-item-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">
                            {item.label}
                            {item.required && (
                              <span className="text-red-500 ml-1">*</span>
                            )}
                          </p>
                          {item.description && (
                            <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                          )}
                        </div>
                      </div>

                      {item.type === 'boolean' ? (
                        <div className="flex gap-3 mt-2">
                          <Button
                            type="button"
                            variant={answers[item.id] === true ? "default" : "outline"}
                            className={`flex-1 ${
                              answers[item.id] === true 
                                ? 'bg-green-600 hover:bg-green-700' 
                                : 'border-slate-300'
                            }`}
                            onClick={() => setAnswers(prev => ({ ...prev, [item.id]: true }))}
                            data-testid={`button-yes-${item.id}`}
                          >
                            SIM
                          </Button>
                          <Button
                            type="button"
                            variant={answers[item.id] === false ? "default" : "outline"}
                            className={`flex-1 ${
                              answers[item.id] === false 
                                ? 'bg-red-600 hover:bg-red-700' 
                                : 'border-slate-300'
                            }`}
                            onClick={() => setAnswers(prev => ({ ...prev, [item.id]: false }))}
                            data-testid={`button-no-${item.id}`}
                          >
                            NÃO
                          </Button>
                        </div>
                      ) : item.type === 'photo' ? (
                        <div className="mt-2 space-y-3">
                          {/* Info sobre requisitos */}
                          <div className="text-xs text-slate-600 flex items-center gap-2">
                            <Camera className="w-4 h-4" />
                            <span>
                              {item.validation?.photoMinCount && item.validation?.photoMaxCount 
                                ? `Envie entre ${item.validation.photoMinCount} e ${item.validation.photoMaxCount} fotos`
                                : item.validation?.photoMinCount
                                ? `Envie no mínimo ${item.validation.photoMinCount} foto(s)`
                                : item.validation?.photoMaxCount
                                ? `Envie no máximo ${item.validation.photoMaxCount} foto(s)`
                                : 'Envie suas fotos'
                              }
                            </span>
                          </div>

                          {/* Preview das fotos */}
                          {answers[item.id] && answers[item.id].length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                              {answers[item.id].map((photo: CapturedPhoto, photoIndex: number) => (
                                <div key={photoIndex} className="relative aspect-square">
                                  <img 
                                    src={photo.dataUrl} 
                                    alt={`Foto ${photoIndex + 1}`}
                                    className="w-full h-full object-cover rounded-lg border-2 border-slate-200"
                                  />
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                                    onClick={() => removePhoto(item.id, photoIndex)}
                                    data-testid={`button-remove-photo-${item.id}-${photoIndex}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Botão adicionar fotos */}
                          {(!item.validation?.photoMaxCount || 
                            (answers[item.id]?.length || 0) < item.validation.photoMaxCount) && (
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full"
                              onClick={() => handlePhotoUpload(item.id)}
                              disabled={isSubmitting}
                              data-testid={`button-add-photos-${item.id}`}
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Adicionar Fotos
                            </Button>
                          )}

                          {/* Contador */}
                          <p className="text-xs text-center text-slate-500">
                            {answers[item.id]?.length || 0} foto(s) adicionada(s)
                          </p>
                        </div>
                      ) : item.type === 'checkbox' ? (
                        <div className="mt-2 space-y-2">
                          {item.options && item.options.length > 0 ? (
                            item.options.map((option: string, optIdx: number) => (
                              <div key={optIdx} className="flex items-center gap-3 p-3 border rounded-lg bg-white hover:bg-slate-50 transition-colors">
                                <Checkbox
                                  id={`${item.id}-${optIdx}`}
                                  checked={(answers[item.id] || []).includes(option)}
                                  onCheckedChange={(checked) => {
                                    setAnswers(prev => {
                                      const current = prev[item.id] || [];
                                      if (checked) {
                                        // Verificar maxChecked se configurado
                                        if (item.validation?.maxChecked && current.length >= item.validation.maxChecked) {
                                          return prev;
                                        }
                                        return { ...prev, [item.id]: [...current, option] };
                                      } else {
                                        return { ...prev, [item.id]: current.filter((o: string) => o !== option) };
                                      }
                                    });
                                  }}
                                  data-testid={`checkbox-${item.id}-${optIdx}`}
                                />
                                <Label 
                                  htmlFor={`${item.id}-${optIdx}`}
                                  className="flex-1 cursor-pointer text-sm"
                                >
                                  {option}
                                </Label>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-500 italic">Nenhuma opção configurada</p>
                          )}
                          
                          {/* Info de validação */}
                          {(item.validation?.minChecked || item.validation?.maxChecked) && (
                            <p className="text-xs text-slate-600 mt-2">
                              {item.validation?.minChecked && item.validation?.maxChecked
                                ? `Selecione entre ${item.validation.minChecked} e ${item.validation.maxChecked} opções`
                                : item.validation?.minChecked
                                ? `Selecione no mínimo ${item.validation.minChecked} opção(ões)`
                                : `Selecione no máximo ${item.validation.maxChecked} opção(ões)`
                              }
                            </p>
                          )}
                          
                          {/* Contador de selecionados */}
                          <p className="text-xs text-center text-slate-500 mt-1">
                            {(answers[item.id] || []).length} opção(ões) selecionada(s)
                          </p>
                        </div>
                      ) : (
                        <Textarea
                          placeholder="Digite sua resposta..."
                          value={answers[item.id] || ''}
                          onChange={(e) => 
                            setAnswers(prev => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="mt-2"
                          rows={3}
                          data-testid={`textarea-${item.id}`}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-slate-600">
              <CheckCircle className="w-12 h-12 text-slate-400 mx-auto mb-2" />
              <p>Esta ordem não possui checklist</p>
            </CardContent>
          </Card>
        )}

        {/* Botões de Ação */}
        <Card className="sticky bottom-4 shadow-lg">
          <CardContent className="p-4 space-y-3">
            <Button
              onClick={() => setIsPauseModalOpen(true)}
              disabled={isSubmitting || isPausing}
              variant="outline"
              className="w-full border-orange-500 text-orange-600 hover:bg-orange-50 py-6 text-lg font-semibold"
              data-testid="button-pause-wo"
            >
              <PauseCircle className="w-5 h-5 mr-2" />
              Pausar Ordem de Serviço
            </Button>
            
            <Button
              onClick={handleFinish}
              disabled={isSubmitting || isPausing}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg font-semibold"
              data-testid="button-finish-wo"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Finalizar Ordem de Serviço
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Modal de Pausa */}
        <Dialog open={isPauseModalOpen} onOpenChange={setIsPauseModalOpen}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-orange-600" />
                Pausar Ordem de Serviço
              </DialogTitle>
              <DialogDescription>
                Informe o motivo da pausa. Você ou outro operador poderá retomar depois.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-4">
              <div className="space-y-2">
                <Label htmlFor="pause-reason">Motivo da Pausa *</Label>
                <Textarea
                  id="pause-reason"
                  placeholder="Ex: Falta de material, equipamento quebrado, intervalo..."
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  rows={4}
                  data-testid="textarea-pause-reason"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pause-photos">Fotos (opcional)</Label>
                {pausePhotos.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {pausePhotos.map((photo, idx) => (
                        <div key={idx} className="relative">
                          <img 
                            src={photo.dataUrl} 
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 h-6 w-6"
                            onClick={() => setPausePhotos(pausePhotos.filter((_, i) => i !== idx))}
                            data-testid={`button-remove-pause-photo-${idx}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full text-sm"
                      onClick={handlePausePhotoUpload}
                      disabled={pausePhotos.length >= 5}
                      data-testid="button-add-more-photos"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Adicionar mais fotos ({pausePhotos.length}/5)
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handlePausePhotoUpload}
                    data-testid="button-add-pause-photo"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Tirar/Anexar Fotos
                  </Button>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t mt-4 sticky bottom-0 bg-white">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsPauseModalOpen(false);
                  setPauseReason("");
                  setPausePhotos([]);
                }}
                disabled={isPausing}
                className="flex-1"
                data-testid="button-cancel-pause"
              >
                Cancelar
              </Button>
              <Button
                onClick={handlePause}
                disabled={isPausing || !pauseReason.trim()}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                data-testid="button-confirm-pause"
              >
                {isPausing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Pausando...
                  </>
                ) : (
                  "Confirmar Pausa"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
