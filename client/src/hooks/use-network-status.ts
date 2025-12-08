import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';

interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
}

export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    connectionType: 'unknown'
  });

  useEffect(() => {
    let isMounted = true;

    const getInitialStatus = async () => {
      try {
        const networkStatus = await Network.getStatus();
        if (isMounted) {
          setStatus({
            isOnline: networkStatus.connected,
            connectionType: networkStatus.connectionType
          });
        }
      } catch (error) {
        console.error('[NETWORK] Error getting initial status:', error);
        if (isMounted) {
          setStatus({
            isOnline: navigator.onLine,
            connectionType: 'unknown'
          });
        }
      }
    };

    getInitialStatus();

    const listenerPromise = Network.addListener('networkStatusChange', (networkStatus) => {
      console.log('[NETWORK] Status changed:', networkStatus);
      if (isMounted) {
        setStatus({
          isOnline: networkStatus.connected,
          connectionType: networkStatus.connectionType
        });
      }
    });

    return () => {
      isMounted = false;
      listenerPromise.then(handler => handler.remove()).catch(err => {
        console.error('[NETWORK] Error removing listener:', err);
      });
    };
  }, []);

  return status;
}
