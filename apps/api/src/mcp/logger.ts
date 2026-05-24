/**
 * Minimal structured logger.
 *
 * Emits JSON lines on stdout/stderr so log aggregators (Phase 5) can
 * parse them without ceremony. Replaces ad-hoc console.log calls.
 *
 * Levels: debug, info, warn, error.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const minLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel | undefined) ??
  (process.env.NODE_ENV === "production" ? "info" : "debug");

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...fields,
  });

  // MCP stdio protocol requires stdout to carry JSON-RPC only. When running
  // over stdio, route all logs to stderr regardless of level.
  if (process.env.MCP_TRANSPORT === "stdio" || level === "error" || level === "warn") {
    console.error(line);
  } else {
    console.info(line);
  }
}

export const logger = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};

export type Logger = typeof logger;
