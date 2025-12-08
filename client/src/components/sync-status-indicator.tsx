import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';
import { useOfflineStorage } from '@/hooks/use-offline-storage';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

export function SyncStatusIndicator() {
  const { isOnline } = useNetwork();
  const { stats, isInitialized } = useOfflineStorage();
  const [isSyncing, setIsSyncing] = useState(false);

  const totalPending = stats.pendingWorkOrders + stats.pendingExecutions + stats.pendingAttachments;

  // Auto-sync when coming back online (handled by SyncManager component elsewhere)
  // This is just a visual indicator

  if (!isInitialized) {
    return null;
  }

  const getStatusColor = () => {
    if (isSyncing) return 'text-blue-500';
    if (!isOnline) return 'text-red-500';
    if (totalPending > 0) return 'text-orange-500';
    return 'text-green-500';
  };

  const getStatusText = () => {
    if (isSyncing) return 'Sincronizando...';
    if (!isOnline) return 'Offline';
    if (totalPending > 0) return `${totalPending} item(s) pendente(s)`;
    return 'Sincronizado';
  };

  const getIcon = () => {
    if (isSyncing) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (!isOnline) {
      return <WifiOff className="h-4 w-4" />;
    }
    if (totalPending > 0) {
      return <CloudOff className="h-4 w-4" />;
    }
    return <Cloud className="h-4 w-4" />;
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2" data-testid="sync-status-indicator">
          <div className={`flex items-center gap-1.5 ${getStatusColor()}`}>
            {getIcon()}
            <span className="text-sm font-medium hidden sm:inline">
              {getStatusText()}
            </span>
          </div>
          
          {totalPending > 0 && (
            <Badge variant="secondary" className="text-xs" data-testid="badge-pending-count">
              {totalPending}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-sm space-y-1">
          <div className="font-semibold">
            {isOnline ? 'Conectado' : 'Desconectado'}
          </div>
          <div className="text-muted-foreground">
            OSs pendentes: {stats.pendingWorkOrders}
          </div>
          <div className="text-muted-foreground">
            Execuções pendentes: {stats.pendingExecutions}
          </div>
          <div className="text-muted-foreground">
            Anexos pendentes: {stats.pendingAttachments}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
