import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Palette, Upload, X, Check, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Customer } from "@shared/schema";

interface CustomerBrandingConfigProps {
  customer: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ModuleColors {
  clean?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  maintenance?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
}

interface LogoPreview {
  file: File | null;
  previewUrl: string | null;
}

export function CustomerBrandingConfig({ customer, open, onOpenChange }: CustomerBrandingConfigProps) {
  const { toast } = useToast();
  const [moduleColors, setModuleColors] = useState<ModuleColors>((customer.moduleColors as ModuleColors) || {});
  const [activeTab, setActiveTab] = useState('logos');
  
  // Estados para preview de logos
  const [loginLogo, setLoginLogo] = useState<LogoPreview>({ file: null, previewUrl: customer.loginLogo || null });
  const [sidebarLogo, setSidebarLogo] = useState<LogoPreview>({ file: null, previewUrl: customer.sidebarLogo || null });
  const [sidebarCollapsedLogo, setSidebarCollapsedLogo] = useState<LogoPreview>({ file: null, previewUrl: customer.sidebarLogoCollapsed || null });
  const [homeLogo, setHomeLogo] = useState<LogoPreview>({ file: null, previewUrl: customer.homeLogo || null });
  const [favicon, setFavicon] = useState<LogoPreview>({ file: null, previewUrl: (customer as any).favicon || null });
  
  const [isSavingLogos, setIsSavingLogos] = useState(false);
  
  const loginLogoRef = useRef<HTMLInputElement>(null);
  const sidebarLogoRef = useRef<HTMLInputElement>(null);
  const sidebarCollapsedRef = useRef<HTMLInputElement>(null);
  const homeLogoRef = useRef<HTMLInputElement>(null);
  const faviconRef = useRef<HTMLInputElement>(null);

  // Resetar previews quando o diálogo abrir ou o cliente mudar
  useEffect(() => {
    if (open) {
      setLoginLogo({ file: null, previewUrl: customer.loginLogo || null });
      setSidebarLogo({ file: null, previewUrl: customer.sidebarLogo || null });
      setSidebarCollapsedLogo({ file: null, previewUrl: customer.sidebarLogoCollapsed || null });
      setHomeLogo({ file: null, previewUrl: customer.homeLogo || null });
      setFavicon({ file: null, previewUrl: (customer as any).favicon || null });
      setModuleColors((customer.moduleColors as ModuleColors) || {});
    }
  }, [open, customer]);

  // Limpar URLs de preview ao desmontar
  useEffect(() => {
    return () => {
      if (loginLogo.previewUrl && loginLogo.file) URL.revokeObjectURL(loginLogo.previewUrl);
      if (sidebarLogo.previewUrl && sidebarLogo.file) URL.revokeObjectURL(sidebarLogo.previewUrl);
      if (sidebarCollapsedLogo.previewUrl && sidebarCollapsedLogo.file) URL.revokeObjectURL(sidebarCollapsedLogo.previewUrl);
      if (homeLogo.previewUrl && homeLogo.file) URL.revokeObjectURL(homeLogo.previewUrl);
      if (favicon.previewUrl && favicon.file) URL.revokeObjectURL(favicon.previewUrl);
    };
  }, []);

  const updateBrandingMutation = useMutation({
    mutationFn: async (brandingData: any) => {
      return await apiRequest("PUT", `/api/customers/${customer.id}/branding`, brandingData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id] });
      setIsSavingLogos(false);
      toast({
        title: "Configuração de branding atualizada!",
        description: "As mudanças foram aplicadas com sucesso.",
      });
    },
    onError: () => {
      setIsSavingLogos(false);
      toast({
        title: "Erro ao atualizar branding",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (
    logoType: 'login' | 'sidebar' | 'sidebarCollapsed' | 'home' | 'favicon',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem.",
        variant: "destructive",
      });
      return;
    }

    // Criar preview local
    const previewUrl = URL.createObjectURL(file);
    
    const setLogo = logoType === 'login' ? setLoginLogo : 
                    logoType === 'sidebar' ? setSidebarLogo : 
                    logoType === 'sidebarCollapsed' ? setSidebarCollapsedLogo :
                    logoType === 'favicon' ? setFavicon :
                    setHomeLogo;

    setLogo({ file, previewUrl });
  };

  const removeLogo = (logoType: 'login' | 'sidebar' | 'sidebarCollapsed' | 'home' | 'favicon') => {
    const setLogo = logoType === 'login' ? setLoginLogo : 
                    logoType === 'sidebar' ? setSidebarLogo : 
                    logoType === 'sidebarCollapsed' ? setSidebarCollapsedLogo :
                    logoType === 'favicon' ? setFavicon :
                    setHomeLogo;
    
    const logo = logoType === 'login' ? loginLogo :
                 logoType === 'sidebar' ? sidebarLogo :
                 logoType === 'sidebarCollapsed' ? sidebarCollapsedLogo :
                 logoType === 'favicon' ? favicon :
                 homeLogo;
    
    // Revogar URL de preview se for um arquivo local
    if (logo.previewUrl && logo.file) {
      URL.revokeObjectURL(logo.previewUrl);
    }
    
    setLogo({ file: null, previewUrl: null });
  };

  const handleSaveLogos = async () => {
    setIsSavingLogos(true);
    
    try {
      const brandingData: any = {};

      // Fazer upload das logos selecionadas
      for (const [logoType, logo, apiKey] of [
        ['login', loginLogo, 'loginLogo'] as const,
        ['sidebar', sidebarLogo, 'sidebarLogo'] as const,
        ['sidebarCollapsed', sidebarCollapsedLogo, 'sidebarLogoCollapsed'] as const,
        ['home', homeLogo, 'homeLogo'] as const,
        ['favicon', favicon, 'favicon'] as const,
      ]) {
        if (logo.file) {
          // Upload da logo
          const reader = new FileReader();
          const base64Data = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(logo.file!);
          });

          const uploadResponseRaw = await apiRequest("POST", `/api/customers/${customer.id}/upload-logo`, {
            logoType: apiKey,
            imageData: base64Data,
            fileName: logo.file.name,
          });

          const uploadResponse = await uploadResponseRaw.json();
          brandingData[apiKey] = uploadResponse.path;
        } else if (logo.previewUrl === null) {
          // Logo foi removida
          brandingData[apiKey] = null;
        }
      }

      // Salvar branding data
      if (Object.keys(brandingData).length > 0) {
        await updateBrandingMutation.mutateAsync(brandingData);
      }
    } catch (error) {
      setIsSavingLogos(false);
      toast({
        title: "Erro ao salvar logos",
        description: "Ocorreu um erro ao fazer upload das imagens.",
        variant: "destructive",
      });
    }
  };

  const handleColorChange = (
    module: 'clean' | 'maintenance',
    colorType: 'primary' | 'secondary' | 'accent',
    value: string
  ) => {
    setModuleColors(prev => ({
      ...prev,
      [module]: {
        ...(prev[module] || {}),
        [colorType]: value,
      },
    }));
  };

  const handleSaveColors = () => {
    updateBrandingMutation.mutate({ moduleColors });
  };

  const hasLogoChanges = loginLogo.file !== null || sidebarLogo.file !== null || sidebarCollapsedLogo.file !== null || homeLogo.file !== null || favicon.file !== null ||
                         (loginLogo.previewUrl === null && customer.loginLogo) ||
                         (sidebarLogo.previewUrl === null && customer.sidebarLogo) ||
                         (sidebarCollapsedLogo.previewUrl === null && customer.sidebarLogoCollapsed) ||
                         (homeLogo.previewUrl === null && customer.homeLogo) ||
                         (favicon.previewUrl === null && (customer as any).favicon);

  const LogoUploadCard = ({ 
    title, 
    description, 
    logo, 
    inputRef, 
    logoType,
    recommendedSize 
  }: { 
    title: string;
    description: string;
    logo: LogoPreview;
    inputRef: React.RefObject<HTMLInputElement>;
    logoType: 'login' | 'sidebar' | 'sidebarCollapsed' | 'home' | 'favicon';
    recommendedSize: string;
  }) => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description} (recomendado: {recommendedSize})</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {logo.previewUrl ? (
          <div className="space-y-3">
            <div className="relative inline-block">
              <img
                src={logo.previewUrl}
                alt={`${title} Preview`}
                className="max-h-32 max-w-full border rounded-md bg-gray-50 object-contain"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={() => removeLogo(logoType)}
                data-testid={`button-remove-${logoType}-logo`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {logo.file && (
              <p className="text-xs text-muted-foreground">
                ✓ Novo arquivo selecionado: {logo.file.name}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-md bg-gray-50">
            <div className="text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-sm text-gray-500">Nenhuma logo selecionada</p>
            </div>
          </div>
        )}
        
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFileSelect(logoType, e)}
        />
        
        <Button
          variant="outline"
          className="w-full"
          onClick={() => inputRef.current?.click()}
          data-testid={`button-select-${logoType}-logo`}
        >
          <Upload className="mr-2 h-4 w-4" />
          {logo.previewUrl ? 'Trocar Logo' : 'Selecionar Logo'}
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Configuração de Branding - {customer.name}</DialogTitle>
          <DialogDescription>
            Configure as logos e cores personalizadas para este cliente
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="logos" value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="logos">Logos</TabsTrigger>
            <TabsTrigger value="colors">Cores dos Módulos</TabsTrigger>
          </TabsList>

          <TabsContent value="logos" className="space-y-4 overflow-y-auto flex-1">
            <LogoUploadCard
              title="Logo da Tela de Login"
              description="Logo exibida na tela de login"
              logo={loginLogo}
              inputRef={loginLogoRef}
              logoType="login"
              recommendedSize="400x200px"
            />

            <LogoUploadCard
              title="Logo da Sidebar (Expandida)"
              description="Logo exibida na barra lateral quando expandida"
              logo={sidebarLogo}
              inputRef={sidebarLogoRef}
              logoType="sidebar"
              recommendedSize="200x80px"
            />

            <LogoUploadCard
              title="Logo da Sidebar (Colapsada)"
              description="Logo exibida na barra lateral quando colapsada"
              logo={sidebarCollapsedLogo}
              inputRef={sidebarCollapsedRef}
              logoType="sidebarCollapsed"
              recommendedSize="80x80px"
            />

            <LogoUploadCard
              title="Logo da Tela Inicial (Home)"
              description="Logo exibida na tela de seleção de módulos"
              logo={homeLogo}
              inputRef={homeLogoRef}
              logoType="home"
              recommendedSize="300x100px"
            />

            <LogoUploadCard
              title="Favicon"
              description="Ícone exibido na aba do navegador"
              logo={favicon}
              inputRef={faviconRef}
              logoType="favicon"
              recommendedSize="32x32px ou 16x16px (formato .ico, .png)"
            />
          </TabsContent>

          <TabsContent value="colors" className="space-y-6 overflow-y-auto flex-1">
            {/* Módulo Clean */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-blue-600" />
                  Cores do Módulo Clean
                </CardTitle>
                <CardDescription>
                  Cores personalizadas para o módulo de limpeza
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={moduleColors.clean?.primary || '#1e3a8a'}
                        onChange={(e) => handleColorChange('clean', 'primary', e.target.value)}
                        className="h-10 w-14"
                        data-testid="input-clean-primary-color"
                      />
                      <Input
                        type="text"
                        value={moduleColors.clean?.primary || '#1e3a8a'}
                        onChange={(e) => handleColorChange('clean', 'primary', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={moduleColors.clean?.secondary || '#3b82f6'}
                        onChange={(e) => handleColorChange('clean', 'secondary', e.target.value)}
                        className="h-10 w-14"
                        data-testid="input-clean-secondary-color"
                      />
                      <Input
                        type="text"
                        value={moduleColors.clean?.secondary || '#3b82f6'}
                        onChange={(e) => handleColorChange('clean', 'secondary', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cor de Destaque</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={moduleColors.clean?.accent || '#60a5fa'}
                        onChange={(e) => handleColorChange('clean', 'accent', e.target.value)}
                        className="h-10 w-14"
                        data-testid="input-clean-accent-color"
                      />
                      <Input
                        type="text"
                        value={moduleColors.clean?.accent || '#60a5fa'}
                        onChange={(e) => handleColorChange('clean', 'accent', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Módulo Maintenance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-orange-600" />
                  Cores do Módulo Manutenção
                </CardTitle>
                <CardDescription>
                  Cores personalizadas para o módulo de manutenção
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={moduleColors.maintenance?.primary || '#FF9800'}
                        onChange={(e) => handleColorChange('maintenance', 'primary', e.target.value)}
                        className="h-10 w-14"
                        data-testid="input-maintenance-primary-color"
                      />
                      <Input
                        type="text"
                        value={moduleColors.maintenance?.primary || '#FF9800'}
                        onChange={(e) => handleColorChange('maintenance', 'primary', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={moduleColors.maintenance?.secondary || '#FB8C00'}
                        onChange={(e) => handleColorChange('maintenance', 'secondary', e.target.value)}
                        className="h-10 w-14"
                        data-testid="input-maintenance-secondary-color"
                      />
                      <Input
                        type="text"
                        value={moduleColors.maintenance?.secondary || '#FB8C00'}
                        onChange={(e) => handleColorChange('maintenance', 'secondary', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cor de Destaque</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={moduleColors.maintenance?.accent || '#FFB74D'}
                        onChange={(e) => handleColorChange('maintenance', 'accent', e.target.value)}
                        className="h-10 w-14"
                        data-testid="input-maintenance-accent-color"
                      />
                      <Input
                        type="text"
                        value={moduleColors.maintenance?.accent || '#FFB74D'}
                        onChange={(e) => handleColorChange('maintenance', 'accent', e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Rodapé fixo com botões - sempre visível */}
        <div className="flex justify-end gap-2 border-t pt-4 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          
          {activeTab === 'logos' ? (
            <Button
              variant="outline"
              onClick={handleSaveLogos}
              disabled={!hasLogoChanges || isSavingLogos}
              data-testid="button-save-logos"
            >
              <Check className="mr-2 h-4 w-4" />
              {isSavingLogos ? 'Salvando...' : 'Confirmar Logos'}
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleSaveColors}
              disabled={updateBrandingMutation.isPending}
              data-testid="button-save-colors"
            >
              <Check className="mr-2 h-4 w-4" />
              {updateBrandingMutation.isPending ? 'Salvando...' : 'Salvar Cores'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
