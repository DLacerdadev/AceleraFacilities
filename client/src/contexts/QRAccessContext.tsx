import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface QRAccessSession {
  code: string;
  timestamp: number;
  expiresAt: number;
}

interface QRAccessContextType {
  registerQRAccess: (code: string) => void;
  validateQRAccess: (code: string) => boolean;
  clearQRAccess: (code: string) => void;
  getActiveSession: (code: string) => QRAccessSession | null;
}

const QRAccessContext = createContext<QRAccessContextType | null>(null);

const SESSION_DURATION_MS = 30 * 60 * 1000;
const STORAGE_KEY = "qr_access_sessions";

function getStoredSessions(): Record<string, QRAccessSession> {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("[QR ACCESS] Error reading sessions:", error);
  }
  return {};
}

function saveSessions(sessions: Record<string, QRAccessSession>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("[QR ACCESS] Error saving sessions:", error);
  }
}

export function QRAccessProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, QRAccessSession>>(() => getStoredSessions());

  const registerQRAccess = useCallback((code: string) => {
    const now = Date.now();
    const session: QRAccessSession = {
      code,
      timestamp: now,
      expiresAt: now + SESSION_DURATION_MS
    };

    setSessions(prev => {
      const updated = { ...prev, [code]: session };
      saveSessions(updated);
      console.log(`[QR ACCESS] Registered access for code: ${code}, expires in ${SESSION_DURATION_MS / 60000} minutes`);
      return updated;
    });
  }, []);

  const validateQRAccess = useCallback((code: string): boolean => {
    const storedSessions = getStoredSessions();
    const session = storedSessions[code];

    if (!session) {
      console.log(`[QR ACCESS] No session found for code: ${code}`);
      return false;
    }

    const now = Date.now();
    if (now > session.expiresAt) {
      console.log(`[QR ACCESS] Session expired for code: ${code}`);
      const updated = { ...storedSessions };
      delete updated[code];
      saveSessions(updated);
      setSessions(updated);
      return false;
    }

    console.log(`[QR ACCESS] Valid session for code: ${code}`);
    return true;
  }, []);

  const clearQRAccess = useCallback((code: string) => {
    setSessions(prev => {
      const updated = { ...prev };
      delete updated[code];
      saveSessions(updated);
      console.log(`[QR ACCESS] Cleared session for code: ${code}`);
      return updated;
    });
  }, []);

  const getActiveSession = useCallback((code: string): QRAccessSession | null => {
    const storedSessions = getStoredSessions();
    const session = storedSessions[code];

    if (!session) return null;

    const now = Date.now();
    if (now > session.expiresAt) {
      return null;
    }

    return session;
  }, []);

  return (
    <QRAccessContext.Provider value={{
      registerQRAccess,
      validateQRAccess,
      clearQRAccess,
      getActiveSession
    }}>
      {children}
    </QRAccessContext.Provider>
  );
}

export function useQRAccess() {
  const context = useContext(QRAccessContext);
  if (!context) {
    throw new Error("useQRAccess must be used within QRAccessProvider");
  }
  return context;
}
