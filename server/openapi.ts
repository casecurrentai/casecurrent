import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "CounselTech API",
      version: "1.0.0",
      description: "AI-powered intake and lead capture platform for law firms",
    },
    servers: [
      {
        url: "/",
        description: "Current server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["email", "password", "name", "orgName"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            name: { type: "string" },
            orgName: { type: "string" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string" },
                email: { type: "string" },
                name: { type: "string" },
                role: { type: "string", enum: ["owner", "admin", "staff", "viewer"] },
              },
            },
            organization: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                slug: { type: "string" },
              },
            },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            name: { type: "string" },
            role: { type: "string", enum: ["owner", "admin", "staff", "viewer"] },
            status: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Organization: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            slug: { type: "string" },
            status: { type: "string" },
            timezone: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        UpdateOrgRequest: {
          type: "object",
          properties: {
            name: { type: "string" },
            timezone: { type: "string" },
          },
        },
        HealthResponse: {
          type: "object",
          properties: {
            status: { type: "string" },
            timestamp: { type: "string", format: "date-time" },
            database: { type: "string" },
            orgCount: { type: "integer" },
          },
        },
        Contact: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            primaryPhone: { type: "string", nullable: true },
            primaryEmail: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateContactRequest: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            primaryPhone: { type: "string" },
            primaryEmail: { type: "string", format: "email" },
          },
        },
        Lead: {
          type: "object",
          properties: {
            id: { type: "string" },
            contactId: { type: "string" },
            source: { type: "string" },
            status: { type: "string", enum: ["new", "contacted", "qualified", "unqualified", "converted", "closed"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            practiceAreaId: { type: "string", nullable: true },
            incidentDate: { type: "string", format: "date-time", nullable: true },
            incidentLocation: { type: "string", nullable: true },
            summary: { type: "string", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            contact: { $ref: "#/components/schemas/Contact" },
          },
        },
        CreateLeadRequest: {
          type: "object",
          required: ["source"],
          properties: {
            contactId: { type: "string", description: "Existing contact ID" },
            contactName: { type: "string", description: "Create new contact with this name" },
            contactPhone: { type: "string" },
            contactEmail: { type: "string", format: "email" },
            source: { type: "string" },
            status: { type: "string", enum: ["new", "contacted", "qualified", "unqualified", "converted", "closed"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            practiceAreaId: { type: "string" },
            incidentDate: { type: "string", format: "date-time" },
            incidentLocation: { type: "string" },
            summary: { type: "string" },
          },
        },
        UpdateLeadRequest: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["new", "contacted", "qualified", "unqualified", "converted", "closed"] },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            practiceAreaId: { type: "string" },
            incidentDate: { type: "string", format: "date-time" },
            incidentLocation: { type: "string" },
            summary: { type: "string" },
          },
        },
        ContactList: {
          type: "object",
          properties: {
            contacts: { type: "array", items: { $ref: "#/components/schemas/Contact" } },
            total: { type: "integer" },
          },
        },
        LeadList: {
          type: "object",
          properties: {
            leads: { type: "array", items: { $ref: "#/components/schemas/Lead" } },
            total: { type: "integer" },
          },
        },
      },
    },
  },
  apis: ["./server/routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
