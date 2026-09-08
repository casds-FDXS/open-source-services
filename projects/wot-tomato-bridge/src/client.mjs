const API_BASE = "https://api.tomato.gg";

function boundedString(value, name, max = 120) {
  if (value == null || value === "") return undefined;
  const text = String(value);
  if (text.length > max) throw new Error(`${name} is too long.`);
  if (/[\u0000\r\n]/.test(text)) throw new Error(`${name} contains invalid control characters.`);
  return text;
}

function positiveInt(value, name) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`${name} must be a positive integer.`);
  return n;
}

function nonNegativeInt(value, name, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 0 || n > max) throw new Error(`${name} is out of range.`);
  return n;
}

class SlidingWindowLimiter {
  constructor(limit, windowMs = 60_000) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.events = [];
  }

  take(now = Date.now()) {
    this.events = this.events.filter((at) => now - at < this.windowMs);
    if (this.events.length >= this.limit) {
      const error = new Error("Local Tomato.gg rate limit reached. Retry shortly.");
      error.code = "LOCAL_RATE_LIMIT";
      throw error;
    }
    this.events.push(now);
  }
}

export class TomatoClient {
  constructor({ apiKey, timeoutMs = 12000, maxResponseBytes = 2 * 1024 * 1024, rateLimitPerMinute = 50, fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.");
    if (typeof apiKey !== "string" || !apiKey.startsWith("tmgg_")) throw new Error("A valid-looking Tomato.gg API key is required.");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.maxResponseBytes = maxResponseBytes;
    this.fetchImpl = fetchImpl;
    this.limiter = new SlidingWindowLimiter(rateLimitPerMinute);
  }

  async request(pathname, query = {}) {
    if (typeof pathname !== "string" || !pathname.startsWith("/api/player/")) {
      throw new Error("Tomato.gg path is outside the approved player API surface.");
    }
    this.limiter.take();

    const url = new URL(pathname, API_BASE);
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-api-key": this.apiKey,
          "user-agent": "wot-tomato-bridge/0.1.0",
        },
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      if (error?.name === "AbortError") {
        const timeout = new Error("Tomato.gg request timed out.");
        timeout.code = "UPSTREAM_TIMEOUT";
        throw timeout;
      }
      const network = new Error("Tomato.gg request failed before a response was received.");
      network.code = "UPSTREAM_NETWORK_ERROR";
      throw network;
    } finally {
      clearTimeout(timer);
    }

    const declaredLength = Number(response.headers?.get?.("content-length") ?? 0);
    if (Number.isFinite(declaredLength) && declaredLength > this.maxResponseBytes) {
      const error = new Error("Tomato.gg response exceeded the configured size limit.");
      error.code = "UPSTREAM_RESPONSE_TOO_LARGE";
      throw error;
    }

    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > this.maxResponseBytes) {
      const error = new Error("Tomato.gg response exceeded the configured size limit.");
      error.code = "UPSTREAM_RESPONSE_TOO_LARGE";
      throw error;
    }

    let body;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      const error = new Error("Tomato.gg returned a non-JSON response.");
      error.code = "UPSTREAM_INVALID_JSON";
      throw error;
    }

    if (!response.ok) {
      const upstreamMessage = typeof body?.error === "string" ? body.error.slice(0, 240) : `HTTP ${response.status}`;
      const error = new Error(`Tomato.gg request failed: ${upstreamMessage}`);
      error.code = `UPSTREAM_HTTP_${response.status}`;
      error.status = response.status;
      throw error;
    }
    return body;
  }

  onslaughtProgression(playerId) {
    return this.request(`/api/player/onslaught/${positiveInt(playerId, "playerId")}`);
  }

  combinedBattles(playerId, options = {}) {
    const query = {
      page: nonNegativeInt(options.page ?? 0, "page", 100000),
      pageSize: Math.min(10, Math.max(1, nonNegativeInt(options.pageSize ?? 10, "pageSize", 10))),
      days: options.days == null ? undefined : positiveInt(options.days, "days"),
      battleType: boundedString(options.battleType, "battleType", 40),
      tankId: options.tankId == null ? undefined : positiveInt(options.tankId, "tankId"),
      mapId: options.mapId == null ? undefined : positiveInt(options.mapId, "mapId"),
      arenaId: options.arenaId == null ? undefined : positiveInt(options.arenaId, "arenaId"),
      sortBy: boundedString(options.sortBy ?? "battle_time", "sortBy", 40),
      sortDirection: options.sortDirection ?? "desc",
      platoon: options.platoon ?? "in-and-outside-platoon",
      spawn: options.spawn ?? "all",
      won: options.won ?? "all",
      tankType: options.tankType ?? "all",
      classes: boundedString(options.classes, "classes", 40),
      nations: boundedString(options.nations, "nations", 80),
      roles: boundedString(options.roles, "roles", 80),
      tiers: boundedString(options.tiers, "tiers", 40),
    };
    return this.request(`/api/player/combined-battles/${positiveInt(playerId, "playerId")}`, query);
  }

  modSessions(playerId, options = {}) {
    return this.request(`/api/player/mod-sessions/${positiveInt(playerId, "playerId")}`, {
      battleType: boundedString(options.battleType, "battleType", 40),
      tankId: options.tankId == null ? undefined : positiveInt(options.tankId, "tankId"),
      map: boundedString(options.map, "map", 100),
      limit: Math.min(14, Math.max(1, nonNegativeInt(options.limit ?? 14, "limit", 14))),
    });
  }

  garageEquipment(playerId) {
    return this.request(`/api/player/equipment/${positiveInt(playerId, "playerId")}`);
  }

  moeProgression(playerId, tankId) {
    return this.request(`/api/player/moe-progression/${positiveInt(playerId, "playerId")}/${positiveInt(tankId, "tankId")}`);
  }

  playerRecents(server, playerId, options = {}) {
    if (!["com", "eu", "asia"].includes(server)) throw new Error("server must be com, eu, or asia.");
    return this.request(`/api/player/recents/${server}/${positiveInt(playerId, "playerId")}`, {
      days: boundedString(options.days, "days", 60),
      battles: boundedString(options.battles, "battles", 60),
      cache: options.cache == null ? undefined : options.cache ? "true" : "false",
    });
  }

  bulkPlayerStats(server, ids) {
    if (!["com", "eu", "asia"].includes(server)) throw new Error("server must be com, eu, or asia.");
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20) throw new Error("ids must contain 1 to 20 player IDs.");
    const normalized = ids.map((id) => positiveInt(id, "playerId"));
    return this.request(`/api/player/bulk-stats/${server}`, { ids: normalized.join(",") });
  }

  battleDetail(arenaId) {
    return this.request(`/api/player/battle-detail/${positiveInt(arenaId, "arenaId")}`);
  }
}

export const __test = { boundedString, positiveInt, nonNegativeInt, SlidingWindowLimiter, API_BASE };
