import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getAuthState } from "@/lib/auth";
import { ModernPageHeader } from "@/components/ui/modern-page-header";
import { ModernCard, ModernCardHeader, ModernCardContent } from "@/components/ui/modern-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { cn } from "@/lib/utils";
import { 
  Bot, Plus, Edit, Trash2, TestTube, Loader2, 
  Check, X, Brain, Sparkles, Shield, Key,
  AlertCircle, CheckCircle2, XCircle, Clock, Cloud, ExternalLink, Info
} from "lucide-react";
import { SiOpenai, SiGoogle } from "react-icons/si";

type AiProvider = 'openai' | 'anthropic' | 'google' | 'groq' | 'azure_openai' | 'cohere' | 'huggingface' | 'custom';
type IntegrationStatus = 'ativa' | 'inativa' | 'erro';

interface AiIntegration {
  id: string;
  companyId: string;
  provider: AiProvider;
  name: string;
  apiKey: string;
  model?: string;
  endpoint?: string;
  status: IntegrationStatus;
  isDefault: boolean;
  lastTestedAt?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

const providerOptions = [
  { value: 'openai', label: 'OpenAI', icon: SiOpenai, color: 'text-emerald-600' },
  { value: 'anthropic', label: 'Anthropic (Claude)', icon: Brain, color: 'text-orange-600' },
  { value: 'google', label: 'Google AI', icon: SiGoogle, color: 'text-blue-600' },
  { value: 'groq', label: 'Groq (Llama 3 Grátis)', icon: Bot, color: 'text-indigo-600' },
  { value: 'azure_openai', label: 'Azure OpenAI', icon: Cloud, color: 'text-sky-600' },
  { value: 'cohere', label: 'Cohere', icon: Sparkles, color: 'text-purple-600' },
  { value: 'huggingface', label: 'HuggingFace', icon: Bot, color: 'text-yellow-600' },
  { value: 'custom', label: 'Custom Endpoint', icon: Shield, color: 'text-gray-600' }
];

interface ProviderConfig {
  keyLabel: string;
  keyPlaceholder: string;
  keyHelp: string;
  keyLink: string;
  requiresEndpoint: boolean;
  endpointLabel?: string;
  endpointPlaceholder?: string;
  endpointHelp?: string;
  modelLabel: string;
  modelPlaceholder: string;
  modelHelp?: string;
  modelRequired: boolean;
}

const providerConfigs: Record<AiProvider, ProviderConfig> = {
  openai: {
    keyLabel: 'OpenAI API Key',
    keyPlaceholder: 'sk-...',
    keyHelp: 'Sua chave de API do OpenAI',
    keyLink: 'https://platform.openai.com/api-keys',
    requiresEndpoint: false,
    modelLabel: 'Modelo',
    modelPlaceholder: 'gpt-4o, gpt-4-turbo, gpt-3.5-turbo',
    modelHelp: 'Deixe vazio para usar o modelo padrão (gpt-4o)',
    modelRequired: false
  },
  anthropic: {
    keyLabel: 'Anthropic API Key',
    keyPlaceholder: 'sk-ant-api03-...',
    keyHelp: 'Sua chave de API do Anthropic (Claude)',
    keyLink: 'https://console.anthropic.com/',
    requiresEndpoint: false,
    modelLabel: 'Modelo',
    modelPlaceholder: 'claude-3-5-sonnet-20241022, claude-3-opus',
    modelHelp: 'Deixe vazio para usar o modelo padrão (claude-3-5-sonnet)',
    modelRequired: false
  },
  google: {
    keyLabel: 'Google AI API Key',
    keyPlaceholder: 'AIza...',
    keyHelp: 'Sua chave de API do Google AI Studio',
    keyLink: 'https://aistudio.google.com/app/apikey',
    requiresEndpoint: false,
    modelLabel: 'Modelo',
    modelPlaceholder: 'gemini-2.0-flash-exp, gemini-1.5-pro',
    modelHelp: 'Deixe vazio para usar o modelo padrão (gemini-2.0-flash)',
    modelRequired: false
  },
  groq: {
    keyLabel: 'Groq API Key (GRÁTIS)',
    keyPlaceholder: 'gsk_...',
    keyHelp: 'Chave de API gratuita do Groq - sem limites absurdos',
    keyLink: 'https://console.groq.com/keys',
    requiresEndpoint: false,
    modelLabel: 'Modelo',
    modelPlaceholder: 'llama-3.3-70b-versatile, llama-3-groq-8b-tool-use',
    modelHelp: 'Deixe vazio para usar llama-3-groq-8b-tool-use (especializado em function calling)',
    modelRequired: false
  },
  azure_openai: {
    keyLabel: 'Azure OpenAI API Key',
    keyPlaceholder: 'xxx...',
    keyHelp: 'Chave de API do seu recurso Azure OpenAI',
    keyLink: 'https://portal.azure.com',
    requiresEndpoint: true,
    endpointLabel: 'Endpoint Azure',
    endpointPlaceholder: 'https://seu-recurso.openai.azure.com',
    endpointHelp: 'URL do endpoint do seu recurso Azure OpenAI',
    modelLabel: 'Nome do Deployment',
    modelPlaceholder: 'gpt-4-deployment',
    modelHelp: 'Nome do deployment configurado no Azure (não o nome do modelo)',
    modelRequired: true
  },
  cohere: {
    keyLabel: 'Cohere API Key',
    keyPlaceholder: 'xxx...',
    keyHelp: 'Sua chave de API do Cohere',
    keyLink: 'https://dashboard.cohere.com/api-keys',
    requiresEndpoint: false,
    modelLabel: 'Modelo',
    modelPlaceholder: 'command-r-plus, command-r',
    modelHelp: 'Deixe vazio para usar o modelo padrão (command-r-plus)',
    modelRequired: false
  },
  huggingface: {
    keyLabel: 'HuggingFace API Token',
    keyPlaceholder: 'hf_...',
    keyHelp: 'Seu token de acesso do HuggingFace',
    keyLink: 'https://huggingface.co/settings/tokens',
    requiresEndpoint: false,
    modelLabel: 'Modelo',
    modelPlaceholder: 'meta-llama/Llama-3.3-70B-Instruct',
    modelHelp: 'Nome completo do modelo no formato autor/modelo',
    modelRequired: false
  },
  custom: {
    keyLabel: 'API Key',
    keyPlaceholder: 'xxx...',
    keyHelp: 'Chave de autenticação da API personalizada',
    keyLink: '',
    requiresEndpoint: true,
    endpointLabel: 'Endpoint URL',
    endpointPlaceholder: 'https://api.exemplo.com/v1',
    endpointHelp: 'URL base da sua API personalizada',
    modelLabel: 'Modelo',
    modelPlaceholder: 'modelo-personalizado',
    modelHelp: 'Identificador do modelo na sua API',
    modelRequired: true
  }
};

export default function AiIntegrationsPage() {
  const { user } = getAuthState();
  const { toast } = useToast();
  const theme = useModuleTheme();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<AiIntegration | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    provider: 'openai' as AiProvider,
    name: '',
    apiKey: '',
    model: '',
    endpoint: '',
    isDefault: false
  });

  // Fetch integrations
  const { data: integrations = [], isLoading } = useQuery<AiIntegration[]>({
    queryKey: ['/api/ai-integrations'],
    enabled: (user as any)?.userType === 'opus_user'
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest('POST', '/api/ai-integrations', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-integrations'] });
      toast({ 
        title: "Integração criada", 
        description: "A integração AI foi criada com sucesso."
      });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao criar", 
        description: error.message || "Não foi possível criar a integração.",
        variant: "destructive"
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: Partial<typeof formData> }) => {
      return apiRequest('PUT', `/api/ai-integrations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-integrations'] });
      toast({ 
        title: "Integração atualizada", 
        description: "A integração AI foi atualizada com sucesso."
      });
      closeDialog();
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao atualizar", 
        description: error.message || "Não foi possível atualizar a integração.",
        variant: "destructive"
      });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/ai-integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-integrations'] });
      toast({ 
        title: "Integração removida", 
        description: "A integração AI foi removida com sucesso."
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao remover", 
        description: error.message || "Não foi possível remover a integração.",
        variant: "destructive"
      });
    }
  });

  // Test mutation
  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      setTestingId(id);
      const response = await apiRequest('POST', `/api/ai-integrations/${id}/test`, {});
      return response as unknown as { success: boolean; message: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-integrations'] });
      toast({ 
        title: data.success ? "✓ Conexão bem-sucedida" : "✗ Teste de conexão falhou", 
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
      setTestingId(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "✗ Erro ao testar conexão", 
        description: error.message || "Não foi possível testar a conexão.",
        variant: "destructive"
      });
      setTestingId(null);
    }
  });

  const openCreateDialog = () => {
    setEditingIntegration(null);
    setFormData({
      provider: 'openai',
      name: '',
      apiKey: '',
      model: '',
      endpoint: '',
      isDefault: false
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (integration: AiIntegration) => {
    setEditingIntegration(integration);
    setFormData({
      provider: integration.provider,
      name: integration.name,
      apiKey: '',
      model: integration.model || '',
      endpoint: integration.endpoint || '',
      isDefault: integration.isDefault
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingIntegration(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIntegration) {
      const updateData: any = { ...formData };
      if (!formData.apiKey) {
        delete updateData.apiKey;
      }
      updateMutation.mutate({ id: editingIntegration.id, data: updateData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getStatusBadge = (status: IntegrationStatus) => {
    const variants = {
      ativa: { variant: "default" as const, icon: CheckCircle2, text: "Ativa", className: "bg-green-600 hover:bg-green-700" },
      inativa: { variant: "secondary" as const, icon: Clock, text: "Inativa", className: "" },
      erro: { variant: "destructive" as const, icon: XCircle, text: "Erro", className: "" }
    };
    const config = variants[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };

  const getProviderIcon = (provider: AiProvider) => {
    const option = providerOptions.find(opt => opt.value === provider);
    if (!option) return <Bot className="h-5 w-5 text-gray-500" />;
    const Icon = option.icon;
    return <Icon className={`h-5 w-5 ${option.color}`} />;
  };

  const getProviderLabel = (provider: AiProvider) => {
    return providerOptions.find(opt => opt.value === provider)?.label || provider;
  };

  // Access control check
  if ((user as any)?.userType !== 'opus_user') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white p-4">
        <ModernCard variant="glass" className="max-w-2xl mx-auto mt-20">
          <ModernCardContent className="text-center py-12">
            <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso Restrito</h2>
            <p className="text-gray-600">
              Esta funcionalidade está disponível apenas para usuários OPUS.
            </p>
          </ModernCardContent>
        </ModernCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-gray-50 to-white">
      <ModernPageHeader
        title="Integrações AI"
        description="Configure e gerencie integrações com provedores de inteligência artificial"
        icon={Brain}
      />

      <div className="w-full px-6 py-8">
        {/* Development Notice */}
        <ModernCard variant="glass" className="mb-6 border-l-4 border-l-amber-500">
          <ModernCardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/20">
                <Info className="h-6 w-6 text-amber-600 dark:text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Funcionalidade em Desenvolvimento
                </h3>
                <p className="text-gray-700 dark:text-gray-300 mb-3">
                  O sistema de assistente AI está atualmente em desenvolvimento e será disponibilizado em breve.
                </p>
                <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>
                    Enquanto isso, você pode configurar as integrações AI que serão utilizadas quando a funcionalidade estiver disponível.
                  </span>
                </div>
              </div>
            </div>
          </ModernCardContent>
        </ModernCard>

        {/* Header Actions */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Shield className="h-4 w-4" />
            <span>Apenas usuários OPUS</span>
          </div>
          <Button 
            onClick={openCreateDialog}
            className={cn("flex items-center gap-2", theme.buttons.primary)}
            style={theme.buttons.primaryStyle}
            data-testid="button-add-integration"
          >
            <Plus className="h-4 w-4" />
            Nova Integração
          </Button>
        </div>

        {/* Integrations Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : integrations.length === 0 ? (
          <ModernCard variant="glass" className="text-center py-16">
            <ModernCardContent>
              <Bot className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Nenhuma integração configurada
              </h3>
              <p className="text-gray-600 mb-6">
                Configure sua primeira integração AI para começar
              </p>
              <Button 
                onClick={openCreateDialog}
                className={theme.buttons.primary}
                style={theme.buttons.primaryStyle}
              >
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Integração
              </Button>
            </ModernCardContent>
          </ModernCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {integrations.map((integration) => (
              <ModernCard 
                key={integration.id} 
                variant="glass"
                className="relative"
                data-testid={`card-integration-${integration.id}`}
              >
                {integration.isDefault && (
                  <div className="absolute top-3 right-3">
                    <Badge variant="default" className="flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Padrão
                    </Badge>
                  </div>
                )}
                
                <ModernCardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-white shadow-sm border">
                      {getProviderIcon(integration.provider)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900" data-testid={`text-name-${integration.id}`}>
                        {integration.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {getProviderLabel(integration.provider)}
                      </p>
                    </div>
                  </div>
                </ModernCardHeader>

                <ModernCardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Status</span>
                    {getStatusBadge(integration.status)}
                  </div>

                  {integration.model && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Modelo</span>
                      <span className="text-sm font-medium text-gray-900">
                        {integration.model}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">API Key</span>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                      {integration.apiKey}
                    </code>
                  </div>

                  {integration.lastTestedAt && (
                    <div className="text-xs text-gray-500">
                      Último teste: {new Date(integration.lastTestedAt).toLocaleString('pt-BR')}
                    </div>
                  )}

                  {integration.lastErrorMessage && (
                    <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded">
                      <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      <span>{integration.lastErrorMessage}</span>
                    </div>
                  )}

                  <div className="flex gap-2 pt-3 border-t">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => testMutation.mutate(integration.id)}
                      disabled={testingId === integration.id}
                      data-testid={`button-test-${integration.id}`}
                    >
                      {testingId === integration.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <TestTube className="h-3 w-3" />
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => openEditDialog(integration)}
                      data-testid={`button-edit-${integration.id}`}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (confirm('Deseja realmente remover esta integração?')) {
                          deleteMutation.mutate(integration.id);
                        }
                      }}
                      data-testid={`button-delete-${integration.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </ModernCardContent>
              </ModernCard>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              {editingIntegration ? 'Editar Integração' : 'Nova Integração AI'}
            </DialogTitle>
            <DialogDescription>
              {editingIntegration 
                ? 'Atualize as configurações da integração AI'
                : 'Configure uma nova integração com provedor de inteligência artificial'
              }
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provider">Provedor *</Label>
                <Select 
                  value={formData.provider} 
                  onValueChange={(value: AiProvider) => setFormData(prev => ({ ...prev, provider: value }))}
                  disabled={!!editingIntegration}
                >
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {providerOptions.map(option => {
                      const Icon = option.icon;
                      return (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${option.color}`} />
                            {option.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Nome da Integração *</Label>
                <Input
                  id="name"
                  placeholder="Ex: OpenAI GPT-4"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  data-testid="input-name"
                />
              </div>
            </div>

            {/* API Key Field - Dinâmico baseado no provedor */}
            <div className="space-y-2">
              <Label htmlFor="apiKey" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                {providerConfigs[formData.provider].keyLabel} {editingIntegration ? '(deixe em branco para manter)' : '*'}
              </Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={providerConfigs[formData.provider].keyPlaceholder}
                value={formData.apiKey}
                onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                required={!editingIntegration}
                data-testid="input-apikey"
              />
              <div className="flex items-start gap-2 text-xs text-gray-600">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <div>
                  <p>{providerConfigs[formData.provider].keyHelp}</p>
                  {providerConfigs[formData.provider].keyLink && (
                    <a 
                      href={providerConfigs[formData.provider].keyLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      Obter chave <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Endpoint Field - Condicional (Azure e Custom) */}
            {providerConfigs[formData.provider].requiresEndpoint && (
              <div className="space-y-2">
                <Label htmlFor="endpoint">{providerConfigs[formData.provider].endpointLabel} *</Label>
                <Input
                  id="endpoint"
                  placeholder={providerConfigs[formData.provider].endpointPlaceholder}
                  value={formData.endpoint}
                  onChange={(e) => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                  required
                  data-testid="input-endpoint"
                />
                {providerConfigs[formData.provider].endpointHelp && (
                  <div className="flex items-start gap-2 text-xs text-gray-600">
                    <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <p>{providerConfigs[formData.provider].endpointHelp}</p>
                  </div>
                )}
              </div>
            )}

            {/* Model Field - Dinâmico baseado no provedor */}
            <div className="space-y-2">
              <Label htmlFor="model">
                {providerConfigs[formData.provider].modelLabel} {providerConfigs[formData.provider].modelRequired ? '*' : '(opcional)'}
              </Label>
              <Input
                id="model"
                placeholder={providerConfigs[formData.provider].modelPlaceholder}
                value={formData.model}
                onChange={(e) => setFormData(prev => ({ ...prev, model: e.target.value }))}
                required={providerConfigs[formData.provider].modelRequired}
                data-testid="input-model"
              />
              {providerConfigs[formData.provider].modelHelp && (
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <p>{providerConfigs[formData.provider].modelHelp}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault" className="text-sm font-medium">
                  Definir como padrão
                </Label>
                <p className="text-xs text-gray-500">
                  Esta integração será usada como padrão para novos recursos AI
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isDefault: checked }))}
                data-testid="switch-default"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                variant="default"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
                className={theme.buttons.primary}
                style={theme.buttons.primaryStyle}
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    {editingIntegration ? 'Atualizar' : 'Criar'} Integração
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
