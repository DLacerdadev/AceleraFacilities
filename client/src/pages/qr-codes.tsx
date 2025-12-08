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
  RefreshCw
} from "lucide-react";
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

  const generateQrCodeUrl = (type: string, code: string) => {
    if (type === 'execucao') return code;
    const baseUrl = window.location.origin;
    return `${baseUrl}/qr-public/${code}`;
  };

  const generateQrCodeImage = async (url: string, sizeCm: number): Promise<string> => {
    const sizePixels = cmToPixels(sizeCm);
    try {
      return await QRCode.toDataURL(url, {
        width: sizePixels,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
      });
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
        const url = generateQrCodeUrl(point.type, point.code);
        const sizeCm = point.sizeCm || 5;
        const qrCodeDataUrl = await generateQrCodeImage(url, sizeCm);
        if (qrCodeDataUrl) {
          newQrImages[point.id] = qrCodeDataUrl;
        }
      }
      
      setQrCodeImages(newQrImages);
    };

    generateAllQrCodes();
  }, [qrPoints]);

  const downloadPDF = async (point: any) => {
    const url = generateQrCodeUrl(point.type, point.code);
    const sizeCm = point.sizeCm || 5;
    const qrCodeDataUrl = await generateQrCodeImage(url, sizeCm);
    
    const pdf = new jsPDF();
    const pageWidth = 210;
    const pageHeight = 297;
    
    // QR Code padrão centralizado
    const qrSizeMM = sizeCm * 10;
    const borderMM = 5;
    const qrWithBorderMM = qrSizeMM + (borderMM * 2);
    const qrX = (pageWidth - qrWithBorderMM) / 2;
    const qrY = 50;
    
    // Borda simples cinza
    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(qrX, qrY, qrWithBorderMM, qrWithBorderMM, 3, 3, 'F');
    
    // Fundo branco para QR
    pdf.setFillColor(255, 255, 255);
    pdf.rect(qrX + borderMM, qrY + borderMM, qrSizeMM, qrSizeMM, 'F');
    
    // QR Code
    pdf.addImage(qrCodeDataUrl, 'PNG', qrX + borderMM, qrY + borderMM, qrSizeMM, qrSizeMM);
    
    // Informações abaixo do QR code
    const textStartY = qrY + qrWithBorderMM + 15;
    
    // Nome
    pdf.setTextColor(30, 41, 59);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text(point.name, pageWidth / 2, textStartY, { align: 'center' });
    
    // Código
    pdf.setTextColor(100, 116, 139);
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Código: ${point.code}`, pageWidth / 2, textStartY + 8, { align: 'center' });
    
    // Local
    if (point.zoneName) {
      pdf.setFontSize(9);
      pdf.text(`Local: ${point.zoneName}`, pageWidth / 2, textStartY + 15, { align: 'center' });
    }
    
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
      
      const url = generateQrCodeUrl(point.type, point.code);
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
                  
                  return (
                    <Card 
                      key={point.id} 
                      className={cn(
                        "relative transition-all duration-200",
                        isSelected && "ring-2 ring-offset-2",
                        isSelected && theme.borders.primary
                      )}
                    >
                      <CardContent className="p-6">
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleSelection(point.id)}
                          data-testid={`checkbox-qr-${point.id}`}
                          className={cn(
                            "absolute top-4 left-4 w-7 h-7 rounded-md border-2 flex items-center justify-center transition-all duration-200 hover:scale-110",
                            isSelected 
                              ? "border-transparent shadow-lg"
                              : 'border-gray-400 bg-white hover:border-gray-600 hover:bg-gray-50'
                          )}
                          style={isSelected ? {
                            background: 'linear-gradient(135deg, var(--module-primary), var(--module-secondary))'
                          } : undefined}
                        >
                          {isSelected && <Check className="w-5 h-5 text-white font-bold" />}
                        </button>

                        {/* Badge Tipo */}
                        <Badge 
                          className={cn("absolute top-4 right-4 text-white")}
                          style={theme.backgrounds.primaryStyle}
                        >
                          Execução
                        </Badge>

                        {/* QR Code com borda dinâmica */}
                        <div className="flex justify-center my-4">
                          <div className="relative">
                            <div 
                              className="p-4 rounded-2xl"
                              style={theme.backgrounds.primaryStyle}
                            >
                              {qrCodeImages[point.id] && (
                                <div className="bg-white p-2">
                                  <img 
                                    src={qrCodeImages[point.id]} 
                                    alt={point.name}
                                    className="w-32 h-32"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Badge Execução */}
                        <div className="flex justify-center mb-3">
                          <Badge 
                            className="px-4 py-1"
                            style={theme.badges.lightStyle}
                          >
                            Execução
                          </Badge>
                        </div>

                        {/* Informações */}
                        <div className="text-center space-y-1 mb-4">
                          <h3 className="font-bold text-base">{point.name}</h3>
                          <p className="text-sm text-muted-foreground">Código: {point.code}</p>
                          {point.zoneName && (
                            <>
                              <p className="text-xs text-muted-foreground">Local: {point.zoneName}</p>
                              {point.siteName && (
                                <p className="text-xs text-muted-foreground">
                                  Endereço: {point.siteName}
                                </p>
                              )}
                            </>
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
