import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db";
import type { Prisma } from "../apps/api/src/generated/prisma";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required");
}

const JWT_SECRET: string = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "7d";
const IMPERSONATION_EXPIRES_IN = "1h";

// Platform admin emails from environment variable
function getPlatformAdminEmails(): string[] {
  const emails = process.env.PLATFORM_ADMIN_EMAILS || "";
  return emails.split(",").map(e => e.trim().toLowerCase()).filter(Boolean);
}

export function isPlatformAdmin(email: string): boolean {
  const adminEmails = getPlatformAdminEmails();
  return adminEmails.includes(email.toLowerCase());
}

export interface TokenPayload {
  userId: string;
  orgId: string;
  email: string;
  role: string;
  isPlatformAdmin?: boolean;
  isImpersonating?: boolean;
  impersonatedOrgId?: string;
  originalUserId?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export function generateToken(payload: TokenPayload, expiresIn?: string): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: (expiresIn || JWT_EXPIRES_IN) as jwt.SignOptions["expiresIn"] });
}

export function generateImpersonationToken(
  adminUserId: string,
  adminEmail: string,
  targetOrgId: string
): string {
  const payload: TokenPayload = {
    userId: adminUserId,
    orgId: targetOrgId,
    email: adminEmail,
    role: "owner",
    isPlatformAdmin: true,
    isImpersonating: true,
    impersonatedOrgId: targetOrgId,
    originalUserId: adminUserId,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: IMPERSONATION_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization header required" });
  }
  
  const token = authHeader.substring(7);
  const payload = verifyToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  
  req.user = payload;
  next();
}

// Platform admin middleware - requires user to be in PLATFORM_ADMIN_EMAILS
export function requirePlatformAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  if (!isPlatformAdmin(req.user.email)) {
    return res.status(403).json({ error: "Platform admin access required" });
  }
  
  next();
}

type Role = "owner" | "admin" | "staff" | "viewer";

const roleHierarchy: Record<Role, number> = {
  owner: 4,
  admin: 3,
  staff: 2,
  viewer: 1,
};

export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const userRole = req.user.role as Role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
}

export function requireMinRole(minRole: Role) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    const userRole = req.user.role as Role;
    const userLevel = roleHierarchy[userRole] || 0;
    const requiredLevel = roleHierarchy[minRole];
    
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
}

export async function createAuditLog(
  orgId: string,
  actorUserId: string | null,
  actorType: "user" | "system" | "ai",
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId,
        actorUserId,
        actorType,
        action,
        entityType,
        entityId,
        details: details as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

// Helper to create audit log for platform admin actions (creates in target org)
export async function createPlatformAdminAuditLog(
  targetOrgId: string,
  adminUserId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, unknown>
) {
  await createAuditLog(
    targetOrgId,
    adminUserId,
    "user",
    action,
    entityType,
    entityId,
    { ...details, platformAdmin: true }
  );
}
