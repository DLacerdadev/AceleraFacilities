import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  Settings, 
  Building, 
  Users, 
  QrCode, 
  Calendar, 
  List, 
  BarChart3, 
  ChevronRight,
  Cog,
  Bell,
  Shield,
  Database,
  Globe,
  Palette
} from "lucide-react";

interface SettingsMobileProps {
  onNavigate: (page: string) => void;
}

export default function SettingsMobile({ onNavigate }: SettingsMobileProps) {
  const mainSettings = [
    { 
      icon: Users, 
      label: "Usuários e Permissões", 
      description: "Gerenciar usuários, perfis e acessos",
      page: "users", 
      color: "text-blue-600", 
      bg: "bg-blue-50",
      badge: null
    },
    { 
      icon: Building, 
      label: "Locais e Zonas", 
      description: "Locais, plantas e áreas de limpeza",
      page: "sites", 
      color: "text-green-600", 
      bg: "bg-green-50",
      badge: null
    },
    { 
      icon: List, 
      label: "Tipos de Serviço", 
      description: "Categorias e tipos de serviços",
      page: "services", 
      color: "text-purple-600", 
      bg: "bg-purple-50",
      badge: null
    },
  ];

  const operationalSettings = [
    { 
      icon: Calendar, 
      label: "Cronograma de Limpeza", 
      description: "Programação e frequências",
      page: "schedule", 
      color: "text-pink-600", 
      bg: "bg-pink-50",
      badge: null
    },
    { 
      icon: QrCode, 
      label: "QR Codes", 
      description: "Pontos de execução e atendimento",
      page: "qrcodes", 
      color: "text-orange-600", 
      bg: "bg-orange-50",
      badge: null
    },
    { 
      icon: List, 
      label: "Checklists", 
      description: "Templates de checklist",
      page: "checklists", 
      color: "text-indigo-600", 
      bg: "bg-indigo-50",
      badge: null
    },
  ];

  const systemSettings = [
    { 
      icon: Cog, 
      label: "Configurações do Sistema", 
      description: "Parâmetros gerais",
      page: "service-settings", 
      color: "text-slate-600", 
      bg: "bg-slate-50",
      badge: null
    },
    { 
      icon: Bell, 
      label: "Notificações", 
      description: "Alertas e avisos",
      page: "notifications", 
      color: "text-yellow-600", 
      bg: "bg-yellow-50",
      badge: "Em breve"
    },
    { 
      icon: Database, 
      label: "Backup e Dados", 
      description: "Gerenciar backups",
      page: "backup", 
      color: "text-cyan-600", 
      bg: "bg-cyan-50",
      badge: "Em breve"
    },
  ];

  const analyticsSettings = [
    { 
      icon: BarChart3, 
      label: "Relatórios", 
      description: "Métricas e análises",
      page: "reports", 
      color: "text-violet-600", 
      bg: "bg-violet-50",
      badge: null
    },
    { 
      icon: BarChart3, 
      label: "Dashboards BI", 
      description: "Painéis de controle",
      page: "dashboards", 
      color: "text-teal-600", 
      bg: "bg-teal-50",
      badge: null
    },
  ];

  const renderSettingButton = (item: any) => (
    <Button
      key={item.page}
      variant="ghost"
      onClick={() => onNavigate(item.page)}
      className="w-full justify-start p-0 h-auto hover:bg-transparent group"
      data-testid={`button-navigate-${item.page}`}
      disabled={!!item.badge}
    >
      <Card className="w-full border-0 shadow-sm hover:shadow-md transition-all group-hover:scale-[1.01]">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 ${item.bg} rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
              <item.icon className={`w-7 h-7 ${item.color}`} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold text-gray-900 text-base" data-testid={`text-setting-label-${item.page}`}>
                  {item.label}
                </p>
                {item.badge && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
          </div>
        </CardContent>
      </Card>
    </Button>
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header Moderno */}
      <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-6 pb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center ring-4 ring-white/20">
            <Settings className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Configurações</h1>
            <p className="text-sm text-white/80">Gerenciar sistema OPUS CLEAN</p>
          </div>
        </div>
      </div>

      {/* Conteúdo com margem negativa para sobrepor o header */}
      <div className="px-4 -mt-4 space-y-6">
        {/* Configurações Principais */}
        <div>
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                Gerenciamento Principal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-2 pb-2">
              {mainSettings.map((item, index) => (
                <div key={item.page}>
                  {renderSettingButton(item)}
                  {index < mainSettings.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Configurações Operacionais */}
        <div>
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Cog className="w-5 h-5 text-green-600" />
                Operações
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-2 pb-2">
              {operationalSettings.map((item, index) => (
                <div key={item.page}>
                  {renderSettingButton(item)}
                  {index < operationalSettings.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Análises e Relatórios */}
        <div>
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                Análises
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-2 pb-2">
              {analyticsSettings.map((item, index) => (
                <div key={item.page}>
                  {renderSettingButton(item)}
                  {index < analyticsSettings.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Configurações do Sistema */}
        <div>
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-slate-600" />
                Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-2 pb-2">
              {systemSettings.map((item, index) => (
                <div key={item.page}>
                  {renderSettingButton(item)}
                  {index < systemSettings.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Card Informativo */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shrink-0">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 mb-1">Sistema OPUS CLEAN</p>
                <p className="text-sm text-gray-600">
                  Gerencie todos os aspectos do sistema de limpeza e facilities em um só lugar.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
