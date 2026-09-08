# MCP Hub Forwarding Design

Status: design-ready, not yet wired into MCP Hub core.

## Why forwarding is split from the bridge

MCP Hub's current North Star forbids unrestricted network and secret access. Tomato.gg requires an API key and outbound HTTPS. Putting the key directly into MCP Hub would unnecessarily widen the Recovery/Core trust boundary.

The bridge therefore owns both sensitive facts:

1. the Tomato.gg credential;
2. outbound access to the single fixed host `api.tomato.gg`.

MCP Hub should see only a local read-only MCP endpoint on loopback.

```text
MCP Hub -> http://127.0.0.1:7342/mcp -> WoT Tomato Bridge -> https://api.tomato.gg
                   no secret                     x-api-key here only
```

## Proposed MCP Hub capability

Add one non-core beta capability after the V0.7 -> V0.8 transition baseline is accepted:

```text
id: external-game-data
name: External Game Data
maturity: beta
network authority: none beyond fixed loopback provider
secret authority: none
```

The Hub-facing capability should expose only the already reviewed bridge tools:

- `tomato_onslaught_progression`
- `tomato_combined_battles`
- `tomato_mod_sessions`
- `tomato_garage_equipment`
- `tomato_moe_progression`
- `tomato_player_recents`
- `tomato_bulk_player_stats`
- `tomato_battle_detail`

No generic `http_get`, `fetch_url`, arbitrary MCP passthrough, arbitrary tool-name forwarding, dynamic endpoint discovery, or caller-supplied header should be added.

## Proposed implementation seams

Keep the new capability out of the existing project/filesystem and execution-control paths.

Recommended MCP Hub files after the transition freeze is lifted:

1. `gateway/fixed-loopback-mcp-provider.mjs`
   - accepts only a source-owned endpoint declaration;
   - endpoint fixed to `http://127.0.0.1:7342/mcp` for this bridge;
   - no caller URL/port/headers/env;
   - connection timeout and response size caps;
   - tools/list must exactly match the source-owned expected manifest before READY.

2. `gateway/external-game-data-service.mjs`
   - maps each Hub tool to exactly one upstream bridge tool;
   - validates arguments using the Hub's public schemas before forwarding;
   - redacts any unexpected `tmgg_...` material from errors;
   - returns only bounded structured results.

3. `gateway/capability-manager.mjs`
   - add `external-game-data` as beta/non-core;
   - initialization succeeds only when the bridge schema matches;
   - bridge unavailable -> capability `UNAVAILABLE`, never core failure.

4. `gateway/tool-server.mjs`
   - add the eight explicit read-only tool schemas;
   - route them to `externalGameData` service;
   - these tools are global external-data tools, not project-scoped tools, so they must not accept `project_id` or maintenance correlation unless a later design explicitly justifies it.

5. `gateway/expected-tool-manifest.mjs`
   - add the eight reviewed names only after the capability implementation and tests are ready.

6. `gateway/server.mjs`
   - construct the fixed loopback provider and external-game-data service;
   - do not read `TOMATO_API_KEY` or any bridge secret.

7. tests
   - bridge absent -> capability unavailable, Hub core stays READY;
   - schema mismatch -> fail closed;
   - unexpected upstream tool -> fail closed;
   - caller cannot control URL/host/port/header/tool name;
   - key-shaped upstream text is redacted;
   - all forwarded calls are read-only and map to exactly one reviewed tool;
   - timeout/oversize/non-JSON responses fail closed;
   - full existing Hub regression still passes.

## Health model

Bridge `/healthz` means only the bridge process loaded safe configuration. MCP Hub should not infer Tomato.gg upstream availability from it.

Suggested states:

- `READY`: loopback bridge reachable and exact tool manifest matches;
- `UNAVAILABLE`: bridge absent/refused/timeout;
- `DEGRADED`: optional only if future non-sensitive upstream observation is explicitly introduced;
- never silently fall back to direct Tomato.gg network access.

## Operation and error evidence

Forwarded reads can be recorded in Operation Bus using only:

- tool name;
- timing/status;
- bounded result metadata (for example row count or meta status where safe);
- error class.

Do not persist:

- API keys;
- request headers;
- raw bridge environment;
- full battle payloads into Hub audit logs by default.

The actual MCP response may contain the requested battle data; audit evidence should remain metadata-only.

## Installation / lifecycle

The first implementation should keep lifecycle ownership explicit:

- user starts/stops the bridge or a later reviewed launcher owns it;
- MCP Hub only observes and forwards to the fixed loopback service;
- Hub does not spawn an arbitrary command or inherit the Tomato credential;
- if the bridge is stopped, game-data tools become unavailable while all project-maintenance capabilities remain healthy.

## Current phase gate

MCP Hub's current authoritative state says V0.8 implementation has not started and the V0.7 -> V0.8 transition does not authorize new capability implementation. The Hub worktree is also intentionally mixed-dirty across the active transition.

Therefore the safe one-shot boundary for now is:

- build and review the standalone bridge;
- freeze this forwarding design;
- do **not** edit the active MCP Hub tool manifest/capability core until the transition baseline is accepted and a fresh runtime can be loaded.

Once that gate is cleared, the forwarding patch should be a bounded standalone stage rather than mixed into transition debt closure.
