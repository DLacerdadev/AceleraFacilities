import { useModule } from "@/contexts/ModuleContext";
import { Badge } from "@/components/ui/badge";
import { Palette } from "lucide-react";

export function ModuleColorDemo() {
  const { currentModule } = useModule();

  return (
    <div className="flex items-center gap-2" data-testid="module-color-demo">
      <Palette className="w-4 h-4 text-muted-foreground" />
      <div className="flex gap-1">
        <div 
          className="w-6 h-6 rounded-md border border-border"
          style={{ backgroundColor: 'var(--module-primary)' }}
          title="Cor Primária"
          data-testid="color-primary"
        />
        <div 
          className="w-6 h-6 rounded-md border border-border"
          style={{ backgroundColor: 'var(--module-secondary)' }}
          title="Cor Secundária"
          data-testid="color-secondary"
        />
        <div 
          className="w-6 h-6 rounded-md border border-border"
          style={{ backgroundColor: 'var(--module-accent)' }}
          title="Cor de Destaque"
          data-testid="color-accent"
        />
      </div>
      <Badge 
        variant="outline" 
        className="text-xs"
        style={{ 
          borderColor: 'var(--module-primary)',
          color: 'var(--module-primary)'
        }}
      >
        {currentModule === 'clean' ? 'Clean' : 'Manutenção'}
      </Badge>
    </div>
  );
}
