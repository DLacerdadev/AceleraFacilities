import { useModuleTheme } from "@/hooks/use-module-theme";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface ModernPageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  stats?: Array<{
    label: string;
    value: string | number;
    icon?: LucideIcon;
    trend?: 'up' | 'down';
  }>;
}

/**
 * Header de página ultra-moderno 2025 com gradientes e glassmorphism
 */
export function ModernPageHeader({ 
  title, 
  description, 
  icon: Icon, 
  actions,
  stats 
}: ModernPageHeaderProps) {
  const theme = useModuleTheme();
  
  return (
    <div className={cn(
      "relative overflow-hidden",
      theme.gradients.page
    )}>
      {/* Conteúdo */}
      <div className="relative px-6 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Título e ações */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {Icon && (
                <div 
                  className="p-3 rounded-2xl backdrop-blur-xl text-white"
                  style={{
                    ...theme.styles.gradient,
                    ...theme.shadows.buttonStyle
                  }}
                >
                  <Icon className="w-8 h-8" />
                </div>
              )}
              <div>
                <h1 
                  className="text-4xl font-bold"
                  style={theme.styles.color}
                >
                  {title}
                </h1>
                {description && (
                  <p className="text-slate-600 mt-1 text-lg">
                    {description}
                  </p>
                )}
              </div>
            </div>
            
            {actions && (
              <div className="flex items-center gap-3">
                {actions}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
