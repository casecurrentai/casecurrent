import type { Express } from "express";
import { createServer, type Server } from "http";
import { prisma } from "./db";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check endpoint with database connectivity
  app.get("/api/health", async (_req, res) => {
    let dbStatus = "unknown";
    let orgCount = 0;

    try {
      await prisma.$queryRaw`SELECT 1`;
      const count = await prisma.organization.count();
      dbStatus = "connected";
      orgCount = count;
    } catch (error) {
      console.error("Database health check failed:", error);
      dbStatus = "disconnected";
    }

    res.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: dbStatus,
      orgCount,
    });
  });

  // Root API info endpoint
  app.get("/api", (_req, res) => {
    res.json({
      status: "ok",
      service: "CounselTech API",
      version: "1.0.0",
    });
  });

  return httpServer;
}
