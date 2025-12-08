import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useParams, useLocation } from "wouter";
import { useModule } from "@/contexts/ModuleContext";
import { useNetwork } from "@/contexts/NetworkContext";
import { useOfflineStorage } from "@/hooks/use-offline-storage";
import { nanoid } from "nanoid";
import { 
  QrCode, 
  Camera, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Upload,
  ArrowLeft,
  User,
  MapPin,
  FileText,
  WifiOff,
  Wifi,
  ClipboardList
} from "lucide-react";
import { pickMultipleImages, type CapturedPhoto } from "@/lib/camera-utils";
import type { CachedQRPoint, CachedZone } from "@/lib/offline-storage";
import { OfflineExecutionNormalizer } from "@/lib/offline-execution-normalizer";

export default function QrExecution() {
  const { currentModule } = useModule();
  const { code } = useParams<{ code: string }>();
  const [, setLocation] = useLocation();
  const [observations, setObservations] = useState("");
  const [checklistItems, setChecklistItems] = useState<Record<string, any>>({});
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isOnline } = useNetwork();
  const { 
    createOfflineWorkOrder,
    createOfflineChecklistExecution,
    createOfflineAttachment,
    getQRPoint,
    getZone,
    cacheQRPoint,
    cacheZone
  } = useOfflineStorage();

  // Cache-first data
  const [cachedQRData, setCachedQRData] = useState<CachedQRPoint | null>(null);
  const [cachedZone, setCachedZone] = useState<CachedZone | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [cacheLoadAttempted, setCacheLoadAttempted] = useState(false);
  const [normalizedOfflineData, setNormalizedOfflineData] = useState<any>(null);

  // Cache-first: Load from cache if offline or while loading from API
  useEffect(() => {
    if (!code || cacheLoadAttempted) return;

    async function loadFromCache() {
      try {
        console.log(`[QR EXECUTION] Loading QR point from cache: ${code}`);
        const cachedPoint = await getQRPoint(code);
        
        if (cachedPoint) {
          console.log('[QR EXECUTION] ✅ Found in cache:', cachedPoint);
          setCachedQRData(cachedPoint);
          setIsFromCache(true);

          // Load zone from cache
          if (cachedPoint.zoneId) {
            const cachedZ = await getZone(cachedPoint.zoneId);
            if (cachedZ) {
              console.log('[QR EXECUTION] ✅ Found zone in cache:', cachedZ);
              setCachedZone(cachedZ);
            }
          }

          // Normalize offline data using OfflineExecutionNormalizer
          console.log('[QR EXECUTION] Normalizing offline data with scheduled WOs...');
          const normalizer = new OfflineExecutionNormalizer();
          const normalized = await normalizer.normalizeForQRCode(code);
          if (normalized) {
            console.log('[QR EXECUTION] ✅ Normalized offline data:', normalized);
            setNormalizedOfflineData(normalized);
          } else {
            console.log('[QR EXECUTION] ⚠️ Normalizer returned null');
          }
        } else {
          console.log('[QR EXECUTION] ⚠️ Not found in cache');
        }
      } catch (error) {
        console.error('[QR EXECUTION] Cache load error:', error);
      } finally {
        setCacheLoadAttempted(true);
      }
    }

    loadFromCache();
  }, [code, cacheLoadAttempted, getQRPoint, getZone]);

  // Get QR point data and check for scheduled activities (only when online)
  const { data: qrData, isLoading, error } = useQuery({
    queryKey: ["/api/qr-execution", code],
    enabled: !!code && isOnline,
  });

  // Get zone details (only when online)
  const { data: zone } = useQuery({
    queryKey: ["/api/zones", (qrData as any)?.point?.zoneId, { module: currentModule }],
    enabled: !!(qrData as any)?.point?.zoneId && isOnline,
  });

  // Get ALL work orders for this zone (available for this operator)
  const { data: zoneWorkOrders } = useQuery({
    queryKey: ["/api/customers", (qrData as any)?.point?.customerId, "work-orders", { zoneId: (qrData as any)?.point?.zoneId, module: currentModule }],
    enabled: !!(qrData as any)?.point?.zoneId && !!(qrData as any)?.point?.customerId && isOnline,
    queryFn: async () => {
      const response = await fetch(
        `/api/customers/${(qrData as any)?.point?.customerId}/work-orders?zoneId=${(qrData as any)?.point?.zoneId}&module=${currentModule}&assignedTo=nao_atribuido`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch zone work orders');
      return response.json();
    }
  });

  // Cache QR point when fetched from API (TanStack Query v5 pattern)
  useEffect(() => {
    if (!isOnline || !qrData || !(qrData as any)?.point) return;

    async function updateCacheFromAPI() {
      const pointData = (qrData as any).point;
      try {
        await cacheQRPoint({
          code: pointData.code,
          pointId: pointData.id,
          name: pointData.name || pointData.code,
          description: pointData.description,
          zoneId: pointData.zoneId,
          customerId: pointData.customerId,
          module: pointData.module,
        });
        console.log('[QR EXECUTION] 💾 Cached QR point from API');
        setIsFromCache(false); // Fresh from server
      } catch (error) {
        console.error('[QR EXECUTION] Failed to cache QR point:', error);
      }
    }

    updateCacheFromAPI();
  }, [isOnline, qrData, cacheQRPoint]);

  // Cache zone when fetched from API
  useEffect(() => {
    if (!isOnline || !zone || !qrData || !(qrData as any)?.point?.customerId) return;

    async function updateZoneCacheFromAPI() {
      try {
        await cacheZone({
          id: (zone as any).id,
          name: (zone as any).name,
          areaM2: (zone as any).areaM2,
          siteId: (zone as any).siteId,
          customerId: (qrData as any).point.customerId,
          module: (zone as any).module,
        });
        console.log('[QR EXECUTION] 💾 Cached zone from API');
      } catch (error) {
        console.error('[QR EXECUTION] Failed to cache zone:', error);
      }
    }

    updateZoneCacheFromAPI();
  }, [isOnline, zone, qrData, cacheZone]);

  // Mock current user - in real app this would come from auth context
  const currentUser = {
    id: "user-1",
    name: "Carlos Oliveira",
    role: "operador"
  };

  const createWorkOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/work-orders", data);
    },
    onSuccess: () => {
      toast({ title: "Ordem de serviço criada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
    },
    onError: () => {
      toast({ 
        title: "Erro ao criar ordem de serviço", 
        variant: "destructive" 
      });
    },
  });

  const updateWorkOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("PUT", `/api/work-orders/${data.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Ordem de serviço atualizada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/work-orders"] });
      setLocation("/mobile");
    },
    onError: () => {
      toast({ 
        title: "Erro ao atualizar ordem de serviço", 
        variant: "destructive" 
      });
    },
  });

  const handleChecklistChange = (itemId: string, value: any) => {
    setChecklistItems(prev => ({
      ...prev,
      [itemId]: value
    }));
  };

  const handlePhotoUpload = async () => {
    try {
      const newPhotos = await pickMultipleImages({ quality: 80 });
      if (newPhotos.length > 0) {
        setPhotos(prev => [...prev, ...newPhotos]);
      }
    } catch (error) {
      console.error('[QR PHOTO UPLOAD] Error:', error);
      toast({
        title: "Erro ao capturar fotos",
        description: "Não foi possível adicionar as fotos. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleCreateCorrectiveOrder = async () => {
    if (!effectiveZone || !(effectiveQRData as any)?.point) return;

    // Set scheduledDate to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const scheduledDateString = today.toISOString().split('T')[0];

    const workOrderData = {
      companyId: (effectiveQRData as any)?.company?.id || 'company-opus-default',
      customerId: (effectiveQRData as any)?.customer?.id || (effectiveQRData as any)?.point?.customerId,
      zoneId: effectiveZone?.id,
      type: "internal_corrective" as const, // Canonical enum key
      priority: "media" as const,
      title: `Limpeza Corretiva - ${effectiveZone?.name || 'Local'}`,
      description: observations || "Solicitação via QR Code de execução",
      assignedUserId: currentUser.id,
      origin: "QR Execução",
      module: currentModule,
      status: "pendente" as const,
      scheduledDate: scheduledDateString,
    };

    if (isOnline) {
      // Online: Upload photos first, then submit filenames (batch)
      let uploadedFilenames: string[] = [];
      if (photos.length > 0) {
        try {
          const attachments = photos.map((photo) => ({
            base64: photo.dataUrl,
            format: photo.format as 'jpg' | 'jpeg' | 'png' | 'webp' | 'heic' | 'pdf',
          }));
          
          const res = await apiRequest('POST', '/api/attachments/upload-base64-batch', {
            attachments,
          });
          uploadedFilenames = res.filenames;
        } catch (uploadError) {
          console.error('[QR CORRECTIVE] Batch photo upload failed:', uploadError);
          toast({
            title: "Erro ao enviar fotos",
            description: "Não foi possível fazer upload das fotos. Tente novamente.",
            variant: "destructive",
          });
          return;
        }
      }

      createWorkOrderMutation.mutate({
        ...workOrderData,
        attachments: uploadedFilenames.length > 0 ? uploadedFilenames : undefined
      });
    } else {
      // Offline: Save to IndexedDB
      // Validate required fields
      if (!workOrderData.customerId) {
        toast({
          title: "Erro de validação",
          description: "Cliente não identificado. Não é possível criar OS offline.",
          variant: "destructive",
        });
        return;
      }

      try {
        const localId = nanoid();
        await createOfflineWorkOrder({
          localId,
          ...workOrderData,
          syncStatus: 'pending',
          createdOffline: true,
          syncRetryCount: 0,
        });

        // Save photos as attachments if any
        if (photos.length > 0) {
          const photoPromises = photos.map(async (photo, index) => {
            await createOfflineAttachment({
              workOrderId: localId, // Use localId
              type: 'photo',
              url: photo.dataUrl, // Já está em Base64
              fileName: `photo_${Date.now()}_${index}.${photo.format}`,
              mimeType: `image/${photo.format}`,
              uploadedBy: currentUser.id,
              syncStatus: 'pending',
              createdOffline: true,
              syncRetryCount: 0,
            });
          });

          await Promise.all(photoPromises);
        }

        toast({
          title: "📥 OS Salva Offline",
          description: "Será sincronizada automaticamente quando houver conexão",
        });

        // Clear form and redirect
        setObservations("");
        setPhotos([]);
        setTimeout(() => setLocation("/mobile"), 500);
      } catch (error) {
        console.error('[QR EXECUTION] Erro ao salvar OS offline:', error);
        toast({
          title: "Erro ao salvar offline",
          description: "Não foi possível salvar a OS localmente",
          variant: "destructive",
        });
      }
    }
  };

  const handleCompleteWorkOrder = async () => {
    if (!(effectiveQRData as any)?.scheduledWorkOrder) return;
    const workOrder = (effectiveQRData as any).scheduledWorkOrder;

    setIsCompleting(true);

    if (isOnline) {
      // Online: Upload photos first, then submit filenames (batch)
      let uploadedFilenames: string[] = [];
      if (photos.length > 0) {
        try {
          const attachments = photos.map((photo) => ({
            base64: photo.dataUrl,
            format: photo.format as 'jpg' | 'jpeg' | 'png' | 'webp' | 'heic' | 'pdf',
          }));
          
          const res = await apiRequest('POST', '/api/attachments/upload-base64-batch', {
            attachments,
          });
          uploadedFilenames = res.filenames;
        } catch (uploadError) {
          console.error('[QR COMPLETE] Batch photo upload failed:', uploadError);
          toast({
            title: "Erro ao enviar fotos",
            description: "Não foi possível fazer upload das fotos. Tente novamente.",
            variant: "destructive",
          });
          setIsCompleting(false);
          return;
        }
      }

      updateWorkOrderMutation.mutate({
        id: workOrder.id,
        status: "concluida",
        completedAt: new Date().toISOString(),
        checklistData: checklistItems,
        attachments: uploadedFilenames
      });
    } else {
      // Offline: Save checklist execution + attachments
      try {
        const completedAt = new Date().toISOString();

        // 1. Create checklist execution
        await createOfflineChecklistExecution({
          workOrderId: workOrder.id, // serverId
          checklistTemplateId: workOrder.checklistTemplateId || 'manual',
          executedBy: currentUser.id,
          status: 'completed',
          itemsData: checklistItems,
          executedAt: completedAt,
          syncStatus: 'pending',
          createdOffline: true,
          syncRetryCount: 0,
        });

        // 2. Save photos as attachments
        if (photos.length > 0) {
          const photoPromises = photos.map(async (photo, index) => {
            await createOfflineAttachment({
              workOrderId: workOrder.id, // serverId
              type: 'photo',
              url: photo.dataUrl, // Já está em Base64
              fileName: `qr_photo_${Date.now()}_${index}.${photo.format}`,
              mimeType: `image/${photo.format}`,
              uploadedBy: currentUser.id,
              syncStatus: 'pending',
              createdOffline: true,
              syncRetryCount: 0,
            });
          });

          await Promise.all(photoPromises);
        }

        console.log('[QR EXECUTION] OS salva offline, aguardando sync para marcar como concluída');

        toast({
          title: "📥 OS Salva Offline",
          description: "Será sincronizada automaticamente quando houver conexão",
        });

        // Clear form and redirect
        setChecklistItems({});
        setPhotos([]);
        setIsCompleting(false);
        setTimeout(() => setLocation("/mobile"), 500);
      } catch (error) {
        console.error('[QR EXECUTION] Erro ao salvar execução offline:', error);
        toast({
          title: "Erro ao salvar offline",
          description: "Não foi possível salvar a execução localmente",
          variant: "destructive",
        });
        setIsCompleting(false);
      }
    }
  };

  useEffect(() => {
    // Store QR scan data for offline sync
    if (effectiveQRData) {
      localStorage.setItem(`qr-scan-${code}`, JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: currentUser.id,
        qrData: effectiveQRData
      }));
      
      // Store current location context for work order filtering
      const locationContext = {
        zoneId: (effectiveQRData as any).point?.zoneId,
        zoneName: effectiveZone?.name || (effectiveQRData as any)?.point?.name,
        siteName: (effectiveQRData as any).site?.name,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('current-location', JSON.stringify(locationContext));
    }
  }, [effectiveQRData, code, currentUser.id, effectiveZone]);

  // Use normalized offline data (from OfflineExecutionNormalizer) or fallback to basic cache
  const normalizedCacheData = normalizedOfflineData || (cachedQRData ? {
    point: {
      id: cachedQRData.pointId,
      code: cachedQRData.code,
      name: cachedQRData.name,
      description: cachedQRData.description,
      zoneId: cachedQRData.zoneId,
      customerId: cachedQRData.customerId,
      module: cachedQRData.module,
    },
    hasScheduledActivity: false, // Fallback if normalizer failed
    scheduledWorkOrder: null,
    checklist: null,
  } : null);

  const normalizedCacheZone = cachedZone ? {
    id: cachedZone.id,
    name: cachedZone.name,
    areaM2: cachedZone.areaM2,
    siteId: cachedZone.siteId,
    module: cachedZone.module,
    isActive: true,
  } : null;

  // Determine effective data (online API data takes priority over cache)
  const effectiveQRData = qrData || normalizedCacheData;
  const effectiveZone = zone || normalizedCacheZone;
  
  // Update isFromCache flag based on actual data source
  const actuallyFromCache = !isOnline && !!cachedQRData && !qrData;

  // Loading state: show spinner while loading from API OR while attempting cache load
  if (isLoading || (!isOnline && !cacheLoadAttempted)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <QrCode className="w-12 h-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">
            {isOnline ? 'Carregando informações do QR Code...' : 'Carregando do cache local...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state: no data from API and no cache available
  if (!effectiveQRData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            {!isOnline ? (
              <>
                <WifiOff className="w-16 h-16 text-destructive mx-auto" />
                <div>
                  <h1 className="text-xl font-bold text-foreground mb-2">QR Code não disponível offline</h1>
                  <p className="text-muted-foreground mb-4">
                    Este QR Code não foi sincronizado para uso offline.
                  </p>
                  <div className="bg-muted/50 rounded-lg p-3 mb-4 text-left">
                    <p className="text-sm text-muted-foreground">
                      <strong>Dica:</strong> Conecte-se à internet uma vez para sincronizar os pontos QR. Depois você poderá escaneá-los offline.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={() => setLocation("/mobile/work-orders/new")}
                    data-testid="button-create-manual-wo"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Criar Ordem Manual
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setLocation("/mobile")}
                    data-testid="button-back-to-mobile"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar ao App
                  </Button>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
                <h1 className="text-xl font-bold text-foreground mb-2">QR Code Inválido</h1>
                <p className="text-muted-foreground mb-4">
                  Este QR Code não foi encontrado ou não é válido para execução.
                </p>
                <Button onClick={() => setLocation("/mobile")} data-testid="button-back-to-mobile">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao App
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation("/mobile")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div className="text-center">
            <h1 className="text-lg font-bold text-foreground">QR Execução</h1>
            <p className="text-xs text-muted-foreground">#{code}</p>
          </div>
          <div className="w-16"></div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Connection Status Badge */}
        {actuallyFromCache && (
          <div className="bg-muted/50 border border-border rounded-lg p-3 flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              <strong>Modo Offline:</strong> Usando dados em cache. Funcionalidades limitadas.
            </p>
          </div>
        )}

        {/* Location Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 text-primary mt-1" />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground">{effectiveZone?.name || (effectiveQRData as any)?.point?.name}</h2>
                <p className="text-sm text-muted-foreground">{(effectiveQRData as any)?.point?.description}</p>
                {effectiveZone?.areaM2 && (
                  <p className="text-xs text-muted-foreground mt-1">Área: {effectiveZone?.areaM2}m²</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operator Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <User className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">{currentUser.name}</p>
                <p className="text-xs text-muted-foreground">Operador • {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scheduled Activity or Corrective Option */}
        {(effectiveQRData as any).hasScheduledActivity && (effectiveQRData as any).scheduledWorkOrder ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-chart-2" />
                <span>Atividade Programada</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-chart-2/5 border border-chart-2/20 rounded-lg p-3">
                <h3 className="font-medium text-foreground mb-1">{(effectiveQRData as any).scheduledWorkOrder.title}</h3>
                <p className="text-sm text-muted-foreground">{(effectiveQRData as any).scheduledWorkOrder.description}</p>
                <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>SLA: {(effectiveQRData as any).scheduledWorkOrder.slaCompleteMinutes || 60} min</span>
                  </span>
                  <Badge className="bg-chart-4/10 text-chart-4">
                    {(effectiveQRData as any).scheduledWorkOrder.priority || 'Média'}
                  </Badge>
                </div>
              </div>

              {/* Checklist */}
              {(effectiveQRData as any).checklist && (
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Checklist</h4>
                  {(effectiveQRData as any).checklist.map((item: any, index: number) => (
                    <div key={index} className="flex items-center space-x-3 p-3 border border-border rounded-lg">
                      <Checkbox 
                        checked={checklistItems[item.id] || false}
                        onCheckedChange={(checked) => handleChecklistChange(item.id, checked)}
                        data-testid={`checkbox-${item.id}`}
                      />
                      <span className="flex-1 text-sm text-foreground">{item.label}</span>
                      {item.required && (
                        <span className="text-xs text-destructive">*</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Photo Upload */}
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-6"
                onClick={handlePhotoUpload}
                disabled={isCompleting}
                data-testid="button-upload-photos"
              >
                <div className="text-center">
                  <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Anexar fotos</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {photos.length > 0 ? `${photos.length} foto(s) selecionada(s)` : "Toque para adicionar fotos"}
                  </p>
                </div>
              </Button>

              {/* Complete Button */}
              <Button 
                onClick={handleCompleteWorkOrder}
                disabled={updateWorkOrderMutation.isPending || isCompleting}
                className="w-full h-12"
                data-testid="button-complete-work-order"
              >
                {isCompleting ? (
                  "Concluindo..."
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Concluir Atividade
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Show available work orders for this zone */}
            {zoneWorkOrders && (zoneWorkOrders as any).length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <ClipboardList className="w-5 h-5 text-primary" />
                    <span>Ordens Disponíveis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(zoneWorkOrders as any).map((wo: any) => (
                    <div key={wo.id} className="border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50" onClick={() => {
                      localStorage.setItem('selected-work-order', JSON.stringify(wo));
                      setLocation(`/mobile/work-orders/${wo.id}`);
                    }}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-foreground">#{wo.number} - {wo.title}</h4>
                        <Badge className={wo.priority === 'Alta' ? 'bg-destructive' : 'bg-chart-3'}>{wo.priority}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{wo.description}</p>
                      <p className="text-xs text-muted-foreground">Status: {wo.status}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              // No work orders for this zone - show corrective option
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5 text-chart-4" />
                    <span>Nenhuma Ordem Disponível</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Não há ordens de serviço disponíveis para este local no momento. Você pode abrir uma ordem corretiva se necessário.
                  </p>

                  {/* Observations for corrective */}
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Motivo da Limpeza Corretiva
                    </label>
                    <Textarea
                      placeholder="Descreva o que foi observado que requer limpeza..."
                      value={observations}
                      onChange={(e) => setObservations(e.target.value)}
                      className="min-h-[120px] max-h-[200px] overflow-y-auto resize-none"
                      data-testid="textarea-corrective-reason"
                    />
                  </div>

                  {/* Photo Upload for corrective */}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-auto py-6"
                    onClick={handlePhotoUpload}
                    disabled={createWorkOrderMutation.isPending}
                    data-testid="button-upload-corrective-photos"
                  >
                    <div className="text-center">
                      <Camera className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Anexar fotos (opcional)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {photos.length > 0 ? `${photos.length} foto(s) selecionada(s)` : "Evidências da necessidade de limpeza"}
                      </p>
                    </div>
                  </Button>

                  {/* Create Corrective Button */}
                  <Button 
                    onClick={handleCreateCorrectiveOrder}
                    disabled={!observations.trim() || createWorkOrderMutation.isPending}
                    className="w-full h-12"
                    variant="outline"
                    data-testid="button-create-corrective"
                  >
                    {createWorkOrderMutation.isPending ? (
                      "Criando..."
                    ) : (
                      <>
                        <FileText className="w-4 h-4 mr-2" />
                        Abrir OS Corretiva
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline"
            onClick={() => setLocation("/mobile")}
            data-testid="button-back-to-app"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao App
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => {
              // In real app, would open QR scanner
              toast({ title: "Scanner QR aberto" });
            }}
            data-testid="button-scan-another"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Escanear Outro
          </Button>
        </div>
      </div>
    </div>
  );
}
