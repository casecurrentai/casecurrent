import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

// Fail-fast env validation - must be imported early
import { DATABASE_URL } from "./env";

// GATE 4: Global crash handlers (anti-crash)
process.on("unhandledRejection", (reason, promise) => {
  console.error(`[CRASH_GUARD] Unhandled Rejection at:`, promise, `reason:`, reason);
});
process.on("uncaughtException", (error) => {
  console.error(`[CRASH_GUARD] Uncaught Exception:`, error);
});

const GIT_SHA = process.env.REPL_SLUG_COMMIT || process.env.RAILWAY_GIT_COMMIT_SHA || "local";
console.log(`[BOOT] SHA=${GIT_SHA} NODE_ENV=${process.env.NODE_ENV || "undefined"} PID=${process.pid}`);

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const CANONICAL_HOST = "casecurrent.co";
app.use((req, res, next) => {
  const host = req.hostname || req.headers.host?.split(":")[0] || "";
  const method = req.method.toUpperCase();
  const path = req.path || req.originalUrl.split("?")[0];
  
  if (method !== "GET" && method !== "HEAD") {
    return next();
  }
  
  if (path.startsWith("/v1/") || path.startsWith("/api/") || path.startsWith("/.well-known/")) {
    return next();
  }
  
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host === CANONICAL_HOST
  ) {
    return next();
  }
  
  const redirectUrl = `https://${CANONICAL_HOST}${req.originalUrl}`;
  console.log(`[REDIRECT] 301 ${host}${req.originalUrl} -> ${redirectUrl}`);
  return res.redirect(301, redirectUrl);
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

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

      log(logLine);
    }
  });

  next();
});

(async () => {
  // TASK B & C - Database fingerprint and phone number check on startup
  try {
    // Parse DATABASE_URL for fingerprint (don't log credentials)
    const urlMatch = DATABASE_URL.match(/@([^:/]+)(?::(\d+))?\/([^?]+)/);
    if (urlMatch) {
      const host = urlMatch[1];
      const dbName = urlMatch[3];
      const dbFingerprint = dbName.length > 6 ? dbName.slice(-6) : dbName;
      console.log(`[DB] Fingerprint - host=${host} db=...${dbFingerprint}`);
    } else {
      console.log(`[DB] Fingerprint - Could not parse DATABASE_URL`);
    }
    
    // TASK C - Seed demo phone number on startup (idempotent)
    const { PrismaClient } = await import("../apps/api/src/generated/prisma");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const startupPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
    
    const DEMO_ORG_ID = 'e552396a-e129-4a16-aa24-a016f9dcaba3';
    const DEMO_PHONE_E164 = '+18443214257';
    
    // Ensure org exists first (idempotent)
    const demoOrg = await startupPrisma.organization.upsert({
      where: { id: DEMO_ORG_ID },
      create: { id: DEMO_ORG_ID, name: 'Demo Law Firm', slug: 'demo-law-firm' },
      update: {},
    });
    
    // Upsert the demo phone number (idempotent)
    const phoneRecord = await startupPrisma.phoneNumber.upsert({
      where: { e164: DEMO_PHONE_E164 },
      create: {
        orgId: DEMO_ORG_ID,
        e164: DEMO_PHONE_E164,
        label: 'Twilio Main Line',
        provider: 'twilio',
        inboundEnabled: true,
      },
      update: {
        orgId: DEMO_ORG_ID,
        inboundEnabled: true,
      },
    });
    
    console.log(`[DB STARTUP] Demo phone ${DEMO_PHONE_E164} -> org ${phoneRecord.orgId} (inbound=${phoneRecord.inboundEnabled})`);
    
    const totalPhones = await startupPrisma.phoneNumber.count();
    console.log(`[DB STARTUP] Total phone_numbers in database: ${totalPhones}`);
    
    await startupPrisma.$disconnect();
  } catch (err: any) {
    console.error(`[DB STARTUP] Error during DB check:`, err?.message || err);
  }

  // TELEPHONY PROVIDER BOOT LOG
  const telephonyProvider = (process.env.TELEPHONY_PROVIDER || 'twilio').toLowerCase();
  const isPlivo = telephonyProvider === 'plivo';
  const voiceEnabled = isPlivo 
    ? !!(process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN)
    : !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
  const smsEnabled = voiceEnabled; // Same credential check for both
  console.log(`[TELEPHONY] Provider: ${isPlivo ? 'plivo' : 'twilio'} | Voice: ${voiceEnabled} | SMS: ${smsEnabled}`);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);

  // Setup Vite or static serving
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
