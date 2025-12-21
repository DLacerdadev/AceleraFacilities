import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useClient } from "@/contexts/ClientContext";
import { useModule } from "@/contexts/ModuleContext";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { ModernCard, ModernCardHeader, ModernCardContent } from "@/components/ui/modern-card";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import QRCode from "qrcode";
import { 
  QrCode as QrCodeIcon, 
  Download, 
  Plus, 
  Trash2,
  FileText,
  Printer,
  Check,
  Copy,
  RefreshCw,
  Globe,
  Link,
  Eye,
  MapPin
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import jsPDF from 'jspdf';
import { cn } from "@/lib/utils";

const QR_SIZES_CM = [3, 4, 5, 6, 7, 8, 10, 12, 15];
const cmToPixels = (cm: number) => Math.round(cm * 28.35);

export default function QrCodes() {
  const { activeClientId } = useClient();
  const { currentModule } = useModule();
  const theme = useModuleTheme();
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedZone, setSelectedZone] = useState("");
  const [pointName, setPointName] = useState("");
  const [pointCode, setPointCode] = useState("");
  const [qrSizeCm, setQrSizeCm] = useState(5);
  const [qrCodeImages, setQrCodeImages] = useState<{[key: string]: string}>({});
  const [selectedQrCodes, setSelectedQrCodes] = useState<string[]>([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: sites } = useQuery({
    queryKey: ["/api/customers", activeClientId, "sites", { module: currentModule }],
    enabled: !!activeClientId,
  });

  const { data: zones } = useQuery({
    queryKey: ["/api/sites", selectedSite, "zones", { module: currentModule }],
    enabled: !!selectedSite,
  });

  const { data: qrPoints, isLoading } = useQuery({
    queryKey: ["/api/customers", activeClientId, "qr-points", { module: currentModule }],
    enabled: !!activeClientId,
  });

  // Buscar dados do customer para obter o logo do QR code e cores
  const { data: customer } = useQuery({
    queryKey: ["/api/customers", activeClientId],
    enabled: !!activeClientId,
  });

  const createQrPointMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", `/api/customers/${activeClientId}/qr-points`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "qr-points"] });
      toast({ title: "✅ QR Code criado com sucesso!" });
      setSelectedSite("");
      setSelectedZone("");
      setPointName("");
      setPointCode("");
      setQrSizeCm(5);
    },
    onError: () => {
      toast({ 
        title: "Erro ao criar QR Code", 
        description: "Tente novamente",
        variant: "destructive" 
      });
    },
  });

  // Resetar zona quando mudar o site
  useEffect(() => {
    setSelectedZone("");
  }, [selectedSite]);

  const handleCreateQrPoint = () => {
    if (!selectedZone || !pointName) {
      toast({ 
        title: "Preencha todos os campos obrigatórios", 
        description: "Local e nome são obrigatórios",
        variant: "destructive" 
      });
      return;
    }

    createQrPointMutation.mutate({
      zoneId: selectedZone,
      type: "execucao",
      name: pointName,
      sizeCm: qrSizeCm,
      module: currentModule,
      ...(pointCode ? { code: pointCode } : {}),
    });
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast({ title: "🔄 Atualizando lista..." });
    await queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "qr-points"] });
    // Pequeno delay para garantir que a animação seja visível
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  const generateQrCodeUrl = (point: { type: string; code: string; isPublic?: boolean; publicSlug?: string | null }) => {
    const baseUrl = window.location.origin;
    
    // Se acesso público está ativo e tem slug, usa a URL pública direta
    if (point.isPublic && point.publicSlug) {
      return `${baseUrl}/public/tv/${point.publicSlug}`;
    }
    
    // QR codes de execução usam apenas o código interno (para o app)
    if (point.type === 'execucao') return point.code;
    
    // Outros tipos usam URL de redirecionamento
    return `${baseUrl}/qr-public/${point.code}`;
  };

  // Obter a cor do módulo para usar no QR code
  const getModuleColor = (): string => {
    const customerData = customer as any;
    const moduleColors = customerData?.moduleColors;
    if (moduleColors && currentModule) {
      const moduleKey = currentModule === 'clean' ? 'cleanPrimary' : 'maintenancePrimary';
      if (moduleColors[moduleKey]) {
        return moduleColors[moduleKey];
      }
    }
    // Fallback para cores padrão dos módulos
    return currentModule === 'clean' ? '#3b82f6' : '#f97316';
  };

  // Função para carregar uma imagem
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  const generateQrCodeImage = async (url: string, sizeCm: number): Promise<string> => {
    const sizePixels = cmToPixels(sizeCm);
    const moduleColor = getModuleColor();
    const borderWidth = Math.max(8, sizePixels * 0.04); // Borda proporcional ao tamanho
    const totalSize = sizePixels + (borderWidth * 2);
    
    try {
      // Gerar QR code base em PRETO E BRANCO
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: sizePixels,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'H' // Alto nível de correção para permitir logo no centro
      });
      
      // Criar canvas com espaço para borda colorida
      const canvas = document.createElement('canvas');
      canvas.width = totalSize;
      canvas.height = totalSize;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return qrDataUrl;
      
      // Desenhar borda colorida (moldura)
      ctx.fillStyle = moduleColor;
      ctx.fillRect(0, 0, totalSize, totalSize);
      
      // Desenhar fundo branco interno
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(borderWidth, borderWidth, sizePixels, sizePixels);
      
      // Desenhar o QR code no centro
      const qrImage = await loadImage(qrDataUrl);
      ctx.drawImage(qrImage, borderWidth, borderWidth, sizePixels, sizePixels);
      
      // Verificar se o customer tem logo para QR code
      const customerData = customer as any;
      const qrCodeLogo = customerData?.qrCodeLogo;
      
      if (qrCodeLogo) {
        try {
          // Carregar e desenhar o logo no centro
          const logoImage = await loadImage(qrCodeLogo);
          
          // Logo ocupa 22% do QR code (tamanho seguro para não comprometer leitura)
          const logoSize = sizePixels * 0.22;
          const centerX = totalSize / 2;
          const centerY = totalSize / 2;
          const logoX = centerX - logoSize / 2;
          const logoY = centerY - logoSize / 2;
          
          // Desenhar fundo branco quadrado para o logo
          const padding = 4;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(logoX - padding, logoY - padding, logoSize + padding * 2, logoSize + padding * 2);
          
          // Desenhar o logo
          ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
        } catch (logoError) {
          console.warn('Não foi possível carregar o logo do QR code:', logoError);
        }
      }
      
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Erro ao gerar QR code:', error);
      return '';
    }
  };

  useEffect(() => {
    const generateAllQrCodes = async () => {
      if (!qrPoints || (qrPoints as any[]).length === 0) return;

      const newQrImages: {[key: string]: string} = {};
      
      for (const point of qrPoints as any[]) {
        const url = generateQrCodeUrl(point);
        const sizeCm = point.sizeCm || 5;
        const qrCodeDataUrl = await generateQrCodeImage(url, sizeCm);
        if (qrCodeDataUrl) {
          newQrImages[point.id] = qrCodeDataUrl;
        }
      }
      
      setQrCodeImages(newQrImages);
    };

    generateAllQrCodes();
  }, [qrPoints, customer, currentModule]);

  // Helper para converter hex/rgb para array RGB
  const colorToRgb = (color: string): number[] => {
    // Tenta hex
    const hexResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    if (hexResult) {
      return [parseInt(hexResult[1], 16), parseInt(hexResult[2], 16), parseInt(hexResult[3], 16)];
    }
    // Tenta rgb(r, g, b)
    const rgbResult = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(color);
    if (rgbResult) {
      return [parseInt(rgbResult[1]), parseInt(rgbResult[2]), parseInt(rgbResult[3])];
    }
    return [59, 130, 246]; // Fallback azul
  };
  
  // Obtém as cores CSS reais do módulo/cliente
  const getModuleColors = (): { primary: number[], secondary: number[] } => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const primaryColor = computedStyle.getPropertyValue('--module-primary').trim();
    const secondaryColor = computedStyle.getPropertyValue('--module-secondary').trim();
    
    return {
      primary: colorToRgb(primaryColor),
      secondary: colorToRgb(secondaryColor)
    };
  };

  const downloadPDF = async (point: any) => {
    const url = generateQrCodeUrl(point);
    const sizeCm = point.sizeCm || 5;
    const qrCodeDataUrl = await generateQrCodeImage(url, sizeCm);
    const customerData = customer as any;
    
    const pdf = new jsPDF();
    const pageWidth = 210;
    const pageHeight = 297;
    
    // Obtém as cores reais do cliente/módulo das variáveis CSS
    const moduleColors = getModuleColors();
    const primaryRgb = moduleColors.primary;
    const secondaryRgb = moduleColors.secondary;
    
    // ========== CARD CENTRALIZADO ==========
    const cardWidth = 140;
    const cardHeight = 200;
    const cardX = (pageWidth - cardWidth) / 2;
    const cardY = (pageHeight - cardHeight) / 2 - 20;
    
    // Sombra do card
    pdf.setFillColor(200, 200, 200);
    pdf.roundedRect(cardX + 3, cardY + 3, cardWidth, cardHeight, 6, 6, 'F');
    
    // Fundo branco do card
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(cardX, cardY, cardWidth, cardHeight, 6, 6, 'F');
    
    // Borda do card
    pdf.setDrawColor(230, 230, 230);
    pdf.setLineWidth(0.5);
    pdf.roundedRect(cardX, cardY, cardWidth, cardHeight, 6, 6, 'S');
    
    // ========== HEADER DO CARD ==========
    const headerH = 28;
    
    // Fundo colorido do header
    pdf.setFillColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    pdf.roundedRect(cardX, cardY, cardWidth, headerH, 6, 6, 'F');
    // Retângulo para cobrir cantos inferiores arredondados
    pdf.rect(cardX, cardY + headerH - 6, cardWidth, 6, 'F');
    
    // Logo do cliente no header
    let textStartX = cardX + 12;
    if (customerData?.sidebarLogoCollapsed) {
      try {
        const logoSize = 16;
        const logoX = cardX + 8;
        const logoY = cardY + 6;
        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(logoX, logoY, logoSize, logoSize, 2, 2, 'F');
        pdf.addImage(customerData.sidebarLogoCollapsed, 'PNG', logoX + 1, logoY + 1, logoSize - 2, logoSize - 2);
        textStartX = logoX + logoSize + 6;
      } catch (e) {
        // Ignora erro de logo
      }
    }
    
    // Nome do cliente
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    const clientName = customerData?.name || 'Cliente';
    const maxNameWidth = cardWidth - (textStartX - cardX) - 40;
    const truncatedName = clientName.length > 18 ? clientName.substring(0, 16) + '...' : clientName;
    pdf.text(truncatedName, textStartX, cardY + 17);
    
    // Badge do módulo
    const moduleName = currentModule === 'clean' ? 'Limpeza' : 'Manutenção';
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    const badgeW = pdf.getTextWidth(moduleName) + 6;
    const badgeX = cardX + cardWidth - badgeW - 8;
    const badgeY = cardY + 9;
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(badgeX, badgeY, badgeW, 10, 2, 2, 'F');
    pdf.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    pdf.text(moduleName, badgeX + 3, badgeY + 7);
    
    // ========== QR CODE ==========
    const qrSizeMM = Math.min(sizeCm * 10, 90);
    const qrX = cardX + (cardWidth - qrSizeMM) / 2;
    const qrY = cardY + headerH + 12;
    
    // Fundo branco para o QR
    pdf.setFillColor(255, 255, 255);
    pdf.rect(qrX, qrY, qrSizeMM, qrSizeMM, 'F');
    
    // Imagem do QR Code
    pdf.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSizeMM, qrSizeMM);
    
    // ========== INFORMAÇÕES DO PONTO ==========
    const infoY = qrY + qrSizeMM + 10;
    
    // Linha separadora
    pdf.setDrawColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    pdf.setLineWidth(0.8);
    pdf.line(cardX + 20, infoY, cardX + cardWidth - 20, infoY);
    
    // Nome do ponto
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    const centerX = cardX + cardWidth / 2;
    pdf.text(point.name, centerX, infoY + 14, { align: 'center' });
    
    // Código
    pdf.setTextColor(primaryRgb[0], primaryRgb[1], primaryRgb[2]);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(point.code, centerX, infoY + 24, { align: 'center' });
    
    // Local (zona e site)
    if (point.zoneName) {
      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(8);
      const localText = point.siteName ? `${point.zoneName} | ${point.siteName}` : point.zoneName;
      const maxLocalWidth = cardWidth - 16;
      const localParts = pdf.splitTextToSize(localText, maxLocalWidth);
      pdf.text(localParts[0], centerX, infoY + 34, { align: 'center' });
    }
    
    // ========== FOOTER DO CARD ==========
    pdf.setTextColor(160, 160, 160);
    pdf.setFontSize(7);
    pdf.text('Escaneie para executar', centerX, cardY + cardHeight - 8, { align: 'center' });
    
    pdf.save(`qr_${point.name.replace(/\s+/g, '_')}_${sizeCm}cm.pdf`);
  };

  const downloadMultiplePDF = async () => {
    if (selectedQrCodes.length === 0) {
      toast({ title: "Selecione QR codes para imprimir", variant: "destructive" });
      return;
    }

    setIsGeneratingPDF(true);
    const selectedPoints = (qrPoints as any[]).filter(point => selectedQrCodes.includes(point.id));
    const pdf = new jsPDF();
    
    const pageWidth = 210; // mm A4
    const pageHeight = 297; // mm A4
    const margin = 8;
    const spacing = 5;
    
    let currentY = margin;
    let currentX = margin;
    let maxRowHeight = 0;
    const borderMM = 5;
    const textHeight = 25;
    
    for (let i = 0; i < selectedPoints.length; i++) {
      const point = selectedPoints[i];
      const sizeCm = point.sizeCm || 5;
      const qrSizeMM = sizeCm * 10;
      const qrWithBorderMM = qrSizeMM + (borderMM * 2);
      const totalItemHeight = qrWithBorderMM + textHeight;
      
      // Se não cabe na linha atual, vai para próxima linha
      if (currentX + qrWithBorderMM > pageWidth - margin && currentX > margin) {
        currentY += maxRowHeight + spacing;
        currentX = margin;
        maxRowHeight = 0;
      }
      
      // Se não cabe na página atual, cria nova página
      if (currentY + totalItemHeight > pageHeight - margin) {
        pdf.addPage();
        currentY = margin;
        currentX = margin;
        maxRowHeight = 0;
      }
      
      const url = generateQrCodeUrl(point);
      const qrCodeDataUrl = await generateQrCodeImage(url, sizeCm);
      
      // Borda simples cinza
      pdf.setFillColor(240, 240, 240);
      pdf.roundedRect(currentX, currentY, qrWithBorderMM, qrWithBorderMM, 3, 3, 'F');
      
      // Fundo branco para QR
      pdf.setFillColor(255, 255, 255);
      pdf.rect(currentX + borderMM, currentY + borderMM, qrSizeMM, qrSizeMM, 'F');
      
      // QR Code
      pdf.addImage(qrCodeDataUrl, 'PNG', currentX + borderMM, currentY + borderMM, qrSizeMM, qrSizeMM);
      
      // Texto abaixo do QR
      const textY = currentY + qrWithBorderMM + 5;
      
      // Nome
      pdf.setTextColor(30, 41, 59);
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      const maxNameWidth = qrWithBorderMM - 2;
      const nameParts = pdf.splitTextToSize(point.name, maxNameWidth);
      pdf.text(nameParts[0], currentX + qrWithBorderMM / 2, textY, { align: 'center' });
      
      // Código
      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(6);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${point.code}`, currentX + qrWithBorderMM / 2, textY + 6, { align: 'center' });
      
      // Atualiza posição X e altura máxima da linha
      currentX += qrWithBorderMM + spacing;
      maxRowHeight = Math.max(maxRowHeight, totalItemHeight);
    }
    
    pdf.save(`qr_codes_multiplos_${selectedPoints.length}_itens.pdf`);
    toast({ title: `${selectedPoints.length} QR codes baixados em PDF` });
    setIsGeneratingPDF(false);
  };

  const deleteQrPointMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/qr-points/${id}`);
    },
    onSuccess: () => {
      toast({ title: "QR Code excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "qr-points"] });
    },
  });

  const togglePublicAccessMutation = useMutation({
    mutationFn: async ({ id, isPublic }: { id: string; isPublic: boolean }) => {
      return await apiRequest("PATCH", `/api/qr-points/${id}/public`, { isPublic });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", activeClientId, "qr-points"] });
      if (data.isPublic) {
        toast({ 
          title: "Acesso público ativado",
          description: "O link público foi gerado com sucesso"
        });
      } else {
        toast({ title: "Acesso público desativado" });
      }
    },
    onError: () => {
      toast({ 
        title: "Erro ao alterar acesso público",
        variant: "destructive"
      });
    },
  });

  const getPublicUrl = (slug: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/public/tv/${slug}`;
  };

  const copyPublicUrl = (slug: string) => {
    navigator.clipboard.writeText(getPublicUrl(slug));
    toast({ title: "Link público copiado!" });
  };

  const toggleSelection = (id: string) => {
    setSelectedQrCodes(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedQrCodes.length === (qrPoints as any[])?.length) {
      setSelectedQrCodes([]);
    } else {
      setSelectedQrCodes((qrPoints as any[])?.map(p => p.id) || []);
    }
  };

  return (
    <>
      <ModernPageHeader 
        title="QR Codes"
        description="Gerencie códigos QR para execução e serviços públicos"
        icon={QrCodeIcon}
        stats={[
          { 
            label: "Total de QR Codes", 
            value: (qrPoints as any[])?.length || 0,
            icon: QrCodeIcon
          }
        ]}
        actions={
          <Button 
            onClick={handleRefresh}
            className={cn("flex items-center gap-2", theme.buttons.primary)}
            style={theme.buttons.primaryStyle}
            size="sm"
            disabled={isRefreshing}
            data-testid="button-refresh-header"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            Atualizar
          </Button>
        }
      />
      
      <div className={cn("flex-1 overflow-y-auto p-4 md:p-6 space-y-6", theme.gradients.section)}>
        <ModernCard variant="default">
          <ModernCardHeader icon={<Plus className="w-6 h-6" />}>
            Criar Novo QR Code
          </ModernCardHeader>
          <ModernCardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Coluna Esquerda - Informações Principais */}
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-700">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", theme.backgrounds.light)}>
                      <span className={cn("text-xs font-bold", theme.text.primary)}>1</span>
                    </div>
                    Local <span className="text-red-500">*</span>
                  </label>
                  <Select value={selectedSite} onValueChange={setSelectedSite}>
                    <SelectTrigger 
                      data-testid="select-site"
                      className={`h-12 ${!selectedSite ? 'border-orange-300 bg-orange-50/30' : 'border-green-300 bg-green-50/30'}`}
                    >
                      <SelectValue placeholder="Selecione o local" />
                    </SelectTrigger>
                    <SelectContent>
                      {(sites as any[])?.map((site: any) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedSite && (
                    <p className="text-xs text-orange-600 mt-1">Escolha o local onde o QR será instalado</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-700">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", theme.backgrounds.light)}>
                      <span className={cn("text-xs font-bold", theme.text.primary)}>2</span>
                    </div>
                    Zona <span className="text-red-500">*</span>
                  </label>
                  <Select value={selectedZone} onValueChange={setSelectedZone} disabled={!selectedSite}>
                    <SelectTrigger 
                      data-testid="select-zone"
                      className={`h-12 ${!selectedZone && selectedSite ? 'border-orange-300 bg-orange-50/30' : selectedZone ? 'border-green-300 bg-green-50/30' : ''}`}
                    >
                      <SelectValue placeholder={selectedSite ? "Selecione a zona" : "Selecione o local primeiro"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(zones as any[])?.map((zone: any) => (
                        <SelectItem key={zone.id} value={zone.id}>
                          {zone.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!selectedSite && (
                    <p className="text-xs text-gray-500 mt-1">Primeiro selecione um local</p>
                  )}
                  {selectedSite && !selectedZone && (
                    <p className="text-xs text-orange-600 mt-1">Escolha a zona específica dentro do local</p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-700">
                    <div className={cn("w-6 h-6 rounded-full flex items-center justify-center", theme.backgrounds.light)}>
                      <span className={cn("text-xs font-bold", theme.text.primary)}>3</span>
                    </div>
                    Nome do Ponto <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Ex: Sala de Reunião 1"
                    value={pointName}
                    onChange={(e) => setPointName(e.target.value)}
                    data-testid="input-point-name"
                    className={`h-12 ${!pointName ? 'border-orange-300 bg-orange-50/30' : 'border-green-300 bg-green-50/30'}`}
                  />
                  {!pointName && (
                    <p className="text-xs text-orange-600 mt-1">Digite um nome descritivo para o ponto</p>
                  )}
                </div>
              </div>

              {/* Coluna Direita - Detalhes Opcionais */}
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-700">
                    <FileText className="w-4 h-4 text-gray-500" />
                    Código Personalizado <span className="text-gray-400 text-xs">(opcional)</span>
                  </label>
                  <Input
                    placeholder="Ex: SR-001, QR-123"
                    value={pointCode}
                    onChange={(e) => setPointCode(e.target.value)}
                    data-testid="input-point-code"
                    className="h-12 border-gray-300"
                  />
                  <p className="text-xs text-gray-500 mt-1">Deixe em branco para gerar automaticamente</p>
                </div>

                <div>
                  <label className="text-sm font-semibold mb-2 flex items-center gap-2 text-gray-700">
                    <QrCodeIcon className="w-4 h-4 text-gray-500" />
                    Tamanho do QR Code
                  </label>
                  <Select value={String(qrSizeCm)} onValueChange={(v) => setQrSizeCm(Number(v))}>
                    <SelectTrigger data-testid="select-size" className="h-12">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QR_SIZES_CM.map(size => (
                        <SelectItem key={size} value={String(size)}>
                          {size} cm {size === 5 && '(recomendado)'} {size >= 10 && '(grande)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">5 cm é ideal para a maioria dos casos</p>
                </div>

                <div className="pt-4">
                  <Button 
                    onClick={handleCreateQrPoint} 
                    className={cn("w-full h-14 text-base font-semibold", theme.buttons.primary)}
                    style={theme.buttons.primaryStyle}
                    disabled={createQrPointMutation.isPending}
                    data-testid="button-create-qr"
                  >
                    {createQrPointMutation.isPending ? (
                      <>
                        <div className="w-5 h-5 mr-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Gerando QR Code...
                      </>
                    ) : (
                      <>
                        <QrCodeIcon className="w-5 h-5 mr-3" />
                        Criar QR Code
                      </>
                    )}
                  </Button>
                  {(!selectedSite || !selectedZone || !pointName) && (
                    <p className="text-xs text-center text-orange-600 mt-2 font-medium">
                      ⚠️ Preencha todos os campos obrigatórios (*)
                    </p>
                  )}
                </div>
              </div>
            </div>
          </ModernCardContent>
        </ModernCard>

        {selectedQrCodes.length > 0 && (
          <Card className={cn(theme.backgrounds.light, theme.borders.primary)}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedQrCodes.length} selecionado{selectedQrCodes.length > 1 ? 's' : ''}
                </span>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedQrCodes([])}
                    disabled={isGeneratingPDF}
                  >
                    Limpar
                  </Button>
                  <Button 
                    variant="default"
                    size="sm" 
                    onClick={downloadMultiplePDF}
                    disabled={isGeneratingPDF}
                    className={theme.buttons.primary}
                    style={theme.buttons.primaryStyle}
                  >
                    {isGeneratingPDF ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Gerando PDF...
                      </>
                    ) : (
                      <>
                        <Printer className="w-4 h-4 mr-2" />
                        Baixar PDF
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>QR Codes Cadastrados</CardTitle>
              <div className="flex gap-2">
                <Button
                  onClick={handleRefresh}
                  className={cn("flex items-center gap-2", theme.buttons.primary)}
                  style={theme.buttons.primaryStyle}
                  size="sm"
                  disabled={isRefreshing}
                  data-testid="button-refresh-qr"
                >
                  <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                  Atualizar
                </Button>
                {(qrPoints as any[])?.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                    data-testid="button-select-all"
                  >
                    {selectedQrCodes.length === (qrPoints as any[])?.length ? (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Desmarcar Todos
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Selecionar Todos
                    </>
                  )}
                </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-center text-muted-foreground py-8">Carregando...</p>
            ) : (qrPoints as any[])?.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum QR code cadastrado</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(qrPoints as any[])?.map((point: any) => {
                  const sizeCm = point.sizeCm || 5;
                  const isSelected = selectedQrCodes.includes(point.id);
                  const customerData = customer as any;
                  
                  return (
                    <Card 
                      key={point.id} 
                      className={cn(
                        "relative transition-all duration-200 overflow-hidden",
                        isSelected && "ring-2 ring-offset-2",
                        isSelected && theme.borders.primary
                      )}
                    >
                      {/* Header com cor do cliente */}
                      <div 
                        className="px-4 py-3 flex items-center justify-between"
                        style={{
                          background: 'linear-gradient(135deg, var(--module-primary), var(--module-secondary))'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {customerData?.sidebarLogoCollapsed ? (
                            <img 
                              src={customerData.sidebarLogoCollapsed} 
                              alt={customerData?.name || 'Logo'} 
                              className="h-6 w-6 object-contain bg-white rounded-sm p-0.5"
                            />
                          ) : (
                            <div className="h-6 w-6 rounded-sm bg-white/20 flex items-center justify-center">
                              <QrCodeIcon className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <span className="text-white font-semibold text-sm truncate max-w-[120px]">
                            {customerData?.name || 'Cliente'}
                          </span>
                        </div>
                        <Badge className="bg-white/20 text-white text-xs border-0">
                          {currentModule === 'clean' ? 'Limpeza' : 'Manutenção'}
                        </Badge>
                      </div>

                      <CardContent className="p-4">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelection(point.id)}
                          data-testid={`checkbox-qr-${point.id}`}
                          className={cn(
                            "absolute top-14 left-4 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 hover:scale-110 z-10",
                            isSelected 
                              ? "border-transparent shadow-lg"
                              : 'border-gray-300 bg-white hover:border-gray-500'
                          )}
                          style={isSelected ? {
                            background: 'linear-gradient(135deg, var(--module-primary), var(--module-secondary))'
                          } : undefined}
                        >
                          {isSelected && <Check className="w-4 h-4 text-white font-bold" />}
                        </button>

                        {/* QR Code centralizado */}
                        <div className="flex justify-center my-3">
                          <div className="relative">
                            {qrCodeImages[point.id] && (
                              <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-1">
                                <img 
                                  src={qrCodeImages[point.id]} 
                                  alt={point.name}
                                  className="w-36 h-36"
                                />
                              </div>
                            )}
                            {/* Badge de QR Code Público */}
                            {point.isPublic && point.publicSlug && (
                              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">
                                <Badge 
                                  className="bg-green-600 text-white text-xs shadow-md"
                                  data-testid={`badge-public-qr-${point.id}`}
                                >
                                  <Globe className="w-3 h-3 mr-1" />
                                  Público
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Informações do local */}
                        <div 
                          className="text-center rounded-lg p-3 mb-3"
                          style={{
                            background: 'linear-gradient(135deg, var(--module-primary) / 0.08, var(--module-secondary) / 0.05)'
                          }}
                        >
                          <h3 className="font-bold text-base" style={{ color: 'var(--module-primary)' }}>
                            {point.name}
                          </h3>
                          <p className="text-xs text-muted-foreground font-mono mt-1">{point.code}</p>
                          {point.zoneName && (
                            <div className="mt-2 pt-2 border-t border-gray-200/50">
                              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {point.zoneName}
                              </p>
                              {point.siteName && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {point.siteName}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Botões */}
                        <Button 
                          variant="default"
                          className={cn("w-full", theme.buttons.primary)}
                          style={theme.buttons.primaryStyle}
                          size="sm"
                          onClick={() => downloadPDF(point)}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          Baixar PDF
                        </Button>

                        {/* Ações extras */}
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(point.code);
                              toast({ title: "Código copiado!" });
                            }}
                          >
                            <Copy className="w-4 h-4 mr-1" />
                            Copiar
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => deleteQrPointMutation.mutate(point.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Excluir
                          </Button>
                        </div>

                        {/* Acesso Público */}
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Globe className={cn("w-4 h-4", point.isPublic ? "text-green-600" : "text-gray-400")} />
                              <span className="text-sm font-medium">Acesso Público</span>
                            </div>
                            <Switch
                              checked={point.isPublic || false}
                              onCheckedChange={(checked) => 
                                togglePublicAccessMutation.mutate({ id: point.id, isPublic: checked })
                              }
                              disabled={togglePublicAccessMutation.isPending}
                              data-testid={`switch-public-${point.id}`}
                            />
                          </div>
                          
                          {point.isPublic && point.publicSlug && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">
                                Visitantes podem ver estatísticas desta zona sem login
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => copyPublicUrl(point.publicSlug)}
                                  data-testid={`button-copy-public-url-${point.id}`}
                                >
                                  <Link className="w-3 h-3 mr-1" />
                                  Copiar Link
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(getPublicUrl(point.publicSlug), '_blank')}
                                  data-testid={`button-view-public-${point.id}`}
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
