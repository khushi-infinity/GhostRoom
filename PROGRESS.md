# GhostRoom progress

## DONE
- Fresh browser load verified automatic history analysis, visible asynchronously arriving nodes, Ready state, and functioning CometChat history/composer/presence.
- After final fixes, all 14 regression tests, frontend/backend production build, and lint passed.
- Configured OpenRouter server-only with google/gemini-2.5-flash-lite; credentials are ignored and owner-readable only.
- Real-provider backend smoke tests passed: initial startup graph (8 nodes / 10 edges) and evolving graph (9 nodes / 12 edges), preserving existing IDs and citing the new message.
- Browser verified real CometChat extraction (3 nodes / 2 edges), visible graph cards, and details showing the actual source message.
- Fixed measurement-event feedback that prevented asynchronously arriving React Flow nodes from rendering.
- Added an explicit 8,192-token output limit after OpenRouter rejected its much larger default reservation; regression assertion added.
- Verified missing-AI failure in the browser: graph pauses with retry, while CometChat history/composer and 1-online presence remain available.
- Added initial auto-fit for the first real graph while preserving later user pan/zoom.
- Wired real CometChat text history, received/successfully sent messages, edits, and deletions using the documented v7 event bus without intercepting chat sending.
- Removed mock data from the live UI; graph details now resolve actual chat source messages.
- Added debounced serialized analysis, stale-response cancellation, failure retention/retry, dynamic graph nodes, and thinking UI.
- Added 14 passing backend and frontend session tests.
- Final frontend/backend TypeScript build and lint passed; existing vendor-size warning remains.
- Checked generated browser JavaScript: server AI environment variables and test provider keys are absent.
- Added server-side OpenAI-compatible extraction with provider-neutral AI_API_KEY / AI_BASE_URL / AI_MODEL configuration, strict JSON schema, parsing and validation, timeouts, output limits, and format fallback.
- Added graph provenance checks and deterministic preservation/deduplication with stable IDs.
- Final build and lint passed; verified related-concept navigation, Escape dismissal, zoom and fit-view controls.
- Refined the compact graph layout and removed overlays that obscured nodes.
- Browser verified node details (multiple source messages), close behavior, graph replay, and CometChat group history/composer/presence working alongside the graph.
- Fixed a controlled-selection issue that reopened the detail panel after closing.
- Implemented custom cards for all seven types, directional relationship labels, connected-node highlighting, zoom/pan, drag, fit-view, and replayed node emergence.
- Added a scrollable detail panel with summaries, authors, timestamps, every source message, and related-concept navigation.
- Added reduced-motion support and keyboard dismissal.
- Added GraphNode / GraphEdge TypeScript domain models and a startup launch fixture: 12 concepts, 13 relationships, 10 source messages, all seven node types.
- Kept mock provenance separate from the live CometChat conversation; source IDs remain available for future integration.
- Ran GhostRoom in Chrome: demo login succeeded, existing Hiking Group opened, message list/composer rendered, online count showed 1; no app runtime errors observed.
- Final lint check passed without warnings.
- Added setup notes, env example, credential ignores, and GhostRoom metadata/favicon.
- Built the responsive dark workspace, group picker, message list/composer, thread view, and presence indicator.
- Added the empty React Flow canvas, controls, and seven-type legend.
- Fetched credentials for the existing India-region app into ignored .env.local; selected the authorized demo user.
- TypeScript and production build passed.
- Inspected the React 19 / Vite 8 / TypeScript 6 starter and local CometChat skills.
- Selected UI Kit v7 + Chat SDK v4, following the installed React v7 core and official group-chat guide.
- Installed UI Kit 7.2.3, SDK v4, and dompurify. React Flow was already installed.
- Authenticated the CometChat dashboard CLI.

## CURRENT
- Implementing dynamic private rooms, per-browser server-issued identities, and one durable graph per room.
- Extraction implementation is built and running at http://localhost:5174/ with API at http://127.0.0.1:3001/.
- OpenRouter extraction is configured and verified through the backend and live workspace; failures retain chat functionality.
- CometChat authentication remains unchanged; independent analysis subscriber is connected.

## NEXT
- Voice room integration.
- Resolve real CometChat source IDs and add chat-message navigation.
- Production per-user token authentication and vendor bundle optimization.

## ISSUES
- Port 5173 is occupied by the earlier server; the updated verified app runs on 5174.
- npm audit reports two moderate findings through UI Kit’s transitive dompurify. Its suggested fix downgrades UI Kit to v6, so it was not applied; keep the required v7 integration.
- Voice remains disabled.
- CometChat adds large vendor chunks; build succeeds with a bundle-size warning.
- Message sending is integrated through the UI Kit but no test messages were posted to the existing group.
