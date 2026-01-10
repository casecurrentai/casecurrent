import * as SecureStore from "expo-secure-store";
import type {
  Lead,
  ThreadResponse,
  AnalyticsSummary,
  AuthTokens,
} from "../types";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "https://casecurrent.co";

if (API_BASE_URL.includes("casecurrent.io")) {
  throw new Error(
    `Invalid API_BASE_URL: "${API_BASE_URL}" contains deprecated domain casecurrent.io. ` +
    `Please update EXPO_PUBLIC_API_BASE_URL to use casecurrent.co instead.`
  );
}

let authToken: string | null = null;
let currentOrgId: string | null = null;

export async function initializeAuth(): Promise<string | null> {
  try {
    authToken = await SecureStore.getItemAsync("authToken");
    currentOrgId = await SecureStore.getItemAsync("currentOrgId");
    return authToken;
  } catch (e) {
    console.error("Failed to get auth token:", e);
    return null;
  }
}

export async function setAuthToken(token: string): Promise<void> {
  authToken = token;
  await SecureStore.setItemAsync("authToken", token);
}

export async function setOrgContext(orgId: string): Promise<void> {
  currentOrgId = orgId;
  await SecureStore.setItemAsync("currentOrgId", orgId);
}

export async function clearAuthToken(): Promise<void> {
  authToken = null;
  currentOrgId = null;
  await SecureStore.deleteItemAsync("authToken");
  await SecureStore.deleteItemAsync("currentOrgId");
}

export function getAuthToken(): string | null {
  return authToken;
}

export function getCurrentOrgId(): string | null {
  return currentOrgId;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  auth: {
    async login(email: string, password: string): Promise<AuthTokens> {
      const result = await apiRequest<AuthTokens>("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      await setAuthToken(result.token);
      return result;
    },

    async logout(): Promise<void> {
      try {
        await apiRequest("/v1/auth/logout", { method: "POST" });
      } finally {
        await clearAuthToken();
      }
    },
  },

  leads: {
    async list(params?: {
      status?: string;
      owner?: string;
      q?: string;
      practiceArea?: string;
      hot?: boolean;
    }): Promise<Lead[]> {
      const query = new URLSearchParams();
      if (params?.status) query.set("status", params.status);
      if (params?.owner) query.set("owner", params.owner);
      if (params?.q) query.set("q", params.q);
      if (params?.practiceArea) query.set("practice_area", params.practiceArea);
      if (params?.hot) query.set("hot", "true");

      const queryStr = query.toString();
      return apiRequest(`/v1/leads${queryStr ? `?${queryStr}` : ""}`);
    },

    async get(leadId: string): Promise<Lead> {
      return apiRequest(`/v1/leads/${leadId}`);
    },

    async getThread(leadId: string, cursor?: string): Promise<ThreadResponse> {
      const query = cursor ? `?cursor=${cursor}` : "";
      return apiRequest(`/v1/leads/${leadId}/thread${query}`);
    },

    async updateStatus(leadId: string, status: string): Promise<void> {
      await apiRequest(`/v1/leads/${leadId}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
    },

    async assign(leadId: string, userId?: string): Promise<void> {
      await apiRequest(`/v1/leads/${leadId}/assign`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
    },
  },

  messaging: {
    async sendSms(leadId: string, body: string): Promise<{ messageId: string }> {
      return apiRequest(`/v1/leads/${leadId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    },
  },

  calls: {
    async start(leadId: string): Promise<{ dialTo: string; firmCallerId: string }> {
      return apiRequest(`/v1/leads/${leadId}/call/start`, {
        method: "POST",
      });
    },
  },

  intake: {
    async generateLink(leadId: string): Promise<{ intakeLink: string; expiresAt: string }> {
      return apiRequest(`/v1/leads/${leadId}/intake/link`, {
        method: "POST",
      });
    },
  },

  devices: {
    async register(
      platform: "ios" | "android",
      token: string,
      deviceId: string,
      preferences?: Record<string, boolean>
    ): Promise<void> {
      await apiRequest("/v1/devices/register", {
        method: "POST",
        body: JSON.stringify({ platform, token, deviceId, preferences }),
      });
    },

    async unregister(deviceId: string): Promise<void> {
      await apiRequest("/v1/devices/unregister", {
        method: "POST",
        body: JSON.stringify({ deviceId }),
      });
    },
  },

  analytics: {
    async getSummary(range: "7d" | "30d" = "7d"): Promise<AnalyticsSummary> {
      return apiRequest(`/v1/analytics/summary?range=${range}`);
    },

    async getCapturedLeads(range: "7d" | "30d" = "7d"): Promise<{
      range: string;
      count: number;
      leads: Array<{
        id: string;
        name: string;
        phone?: string;
        source: string;
        status: string;
        practiceArea?: string;
        score?: number;
        createdAt: string;
      }>;
    }> {
      return apiRequest(`/v1/analytics/captured-leads?range=${range}`);
    },
  },
};
