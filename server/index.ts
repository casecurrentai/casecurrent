import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

// GATE 4: Global crash handlers (anti-crash)
process.on("unhandledRejection", (reason, promise) => {
  console.error(`[CRASH_GUARD] Unhandled Rejection at:`, promise, `reason:`, reason);
});
process.on("uncaughtException", (error) => {
  console.error(`[CRASH_GUARD] Uncaught Exception:`, error);
});

console.log(`[DEPLOY_MARK] server/index.ts loaded v3 ${new Date().toISOString()}`);

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
    const dbUrl = process.env.DATABASE_URL || "";
    if (dbUrl) {
      // Parse DATABASE_URL for fingerprint (don't log credentials)
      const urlMatch = dbUrl.match(/@([^:/]+)(?::(\d+))?\/([^?]+)/);
      if (urlMatch) {
        const host = urlMatch[1];
        const dbName = urlMatch[3];
        const dbFingerprint = dbName.length > 6 ? dbName.slice(-6) : dbName;
        console.log(`[DB] Fingerprint - host=${host} db=...${dbFingerprint}`);
      } else {
        console.log(`[DB] Fingerprint - Could not parse DATABASE_URL`);
      }
    }
    
    // TASK C - Check for phone number on startup
    const { PrismaClient } = await import("../apps/api/src/generated/prisma");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const startupPrisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });
    
    const phoneCheck = await startupPrisma.phoneNumber.findFirst({
      where: { e164: "+18443214257" },
      select: { e164: true, orgId: true, inboundEnabled: true },
    });
    
    if (phoneCheck) {
      console.log(`[DB STARTUP] Phone +18443214257 EXISTS: orgId=${phoneCheck.orgId} inboundEnabled=${phoneCheck.inboundEnabled}`);
    } else {
      console.log(`[DB STARTUP] Phone +18443214257 NOT FOUND in database`);
    }
    
    const totalPhones = await startupPrisma.phoneNumber.count();
    console.log(`[DB STARTUP] Total phone_numbers in database: ${totalPhones}`);
    
    await startupPrisma.$disconnect();
  } catch (err: any) {
    console.error(`[DB STARTUP] Error during DB check:`, err?.message || err);
  }

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
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
