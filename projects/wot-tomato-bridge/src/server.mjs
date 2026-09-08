import process from "node:process";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadConfig } from "./config.mjs";
import { TomatoClient } from "./client.mjs";

const readOnly = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

const playerIdSchema = { type: "integer", minimum: 1, description: "Wargaming account ID. Omit to use TOMATO_DEFAULT_PLAYER_ID." };
const tankIdSchema = { type: "integer", minimum: 1 };

const tools = [
  {
    name: "tomato_onslaught_progression",
    description: "Read a player's Tomato.gg Onslaught rating progression for the last 60 days.",
    annotations: readOnly,
    inputSchema: { type: "object", properties: { player_id: playerIdSchema }, additionalProperties: false },
  },
  {
    name: "tomato_combined_battles",
    description: "Read a bounded page of a player's combined Tomato.gg battle log, with advanced details when available.",
    annotations: readOnly,
    inputSchema: {
      type: "object",
      properties: {
        player_id: playerIdSchema,
        page: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
        page_size: { type: "integer", minimum: 1, maximum: 10, default: 10 },
        days: { type: "integer", minimum: 1, maximum: 3650 },
        battle_type: { type: "string", minLength: 1, maxLength: 40 },
        tank_id: tankIdSchema,
        map_id: { type: "integer", minimum: 1 },
        arena_id: { type: "integer", minimum: 1 },
        sort_by: { type: "string", minLength: 1, maxLength: 40, default: "battle_time" },
        sort_direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
        platoon: { type: "string", enum: ["in-platoon", "outside-platoon", "in-and-outside-platoon"], default: "in-and-outside-platoon" },
        spawn: { type: "string", enum: ["first", "second", "all"], default: "all" },
        won: { type: "string", enum: ["won", "lost", "draw", "all"], default: "all" },
        tank_type: { type: "string", enum: ["tech-tree", "premium", "all"], default: "all" },
        classes: { type: "string", maxLength: 40 },
        nations: { type: "string", maxLength: 80 },
        roles: { type: "string", maxLength: 80 },
        tiers: { type: "string", maxLength: 40 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "tomato_mod_sessions",
    description: "Read Tomato.gg mod sessions, optionally filtered by game mode, tank, and map.",
    annotations: readOnly,
    inputSchema: {
      type: "object",
      properties: {
        player_id: playerIdSchema,
        battle_type: { type: "string", minLength: 1, maxLength: 40 },
        tank_id: tankIdSchema,
        map: { type: "string", minLength: 1, maxLength: 100 },
        limit: { type: "integer", minimum: 1, maximum: 14, default: 14 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "tomato_garage_equipment",
    description: "Read the player's Tomato.gg garage equipment/loadout snapshot captured by the Tomato.gg mod.",
    annotations: readOnly,
    inputSchema: { type: "object", properties: { player_id: playerIdSchema }, additionalProperties: false },
  },
  {
    name: "tomato_moe_progression",
    description: "Read a player's Mark of Excellence progression for one tank.",
    annotations: readOnly,
    inputSchema: {
      type: "object",
      properties: { player_id: playerIdSchema, tank_id: tankIdSchema },
      required: ["tank_id"],
      additionalProperties: false,
    },
  },
  {
    name: "tomato_player_recents",
    description: "Read recent player statistics over bounded day and battle-count windows.",
    annotations: readOnly,
    inputSchema: {
      type: "object",
      properties: {
        player_id: playerIdSchema,
        server: { type: "string", enum: ["com", "eu", "asia"] },
        days: { type: "string", maxLength: 60, description: "Comma-separated day windows, e.g. 7,30,60." },
        battles: { type: "string", maxLength: 60, description: "Comma-separated recent battle counts, e.g. 100,500." },
        cache_only: { type: "boolean", default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: "tomato_bulk_player_stats",
    description: "Read recent and overall summary stats for up to 20 player IDs, useful for player comparisons.",
    annotations: readOnly,
    inputSchema: {
      type: "object",
      properties: {
        server: { type: "string", enum: ["com", "eu", "asia"] },
        player_ids: { type: "array", minItems: 1, maxItems: 20, uniqueItems: true, items: { type: "integer", minimum: 1 } },
      },
      required: ["player_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "tomato_battle_detail",
    description: "Read the scoreboard and general metadata for one Tomato.gg battle arena ID.",
    annotations: readOnly,
    inputSchema: {
      type: "object",
      properties: { arena_id: { type: "integer", minimum: 1 } },
      required: ["arena_id"],
      additionalProperties: false,
    },
  },
];

function resolvePlayerId(args, config) {
  const value = args.player_id ?? config.defaultPlayerId;
  if (!Number.isSafeInteger(value) || value <= 0) {
    const error = new Error("player_id is required unless TOMATO_DEFAULT_PLAYER_ID is configured.");
    error.code = "PLAYER_ID_REQUIRED";
    throw error;
  }
  return value;
}

function createToolServer(config, client) {
  const server = new Server({ name: "wot-tomato-bridge", version: "0.1.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = request.params.arguments ?? {};
    try {
      let result;
      if (name === "tomato_onslaught_progression") {
        result = await client.onslaughtProgression(resolvePlayerId(args, config));
      } else if (name === "tomato_combined_battles") {
        result = await client.combinedBattles(resolvePlayerId(args, config), {
          page: args.page,
          pageSize: args.page_size,
          days: args.days,
          battleType: args.battle_type,
          tankId: args.tank_id,
          mapId: args.map_id,
          arenaId: args.arena_id,
          sortBy: args.sort_by,
          sortDirection: args.sort_direction,
          platoon: args.platoon,
          spawn: args.spawn,
          won: args.won,
          tankType: args.tank_type,
          classes: args.classes,
          nations: args.nations,
          roles: args.roles,
          tiers: args.tiers,
        });
      } else if (name === "tomato_mod_sessions") {
        result = await client.modSessions(resolvePlayerId(args, config), {
          battleType: args.battle_type,
          tankId: args.tank_id,
          map: args.map,
          limit: args.limit,
        });
      } else if (name === "tomato_garage_equipment") {
        result = await client.garageEquipment(resolvePlayerId(args, config));
      } else if (name === "tomato_moe_progression") {
        result = await client.moeProgression(resolvePlayerId(args, config), args.tank_id);
      } else if (name === "tomato_player_recents") {
        result = await client.playerRecents(args.server ?? config.defaultServer, resolvePlayerId(args, config), {
          days: args.days,
          battles: args.battles,
          cache: args.cache_only,
        });
      } else if (name === "tomato_bulk_player_stats") {
        result = await client.bulkPlayerStats(args.server ?? config.defaultServer, args.player_ids);
      } else if (name === "tomato_battle_detail") {
        result = await client.battleDetail(args.arena_id);
      } else {
        return {
          isError: true,
          content: [{ type: "text", text: JSON.stringify({ ok: false, error: { code: "TOOL_DENIED", message: "Unknown bridge tool." } }) }],
        };
      }
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      };
    } catch (error) {
      const safe = {
        ok: false,
        error: {
          code: String(error?.code ?? "BRIDGE_ERROR"),
          message: String(error?.message ?? "Bridge request failed.").replace(/tmgg_[A-Za-z0-9_-]+/g, "[REDACTED]"),
        },
      };
      return { isError: true, content: [{ type: "text", text: JSON.stringify(safe) }], structuredContent: safe };
    }
  });
  return server;
}

export async function startBridge(config = loadConfig()) {
  const client = new TomatoClient(config);
  const app = createMcpExpressApp({ host: config.host });
  app.disable("x-powered-by");
  app.get("/healthz", (_request, response) => response.json({ status: "ok", service: "wot-tomato-bridge", version: "0.1.0", upstream: "api.tomato.gg", secret_loaded: true }));
  app.post("/mcp", async (request, response) => {
    const server = createToolServer(config, client);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    response.on("close", () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch {
      if (!response.headersSent) response.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Bridge transport error" }, id: null });
    }
  });
  app.all("/mcp", (request, response) => {
    if (request.method !== "POST") response.status(405).json({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null });
  });

  const httpServer = await new Promise((resolve, reject) => {
    const instance = app.listen(config.port, config.host, () => resolve(instance));
    instance.once("error", reject);
  });
  const address = httpServer.address();
  const actualPort = typeof address === "object" && address ? address.port : config.port;
  const url = `http://${config.host === "::1" ? "[::1]" : config.host}:${actualPort}`;
  process.stdout.write(`WOT_TOMATO_BRIDGE_READY ${url}/mcp\n`);
  return { url, close: () => new Promise((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve())) };
}

const isEntry = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href;
if (isEntry) {
  const bridge = await startBridge();
  const stop = async () => { await bridge.close(); process.exit(0); };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
