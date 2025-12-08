import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  ArrowRight, 
  Building2, 
  Wrench,
  ClipboardCheck, 
  TrendingUp, 
  Shield, 
  Users,
  BarChart3,
  Clock,
  CheckCircle2,
  Zap,
  MapPin,
  CalendarDays,
  AlertCircle
} from "lucide-react";
import { useBranding } from "@/contexts/BrandingContext";
import { useClient } from "@/contexts/ClientContext";
import { LogoImage } from "@/components/logo-image";
import { useSubdomainNavigation } from "@/hooks/useSubdomainNavigation";
import aceleraLogo from "@assets/acelera-full-facilities-logo.png";

export default function Landing() {
  const [, setLocation] = useLocation();
  const [activeSlide, setActiveSlide] = useState(0);
  const { branding, isLoading: isBrandingLoading } = useBranding();
  const { subdomainCustomer, isSubdomainLoading } = useClient();
  const { navigateTo, getPathWithSubdomain } = useSubdomainNavigation();

  const stats = [
    { value: "45%", label: "Redução de Custos" },
    { value: "3x", label: "Mais Produtividade" },
    { value: "99%", label: "Uptime Garantido" },
    { value: "24/7", label: "Suporte Enterprise" }
  ];

  const features = [
    {
      icon: Building2,
      title: "Gestão de Facilities",
      description: "Controle completo de múltiplos locais, zonas e equipamentos em uma única plataforma"
    },
    {
      icon: Wrench,
      title: "Manutenção Inteligente",
      description: "Preventiva e corretiva automatizada com notificações e SLA tracking"
    },
    {
      icon: ClipboardCheck,
      title: "Ordens de Serviço",
      description: "Gestão end-to-end com QR codes, fotos, assinaturas e histórico completo"
    },
    {
      icon: TrendingUp,
      title: "Analytics em Tempo Real",
      description: "Dashboards personalizados com métricas de desempenho e ROI"
    },
    {
      icon: Users,
      title: "Gestão de Equipes",
      description: "Controle de colaboradores, turnos, permissões e produtividade"
    },
    {
      icon: Shield,
      title: "Segurança Enterprise",
      description: "SSO, autenticação multi-fator e controle granular de acessos"
    }
  ];

  const benefits = [
    { icon: Clock, text: "Reduza tempo de resposta em até 60%" },
    { icon: BarChart3, text: "Aumente eficiência operacional em 45%" },
    { icon: Zap, text: "Automatize 80% dos processos manuais" },
    { icon: CheckCircle2, text: "Conformidade e auditoria garantidas" }
  ];

  // Dashboard carousel slides
  const dashboardSlides = [
    {
      title: "Dashboard Facilities",
      subtitle: "Visão Geral",
      icon: Building2,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-lg p-4">
              <div className="text-xs text-emerald-700 font-medium mb-1">OSs Concluídas</div>
              <div className="text-2xl font-bold text-emerald-600">487</div>
              <div className="text-xs text-emerald-600 mt-1">↑ 23% vs mês anterior</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg p-4">
              <div className="text-xs text-blue-700 font-medium mb-1">Locais Ativos</div>
              <div className="text-2xl font-bold text-blue-600">24</div>
              <div className="text-xs text-blue-600 mt-1">100% cobertura</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-50/80 to-white rounded-lg p-4 border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <div className="text-xs font-semibold text-slate-700">Performance por Local</div>
              <div className="text-xs text-slate-500">Este mês</div>
            </div>
            <div className="space-y-3">
              {[
                { name: 'Local 1', value: 85 },
                { name: 'Local 2', value: 72 },
                { name: 'Local 3', value: 93 }
              ].map((local, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-slate-700">{local.name}</div>
                    <div className="text-xs font-bold text-slate-900">{local.value}%</div>
                  </div>
                  <div className="relative h-2.5 bg-gradient-to-r from-slate-100 to-slate-200 rounded-full overflow-hidden shadow-inner">
                    <div 
                      className={`absolute h-full rounded-full transition-all duration-700 ease-out ${
                        local.value >= 80 ? 'bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600' :
                        local.value >= 60 ? 'bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600' :
                        'bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600'
                      }`}
                      style={{ width: `${local.value}%` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Manutenção",
      subtitle: "Ordens de Serviço",
      icon: Wrench,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200 rounded-lg p-3">
              <div className="text-xs text-amber-700 font-medium mb-1">Pendentes</div>
              <div className="text-xl font-bold text-amber-600">12</div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-700 font-medium mb-1">Em Andamento</div>
              <div className="text-xl font-bold text-blue-600">8</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-lg p-3">
              <div className="text-xs text-emerald-700 font-medium mb-1">Concluídas</div>
              <div className="text-xl font-bold text-emerald-600">156</div>
            </div>
          </div>
          <div className="bg-gradient-to-br from-slate-50/80 to-white rounded-lg p-4 border border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-3">OSs Recentes</div>
            <div className="space-y-2">
              {[
                { id: 'OS-1234', local: 'Edifício A - Sala 301', priority: 'alta', status: 'Em andamento' },
                { id: 'OS-1235', local: 'Edifício B - Corredor', priority: 'média', status: 'Pendente' },
                { id: 'OS-1236', local: 'Edifício C - Entrada', priority: 'baixa', status: 'Concluída' }
              ].map((os, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">{os.id}</div>
                    <div className="text-xs text-slate-500">{os.local}</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded-full font-medium ${
                    os.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' :
                    os.status === 'Em andamento' ? 'bg-blue-100 text-blue-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {os.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Analytics",
      subtitle: "Performance",
      icon: TrendingUp,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg p-4">
            <div className="text-xs text-blue-700 font-medium mb-3">Tempo Médio de Conclusão</div>
            <div className="flex items-end gap-1 mb-2">
              {[45, 62, 38, 72, 55, 48, 65].map((height, i) => (
                <div key={i} className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t" style={{ height: `${height}px` }}></div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Última semana</div>
              <div className="text-lg font-bold text-blue-600">2.4h</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-lg p-3">
              <div className="text-xs text-emerald-700 font-medium mb-1">SLA Cumprido</div>
              <div className="text-2xl font-bold text-emerald-600">96%</div>
              <div className="text-xs text-emerald-600 mt-1">↑ 4% este mês</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-lg p-3">
              <div className="text-xs text-purple-700 font-medium mb-1">Equipes Ativas</div>
              <div className="text-2xl font-bold text-purple-600">18</div>
              <div className="text-xs text-purple-600 mt-1">6 locais</div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Calendário",
      subtitle: "Programação",
      icon: CalendarDays,
      content: (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-slate-50/80 to-white rounded-lg p-4 border border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-3">Próximas Manutenções</div>
            <div className="space-y-2">
              {[
                { dia: '15', mes: 'Jan', titulo: 'Manutenção Preventiva - Ar Condicionado', local: 'Ed. A' },
                { dia: '18', mes: 'Jan', titulo: 'Inspeção de Segurança', local: 'Ed. B' },
                { dia: '22', mes: 'Jan', titulo: 'Limpeza Técnica - Sistemas', local: 'Ed. C' }
              ].map((evento, i) => (
                <div key={i} className="flex gap-3 p-2 bg-white rounded-lg border border-slate-200">
                  <div className="flex flex-col items-center justify-center bg-blue-50 rounded-lg px-3 py-2 min-w-[50px]">
                    <div className="text-xl font-bold text-blue-600">{evento.dia}</div>
                    <div className="text-xs text-blue-600">{evento.mes}</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-slate-900">{evento.titulo}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{evento.local}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg p-3">
            <div className="text-xs text-blue-700 font-medium mb-1">Atividades Programadas</div>
            <div className="text-2xl font-bold text-blue-600">24</div>
            <div className="text-xs text-blue-600 mt-1">Este mês</div>
          </div>
        </div>
      )
    }
  ];

  // Auto-advance carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % dashboardSlides.length);
    }, 4000); // Change slide every 4 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Show loading state while branding is being detected
  if (isBrandingLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-600">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-b border-slate-200/50 shadow-sm z-50">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between py-2">
            <div className="flex-shrink-0">
              <LogoImage 
                type="home"
                fallbackSrc={aceleraLogo}
                alt="Acelera Full Facilities" 
                className="h-[100px] my-[-10px]"
                data-testid="img-logo"
              />
            </div>
            <Button 
              onClick={() => navigateTo("/login")}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 font-medium"
              data-testid="button-login-header"
            >
              Acessar Sistema
            </Button>
          </div>
        </div>
      </nav>
      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 pt-28">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left Content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl lg:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              Transforme a Gestão de <span className="text-blue-600">Facilities</span> da sua Empresa
            </h1>

            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              Plataforma completa para gerenciamento de limpeza, manutenção e facilities. 
              Automatize processos, reduza custos e aumente a eficiência operacional.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-3xl font-bold text-blue-600 mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-600 font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-wrap gap-4">
              <Button 
                onClick={() => navigateTo("/login")}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold px-8 py-7 text-lg rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all duration-300 group"
                data-testid="button-start"
              >
                Começar Agora
                <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button 
                onClick={() => navigateTo("/login")}
                size="lg"
                variant="outline"
                className="border-2 border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold px-8 py-7 text-lg rounded-xl"
              >
                Ver Demonstração
              </Button>
            </div>
          </motion.div>

          {/* Right Content - Interactive Dashboard Carousel */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl border-2 border-slate-200 bg-white shadow-2xl p-6 overflow-hidden min-h-[400px]">
              {/* Dashboard Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    {(() => {
                      const Icon = dashboardSlides[activeSlide].icon;
                      return <Icon className="w-5 h-5 text-blue-600" />;
                    })()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {dashboardSlides[activeSlide].title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {dashboardSlides[activeSlide].subtitle}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  {dashboardSlides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveSlide(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === activeSlide 
                          ? 'bg-blue-500 w-6' 
                          : 'bg-slate-300 hover:bg-slate-400'
                      }`}
                      data-testid={`button-slide-${index}`}
                    />
                  ))}
                </div>
              </div>

              {/* Carousel Content */}
              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeSlide}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.3 }}
                  >
                    {dashboardSlides[activeSlide].content}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            
            {/* Decorative Element */}
            <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-full blur-3xl"></div>
          </motion.div>
        </div>
      </section>
      {/* Benefits Bar */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-500 py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.text}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
                  <benefit.icon className="w-6 h-6 text-white" />
                </div>
                <p className="text-white font-medium text-sm leading-tight">{benefit.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* Features Section */}
      <section className="container mx-auto px-6 py-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl font-bold text-slate-900 mb-4">
            Tudo que você precisa para gerenciar suas Facilities
          </h2>
          <p className="text-xl text-slate-600 max-w-3xl mx-auto">
            Solução completa e integrada para gestão de facilities, manutenção e limpeza em ambientes corporativos
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="p-8 h-full border-2 border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all duration-300 bg-white">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-6 shadow-lg shadow-blue-200">
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
      {/* CTA Final */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-20">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-bold text-white mb-6">
              Pronto para transformar sua gestão de facilities?
            </h2>
            <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
              Junte-se a centenas de empresas que já otimizaram suas operações com o Acelera it Full Facilities
            </p>
            <Button 
              onClick={() => navigateTo("/login")}
              size="lg"
              className="bg-white text-blue-600 hover:bg-slate-100 font-bold px-10 py-7 text-lg rounded-xl shadow-2xl"
            >
              Começar Gratuitamente
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </section>
      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-slate-600">© 2025 Acelera it Full Facilities. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
