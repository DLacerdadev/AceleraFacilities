import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface NetworkContextType {
  isOnline: boolean;
  wasOffline: boolean; // Tracks if we just came back online
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      console.log('[NETWORK] Connection restored - online');
      setIsOnline(true);
      setWasOffline(true);
      
      // Reset wasOffline flag after a delay to allow sync to trigger
      setTimeout(() => {
        setWasOffline(false);
      }, 1000);
    };

    const handleOffline = () => {
      console.log('[NETWORK] Connection lost - offline');
      setIsOnline(false);
      setWasOffline(false);
    };

    // Listen for online/offline events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    console.log('[NETWORK] Initial status:', navigator.onLine ? 'online' : 'offline');

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, wasOffline }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}
