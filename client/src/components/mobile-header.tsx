import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useModule, MODULE_CONFIGS } from "@/contexts/ModuleContext";
import { useUserModules } from "@/hooks/useUserModules";
import { useClient } from "@/contexts/ClientContext";
import { ArrowLeft, Wrench, Building, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  backUrl?: string;
  actions?: React.ReactNode;
}

export function MobileHeader({ title, subtitle, showBack = false, backUrl = "/mobile", actions }: MobileHeaderProps) {
  const [, setLocation] = useLocation();
  const { currentModule, moduleConfig, hasMultipleModules, canAccessModule, setModule, allowedModules } = useModule();
  const { activeClient } = useClient();
  
  // 🔥 CORRIGIDO: Calcular módulos permitidos baseado na interseção entre módulos do usuário e do cliente ativo
  const clientModules = (activeClient?.modules || []) as ('clean' | 'maintenance')[];
  const effectiveAllowedModules = allowedModules.filter(module => clientModules.includes(module));
  const effectiveHasMultipleModules = effectiveAllowedModules.length > 1;

  // 🔥 CORRIGIDO: Se usuário não tem acesso ao módulo atual, forçar para o primeiro permitido
  if (!canAccessModule(currentModule)) {
    console.warn(`[MOBILE HEADER] ⚠️ Usuário não tem acesso ao módulo ${currentModule}. Forçando para ${allowedModules[0]}`);
    // Forçar troca para o primeiro módulo permitido ao invés de esconder tudo
    if (allowedModules.length > 0 && allowedModules[0] !== currentModule) {
      setModule(allowedModules[0]);
    }
    // Renderizar o header mesmo assim para evitar tela quebrada
  }

  const handleBack = () => {
    setLocation(backUrl);
  };

  const handleToggleModule = () => {
    // 🔥 CORRIGIDO: Só alternar se ambos os módulos estão disponíveis
    const nextModule = currentModule === 'clean' ? 'maintenance' : 'clean';
    
    // Verificar se o próximo módulo está na lista de módulos efetivamente permitidos
    if (effectiveAllowedModules.includes(nextModule) && canAccessModule(nextModule)) {
      setModule(nextModule);
      // Redirecionar para o dashboard mobile
      setLocation('/mobile');
    }
  };

  return (
    <div className={`sticky top-0 z-50 shadow-md ${
      currentModule === 'maintenance'
        ? 'bg-gradient-to-r from-orange-500 to-amber-600'
        : 'bg-gradient-to-r from-blue-600 to-cyan-600'
    }`}>
      <div className="px-4 py-3">
        {/* Linha 1: Navegação e Ações */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {showBack && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBack}
                className="text-white hover:bg-white/20 p-2"
                data-testid="button-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {actions}
          </div>
        </div>

        {/* Linha 2: Título e Indicador de Módulo */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white truncate" data-testid="text-page-title">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-white/90 mt-1" data-testid="text-page-subtitle">
                {subtitle}
              </p>
            )}
          </div>

          {/* Indicador/Seletor de Módulo Ativo - Mostrar botão apenas se cliente atual tem múltiplos módulos */}
          {effectiveHasMultipleModules ? (
            <Button
              onClick={handleToggleModule}
              variant="secondary"
              size="sm"
              className={`flex items-center gap-1.5 px-3 py-1.5 shrink-0 transition-all hover:scale-105 active:scale-95 ${
                currentModule === 'maintenance'
                  ? 'bg-white text-orange-600 border-orange-300 hover:bg-orange-50 hover:border-orange-400'
                  : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50 hover:border-blue-400'
              }`}
              data-testid="button-toggle-module"
            >
              {currentModule === 'maintenance' ? (
                <Wrench className="w-3.5 h-3.5" />
              ) : (
                <Building className="w-3.5 h-3.5" />
              )}
              <span className="text-xs font-semibold">
                {currentModule === 'maintenance' ? 'Manutenção' : 'Clean'}
              </span>
              <RefreshCw className="w-3 h-3 ml-0.5 opacity-60" />
            </Button>
          ) : (
            <Badge 
              variant="secondary"
              className={`flex items-center gap-1.5 px-3 py-1.5 shrink-0 ${
                currentModule === 'maintenance'
                  ? 'bg-white text-orange-600 border-orange-300'
                  : 'bg-white text-blue-600 border-blue-300'
              }`}
              data-testid="badge-current-module"
            >
              {currentModule === 'maintenance' ? (
                <Wrench className="w-3.5 h-3.5" />
              ) : (
                <Building className="w-3.5 h-3.5" />
              )}
              <span className="text-xs font-semibold">
                {currentModule === 'maintenance' ? 'Manutenção' : 'Clean'}
              </span>
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
