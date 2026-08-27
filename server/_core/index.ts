import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { registerMinimalGptProxyRoute } from "../minimal-gpt-proxy";
import {
  registerRailwayClientSessionRoute,
  requireRailwayClientSession,
} from "../security/railway-client-security";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.set('trust proxy', 1);

  const configuredOrigins = (process.env.RECOFREE_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Native APK requests have no Origin. Browser origins must be explicitly allowed.
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isLocalDevelopmentOrigin = process.env.NODE_ENV !== 'production' &&
      typeof origin === 'string' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (origin && !configuredOrigins.includes(origin) && !isLocalDevelopmentOrigin) {
      res.status(403).json({ ok: false, errorCode: 'ORIGIN_NOT_ALLOWED' });
      return;
    }
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header('Vary', 'Origin');
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, Content-Type, Accept, Authorization, X-RecoFree-Request-Id, X-RecoFree-Client-Time",
    );

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "512kb" }));
  app.use(express.urlencoded({ limit: "512kb", extended: true }));

  registerRailwayClientSessionRoute(app);
  app.use('/api', (req, res, next) => {
    if (req.path === '/health' || req.path === '/client/session') return next();
    requireRailwayClientSession(req, res, next);
  });

  // Production backend freeze: the client engine decides; Railway only proxies GPT.
  // Specialized AI/OAuth/tRPC/debug/server-engine modules remain in the repository as
  // frozen migration history, but are intentionally not registered in production.
  registerMinimalGptProxyRoute(app);

  // Root health check for Railway deploy verification
  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "recofree-server" });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ ok: false, errorCode: 'ROUTE_NOT_AVAILABLE' });
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
