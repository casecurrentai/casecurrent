import { describe, it } from "node:test";
import assert from "node:assert";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5000";

describe("API Routes", () => {
  describe("Health Check", () => {
    it("GET /api/health returns healthy status", async () => {
      const response = await fetch(`${BASE_URL}/api/health`);

      assert.strictEqual(response.status, 200);

      const json = await response.json();
      assert.strictEqual(json.status, "healthy");
      assert.ok(json.timestamp);
      assert.ok(json.database !== undefined);
    });
  });

  describe("Version", () => {
    it("GET /api/version returns version info", async () => {
      const response = await fetch(`${BASE_URL}/api/version`);

      assert.strictEqual(response.status, 200);

      const json = await response.json();
      assert.ok(json.build !== undefined);
      assert.ok(json.bootTime !== undefined);
    });
  });

  describe("Root API", () => {
    it("GET /api returns API info", async () => {
      const response = await fetch(`${BASE_URL}/api`);

      assert.strictEqual(response.status, 200);

      const json = await response.json();
      assert.ok(json.name !== undefined || json.status !== undefined);
    });
  });

  describe("Authentication", () => {
    it("POST /v1/auth/login requires email and password", async () => {
      const response = await fetch(`${BASE_URL}/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      assert.strictEqual(response.status, 400);

      const json = await response.json();
      assert.strictEqual(json.error, "Email and password required");
    });

    it("POST /v1/auth/login rejects invalid credentials", async () => {
      const response = await fetch(`${BASE_URL}/v1/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: "nonexistent@example.com",
          password: "wrongpassword",
        }),
      });

      assert.strictEqual(response.status, 401);

      const json = await response.json();
      assert.strictEqual(json.error, "Invalid credentials");
    });

    it("GET /v1/me requires authentication", async () => {
      const response = await fetch(`${BASE_URL}/v1/me`);

      assert.strictEqual(response.status, 401);
    });
  });

  describe("Diagnostic Endpoints", () => {
    it("GET /v1/diag/logs returns 404 or 401 without valid token", async () => {
      const response = await fetch(`${BASE_URL}/v1/diag/logs`);

      // Returns 404 if DIAG_TOKEN not set, 401 if token mismatch
      assert.ok(response.status === 404 || response.status === 401);
    });

    it("GET /v1/diag/status returns 404 or 401 without valid token", async () => {
      const response = await fetch(`${BASE_URL}/v1/diag/status`);

      assert.ok(response.status === 404 || response.status === 401);
    });
  });

  describe("OpenAPI Documentation", () => {
    it("GET /docs.json returns valid JSON", async () => {
      const response = await fetch(`${BASE_URL}/docs.json`);

      assert.strictEqual(response.status, 200);

      const contentType = response.headers.get("content-type") || "";
      assert.ok(contentType.includes("application/json"));

      const json = await response.json();
      assert.ok(json.openapi !== undefined || json.swagger !== undefined);
    });
  });
});
