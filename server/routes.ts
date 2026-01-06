import type { Express } from "express";
import type { Server } from "http";
import swaggerUi from "swagger-ui-express";
import { prisma } from "./db";
import { swaggerSpec } from "./openapi";
import {
  generateToken,
  hashPassword,
  comparePassword,
  authMiddleware,
  requireMinRole,
  createAuditLog,
  type AuthenticatedRequest,
} from "./auth";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Swagger UI
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get("/docs.json", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  /**
   * @openapi
   * /api/health:
   *   get:
   *     summary: Health check endpoint
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Health status
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthResponse'
   */
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

  /**
   * @openapi
   * /v1/auth/register:
   *   post:
   *     summary: Register a new organization and owner
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/RegisterRequest'
   *     responses:
   *       201:
   *         description: Registration successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post("/v1/auth/register", async (req, res) => {
    try {
      const { email, password, name, orgName } = req.body;

      if (!email || !password || !name || !orgName) {
        return res.status(400).json({ error: "All fields required: email, password, name, orgName" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const slug = slugify(orgName);
      
      const existingOrg = await prisma.organization.findUnique({
        where: { slug },
      });

      if (existingOrg) {
        return res.status(400).json({ error: "Organization name already taken" });
      }

      const org = await prisma.organization.create({
        data: {
          name: orgName,
          slug,
          status: "active",
          timezone: "America/New_York",
        },
      });

      const passwordHash = await hashPassword(password);
      
      const user = await prisma.user.create({
        data: {
          orgId: org.id,
          email,
          name,
          role: "owner",
          status: "active",
          passwordHash,
        },
      });

      const token = generateToken({
        userId: user.id,
        orgId: org.id,
        email: user.email,
        role: user.role,
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
        },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  /**
   * @openapi
   * /v1/auth/login:
   *   post:
   *     summary: Login with email and password
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/LoginRequest'
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AuthResponse'
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post("/v1/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const user = await prisma.user.findFirst({
        where: { email },
        include: { organization: true },
      });

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const validPassword = await comparePassword(password, user.passwordHash);
      if (!validPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = generateToken({
        userId: user.id,
        orgId: user.orgId,
        email: user.email,
        role: user.role,
      });

      await createAuditLog(
        user.orgId,
        user.id,
        "system",
        "login",
        "user",
        user.id,
        { email: user.email, timestamp: new Date().toISOString() }
      );

      res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  /**
   * @openapi
   * /v1/me:
   *   get:
   *     summary: Get current user profile
   *     tags: [User]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   $ref: '#/components/schemas/User'
   *                 organization:
   *                   $ref: '#/components/schemas/Organization'
   *       401:
   *         description: Unauthorized
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.get("/v1/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user!.userId },
        include: { organization: true },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        },
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          slug: user.organization.slug,
          status: user.organization.status,
          timezone: user.organization.timezone,
          createdAt: user.organization.createdAt,
          updatedAt: user.organization.updatedAt,
        },
      });
    } catch (error) {
      console.error("Get me error:", error);
      res.status(500).json({ error: "Failed to get user profile" });
    }
  });

  /**
   * @openapi
   * /v1/org:
   *   get:
   *     summary: Get current organization
   *     tags: [Organization]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Organization details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Organization'
   *       401:
   *         description: Unauthorized
   */
  app.get("/v1/org", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const org = await prisma.organization.findUnique({
        where: { id: req.user!.orgId },
      });

      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      res.json({
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        timezone: org.timezone,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
      });
    } catch (error) {
      console.error("Get org error:", error);
      res.status(500).json({ error: "Failed to get organization" });
    }
  });

  /**
   * @openapi
   * /v1/org:
   *   patch:
   *     summary: Update organization (owner/admin only)
   *     tags: [Organization]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateOrgRequest'
   *     responses:
   *       200:
   *         description: Organization updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Organization'
   *       403:
   *         description: Insufficient permissions
   */
  app.patch(
    "/v1/org",
    authMiddleware,
    requireMinRole("admin"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { name, timezone } = req.body;
        const orgId = req.user!.orgId;

        const updateData: { name?: string; timezone?: string } = {};
        if (name) updateData.name = name;
        if (timezone) updateData.timezone = timezone;

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: "No valid fields to update" });
        }

        const org = await prisma.organization.update({
          where: { id: orgId },
          data: updateData,
        });

        await createAuditLog(
          orgId,
          req.user!.userId,
          "user",
          "update",
          "organization",
          orgId,
          { changes: updateData, timestamp: new Date().toISOString() }
        );

        res.json({
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          timezone: org.timezone,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        });
      } catch (error) {
        console.error("Update org error:", error);
        res.status(500).json({ error: "Failed to update organization" });
      }
    }
  );

  // ============================================
  // WEBHOOK EVENT STUBS
  // ============================================
  async function emitWebhookEvent(orgId: string, eventType: string, payload: Record<string, unknown>) {
    console.log(`[WEBHOOK STUB] org=${orgId} event=${eventType}`, JSON.stringify(payload).slice(0, 200));
  }

  // ============================================
  // CONTACTS ENDPOINTS
  // ============================================

  /**
   * @openapi
   * /v1/contacts:
   *   get:
   *     summary: List contacts with optional search
   *     tags: [Contacts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: q
   *         in: query
   *         description: Search query (name, phone, email)
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of contacts
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ContactList'
   */
  app.get("/v1/contacts", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const q = req.query.q as string | undefined;

      const where: { orgId: string; OR?: Array<Record<string, unknown>> } = { orgId };
      if (q) {
        where.OR = [
          { name: { contains: q, mode: "insensitive" } },
          { primaryPhone: { contains: q } },
          { primaryEmail: { contains: q, mode: "insensitive" } },
        ];
      }

      const [contacts, total] = await Promise.all([
        prisma.contact.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
        prisma.contact.count({ where }),
      ]);

      res.json({ contacts, total });
    } catch (error) {
      console.error("List contacts error:", error);
      res.status(500).json({ error: "Failed to list contacts" });
    }
  });

  /**
   * @openapi
   * /v1/contacts:
   *   post:
   *     summary: Create a new contact (staff+ only)
   *     tags: [Contacts]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateContactRequest'
   *     responses:
   *       201:
   *         description: Contact created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Contact'
   *       403:
   *         description: Insufficient permissions
   */
  app.post(
    "/v1/contacts",
    authMiddleware,
    requireMinRole("staff"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { name, primaryPhone, primaryEmail } = req.body;

        if (!name) {
          return res.status(400).json({ error: "Name is required" });
        }

        const contact = await prisma.contact.create({
          data: {
            orgId,
            name,
            primaryPhone: primaryPhone || null,
            primaryEmail: primaryEmail || null,
          },
        });

        await createAuditLog(orgId, req.user!.userId, "user", "create", "contact", contact.id, {
          name,
          timestamp: new Date().toISOString(),
        });

        await emitWebhookEvent(orgId, "contact.created", { contactId: contact.id, name });

        res.status(201).json(contact);
      } catch (error) {
        console.error("Create contact error:", error);
        res.status(500).json({ error: "Failed to create contact" });
      }
    }
  );

  /**
   * @openapi
   * /v1/contacts/{id}:
   *   get:
   *     summary: Get contact by ID
   *     tags: [Contacts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Contact details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Contact'
   *       404:
   *         description: Contact not found
   */
  app.get("/v1/contacts/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const contact = await prisma.contact.findFirst({
        where: { id, orgId },
      });

      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      res.json(contact);
    } catch (error) {
      console.error("Get contact error:", error);
      res.status(500).json({ error: "Failed to get contact" });
    }
  });

  /**
   * @openapi
   * /v1/contacts/{id}/leads:
   *   get:
   *     summary: Get leads for a contact
   *     tags: [Contacts]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Leads for the contact
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LeadList'
   *       404:
   *         description: Contact not found
   */
  app.get("/v1/contacts/:id/leads", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const contact = await prisma.contact.findFirst({ where: { id, orgId } });
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }

      const leads = await prisma.lead.findMany({
        where: { contactId: id, orgId },
        include: { contact: true, practiceArea: true },
        orderBy: { createdAt: "desc" },
      });

      res.json({ leads, total: leads.length });
    } catch (error) {
      console.error("Get contact leads error:", error);
      res.status(500).json({ error: "Failed to get contact leads" });
    }
  });

  // ============================================
  // PRACTICE AREAS ENDPOINTS
  // ============================================

  /**
   * @openapi
   * /v1/practice-areas:
   *   get:
   *     summary: List practice areas
   *     tags: [Practice Areas]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of practice areas
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 practiceAreas:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       name:
   *                         type: string
   *                       active:
   *                         type: boolean
   */
  app.get("/v1/practice-areas", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;

      const practiceAreas = await prisma.practiceArea.findMany({
        where: { orgId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, active: true },
      });

      res.json({ practiceAreas });
    } catch (error) {
      console.error("List practice areas error:", error);
      res.status(500).json({ error: "Failed to list practice areas" });
    }
  });

  // ============================================
  // LEADS ENDPOINTS
  // ============================================

  /**
   * @openapi
   * /v1/leads:
   *   get:
   *     summary: List leads with filters
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *       - name: priority
   *         in: query
   *         schema:
   *           type: string
   *       - name: practice_area_id
   *         in: query
   *         schema:
   *           type: string
   *       - name: q
   *         in: query
   *         description: Search query
   *         schema:
   *           type: string
   *       - name: from
   *         in: query
   *         description: From date (ISO)
   *         schema:
   *           type: string
   *           format: date-time
   *       - name: to
   *         in: query
   *         description: To date (ISO)
   *         schema:
   *           type: string
   *           format: date-time
   *     responses:
   *       200:
   *         description: List of leads
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LeadList'
   */
  app.get("/v1/leads", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { status, priority, practice_area_id, q, from, to } = req.query;

      const where: Record<string, unknown> = { orgId };

      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (practice_area_id) where.practiceAreaId = practice_area_id;

      if (from || to) {
        where.createdAt = {};
        if (from) (where.createdAt as Record<string, unknown>).gte = new Date(from as string);
        if (to) (where.createdAt as Record<string, unknown>).lte = new Date(to as string);
      }

      if (q) {
        where.OR = [
          { summary: { contains: q, mode: "insensitive" } },
          { incidentLocation: { contains: q, mode: "insensitive" } },
          { contact: { is: { name: { contains: q, mode: "insensitive" } } } },
        ];
      }

      const [leads, total] = await Promise.all([
        prisma.lead.findMany({
          where,
          include: { contact: true, practiceArea: true },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        prisma.lead.count({ where }),
      ]);

      res.json({ leads, total });
    } catch (error) {
      console.error("List leads error:", error);
      res.status(500).json({ error: "Failed to list leads" });
    }
  });

  /**
   * @openapi
   * /v1/leads:
   *   post:
   *     summary: Create a new lead (staff+ only)
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateLeadRequest'
   *     responses:
   *       201:
   *         description: Lead created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lead'
   *       400:
   *         description: Validation error
   *       403:
   *         description: Insufficient permissions
   */
  app.post(
    "/v1/leads",
    authMiddleware,
    requireMinRole("staff"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const {
          contactId,
          contactName,
          contactPhone,
          contactEmail,
          source,
          status,
          priority,
          practiceAreaId,
          incidentDate,
          incidentLocation,
          summary,
        } = req.body;

        if (!source) {
          return res.status(400).json({ error: "Source is required" });
        }

        let finalContactId = contactId;

        if (!contactId && contactName) {
          const newContact = await prisma.contact.create({
            data: {
              orgId,
              name: contactName,
              primaryPhone: contactPhone || null,
              primaryEmail: contactEmail || null,
            },
          });
          finalContactId = newContact.id;

          await createAuditLog(orgId, req.user!.userId, "user", "create", "contact", newContact.id, {
            name: contactName,
            createdViaLead: true,
            timestamp: new Date().toISOString(),
          });
        }

        if (!finalContactId) {
          return res.status(400).json({ error: "Either contactId or contactName is required" });
        }

        const existingContact = await prisma.contact.findFirst({
          where: { id: finalContactId, orgId },
        });

        if (!existingContact) {
          return res.status(400).json({ error: "Contact not found in your organization" });
        }

        const lead = await prisma.lead.create({
          data: {
            orgId,
            contactId: finalContactId,
            source,
            status: status || "new",
            priority: priority || "medium",
            practiceAreaId: practiceAreaId || null,
            incidentDate: incidentDate ? new Date(incidentDate) : null,
            incidentLocation: incidentLocation || null,
            summary: summary || null,
          },
          include: { contact: true, practiceArea: true },
        });

        await createAuditLog(orgId, req.user!.userId, "user", "create", "lead", lead.id, {
          source,
          contactId: finalContactId,
          timestamp: new Date().toISOString(),
        });

        await emitWebhookEvent(orgId, "lead.created", {
          leadId: lead.id,
          contactId: finalContactId,
          source,
          status: lead.status,
        });

        res.status(201).json(lead);
      } catch (error) {
        console.error("Create lead error:", error);
        res.status(500).json({ error: "Failed to create lead" });
      }
    }
  );

  /**
   * @openapi
   * /v1/leads/{id}:
   *   get:
   *     summary: Get lead by ID
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Lead details
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lead'
   *       404:
   *         description: Lead not found
   */
  app.get("/v1/leads/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
    try {
      const orgId = req.user!.orgId;
      const { id } = req.params;

      const lead = await prisma.lead.findFirst({
        where: { id, orgId },
        include: { contact: true, practiceArea: true },
      });

      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }

      res.json(lead);
    } catch (error) {
      console.error("Get lead error:", error);
      res.status(500).json({ error: "Failed to get lead" });
    }
  });

  /**
   * @openapi
   * /v1/leads/{id}:
   *   patch:
   *     summary: Update lead (staff+ only)
   *     tags: [Leads]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: id
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateLeadRequest'
   *     responses:
   *       200:
   *         description: Lead updated
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Lead'
   *       403:
   *         description: Insufficient permissions
   *       404:
   *         description: Lead not found
   */
  app.patch(
    "/v1/leads/:id",
    authMiddleware,
    requireMinRole("staff"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const orgId = req.user!.orgId;
        const { id } = req.params;
        const { status, priority, practiceAreaId, incidentDate, incidentLocation, summary } = req.body;

        const existingLead = await prisma.lead.findFirst({ where: { id, orgId } });
        if (!existingLead) {
          return res.status(404).json({ error: "Lead not found" });
        }

        const updateData: Record<string, unknown> = {};
        if (status !== undefined) updateData.status = status;
        if (priority !== undefined) updateData.priority = priority;
        if (practiceAreaId !== undefined) updateData.practiceAreaId = practiceAreaId || null;
        if (incidentDate !== undefined) updateData.incidentDate = incidentDate ? new Date(incidentDate) : null;
        if (incidentLocation !== undefined) updateData.incidentLocation = incidentLocation || null;
        if (summary !== undefined) updateData.summary = summary || null;

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: "No valid fields to update" });
        }

        const lead = await prisma.lead.update({
          where: { id },
          data: updateData,
          include: { contact: true, practiceArea: true },
        });

        await createAuditLog(orgId, req.user!.userId, "user", "update", "lead", id, {
          changes: updateData,
          timestamp: new Date().toISOString(),
        });

        await emitWebhookEvent(orgId, "lead.updated", {
          leadId: id,
          changes: updateData,
        });

        res.json(lead);
      } catch (error) {
        console.error("Update lead error:", error);
        res.status(500).json({ error: "Failed to update lead" });
      }
    }
  );

  // =============================================
  // MARKETING ENDPOINTS (PUBLIC)
  // =============================================

  // Simple rate limiting for contact form
  const contactSubmissions = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_MAX = 5;
  const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

  function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = contactSubmissions.get(ip);
    
    if (!record || record.resetAt < now) {
      contactSubmissions.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return true;
    }
    
    if (record.count >= RATE_LIMIT_MAX) {
      return false;
    }
    
    record.count++;
    return true;
  }

  /**
   * @openapi
   * /v1/marketing/contact:
   *   post:
   *     summary: Submit marketing contact form
   *     tags: [Marketing]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email, message]
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               firm:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       201:
   *         description: Submission created
   *       429:
   *         description: Rate limited
   */
  app.post("/v1/marketing/contact", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }

      const { name, email, firm, message } = req.body;

      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Name is required (min 2 characters)" });
      }
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }
      if (!message || typeof message !== "string" || message.trim().length < 10) {
        return res.status(400).json({ error: "Message is required (min 10 characters)" });
      }

      const submission = await prisma.marketingContactSubmission.create({
        data: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          firm: firm?.trim() || null,
          message: message.trim(),
          metadata: {
            ip: clientIp,
            userAgent: req.headers["user-agent"] || null,
            submittedAt: new Date().toISOString(),
          },
        },
      });

      // Note: Audit log skipped for public submissions since there's no org context
      // Submission metadata includes IP and timestamp for tracking purposes

      res.status(201).json({ success: true, id: submission.id });
    } catch (error) {
      console.error("Marketing contact submission error:", error);
      res.status(500).json({ error: "Failed to submit contact form" });
    }
  });

  /**
   * @openapi
   * /v1/marketing/contact-submissions:
   *   get:
   *     summary: List marketing contact submissions (admin only)
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of submissions
   */
  app.get(
    "/v1/marketing/contact-submissions",
    authMiddleware,
    requireMinRole("admin"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const submissions = await prisma.marketingContactSubmission.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        res.json({ submissions, total: submissions.length });
      } catch (error) {
        console.error("Fetch contact submissions error:", error);
        res.status(500).json({ error: "Failed to fetch submissions" });
      }
    }
  );

  /**
   * @openapi
   * /v1/marketing/demo-request:
   *   post:
   *     summary: Submit demo request form
   *     tags: [Marketing]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [name, email]
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               firm_name:
   *                 type: string
   *               phone:
   *                 type: string
   *               practice_area:
   *                 type: string
   *               current_intake_method:
   *                 type: string
   *               monthly_lead_volume:
   *                 type: string
   *               message:
   *                 type: string
   *     responses:
   *       201:
   *         description: Demo request created
   *       429:
   *         description: Rate limited
   */
  app.post("/v1/marketing/demo-request", async (req, res) => {
    try {
      const clientIp = req.ip || req.socket.remoteAddress || "unknown";
      
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({ error: "Too many requests. Please try again later." });
      }

      const { name, email, firm_name, phone, practice_area, current_intake_method, monthly_lead_volume, message, website } = req.body;

      // Honeypot check - reject if filled (bots fill this hidden field)
      if (website && typeof website === "string" && website.trim().length > 0) {
        // Silently succeed to not reveal the honeypot
        return res.status(201).json({ success: true, id: "honeypot" });
      }

      if (!name || typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json({ error: "Name is required (min 2 characters)" });
      }
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Valid email is required" });
      }

      const submission = await prisma.marketingSubmission.create({
        data: {
          type: "demo",
          name: name.trim(),
          email: email.trim().toLowerCase(),
          firm: firm_name?.trim() || null,
          phone: phone?.trim() || null,
          practiceArea: practice_area || null,
          currentIntakeMethod: current_intake_method || null,
          monthlyLeadVolume: monthly_lead_volume || null,
          message: message?.trim() || null,
          metadata: {
            ip: clientIp,
            userAgent: req.headers["user-agent"] || null,
            submittedAt: new Date().toISOString(),
          },
        },
      });

      res.status(201).json({ success: true, id: submission.id });
    } catch (error) {
      console.error("Demo request submission error:", error);
      res.status(500).json({ error: "Failed to submit demo request" });
    }
  });

  /**
   * @openapi
   * /v1/marketing/submissions:
   *   get:
   *     summary: List all marketing submissions (admin only)
   *     tags: [Marketing]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: type
   *         schema:
   *           type: string
   *           enum: [contact, demo]
   *     responses:
   *       200:
   *         description: List of submissions
   */
  app.get(
    "/v1/marketing/submissions",
    authMiddleware,
    requireMinRole("admin"),
    async (req: AuthenticatedRequest, res) => {
      try {
        const { type } = req.query;
        
        const submissions = await prisma.marketingSubmission.findMany({
          where: type ? { type: type as string } : undefined,
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        res.json({ submissions, total: submissions.length });
      } catch (error) {
        console.error("Fetch marketing submissions error:", error);
        res.status(500).json({ error: "Failed to fetch submissions" });
      }
    }
  );

  // Root API info endpoint
  /**
   * @openapi
   * /api:
   *   get:
   *     summary: API info
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: API info
   */
  app.get("/api", (_req, res) => {
    res.json({
      status: "ok",
      service: "CounselTech API",
      version: "1.0.0",
    });
  });

  return httpServer;
}
