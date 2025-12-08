import { useModuleTheme } from "@/hooks/use-module-theme";
import { cn } from "@/lib/utils";

interface ModernCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'glass' | 'featured';
  hover?: boolean;
  shimmer?: boolean;
}

/**
 * Card ultra-moderno 2025 com glassmorphism e cores dinâmicas por módulo
 */
export function ModernCard({ 
  children, 
  className, 
  variant = 'default',
  hover = true,
  shimmer = false 
}: ModernCardProps) {
  const theme = useModuleTheme();
  
  let baseClasses = '';
  
  switch (variant) {
    case 'gradient':
      baseClasses = theme.cards.gradient;
      break;
    case 'glass':
      baseClasses = theme.cards.glass;
      break;
    case 'featured':
      baseClasses = theme.cards.featured;
      break;
    default:
      baseClasses = theme.cards.modern;
  }
  
  return (
    <div className={cn(
      baseClasses,
      hover && variant !== 'glass' && theme.hover.card,
      shimmer && theme.animations.shimmer,
      className
    )}>
      {children}
    </div>
  );
}

interface ModernCardHeaderProps {
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export function ModernCardHeader({ children, className, icon }: ModernCardHeaderProps) {
  const theme = useModuleTheme();
  
  return (
    <div className={cn(
      "px-6 py-4 border-b",
      theme.borders.primary,
      className
    )}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn(
            "p-2 rounded-lg",
            theme.backgrounds.light
          )}>
            {icon}
          </div>
        )}
        <div className={cn("font-semibold text-lg", theme.text.dark)}>
          {children}
        </div>
      </div>
    </div>
  );
}

interface ModernCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ModernCardContent({ children, className }: ModernCardContentProps) {
  return (
    <div className={cn("p-6", className)}>
      {children}
    </div>
  );
}
