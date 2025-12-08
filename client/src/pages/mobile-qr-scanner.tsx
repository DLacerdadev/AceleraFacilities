import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Camera, Flashlight, FlashlightOff, RotateCcw, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import QrScanner from "qr-scanner";
import ServiceSelectionModal from "@/components/ServiceSelectionModal";
import ChecklistSelectionModal from "@/components/ChecklistSelectionModal";
import { useModule } from "@/contexts/ModuleContext";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { useOfflineStorage } from "@/hooks/use-offline-storage";
import { Capacitor } from "@capacitor/core";

const COMPANY_ID = "company-opus-default";

// Get API base URL for mobile
function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    // URL de produção: https://facilities.grupoopus.com
    return import.meta.env.VITE_API_BASE_URL || 'https://facilities.grupoopus.com';
  }
  return '';
}

export default function MobileQrScanner() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { currentModule, setModule, canAccessModule } = useModule();
  const { isOnline } = useNetworkStatus();
  const { getQRPoint, getZone, cacheQRPoint, cacheZone } = useOfflineStorage();
  
  // QR Scanner States
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [flashOn, setFlashOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal States
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [resolvedContext, setResolvedContext] = useState<any>(null);
  const [scannedQrCode, setScannedQrCode] = useState<string>("");

  useEffect(() => {
    initializeCamera();
    return () => {
      stopScanner();
    };
  }, []);

  const initializeCamera = async () => {
    try {
      const hasPermission = await QrScanner.hasCamera();
      setHasCamera(hasPermission);
      
      if (hasPermission) {
        const availableCameras = await QrScanner.listCameras();
        setCameras(availableCameras);
        
        const backCamera = availableCameras.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('rear') ||
          camera.label.toLowerCase().includes('environment')
        );
        
        const cameraToUse = backCamera || availableCameras[0];
        if (cameraToUse) {
          setSelectedCameraId(cameraToUse.id);
          await startScanner(cameraToUse.id);
        }
      }
    } catch (error) {
      console.error("Erro ao inicializar câmera:", error);
      setHasCamera(false);
    }
  };

  const startScanner = async (cameraId?: string) => {
    if (!videoRef.current) return;

    try {
      stopScanner();

      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          if (!isProcessing) {
            handleQrCodeDetected(result.data);
          }
        },
        {
          preferredCamera: cameraId || selectedCameraId,
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 1,
          returnDetailedScanResult: true,
        }
      );

      qrScannerRef.current = scanner;
      await scanner.start();
      setIsScanning(true);
    } catch (error) {
      console.error("Erro ao iniciar scanner:", error);
      setHasCamera(false);
      toast({
        title: "Erro no scanner",
        description: "Não foi possível iniciar o scanner QR.",
        variant: "destructive",
      });
    }
  };

  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleQrCodeDetected = async (qrCode: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    stopScanner();
    setScannedQrCode(qrCode);
    
    // Extrair código da URL se necessário
    let extractedCode = qrCode;
    if (qrCode.includes('replit.dev/qr-execution/') || qrCode.includes('/qr-execution/')) {
      const match = qrCode.match(/\/qr-execution\/([^\/\?]+)/);
      if (match) {
        extractedCode = match[1];
      }
    }

    console.log('[QR SCANNER] Processando QR code:', { extractedCode, isOnline });

    try {
      // MODO OFFLINE: Buscar do IndexedDB
      if (!isOnline) {
        console.log('[QR SCANNER OFFLINE] Buscando QR code do cache:', extractedCode);
        
        const cachedPoint = await getQRPoint(extractedCode);
        if (!cachedPoint) {
          toast({
            title: "QR Code não encontrado offline",
            description: "Este QR code não está no cache offline. Conecte-se à internet para sincronizar.",
            variant: "destructive",
          });
          setIsProcessing(false);
          setTimeout(() => startScanner(), 2000);
          return;
        }

        const cachedZone = await getZone(cachedPoint.zoneId);
        
        const resolved = {
          customer: { id: cachedPoint.customerId },
          site: { id: cachedZone?.siteId || '', name: cachedZone?.siteName || 'Local' },
          zone: { id: cachedPoint.zoneId, name: cachedZone?.name || 'Zona' },
          point: { 
            id: cachedPoint.pointId,
            name: cachedPoint.name,
            description: cachedPoint.description,
            code: cachedPoint.code,
            zoneId: cachedPoint.zoneId,
            customerId: cachedPoint.customerId,
            module: cachedPoint.module,
          },
          qrPoint: cachedPoint,
        };

        setResolvedContext(resolved);
        setShowServiceModal(true);
        
        toast({
          title: "✈️ QR Code detectado! (Modo Offline)",
          description: `${resolved.zone.name} - ${resolved.site.name}`,
        });
        return;
      }

      // MODO ONLINE: Buscar da API
      const token = localStorage.getItem("acelera_token");
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      
      const baseUrl = getApiBaseUrl();
      const apiUrl = `${baseUrl}/api/qr-execution/${encodeURIComponent(extractedCode)}`;
      console.log('[QR SCANNER ONLINE] Chamando API:', apiUrl);
      
      const response = await fetch(apiUrl, {
        cache: 'no-store',
        headers
      });
      
      if (response.ok) {
        const executionData = await response.json();
        
        console.log('[QR SCANNER] Dados recebidos:', executionData);
        
        // Adaptar estrutura da nova API para o formato esperado
        // Nova API retorna: { point, zone, hasScheduledActivity, scheduledWorkOrder }
        // Precisamos converter para: { qrPoint, zone, site, customer }
        
        if (!executionData.point || !executionData.zone) {
          throw new Error('QR code com dados incompletos');
        }
        
        // Buscar customerId da zona (via site)
        const zoneResponse = await fetch(`${baseUrl}/api/zones/${executionData.zone.id}`, { headers });
        const fullZone = await zoneResponse.json();
        
        const siteResponse = await fetch(`${baseUrl}/api/sites/${fullZone.siteId}`, { headers });
        const site = await siteResponse.json();
        
        // Montar estrutura compatível com o resto do código
        const resolved = {
          qrPoint: executionData.point,
          zone: executionData.zone,
          site: site,
          customer: { id: site.customerId },
          hasScheduledActivity: executionData.hasScheduledActivity,
          scheduledWorkOrder: executionData.scheduledWorkOrder
        };
        
        // SALVAR NO CACHE para uso offline futuro (MOBILE-ONLY)
        if (Capacitor.isNativePlatform()) {
          if (resolved.qrPoint) {
            await cacheQRPoint({
              code: extractedCode,
              pointId: resolved.qrPoint.id,
              name: resolved.qrPoint.name,
              description: resolved.qrPoint.description,
              zoneId: resolved.zone.id,
              customerId: resolved.customer.id,
              module: resolved.qrPoint.module || 'clean',
            });
          }
          
          if (resolved.zone) {
            await cacheZone({
              id: resolved.zone.id,
              name: resolved.zone.name,
              areaM2: resolved.zone.areaM2,
              siteId: resolved.site.id,
              siteName: resolved.site.name,
              customerId: resolved.customer.id,
              module: resolved.qrPoint?.module || 'clean',
            });
          }
          
          console.log('[QR SCANNER] QR point e zone salvos no cache para uso offline');
        }
        
        // Verificar e trocar módulo automaticamente se necessário
        const qrModule = resolved.qrPoint?.module || 'clean';
        if (qrModule !== currentModule) {
          // Verificar se o usuário tem acesso ao módulo do QR code
          if (canAccessModule(qrModule)) {
            console.log(`[QR SCANNER] Trocando módulo automaticamente de "${currentModule}" para "${qrModule}"`);
            setModule(qrModule);
            toast({
              title: "🔄 Módulo alterado",
              description: `Trocado para ${qrModule === 'clean' ? 'OPUS Clean' : 'OPUS Manutenção'} automaticamente.`,
            });
            // Aguardar um momento para o módulo ser trocado
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            // Usuário não tem acesso ao módulo do QR code
            toast({
              title: "Acesso negado",
              description: `Este QR code é do módulo ${qrModule === 'clean' ? 'OPUS Clean' : 'OPUS Manutenção'}, mas você não tem acesso a ele.`,
              variant: "destructive",
            });
            setIsProcessing(false);
            setTimeout(() => startScanner(), 2000);
            return;
          }
        }
        
        setResolvedContext(resolved);
        setShowServiceModal(true);
        
        // Mostrar mensagem diferente se há serviço agendado
        if (resolved.hasScheduledActivity && resolved.scheduledWorkOrder) {
          toast({
            title: "🎯 Serviço Agendado!",
            description: `${resolved.zone.name} - ${resolved.scheduledWorkOrder.title}`,
          });
        } else {
          toast({
            title: "QR Code detectado!",
            description: `${resolved.zone.name} - ${resolved.site.name}`,
          });
        }
      } else {
        // Tratar erros específicos por status HTTP
        if (response.status === 403) {
          // Acesso negado - mostrar mensagem do servidor
          const errorData = await response.json();
          toast({
            title: "Acesso Negado",
            description: errorData.message || "Você não tem permissão para acessar este QR code.",
            variant: "destructive",
          });
        } else if (response.status === 404) {
          toast({
            title: "QR Code não encontrado",
            description: "O QR code não foi encontrado ou está inativo.",
            variant: "destructive",
          });
        } else if (response.status === 401) {
          toast({
            title: "Não autenticado",
            description: "Faça login novamente para continuar.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "QR Code inválido",
            description: "O QR code não pôde ser processado. Tente novamente.",
            variant: "destructive",
          });
        }
        
        setIsProcessing(false);
        setTimeout(() => startScanner(), 2000);
        return;
      }
    } catch (error) {
      console.error("[QR SCANNER ERROR]", error);
      
      // Tentar obter mensagem de erro mais específica
      let errorMessage = "Erro desconhecido ao processar QR code.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // Se for erro de rede (fetch failed ou internet disconnected)
      const isNetworkError = errorMessage.toLowerCase().includes('fetch') || 
                             errorMessage.toLowerCase().includes('network') ||
                             errorMessage.toLowerCase().includes('failed to fetch') ||
                             errorMessage.toLowerCase().includes('disconnected');
      
      if (isNetworkError) {
        console.log('[QR SCANNER] Erro de rede detectado, tentando cache offline...');
        
        // FALLBACK: Tentar buscar do cache offline
        try {
          const cachedPoint = await getQRPoint(extractedCode);
          if (cachedPoint) {
            const cachedZone = await getZone(cachedPoint.zoneId);
            
            const resolved = {
              customer: { id: cachedPoint.customerId },
              site: { id: cachedZone?.siteId || '', name: cachedZone?.siteName || 'Local' },
              zone: { id: cachedPoint.zoneId, name: cachedZone?.name || 'Zona' },
              point: { 
                id: cachedPoint.pointId,
                name: cachedPoint.name,
                description: cachedPoint.description,
                code: cachedPoint.code,
                zoneId: cachedPoint.zoneId,
                customerId: cachedPoint.customerId,
                module: cachedPoint.module,
              },
              qrPoint: cachedPoint,
            };

            setResolvedContext(resolved);
            setShowServiceModal(true);
            
            toast({
              title: "✈️ QR Code encontrado no cache!",
              description: `${resolved.zone.name} - ${resolved.site.name} (Modo Offline)`,
            });
            return;
          }
        } catch (cacheError) {
          console.error('[QR SCANNER] Erro ao buscar do cache:', cacheError);
        }
        
        // Se não encontrou no cache
        toast({
          title: "Sem Internet",
          description: "Este QR code não está no cache offline. Conecte-se à internet para escanear novos QR codes.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao processar QR",
          description: errorMessage,
          variant: "destructive",
        });
      }
      
      setIsProcessing(false);
      setTimeout(() => startScanner(), 2000);
    }
  };

  const handleServiceSelection = async (serviceId: string, workOrderId?: string) => {
    console.log('[QR SCANNER] handleServiceSelection chamado:', { serviceId, workOrderId, hasResolvedContext: !!resolvedContext });
    
    if (!resolvedContext) {
      console.error('[QR SCANNER] Erro: resolvedContext está vazio!');
      return;
    }

    try {
      // Se está selecionando uma work order existente
      if (workOrderId) {
        console.log('[QR SCANNER] Selecionando work order existente:', workOrderId);
        setShowServiceModal(false);
        setLocation(`/mobile/work-order/${workOrderId}`);
        return;
      }

      // Se está criando nova OS, abrir modal de seleção de checklist
      console.log('[QR SCANNER] Abrindo modal de checklist para serviceId:', serviceId);
      setSelectedServiceId(serviceId);
      setShowServiceModal(false);
      setShowChecklistModal(true);
    } catch (error) {
      console.error("[QR SCANNER] Erro ao processar serviço:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar seleção de serviço.",
        variant: "destructive",
      });
    }
  };

  const handleChecklistConfirm = async (checklistTemplateId: string) => {
    console.log('[QR SCANNER] Checklist confirmado:', checklistTemplateId);
    
    if (!resolvedContext || !selectedServiceId) {
      console.error('[QR SCANNER] Erro: contexto ou serviceId ausente!');
      return;
    }

    try {
      const customerId = resolvedContext.customer.id;
      const qrModule = resolvedContext.qrPoint?.module || 'clean';
      const companyId = resolvedContext.site?.companyId || COMPANY_ID;
      
      const workOrderData = {
        companyId: companyId,
        module: qrModule,
        siteId: resolvedContext.site.id,
        zoneId: resolvedContext.zone.id,
        serviceId: selectedServiceId,
        type: 'corretiva_interna',
        priority: 'media',
        title: `Serviço via QR - ${resolvedContext.zone.name}`,
        description: `Work order criada via QR Code: ${scannedQrCode}`,
        origin: 'QR Scanner Mobile',
        qrCodePointId: resolvedContext.qrPoint?.id,
        checklistTemplateId: checklistTemplateId,
        checklistData: null
      };

      console.log('[QR SCANNER] Criando work order:', workOrderData);

      const response = await fetch(`/api/customers/${customerId}/work-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workOrderData),
      });

      if (response.ok) {
        const workOrder = await response.json();
        console.log('[QR SCANNER] Work order criada:', workOrder);
        
        toast({
          title: "Work Order Criada!",
          description: `OS #${workOrder.number} criada com sucesso`,
        });

        setShowChecklistModal(false);
        setLocation(`/mobile/work-order/${workOrder.id}`);
      } else {
        const errorData = await response.text();
        console.error('[QR SCANNER] Erro na resposta:', response.status, errorData);
        throw new Error(`Erro ao criar work order: ${response.status}`);
      }
    } catch (error) {
      console.error("[QR SCANNER] Erro ao criar work order:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a work order.",
        variant: "destructive",
      });
    }
  };

  const handleModalClose = () => {
    setShowServiceModal(false);
    setResolvedContext(null);
    setScannedQrCode("");
    setIsProcessing(false);
    setTimeout(() => startScanner(), 500);
  };

  const handleChecklistModalClose = () => {
    setShowChecklistModal(false);
    setSelectedServiceId("");
    setResolvedContext(null);
    setScannedQrCode("");
    setIsProcessing(false);
    setTimeout(() => startScanner(), 500);
  };

  const toggleFlash = async () => {
    if (qrScannerRef.current) {
      try {
        if (flashOn) {
          await qrScannerRef.current.turnFlashOff();
          setFlashOn(false);
        } else {
          await qrScannerRef.current.turnFlashOn();
          setFlashOn(true);
        }
      } catch (error) {
        toast({
          title: "Flash não disponível",
          description: "O flash não está disponível neste dispositivo.",
          variant: "destructive",
        });
      }
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    
    const currentIndex = cameras.findIndex(camera => camera.id === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    
    setSelectedCameraId(nextCamera.id);
    await startScanner(nextCamera.id);
    
    toast({
      title: "Câmera alterada",
      description: nextCamera.label,
    });
  };

  if (!hasCamera) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="ghost" 
              onClick={() => setLocation("/mobile")}
              className="p-2"
              data-testid="button-back"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-bold">Scanner QR</h1>
            <div></div>
          </div>

          <Card className="bg-white/80 backdrop-blur-sm border-white/20">
            <CardContent className="p-6 text-center">
              <Camera className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Câmera não disponível
              </h3>
              <p className="text-slate-600 mb-4">
                Não foi possível acessar a câmera do dispositivo. Verifique as permissões.
              </p>
              <Button onClick={initializeCamera} className="w-full" data-testid="button-retry-camera">
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4">
          <Button 
            variant="ghost" 
            onClick={() => setLocation("/mobile")}
            className="p-2 text-white hover:bg-white/20"
            data-testid="button-back-scanner"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">Scanner QR</h1>
            {!isOnline && (
              <div className="flex items-center gap-1 px-2 py-1 bg-orange-500/80 rounded-md">
                <WifiOff className="w-4 h-4 text-white" />
                <span className="text-xs font-medium text-white">Offline</span>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            {cameras.length > 1 && (
              <Button 
                variant="ghost" 
                onClick={switchCamera}
                className="p-2 text-white hover:bg-white/20"
                data-testid="button-switch-camera"
              >
                <RotateCcw className="w-6 h-6" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              onClick={toggleFlash}
              className="p-2 text-white hover:bg-white/20"
              data-testid="button-toggle-flash"
            >
              {flashOn ? <FlashlightOff className="w-6 h-6" /> : <Flashlight className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Camera View */}
      <div className="relative w-full h-screen">
        <video 
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        
        {/* Scanning Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative">
            {/* Scanning frame */}
            <div className="w-64 h-64 border-2 border-white/50 rounded-2xl relative">
              {/* Corner indicators */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-2xl"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-2xl"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-2xl"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-2xl"></div>
              
              {/* Scanning line animation */}
              {isScanning && !isProcessing && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-white animate-pulse"></div>
              )}
            </div>
            
            {/* Instructions */}
            <p className="text-white text-center mt-6 bg-black/50 px-4 py-2 rounded-lg">
              {isProcessing ? "Processando QR..." : isScanning ? "Posicione o QR code dentro da área" : "Iniciando scanner..."}
            </p>
          </div>
        </div>
      </div>

      {/* Service Selection Modal */}
      {showServiceModal && resolvedContext && (
        <ServiceSelectionModal
          isOpen={showServiceModal}
          onClose={handleModalClose}
          resolvedContext={resolvedContext}
          scannedQrCode={scannedQrCode}
          onServiceSelect={handleServiceSelection}
        />
      )}

      {/* Checklist Selection Modal */}
      {showChecklistModal && resolvedContext && (
        <ChecklistSelectionModal
          isOpen={showChecklistModal}
          onClose={handleChecklistModalClose}
          customerId={resolvedContext.customer.id}
          module={resolvedContext.qrPoint?.module || 'clean'}
          onConfirm={handleChecklistConfirm}
        />
      )}
    </div>
  );
}
