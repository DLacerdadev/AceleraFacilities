import { useEffect, useRef } from 'react';
import { useNetwork } from '@/contexts/NetworkContext';
import { syncQueueManager } from '@/lib/sync-queue-manager';
import { useToast } from '@/hooks/use-toast';
import { Capacitor } from '@capacitor/core';

/**
 * Hook that automatically triggers sync when device reconnects to internet
 * MOBILE-ONLY: This hook does nothing on web platform
 */
export function useSyncOnReconnect() {
  const { isOnline, wasOffline } = useNetwork();
  const { toast } = useToast();
  const isSyncingRef = useRef(false);

  useEffect(() => {
    // MOBILE-ONLY: Skip sync on web platform
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    // Trigger sync when coming back online
    if (isOnline && wasOffline && !isSyncingRef.current) {
      console.log('[SYNC] Device reconnected, triggering automatic sync...');
      isSyncingRef.current = true;

      // Small delay to ensure network is stable
      const timeoutId = setTimeout(async () => {
        try {
          const result = await syncQueueManager.processSyncQueue();
          
          if (result.syncedCount > 0) {
            toast({
              title: '✅ Sincronização concluída',
              description: `${result.syncedCount} item(s) sincronizado(s) com sucesso`,
              variant: 'default',
            });
          }

          if (result.failedCount > 0) {
            toast({
              title: '⚠️ Sincronização parcial',
              description: `${result.failedCount} item(s) falharam. Tentaremos novamente em breve.`,
              variant: 'destructive',
            });
          }
        } catch (error) {
          console.error('[SYNC] Auto-sync failed:', error);
          toast({
            title: '❌ Erro na sincronização',
            description: 'Não foi possível sincronizar. Tentaremos novamente.',
            variant: 'destructive',
          });
        } finally {
          isSyncingRef.current = false;
        }
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, wasOffline, toast]);
}
