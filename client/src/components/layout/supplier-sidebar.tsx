import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  FileText, 
  LogOut, 
  ChevronLeft, 
  ChevronRight,
  Building2,
  ShoppingCart
} from "lucide-react";
import { logout } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Supplier } from "@shared/schema";

function getAuthData() {
  const authStr = localStorage.getItem('acelera_auth');
  if (!authStr) return null;
  try {
    return JSON.parse(authStr);
  } catch {
    return null;
  }
}

interface SupplierSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function SupplierSidebar({ isCollapsed, onToggleCollapse }: SupplierSidebarProps) {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const authData = getAuthData();
  const userId = authData?.user?.id;
  const userName = authData?.user?.name || "Fornecedor";

  const { data: userSupplier } = useQuery<Supplier>({
    queryKey: ['/api/users', userId, 'supplier'],
    enabled: !!userId,
  });

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
      window.location.reload();
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const menuItems = [
    { 
      path: "/supplier-portal", 
      label: "Portal do Fornecedor", 
      icon: ShoppingCart,
      description: "Pedidos e peças"
    },
    { 
      path: "/supplier-proposals", 
      label: "Propostas", 
      icon: FileText,
      description: "Planos de manutenção"
    },
  ];

  return (
    <div 
      className={`flex flex-col h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6 text-orange-500" />
            <span className="font-semibold text-sidebar-foreground">Fornecedor</span>
          </div>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onToggleCollapse}
          className="text-sidebar-foreground"
          data-testid="button-toggle-supplier-sidebar"
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!isCollapsed && userSupplier && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2 text-sm text-sidebar-foreground">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium truncate">{userSupplier.name}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 truncate">{userName}</p>
        </div>
      )}

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = location === item.path;
          const Icon = item.icon;
          
          return (
            <Link key={item.path} href={item.path}>
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                  isActive 
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground' 
                    : 'text-sidebar-foreground hover-elevate'
                }`}
                data-testid={`nav-${item.path.replace('/', '')}`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-orange-500' : ''}`} />
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{item.label}</span>
                    <span className="text-xs text-muted-foreground truncate">{item.description}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border">
        <Button 
          variant="ghost" 
          onClick={handleLogout}
          className={`w-full justify-start text-sidebar-foreground ${isCollapsed ? 'px-2' : ''}`}
          data-testid="button-logout-supplier"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">Sair</span>}
        </Button>
      </div>
    </div>
  );
}
