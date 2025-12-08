import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupWebSocket } from "./websocket";
import helmet from "helmet";
import cors from "cors";
import path from "path";

const app = express();

// Trust proxy for rate limiting and IP detection (required for Replit/VM deployment)
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: function(origin, callback) {
    // Lista de origens permitidas
    const allowedOrigins = [
      'https://facilities.grupoopus.com',
      'https://grupoopus.com',
      process.env.REPLIT_DOMAIN,
      'http://localhost:5000',
      'http://localhost:3000',
      'http://localhost:3007',
    ].filter(Boolean);
    
    // Capacitor envia requisições sem origem (null/undefined) ou com capacitor://
    // Permitir requisições sem origem (apps nativos, Postman, etc)
    if (!origin) {
      console.log('[CORS] Permitindo requisição sem origem (app nativo/Capacitor)');
      return callback(null, true);
    }
    
    // Permitir origens do Capacitor (capacitor://localhost, ionic://localhost)
    if (origin.startsWith('capacitor://') || origin.startsWith('ionic://') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
      console.log('[CORS] Permitindo origem Capacitor/Ionic:', origin);
      return callback(null, true);
    }
    
    // Verificar se está na lista de origens permitidas
    if (allowedOrigins.some(allowed => allowed && origin.includes(allowed.replace('https://', '').replace('http://', '')))) {
      return callback(null, true);
    }
    
    // Permitir qualquer subdomínio replit.dev
    if (origin.includes('replit.dev') || origin.includes('replit.app')) {
      return callback(null, true);
    }
    
    console.log('[CORS] Origem bloqueada:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma', 'Origin', 'Accept'],
  exposedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve static files from attached_assets directory
app.use('/attached_assets', express.static(path.join(process.cwd(), 'attached_assets'), {
  maxAge: '1d', // Cache for 1 day
  etag: true
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Setup WebSocket server for real-time updates
  setupWebSocket(server);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Schedule monthly maintenance work order generation
    scheduleMonthlyMaintenance();
  });
})();

// Monthly maintenance scheduler - runs on the last day of each month at 23:00
function scheduleMonthlyMaintenance() {
  function checkAndRun() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if tomorrow is a new month (meaning today is last day of month)
    const isLastDayOfMonth = tomorrow.getMonth() !== now.getMonth();
    
    // Run at 23:00 on the last day of month
    if (isLastDayOfMonth && now.getHours() === 23 && now.getMinutes() === 0) {
      log('[MONTHLY SCHEDULER] Executando geração automática de OSs para próximo mês');
      
      fetch(`http://localhost:${parseInt(process.env.PORT || '5000', 10)}/api/scheduler/regenerate-monthly-maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
        .then(res => res.json())
        .then(data => {
          log(`[MONTHLY SCHEDULER] ✅ Geração concluída: ${data.totalGenerated} OSs criadas`);
        })
        .catch(error => {
          console.error('[MONTHLY SCHEDULER] ❌ Erro na geração automática:', error);
        });
    }
  }
  
  // Check every hour
  setInterval(checkAndRun, 60 * 60 * 1000);
  log('[MONTHLY SCHEDULER] Agendamento mensal ativado - roda todo último dia do mês às 23:00');
}
