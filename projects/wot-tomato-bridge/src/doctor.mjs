import { loadConfig } from "./config.mjs";

try {
  const config = loadConfig();
  const safe = {
    status: "READY",
    host: config.host,
    port: config.port,
    timeout_ms: config.timeoutMs,
    max_response_bytes: config.maxResponseBytes,
    rate_limit_per_minute: config.rateLimitPerMinute,
    default_server: config.defaultServer,
    default_player_id_configured: config.defaultPlayerId != null,
    api_key_loaded: true,
  };
  process.stdout.write(`${JSON.stringify(safe, null, 2)}\n`);
} catch (error) {
  const message = String(error?.message ?? "Bridge configuration invalid.").replace(/tmgg_[A-Za-z0-9_-]+/g, "[REDACTED]");
  process.stderr.write(`${JSON.stringify({ status: "NOT_READY", error: message }, null, 2)}\n`);
  process.exitCode = 1;
}
