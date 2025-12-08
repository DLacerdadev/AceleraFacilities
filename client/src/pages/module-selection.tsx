import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Wrench, Loader2, ArrowRight, CheckCircle2, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useModule } from "@/contexts/ModuleContext";
import { useAuth } from "@/hooks/useAuth";
import { useBranding } from "@/contexts/BrandingContext";
import { useClient } from "@/contexts/ClientContext";
import { LogoImage } from "@/components/logo-image";
import { useSubdomainNavigation } from "@/hooks/useSubdomainNavigation";
import aceleraLogo from "@assets/acelera-full-facilities-logo.png";

interface Customer {
  id: string;
  name: string;
  isActive: boolean;
  modules: string[];
}

export default function ModuleSelection() {
  const [, setLocation] = useLocation();
  const { setModule } = useModule();
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { branding } = useBranding();
  const { subdomainCustomer, setActiveClientId } = useClient();
  const { navigateTo } = useSubdomainNavigation();

  const companyId = user?.companyId || "company-opus-default";
  const isCustomerUser = user?.userType === 'customer_user';
  const userCustomerId = user?.customerId;

  const { data: modulesData, isLoading: isLoadingModules } = useQuery<{ modules: string[]; defaultModule: string }>({
    queryKey: ["/api/auth/user-modules"],
  });

  const { data: allCustomers = [], isLoading: isLoadingCustomers } = useQuery<Customer[]>({
    queryKey: ["/api/companies", companyId, "customers"],
    enabled: !isCustomerUser && !!companyId,
  });

  const availableModules = modulesData?.modules || [];
  const activeCustomers = (allCustomers as Customer[]).filter(c => c.isActive);

  useEffect(() => {
    if (availableModules.length === 1) {
      const module = availableModules[0] as 'clean' | 'maintenance';
      handleModuleSelect(module);
    }
  }, [availableModules]);

  useEffect(() => {
    if (!user) {
      navigateTo("/login");
    }
  }, [user]);

  const handleModuleSelect = async (module: 'clean' | 'maintenance') => {
    setIsLoading(true);
    setModule(module);
    
    // Priority 1: If subdomain customer is set and has this module, use it
    if (subdomainCustomer && subdomainCustomer.modules?.includes(module)) {
      console.log(`[MODULE SELECTION] 🎯 Using subdomain customer: ${subdomainCustomer.name} for module ${module}`);
      setActiveClientId(subdomainCustomer.id);
      localStorage.setItem('opus:activeClientId', subdomainCustomer.id);
      setTimeout(() => navigateTo("/"), 300);
      return;
    }
    
    // Priority 2: If customer_user, use their assigned customer
    if (isCustomerUser && userCustomerId) {
      localStorage.setItem('opus:activeClientId', userCustomerId);
      setTimeout(() => navigateTo("/"), 300);
      return;
    }

    // Priority 3: Find first customer with this module
    const customersWithModule = activeCustomers.filter(customer => 
      customer.modules.includes(module)
    );

    if (customersWithModule.length > 0) {
      const selectedCustomer = customersWithModule[0];
      setActiveClientId(selectedCustomer.id);
      localStorage.setItem('opus:activeClientId', selectedCustomer.id);
      console.log(`[MODULE SELECTION] Módulo ${module} selecionado. Cliente ativo: ${selectedCustomer.name}`);
    } else {
      console.warn(`[MODULE SELECTION] Nenhum cliente encontrado com o módulo ${module}`);
    }
    
    setTimeout(() => {
      navigateTo("/");
    }, 300);
  };

  if (isLoadingModules) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-700">Carregando módulos...</p>
        </div>
      </div>
    );
  }

  if (availableModules.length === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-700">Redirecionando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-6xl">
          {/* Header with Logo */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
            data-testid="header-module-selection"
          >
            <LogoImage
              src={branding?.homeLogo}
              fallbackSrc={aceleraLogo}
              alt={branding?.name || "Acelera Full Facilities"}
              className="h-32 mx-auto mb-8"
              data-testid="img-module-selection-logo"
            />
            <h1 className="text-4xl font-bold text-slate-900 mb-3">
              Selecione o Módulo
            </h1>
            <p className="text-lg text-slate-600">
              Escolha qual área da plataforma você deseja acessar
            </p>
          </motion.div>

          {/* Module Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {/* Clean Module Card */}
            {availableModules.includes('clean') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                data-testid="card-module-clean"
              >
                <Card 
                  className="group relative overflow-hidden border-2 border-slate-200 hover:border-blue-400 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer bg-white h-full"
                  onClick={() => !isLoading && handleModuleSelect('clean')}
                >
                  <CardContent className="p-8">
                    {/* Module Header */}
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Building2 className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-900 mb-1" data-testid="text-module-clean-title">
                          Acelera Clean
                        </h2>
                        <p className="text-sm text-slate-600" data-testid="text-module-clean-description">
                          Gestão de Limpeza e Facilities
                        </p>
                      </div>
                    </div>

                    {/* ROI Metrics */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                        <div className="text-2xl font-bold text-blue-600 mb-1">45%</div>
                        <div className="text-xs text-blue-700 font-medium">Redução de Custos</div>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                        <div className="text-2xl font-bold text-blue-600 mb-1">3x</div>
                        <div className="text-xs text-blue-700 font-medium">Mais Eficiência</div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">Controle de ordens de serviço e checklists</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">Gestão de equipes, turnos e locais</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">QR codes para execução em campo</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">Relatórios e dashboards em tempo real</span>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <Button
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-6 rounded-xl shadow-lg group-hover:shadow-xl transition-all"
                      data-testid="button-select-clean"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>Acessar Módulo Clean</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Maintenance Module Card */}
            {availableModules.includes('maintenance') && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                data-testid="card-module-maintenance"
              >
                <Card 
                  className="group relative overflow-hidden border-2 border-slate-200 hover:border-orange-400 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer bg-white h-full"
                  onClick={() => !isLoading && handleModuleSelect('maintenance')}
                >
                  <CardContent className="p-8">
                    {/* Module Header */}
                    <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-200">
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Wrench className="w-8 h-8 text-white" />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-2xl font-bold text-slate-900 mb-1" data-testid="text-module-maintenance-title">
                          Acelera Manutenção
                        </h2>
                        <p className="text-sm text-slate-600" data-testid="text-module-maintenance-description">
                          Gestão de Manutenção Preventiva e Corretiva
                        </p>
                      </div>
                    </div>

                    {/* ROI Metrics */}
                    <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                        <div className="text-2xl font-bold text-orange-600 mb-1">60%</div>
                        <div className="text-xs text-orange-700 font-medium">Menos Downtime</div>
                      </div>
                      <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                        <div className="text-2xl font-bold text-orange-600 mb-1">2.5x</div>
                        <div className="text-xs text-orange-700 font-medium">Vida Útil Ativos</div>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-3 mb-6">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">Manutenção preventiva automatizada</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">Gestão de equipamentos e ativos</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">Calendário de atividades e planos</span>
                      </div>
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-slate-700">Solicitações públicas via QR code</span>
                      </div>
                    </div>

                    {/* CTA Button */}
                    <Button
                      disabled={isLoading}
                      className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white font-bold py-6 rounded-xl shadow-lg group-hover:shadow-xl transition-all"
                      data-testid="button-select-maintenance"
                    >
                      {isLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <span>Acessar Módulo Manutenção</span>
                          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>

          {/* Footer Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-12 text-center"
          >
            <div className="inline-flex items-center gap-2 text-sm text-slate-500">
              <TrendingUp className="w-4 h-4" />
              <span>Aumente a eficiência operacional da sua empresa</span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
