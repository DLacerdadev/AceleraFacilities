import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, CheckSquare } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Capacitor } from "@capacitor/core";

// Get API base URL for mobile
function getApiBaseUrl(): string {
  if (Capacitor.isNativePlatform()) {
    return import.meta.env.VITE_API_BASE_URL || 'https://facilities.grupoopus.com';
  }
  return '';
}

interface ChecklistSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  module: 'clean' | 'maintenance';
  onConfirm: (checklistTemplateId: string) => void;
}

export default function ChecklistSelectionModal({
  isOpen,
  onClose,
  customerId,
  module,
  onConfirm,
}: ChecklistSelectionModalProps) {
  const { toast } = useToast();
  const [checklists, setChecklists] = useState<any[]>([]);
  const [selectedChecklist, setSelectedChecklist] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && customerId) {
      loadChecklists();
    }
  }, [isOpen, customerId, module]);

  const loadChecklists = async () => {
    setIsLoading(true);
    try {
      const baseUrl = getApiBaseUrl();
      const token = localStorage.getItem("acelera_token");
      
      const response = await fetch(
        `${baseUrl}/api/customers/${customerId}/checklist-templates?module=${module}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const checklistsData = await response.json();
        setChecklists(checklistsData || []);
        
        // Auto-selecionar o primeiro checklist se houver
        if (checklistsData && checklistsData.length > 0) {
          setSelectedChecklist(checklistsData[0].id);
        }
      } else {
        toast({
          title: "Erro ao carregar checklists",
          description: "Não foi possível carregar os checklists disponíveis.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('[CHECKLIST MODAL] Erro ao carregar checklists:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar checklists.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!selectedChecklist) {
      toast({
        title: "Checklist obrigatório",
        description: "Por favor, selecione um checklist antes de continuar.",
        variant: "destructive",
      });
      return;
    }
    
    onConfirm(selectedChecklist);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <Card className="w-full max-w-md bg-white shadow-2xl">
        <CardHeader className="relative pb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="absolute top-2 right-2 h-8 w-8"
            data-testid="button-close-checklist-modal"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-lg">Selecione o Checklist</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">
              Carregando checklists...
            </div>
          ) : checklists.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <p className="font-semibold mb-2">Nenhum checklist disponível</p>
              <p className="text-sm">
                Crie um checklist antes de criar uma ordem de serviço.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Checklist
                </label>
                <Select value={selectedChecklist} onValueChange={setSelectedChecklist}>
                  <SelectTrigger data-testid="select-checklist" className="w-full">
                    <SelectValue placeholder="Escolha o checklist para esta OS" />
                  </SelectTrigger>
                  <SelectContent className="z-[999999]">
                    {checklists.map((checklist) => (
                      <SelectItem key={checklist.id} value={checklist.id}>
                        {checklist.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  O checklist selecionado será usado na execução desta ordem de serviço
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1"
                  data-testid="button-cancel-checklist"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={!selectedChecklist}
                  data-testid="button-confirm-checklist"
                >
                  Confirmar e Criar OS
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
