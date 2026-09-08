# WoT Tomato Bridge

A small read-only Model Context Protocol (MCP) bridge for a bounded subset of the Tomato.gg API. It is intended for personal World of Tanks statistics analysis, especially Onslaught progression, per-battle logs, mod sessions, garage loadouts, and Mark of Excellence tracking.

The bridge is deliberately separated from MCP Hub's core process: the Tomato.gg API key stays inside this local bridge process, while a future MCP Hub forwarding layer only needs to talk to a fixed loopback MCP endpoint.

## Architecture

```text
Tomato.gg Mod -> Tomato.gg account/battle data
                       |
                       v
               api.tomato.gg
                       |
           x-api-key (local only)
                       |
                       v
        WoT Tomato Bridge :7342
          fixed GET endpoints only
          response/timeout/rate caps
                       |
             loopback MCP only
                       |
                       v
       MCP Hub forwarding (planned)
                       |
                       v
               ChatGPT / Codex
```

Security boundary:

- the API base is hard-coded to `https://api.tomato.gg`;
- only `/api/player/...` paths constructed by reviewed bridge methods are reachable;
- requests are GET-only;
- no caller-supplied URL, hostname, HTTP method, header, API key, executable, or shell command exists;
- the bridge listens on loopback only;
- the API key is read from `TOMATO_API_KEY` and is never returned by the doctor or MCP tools;
- errors redact strings that look like Tomato.gg keys;
- the local request budget defaults to 50/minute, below Tomato.gg's documented 60/minute key limit;
- response size and timeout are bounded;
- the bridge stores no battle data by default.

## Supported tools

| MCP tool | Purpose |
| --- | --- |
| `tomato_onslaught_progression` | Rating/delta progression for the last 60 days |
| `tomato_combined_battles` | Paged battle log, enriched with advanced/mod loadout fields where available |
| `tomato_mod_sessions` | Session-grouped battle history |
| `tomato_garage_equipment` | Mod-captured garage equipment/loadout snapshot |
| `tomato_moe_progression` | Mark of Excellence progression for one tank |
| `tomato_player_recents` | Recent player performance by day/battle windows |
| `tomato_bulk_player_stats` | Compare up to 20 players in one request |
| `tomato_battle_detail` | Full scoreboard/general metadata for one arena ID |

Player identifiers are Wargaming account IDs, not player nicknames. `TOMATO_DEFAULT_PLAYER_ID` can be configured locally so the normal personal-stat tools do not need the ID on every call.

## Install

Requirements: Node.js 20 or newer.

```bash
cd projects/wot-tomato-bridge
npm install
```

Create local environment values. Do **not** commit the real API key.

PowerShell example:

```powershell
$env:TOMATO_API_KEY = "tmgg_your_real_key"
$env:TOMATO_DEFAULT_SERVER = "asia"
$env:TOMATO_DEFAULT_PLAYER_ID = "YOUR_WG_ACCOUNT_ID"
```

Check configuration without making an upstream request:

```bash
npm run doctor
```

Start the bridge:

```bash
npm start
```

Default endpoints:

- MCP: `http://127.0.0.1:7342/mcp`
- health: `http://127.0.0.1:7342/healthz`

The health endpoint reports only configuration readiness; it does not reveal the key and does not claim that Tomato.gg is reachable.

## Tomato.gg setup

1. Install the Tomato.gg World of Tanks mod so battle results and garage loadouts can be uploaded.
2. Generate an API key from the Tomato.gg Account page.
3. Keep the key locally and provide it to this bridge only through `TOMATO_API_KEY`.
4. Let battles finish and open the result screen so the mod can record the result; missing battles can be backfilled from replay results when available.

Official references:

- API documentation: https://tomato.gg/api
- Mod guide: https://tomato.gg/mod-guide

## Tests

```bash
npm test
```

The initial tests are offline. They verify fixed-host URL construction, GET-only behavior, API-key placement, path rejection, response-size failure, and local rate limiting. They intentionally do not require a real API key.

## MCP Hub forwarding status

The bridge is ready to be forwarded, but the current MCP Hub V0.7 -> V0.8 transition explicitly freezes new capability implementation until the transition baseline is accepted. Therefore this branch does **not** edit MCP Hub core files or its public tool manifest.

The forwarding design is documented in `docs/MCP_HUB_FORWARDING.md`. The intended integration is a fixed loopback read-only provider. MCP Hub must never receive the Tomato.gg API key and must not gain generic outbound-network capability as a side effect.

## Intended personal workflow

```text
play WoT
 -> Tomato mod records battles
 -> bridge reads bounded Tomato data
 -> MCP Hub/assistant selects Onslaught or random-battle slices
 -> analyse tank/map/session/win-loss/assist/rating/MoE trends
```

This makes it possible to compare two or more known player IDs through the same data shape without exposing the Tomato.gg credential to chat history or the MCP Hub project-control core.
