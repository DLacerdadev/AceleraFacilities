import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageHeaderWithModuleColors({ 
  icon: Icon, 
  title, 
  description, 
  children 
}: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div 
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
            style={{
              background: `linear-gradient(135deg, var(--module-primary), var(--module-secondary))`
            }}
          >
            <Icon className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
