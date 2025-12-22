import { useState } from "react";
import { Switch, Route, useLocation, Link } from "wouter";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Users, 
  UsersRound,
  FileText,
  Calendar,
  Menu,
  LogOut,
  Building2,
  ClipboardCheck,
  Target,
  Sparkles,
  Wrench
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useModuleTheme } from "@/hooks/use-module-theme";
import { useModule } from "@/contexts/ModuleContext";
import { cn } from "@/lib/utils";
import { logout } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";
import ThirdPartyDashboard from "./dashboard";
import ThirdPartyUsers from "./users";
import ThirdPartyTeams from "./teams";
import ThirdPartyWorkOrders from "./work-orders";
import ThirdPartyReports from "./reports";
import ThirdPartyPlans from "./plans";
import ThirdPartyChecklists from "./checklists";
import ThirdPartyOperationalScopes from "./operational-scopes";

const menuItems = [
  { path: "/third-party", label: "Dashboard", icon: LayoutDashboard },
  { path: "/third-party/work-orders", label: "Ordens de Serviço", icon: ClipboardList },
  { path: "/third-party/plans", label: "Planos", icon: Calendar },
  { path: "/third-party/checklists", label: "Checklists", icon: ClipboardCheck },
  { path: "/third-party/scopes", label: "Escopos", icon: Target },
  { path: "/third-party/users", label: "Usuários", icon: Users },
  { path: "/third-party/teams", label: "Equipes", icon: UsersRound },
  { path: "/third-party/reports", label: "Relatórios", icon: FileText },
];

export default function ThirdPartyPortal() {
  const [location] = useLocation();
  const { user } = useAuth();
  const theme = useModuleTheme();
  const { currentModule, setCurrentModule } = useModule();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch allowed modules for this third-party company
  const { data: modulesData } = useQuery<{
    allowedModules: string[];
    companyName: string;
    customerId: string;
  }>({
    queryKey: ['/api/third-party-portal/my-modules', user?.thirdPartyCompanyId],
    enabled: !!user?.thirdPartyCompanyId,
  });

  const allowedModules = modulesData?.allowedModules || [];

  const handleLogout = async () => {
    await logout();
  };

  const handleModuleChange = (module: 'clean' | 'maintenance') => {
    setCurrentModule(module);
  };

  return (
    <div className="flex h-screen bg-background">
      <aside 
        className={cn(
          "bg-sidebar border-r transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-2 p-4 border-b">
            <Building2 className="w-6 h-6 text-primary" />
            {sidebarOpen && (
              <span className="font-semibold text-lg">Portal Terceiros</span>
            )}
          </div>
          
          <nav className="flex-1 p-2 space-y-1">
            {menuItems.map((item) => {
              const isActive = location === item.path || 
                (item.path !== "/third-party" && location.startsWith(item.path));
              
              return (
                <Link key={item.path} href={item.path}>
                  <a
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                        : "hover-elevate text-sidebar-foreground"
                    )}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <item.icon className="w-5 h-5" />
                    {sidebarOpen && <span>{item.label}</span>}
                  </a>
                </Link>
              );
            })}
          </nav>

          <div className="p-2 border-t">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-5 h-5" />
              {sidebarOpen && <span>Sair</span>}
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between gap-4 p-4 border-b bg-background">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            data-testid="button-toggle-sidebar"
          >
            <Menu className="w-5 h-5" />
          </Button>
          
          {/* Module Selector */}
          {allowedModules.length > 1 && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
              {allowedModules.includes('clean') && (
                <Button
                  variant={currentModule === 'clean' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleModuleChange('clean')}
                  className={cn(
                    "gap-2 transition-all",
                    currentModule === 'clean' 
                      ? "bg-blue-600 hover:bg-blue-700 text-white" 
                      : "hover:bg-muted"
                  )}
                  data-testid="button-module-clean"
                >
                  <Sparkles className="w-4 h-4" />
                  Limpeza
                </Button>
              )}
              {allowedModules.includes('maintenance') && (
                <Button
                  variant={currentModule === 'maintenance' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleModuleChange('maintenance')}
                  className={cn(
                    "gap-2 transition-all",
                    currentModule === 'maintenance' 
                      ? "bg-orange-600 hover:bg-orange-700 text-white" 
                      : "hover:bg-muted"
                  )}
                  data-testid="button-module-maintenance"
                >
                  <Wrench className="w-4 h-4" />
                  Manutenção
                </Button>
              )}
            </div>
          )}
          
          {/* Single module indicator */}
          {allowedModules.length === 1 && (
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium",
              allowedModules[0] === 'clean' 
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
            )}>
              {allowedModules[0] === 'clean' ? (
                <>
                  <Sparkles className="w-4 h-4" />
                  Limpeza
                </>
              ) : (
                <>
                  <Wrench className="w-4 h-4" />
                  Manutenção
                </>
              )}
            </div>
          )}
          
          <div className="flex items-center gap-4 ml-auto">
            <span className="text-sm text-muted-foreground">
              {user?.name}
            </span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <Switch>
            <Route path="/third-party" component={ThirdPartyDashboard} />
            <Route path="/third-party/work-orders" component={ThirdPartyWorkOrders} />
            <Route path="/third-party/plans" component={ThirdPartyPlans} />
            <Route path="/third-party/checklists" component={ThirdPartyChecklists} />
            <Route path="/third-party/scopes" component={ThirdPartyOperationalScopes} />
            <Route path="/third-party/users" component={ThirdPartyUsers} />
            <Route path="/third-party/teams" component={ThirdPartyTeams} />
            <Route path="/third-party/reports" component={ThirdPartyReports} />
          </Switch>
        </div>
      </main>
    </div>
  );
}
