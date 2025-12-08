import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, XCircle } from "lucide-react";
import { useModuleTheme } from "@/hooks/use-module-theme";

interface CancelWorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  workOrderTitle: string;
  isPending?: boolean;
}

export default function CancelWorkOrderDialog({
  open,
  onOpenChange,
  onConfirm,
  workOrderTitle,
  isPending = false,
}: CancelWorkOrderDialogProps) {
  const theme = useModuleTheme();
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    if (reason.trim()) {
      onConfirm(reason.trim());
      setReason("");
    }
  };

  const handleCancel = () => {
    setReason("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-orange-600" />
            Cancelar Ordem de Serviço
          </DialogTitle>
          <DialogDescription>
            Você está prestes a cancelar a O.S: <strong>{workOrderTitle}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium mb-1">Atenção</p>
              <p>
                Esta ação não pode ser desfeita. A ordem de serviço será marcada como cancelada
                e não poderá mais ser executada.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancellation-reason" className="text-base font-medium">
              Motivo do cancelamento <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="cancellation-reason"
              placeholder="Descreva o motivo do cancelamento desta ordem de serviço..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="resize-none"
              disabled={isPending}
              data-testid="textarea-cancellation-reason"
            />
            <p className="text-sm text-muted-foreground">
              O motivo será registrado no histórico da ordem de serviço.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isPending}
            data-testid="button-cancel-dialog"
          >
            Voltar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!reason.trim() || isPending}
            className="bg-orange-600 hover:bg-orange-700 text-white"
            data-testid="button-confirm-cancel"
          >
            {isPending ? "Cancelando..." : "Confirmar Cancelamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
