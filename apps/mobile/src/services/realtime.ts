import { getAuthToken } from "./api";
import type { RealtimeEvent } from "../types";

type EventHandler = (event: RealtimeEvent) => void;

function getWsBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_WS_URL) {
    return process.env.EXPO_PUBLIC_WS_URL;
  }
  const apiUrl = process.env.EXPO_PUBLIC_API_BASE_URL || "https://casecurrent.co";
  if (apiUrl.startsWith("https://")) {
    return apiUrl.replace("https://", "wss://");
  }
  if (apiUrl.startsWith("http://")) {
    return apiUrl.replace("http://", "ws://");
  }
  return `wss://${apiUrl}`;
}

const WS_BASE_URL = getWsBaseUrl();

let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let pingInterval: ReturnType<typeof setInterval> | null = null;
const listeners: Set<EventHandler> = new Set();

export function addRealtimeListener(handler: EventHandler): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function notifyListeners(event: RealtimeEvent): void {
  for (const handler of listeners) {
    try {
      handler(event);
    } catch (e) {
      console.error("Realtime listener error:", e);
    }
  }
}

export function connectRealtime(): void {
  const token = getAuthToken();
  if (!token) {
    console.log("[WS] No auth token, skipping connection");
    return;
  }

  if (socket?.readyState === WebSocket.OPEN) {
    console.log("[WS] Already connected");
    return;
  }

  try {
    socket = new WebSocket(`${WS_BASE_URL}/v1/realtime?token=${token}`);

    socket.onopen = () => {
      console.log("[WS] Connected");
      startPing();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as RealtimeEvent;
        notifyListeners(data);
      } catch (e) {
        console.error("[WS] Parse error:", e);
      }
    };

    socket.onclose = (event) => {
      console.log(`[WS] Disconnected: ${event.code} ${event.reason}`);
      stopPing();
      scheduleReconnect();
    };

    socket.onerror = (error) => {
      console.error("[WS] Error:", error);
    };
  } catch (e) {
    console.error("[WS] Connection error:", e);
    scheduleReconnect();
  }
}

export function disconnectRealtime(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  stopPing();
  if (socket) {
    socket.close();
    socket = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectRealtime();
  }, 5000);
}

function startPing(): void {
  stopPing();
  pingInterval = setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "ping" }));
    }
  }, 30000);
}

function stopPing(): void {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}
