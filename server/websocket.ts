import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { log } from './vite';

const JWT_SECRET = process.env.JWT_SECRET || 'kJsXXrXanldoNcZJG/iHeTEI8WdMch4PFWNIao1llTU=';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  username?: string;
  customerId?: string;
  isAlive?: boolean;
  sessionId?: string;
}

interface BroadcastMessage {
  type: 'update' | 'delete' | 'create';
  resource: string;
  data?: any;
  id?: string;
  customerId?: string;
  companyId?: string;
}

let wss: WebSocketServer | null = null;
const clients = new Set<AuthenticatedWebSocket>();

// Mapa de sessões ativas: userId -> sessionId
const activeSessions = new Map<string, string>();

export function setupWebSocket(server: Server) {
  wss = new WebSocketServer({ 
    server,
    path: '/ws',
    verifyClient: (info, callback) => {
      // Allow all connections initially, authenticate after connection
      callback(true);
    }
  });

  wss.on('connection', (ws: AuthenticatedWebSocket, req) => {
    ws.isAlive = true;
    
    // Extract token from query string
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        ws.userId = decoded.userId;
        ws.username = decoded.username;
        ws.customerId = decoded.customerId;
        ws.sessionId = decoded.sessionId || token; // Use sessionId from token or fallback to token
        
        // Validar que userId e sessionId foram setados corretamente
        if (!ws.userId || !ws.sessionId) {
          throw new Error('Missing userId or sessionId in token');
        }
        
        // Verificar se já existe uma sessão ativa para este usuário
        const existingSessionId = activeSessions.get(ws.userId);
        if (existingSessionId && existingSessionId !== ws.sessionId) {
          // Invalidar sessão anterior ANTES de adicionar novo cliente
          log(`[WS] 🔄 User ${ws.username} logged in from another device. Invalidating old session.`);
          invalidateUserSession(ws.userId, existingSessionId);
        }
        
        // ADICIONAR CLIENTE AO SET PRIMEIRO (antes de registrar sessão)
        clients.add(ws);
        
        // Registrar nova sessão ativa
        activeSessions.set(ws.userId, ws.sessionId);
        
        log(`[WS] ✅ Client connected: ${ws.username} (${ws.userId}) - Session: ${ws.sessionId.substring(0, 8)}...`);
        
        // Send welcome message
        ws.send(JSON.stringify({
          type: 'connected',
          message: 'WebSocket connected',
          userId: ws.userId,
          sessionId: ws.sessionId,
          timestamp: new Date().toISOString()
        }));
      } catch (error) {
        log(`[WS] ❌ Invalid token`);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid authentication token'
        }));
        ws.close();
        return;
      }
    } else {
      log(`[WS] ⚠️ Client connected without token`);
      clients.add(ws);
    }
    
    // Handle pong responses
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Handle ping/pong
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }
        
        log(`[WS] 📩 Message from ${ws.username || 'unknown'}: ${message}`);
      } catch (error) {
        log(`[WS] ❌ Invalid message format`);
      }
    });
    
    ws.on('close', () => {
      clients.delete(ws);
      
      // Limpar sessão ativa se for a mesma que está registrada
      if (ws.userId && ws.sessionId) {
        const currentSession = activeSessions.get(ws.userId);
        if (currentSession === ws.sessionId) {
          activeSessions.delete(ws.userId);
          log(`[WS] 🗑️ Session cleared for user: ${ws.username}`);
        }
      }
      
      log(`[WS] 🔌 Client disconnected: ${ws.username || 'unknown'} (total: ${clients.size})`);
    });
    
    ws.on('error', (error) => {
      log(`[WS] ❌ WebSocket error: ${error.message}`);
      clients.delete(ws);
    });
  });

  // Heartbeat to detect broken connections
  const heartbeat = setInterval(() => {
    clients.forEach((ws) => {
      if (ws.isAlive === false) {
        clients.delete(ws);
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000); // Every 30 seconds

  wss.on('close', () => {
    clearInterval(heartbeat);
  });

  log('[WS] 🚀 WebSocket server initialized on /ws');
}

/**
 * Broadcast a message to all connected clients
 * Can filter by customerId or companyId
 */
export function broadcast(message: BroadcastMessage) {
  if (!wss) {
    log('[WS] ⚠️ WebSocket server not initialized');
    return;
  }

  log(`[WS] 📡 Broadcasting ${message.type} ${message.resource} (total clients: ${clients.size})`);

  const messageStr = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString()
  });

  let sentCount = 0;
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Filter by customer if specified
      if (message.customerId && client.customerId !== message.customerId) {
        return;
      }
      
      // Send to client
      client.send(messageStr);
      sentCount++;
    }
  });
  
  log(`[WS] ✅ Broadcast ${message.type} ${message.resource} sent to ${sentCount}/${clients.size} clients`);
}

/**
 * Broadcast to specific user
 */
export function broadcastToUser(userId: string, message: any) {
  if (!wss) {
    log('[WS] ⚠️ WebSocket server not initialized');
    return;
  }

  const messageStr = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString()
  });

  let sent = false;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client.userId === userId) {
      client.send(messageStr);
      sent = true;
    }
  });
  
  if (sent) {
    log(`[WS] 📧 Message sent to user ${userId}`);
  }
}

/**
 * Get connected clients count
 */
export function getConnectedCount(): number {
  return clients.size;
}

/**
 * Get connected clients info
 */
export function getConnectedClients() {
  return Array.from(clients).map(ws => ({
    userId: ws.userId,
    username: ws.username,
    customerId: ws.customerId,
    isAlive: ws.isAlive
  }));
}

/**
 * Invalidate a specific user session
 * Sends session_invalidated message and closes the connection
 */
function invalidateUserSession(userId: string, sessionId: string) {
  let found = false;
  
  log(`[WS] 🔍 Searching for session to invalidate: userId=${userId}, sessionId=${sessionId.substring(0, 10)}...`);
  log(`[WS] 📊 Total clients: ${clients.size}`);
  
  clients.forEach((client) => {
    log(`[WS] 🔍 Checking client: userId=${client.userId}, sessionId=${client.sessionId?.substring(0, 10)}..., readyState=${client.readyState}`);
    
    if (client.userId === userId && client.sessionId === sessionId && client.readyState === WebSocket.OPEN) {
      found = true;
      log(`[WS] ✅ Found matching client! Sending invalidation message...`);
      
      // Enviar mensagem de sessão invalidada
      client.send(JSON.stringify({
        type: 'session_invalidated',
        message: 'Essa conta foi logada em outro aparelho',
        timestamp: new Date().toISOString()
      }));
      
      log(`[WS] 📤 Invalidation message sent!`);
      
      // Fechar conexão após 2 segundos (dar tempo para a mensagem chegar)
      setTimeout(() => {
        log(`[WS] 🔒 Closing invalidated connection...`);
        client.close(4000, 'Session invalidated - logged in from another device');
      }, 2000);
      
      log(`[WS] 🚫 Invalidated session for user ${userId}`);
    }
  });
  
  if (!found) {
    log(`[WS] ⚠️ No matching client found to invalidate!`);
  }
}

/**
 * Force logout a user (close all connections)
 */
export function forceLogoutUser(userId: string) {
  clients.forEach((client) => {
    if (client.userId === userId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'force_logout',
        message: 'Você foi desconectado pelo sistema',
        timestamp: new Date().toISOString()
      }));
      
      setTimeout(() => {
        client.close(4001, 'Force logout');
      }, 1000);
    }
  });
  
  // Limpar sessão ativa
  activeSessions.delete(userId);
  log(`[WS] 🚫 Force logout user ${userId}`);
}
