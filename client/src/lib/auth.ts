import { apiRequest } from "./queryClient";

export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  role: "admin" | "gestor_cliente" | "supervisor_site" | "operador" | "auditor";
  companyId?: string;
  isActive: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Auth storage keys
const AUTH_STORAGE_KEY = "acelera_auth";
const TOKEN_STORAGE_KEY = "acelera_token";

/**
 * Get current authentication state from localStorage
 */
export function getAuthState(): AuthState {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        user: parsed.user,
        isAuthenticated: !!parsed.user,
        isLoading: false,
      };
    }
  } catch (error) {
    console.error("Error parsing auth state:", error);
  }

  return {
    user: null,
    isAuthenticated: false,
    isLoading: false,
  };
}

/**
 * Custom event name for auth state changes
 */
export const AUTH_STATE_CHANGE_EVENT = 'acelera_auth_state_change';

/**
 * Save authentication state to localStorage
 */
export function setAuthState(user: User | null, token?: string): void {
  try {
    if (user && token) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user }));
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
    
    // Dispatch custom event to notify all useAuth hooks immediately
    window.dispatchEvent(new CustomEvent(AUTH_STATE_CHANGE_EVENT, { 
      detail: { user, isAuthenticated: !!user } 
    }));
  } catch (error) {
    console.error("Error saving auth state:", error);
  }
}

/**
 * Get stored authentication token
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (error) {
    console.error("Error getting auth token:", error);
    return null;
  }
}

/**
 * Login with username and password
 */
export async function login(credentials: LoginCredentials): Promise<{ user: User; token: string }> {
  try {
    const response = await apiRequest("POST", "/api/auth/login", credentials);
    const data = await response.json();
    
    if (data.user && data.token) {
      setAuthState(data.user, data.token);
      return data;
    }
    
    throw new Error("Invalid response format");
  } catch (error) {
    throw new Error("Login failed. Please check your credentials.");
  }
}

/**
 * Login with Microsoft SSO
 */
export async function loginWithMicrosoft(): Promise<{ user: User; token: string }> {
  try {
    // In a real implementation, this would redirect to Microsoft OAuth
    // For now, we'll simulate the flow
    window.location.href = "/api/auth/microsoft";
    
    // This would be handled by the redirect callback
    throw new Error("Redirecting to Microsoft...");
  } catch (error) {
    throw new Error("Microsoft SSO login failed");
  }
}

/**
 * Logout and clear authentication state
 */
export async function logout(): Promise<void> {
  try {
    // Call logout endpoint to invalidate server session
    await apiRequest("POST", "/api/auth/logout", {});
  } catch (error) {
    console.error("Error calling logout endpoint:", error);
  } finally {
    // Always clear local state regardless of server response
    setAuthState(null);
  }
}

/**
 * Refresh current user data
 */
export async function refreshUser(): Promise<User> {
  try {
    const response = await apiRequest("GET", "/api/auth/me", {});
    const user = await response.json();
    
    const currentState = getAuthState();
    if (currentState.user) {
      setAuthState(user, getAuthToken() || undefined);
    }
    
    return user;
  } catch (error) {
    // If refresh fails, user might be logged out
    setAuthState(null);
    throw new Error("Session expired. Please log in again.");
  }
}

/**
 * Check if user has specific role
 */
export function hasRole(user: User | null, roles: string | string[]): boolean {
  if (!user) return false;
  
  const roleArray = Array.isArray(roles) ? roles : [roles];
  return roleArray.includes(user.role);
}

/**
 * Check if user is admin
 */
export function isAdmin(user: User | null): boolean {
  return hasRole(user, "admin");
}

/**
 * Check if user can manage company data
 */
export function canManageCompany(user: User | null): boolean {
  return hasRole(user, ["admin", "gestor_cliente"]);
}

/**
 * Check if user can manage site data
 */
export function canManageSite(user: User | null): boolean {
  return hasRole(user, ["admin", "gestor_cliente", "supervisor_site"]);
}

/**
 * Check if user can only view their own work orders
 */
export function canOnlyViewOwnWorkOrders(user: User | null): boolean {
  return hasRole(user, "operador");
}

/**
 * Get user's company ID for API calls
 */
export function getUserCompanyId(user: User | null): string | null {
  return user?.companyId || null;
}

/**
 * Format user display name
 */
export function getUserDisplayName(user: User | null): string {
  if (!user) return "Usuário";
  return user.name || user.username || user.email;
}

/**
 * Get user role display name in Portuguese
 */
export function getRoleDisplayName(role: string): string {
  const roleMap: Record<string, string> = {
    admin: "Administrador",
    gestor_cliente: "Gestor do Cliente",
    supervisor_site: "Supervisor de Local",
    operador: "Operador",
    auditor: "Auditor"
  };
  
  return roleMap[role] || role;
}

/**
 * Initialize auth state on app startup
 */
export function initializeAuth(): AuthState {
  const state = getAuthState();
  
  // Check if token exists and is still valid
  const token = getAuthToken();
  if (state.user && token) {
    // In a real app, you might want to validate the token with the server
    return state;
  }
  
  // Clear invalid state
  if (state.user && !token) {
    setAuthState(null);
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
    };
  }
  
  return state;
}

/**
 * Create a mock authenticated user for development
 */
export function createMockAuthUser(role: "admin" | "operador" = "admin"): User {
  return {
    id: `mock-user-${role}`,
    name: role === "admin" ? "Administrador Sistema" : "Carlos Oliveira",
    email: role === "admin" ? "admin@opusclean.com" : "carlos@opusclean.com",
    username: role === "admin" ? "admin" : "carlos.oliveira",
    role,
    companyId: "company-1",
    isActive: true,
  };
}

/**
 * Login with mock user for development
 */
export function loginAsMockUser(role: "admin" | "operador" = "admin"): void {
  const mockUser = createMockAuthUser(role);
  const mockToken = `mock-token-${Date.now()}`;
  setAuthState(mockUser, mockToken);
}
