import type WebSocket from 'ws';

export interface KeepAliveOptions {
  /** Human label: "twilio-downstream" | "openai-upstream" etc. */
  label: string;
  /** Correlation id: CallSid, StreamSid, or composite */
  id: string;
  /** Ping interval in ms (default 15000) */
  intervalMs?: number;
  /** Mark socket stale after this many ms without any inbound frame (default 45000) */
  staleMs?: number;
  /** Structured logger — defaults to console.log with JSON */
  log?: (msg: Record<string, unknown>) => void;
}

export interface KeepAliveHandle {
  /** Stop the keepalive timer */
  stop: () => void;
  /** Timestamp of last inbound activity */
  getLastSeen: () => number;
  /** Ms since attach */
  getUptimeMs: () => number;
}

/**
 * Attach ping/pong keepalive + stale detection to a WebSocket.
 *
 * - Sends `ws.ping()` every `intervalMs`.
 * - If no pong (or any message) arrives within `staleMs`, terminates the socket.
 * - Logs every ping, pong, error, and close with structured JSON.
 */
export function attachKeepAlive(ws: WebSocket, opts: KeepAliveOptions): KeepAliveHandle {
  const intervalMs = opts.intervalMs ?? 15_000;
  const staleMs = opts.staleMs ?? 45_000;
  const log = opts.log ?? ((m: Record<string, unknown>) => console.log(JSON.stringify(m)));

  const startedAt = Date.now();
  let lastSeen = Date.now();

  const meta = { label: opts.label, id: opts.id };

  // Track inbound activity on pong
  ws.on('pong', () => {
    lastSeen = Date.now();
    log({ event: 'ws_ka_pong', ...meta });
  });

  // Any inbound message counts as "alive"
  const origOnMessage = () => { lastSeen = Date.now(); };
  ws.on('message', origOnMessage);

  // Log errors
  ws.on('error', (err) => {
    log({
      event: 'ws_ka_error',
      ...meta,
      error: (err as Error)?.message ?? String(err),
    });
  });

  // Obituary on close
  ws.on('close', (code, reasonBuf) => {
    const reason =
      typeof reasonBuf === 'string'
        ? reasonBuf
        : Buffer.isBuffer(reasonBuf)
          ? reasonBuf.toString('utf8')
          : '';
    const elapsedS = Math.round((Date.now() - startedAt) / 1000);
    log({
      event: 'ws_ka_close',
      ...meta,
      code,
      reason,
      elapsedS,
      lastSeenAgoMs: Date.now() - lastSeen,
    });
  });

  // Periodic ping + stale check
  const timer = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return;

    const idleMs = Date.now() - lastSeen;
    if (idleMs > staleMs) {
      log({
        event: 'ws_ka_stale',
        ...meta,
        idleMs,
        staleMs,
        action: 'terminate',
      });
      try { ws.terminate(); } catch { /* already dead */ }
      return;
    }

    try {
      ws.ping();
    } catch (e) {
      log({
        event: 'ws_ka_ping_failed',
        ...meta,
        error: (e as Error)?.message ?? String(e),
      });
      try { ws.terminate(); } catch { /* already dead */ }
    }
  }, intervalMs);

  // Don't prevent process exit
  timer.unref?.();

  return {
    stop: () => clearInterval(timer),
    getLastSeen: () => lastSeen,
    getUptimeMs: () => Date.now() - startedAt,
  };
}
