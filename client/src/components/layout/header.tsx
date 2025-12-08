import { Button } from "@/components/ui/button";

interface HeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export default function Header({ title, description, children }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border p-4 flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <div className="text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </div>
        {children}
      </div>
    </header>
  );
}
