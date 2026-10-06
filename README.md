# GhostRoom

Real-time CometChat group conversation beside an AI-generated visual knowledge graph.

## Run

```sh
npm install
cp server/.env.example server/.env
# Edit server/.env with your provider configuration.
npm run dev
```

`npm run dev` starts the backend on `127.0.0.1:3001` and Vite on the available local port shown in its output. Vite proxies `/api` to the backend. Select a CometChat group; its recent text history (up to 50 messages) seeds analysis. Received messages and successful local sends update it automatically. A 1.4-second debounce batches bursts; new messages during a request trigger a serialized follow-up.

## AI configuration — server only

In **server/.env** (gitignored):

```dotenv
AI_API_KEY=your-provider-key
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=your-provider-model-id
API_PORT=3001
```

`AI_BASE_URL` includes the provider’s API prefix. The backend appends `/chat/completions`; another OpenAI-compatible provider works by changing these variables. No `VITE_AI_*` variables, frontend provider calls, or frontend AI keys. The backend reads server/.env only (or process environment overrides). Restart the backend after editing configuration. Keep API_PORT at 3001 with the default Vite proxy, or update the proxy together.

The model is asked for strict structured JSON. Providers that explicitly reject structured-output parameters fall back to JSON mode, then schema-guided plain output, with the same local validation in every mode. Invalid output gets one bounded regeneration attempt. Refusals, truncated responses, bad schemas, unknown sources, unsupported authors, dangling edges, timeouts, and provider failures return safe JSON errors. The frontend retains its last valid graph and keeps chat operational, with a subtle thinking indicator and a retry action.

Validation guarantees shape and reference integrity; the grounding prompt requires every claim and relationship to be supported by the conversation. Structural validation alone cannot prove a model’s interpretation is factually correct. Review the cited source messages in the detail panel.

## API

`POST /api/analyze-conversation`, `Content-Type: application/json`:

```json
{
  "messages": [{ "id": "123", "senderId": "alice", "senderName": "Alice", "text": "Let's launch a private beta.", "timestamp": "2026-10-06T10:00:00Z" }],
  "existingGraph": { "nodes": [], "edges": [] }
}
```

Success is **only** `{ "nodes": [...], "edges": [...] }`, with the requested node and edge schema. `authorId` is optional in returned nodes. Frontend timestamps are derived from source messages. `existingGraph` may include those timestamps, which are not returned by the endpoint.

Existing nodes retain stable IDs and provenance. Exact normalized label/type duplicates are merged deterministically; semantic duplicate identification and evolving summaries are handled by the model. Edge references are remapped after merges. The endpoint preserves omitted existing concepts and relationships so an incomplete response cannot silently erase the graph.

Limits: 200 input messages, 200 graph nodes, 500 edges, 1 MB request/provider response, 45-second provider deadline, at most two concurrent analyses and 20 accepted requests per minute. This is a localhost hackathon backend. Before exposing it publicly, add app authentication/room authorization, per-user quotas, and persistent room graph storage. The frontend sends the latest 200 text messages plus existingGraph; media contents are not analyzed.

`GET /api/health` returns `{ "ok": true, "aiConfigured": true|false }` without keys or provider settings.

## Graph behavior

All seven node types have custom visual cards. New nodes animate in; updates reuse IDs and node positions. Drag nodes, pan, zoom, or use Fit View. Click a node (or focus its card and press Enter/Space) for summary, real source messages, and related concepts. Close with × or Escape. Reduced-motion preferences are respected.

Mock startup fixtures remain in `src/graph/mockData.ts` as development data; the live application no longer imports them. Graph state is in memory for the selected room. Changing rooms aborts old requests and clears the graph to avoid mixing conversations. Deleted messages remove unsupported orphaned nodes; edits are reanalyzed.

## CometChat

Integration follows the installed `.claude/skills/cometchat-react-v7-core` skill, current group-chat docs, and v7 unified event system (`message/text-received`, `ui:message/sent` filtered to `success`). `ConversationBridge` subscribes independently and never intercepts message sending.

CometChat credentials remain in ignored `.cometchat/config.json` and `.env.local`. For a fresh checkout, copy `.env.example` to `.env.local` and fill in App ID, region, development Auth Key, and existing UID. Optional `VITE_COMETCHAT_GROUP_GUID` opens a group directly; the user needs access. Restart Vite after env changes.

`VITE_COMETCHAT_CREATE_DEMO_USER=true` is development-only. Production should use backend-issued per-user tokens and `loginWithAuthToken`.

## Verification

```sh
npm test
npm run build
npm run lint
```

Tests use a controlled provider transport, never paid external calls. They cover the real HTTP endpoint and analysis-session failure/concurrency behavior. A live-provider smoke test additionally requires server/.env credentials. Voice remains disabled. See PROGRESS.md.
