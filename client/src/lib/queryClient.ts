import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";

// Get the appropriate API base URL depending on environment
function getApiBaseUrl(): string {
  // Check if running in Capacitor (native mobile app)
  if (Capacitor.isNativePlatform()) {
    // In production APK, use the actual backend server URL
    // URL de produção: https://facilities.grupoopus.com
    return import.meta.env.VITE_API_BASE_URL || 'https://facilities.grupoopus.com';
  }
  
  // In web browser, use relative URLs (works with Vite proxy)
  return '';
}

// Convert relative URL to absolute if needed
function getFullUrl(url: string): string {
  const baseUrl = getApiBaseUrl();
  
  // If URL is already absolute, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // Combine base URL with relative URL
  return baseUrl + url;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Tentar fazer parse do JSON para extrair apenas a mensagem
    try {
      const errorData = JSON.parse(text);
      // Extrair apenas a mensagem, sem criar propriedades extras
      const message = errorData.message || errorData.error || text;
      throw new Error(message);
    } catch (parseError) {
      // Se não for JSON válido, jogar o texto direto
      throw new Error(text);
    }
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get token from localStorage
  const token = localStorage.getItem("acelera_token");
  
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  
  // Convert to absolute URL if in Capacitor
  const fullUrl = getFullUrl(url);
  const isNative = Capacitor.isNativePlatform();
  
  console.log('[API REQUEST]', method, fullUrl, isNative ? '(Capacitor)' : '(Web)');
  
  // Em ambiente nativo (Capacitor), não usar credentials pois usamos Bearer token
  // Em ambiente web, usar credentials para sessão/cookies
  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: isNative ? "omit" : "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get token from localStorage
    const token = localStorage.getItem("acelera_token");
    
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    // Process queryKey to handle objects as query parameters
    // The first element should always be the API path
    // Additional elements can be: 
    // - objects: converted to query params
    // - strings: added to URL path
    // Special handling for third-party portal: if first element is /api/third-party-portal/* 
    // and second element looks like an ID (nanoid format), skip it as it's a cache key
    let url = "";
    const queryParams: Record<string, string> = {};
    
    for (let i = 0; i < queryKey.length; i++) {
      const part = queryKey[i];
      if (typeof part === "object" && part !== null) {
        // Extract query parameters from object (but skip _cacheOnly keys)
        const filtered = Object.fromEntries(
          Object.entries(part as Record<string, unknown>).filter(([key]) => !key.startsWith('_'))
        );
        Object.assign(queryParams, filtered);
      } else if (typeof part === "string") {
        // Check if this is a cache-only key for third-party portal queries
        // These are nanoid-format IDs that should not be appended to the URL
        const firstPart = String(queryKey[0]);
        const isThirdPartyPortalQuery = firstPart.includes('/api/third-party-portal/');
        const looksLikeNanoid = /^[A-Za-z0-9_-]{10,30}$/.test(part) && !part.includes('/');
        
        if (i > 0 && isThirdPartyPortalQuery && looksLikeNanoid) {
          // Skip this - it's a cache key only for third-party portal isolation
          continue;
        }
        
        // Check if this is a module identifier for third-party portal queries
        // Modules should be passed as query params, not path segments
        if (i > 0 && isThirdPartyPortalQuery && (part === 'clean' || part === 'maintenance')) {
          queryParams['module'] = part;
          continue;
        }
        
        // Build URL path
        url += (url ? "/" : "") + part;
      } else if (part !== null && part !== undefined) {
        // Non-string, non-object values
        url += (url ? "/" : "") + String(part);
      }
    }
    
    // Append query parameters if any
    if (Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(queryParams);
      url += "?" + params.toString();
    }
    
    // Convert to absolute URL if in Capacitor
    const fullUrl = getFullUrl(url);
    const isNative = Capacitor.isNativePlatform();
    
    console.log('[QUERY FN] Fetching:', fullUrl, 'Headers:', Object.keys(headers));
    
    // Em ambiente nativo (Capacitor), não usar credentials pois usamos Bearer token
    const res = await fetch(fullUrl, {
      headers,
      credentials: isNative ? "omit" : "include",
    });

    console.log('[QUERY FN] Response status:', res.status, 'URL:', fullUrl);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log('[QUERY FN] Returning null for 401');
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    // Melhor log: se for resposta paginada (com data.data), mostra o tamanho correto
    const itemCount = Array.isArray(data) 
      ? data.length 
      : (Array.isArray(data?.data) ? data.data.length : Object.keys(data).length);
    console.log('[QUERY FN] Data received:', itemCount, 'items');
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      refetchOnMount: true,
      refetchOnReconnect: true,
      // staleTime: 5 minutos (300000ms) - dados são considerados frescos por 5 min
      // Isso evita requisições desnecessárias quando componentes re-renderizam
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
