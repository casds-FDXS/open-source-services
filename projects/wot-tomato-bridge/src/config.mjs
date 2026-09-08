import process from "node:process";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const SERVERS = new Set(["com", "eu", "asia"]);

function intEnv(name, fallback, { min, max } = {}) {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be an integer.`);
  if (min != null && value < min) throw new Error(`${name} must be >= ${min}.`);
  if (max != null && value > max) throw new Error(`${name} must be <= ${max}.`);
  return value;
}

function optionalPositiveInt(name) {
  const raw = process.env[name];
  if (raw == null || raw === "") return null;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}

export function loadConfig() {
  const apiKey = process.env.TOMATO_API_KEY ?? "";
  if (!apiKey.startsWith("tmgg_") || apiKey.length < 12) {
    throw new Error("TOMATO_API_KEY is missing or does not look like a Tomato.gg API key.");
  }

  const host = process.env.TOMATO_BRIDGE_HOST ?? "127.0.0.1";
  if (!LOOPBACK_HOSTS.has(host)) throw new Error("TOMATO_BRIDGE_HOST must be loopback-only.");

  const defaultServer = process.env.TOMATO_DEFAULT_SERVER ?? "asia";
  if (!SERVERS.has(defaultServer)) throw new Error("TOMATO_DEFAULT_SERVER must be one of com, eu, asia.");

  return Object.freeze({
    apiKey,
    host,
    port: intEnv("TOMATO_BRIDGE_PORT", 7342, { min: 1024, max: 65535 }),
    timeoutMs: intEnv("TOMATO_BRIDGE_TIMEOUT_MS", 12000, { min: 1000, max: 30000 }),
    maxResponseBytes: intEnv("TOMATO_BRIDGE_MAX_RESPONSE_BYTES", 2 * 1024 * 1024, { min: 64 * 1024, max: 8 * 1024 * 1024 }),
    rateLimitPerMinute: intEnv("TOMATO_BRIDGE_RATE_LIMIT", 50, { min: 1, max: 55 }),
    defaultServer,
    defaultPlayerId: optionalPositiveInt("TOMATO_DEFAULT_PLAYER_ID"),
  });
}

export const tomatoServers = Object.freeze([...SERVERS]);
