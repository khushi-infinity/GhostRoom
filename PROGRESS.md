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

## DONE
- Fixed "Use the GhostRoom app to make this request" root cause: enabled `xfwd: true` in `vite.config.ts`, added `x-forwarded-host` handling in `server/app.ts`, and removed port-mismatched `PUBLIC_ORIGIN`.
- Fixed Join Room failure ("Room not found. Check the invite code."): `server/rooms.ts` was attempting `getGroup` on behalf of the joining user before they joined the private CometChat group, returning 404; updated to add membership first before verifying joined status.
- Implemented and verified end-to-end Playwright multiplayer browser testing (`tests/multiplayer.spec.ts`):
  1. Khushi creates room "Product Strategy" -> gets code `GR-FXWF69BT` -> enters room as owner.
  2. Alex joins via room code in isolated browser context -> successfully added to private group.
  3. Bi-directional real-time messaging verified ("Hey Alex" / "Hey Khushi") without refreshing.
  4. Real-time participant roster shows both users online.
  5. Shared knowledge graph generated from discussion ("We should launch GhostRoom for startup teams" vs "Research teams have more complex discussions") -> 5 nodes/edges generated and synchronized across both sessions.
  6. Graph node detail panel verified with message provenance and source citations.
  7. Refresh test verified both sessions retain their identities, room membership, chat history, and graph state.
- All 17 backend unit tests, Playwright multiplayer test, OxLint (0 errors), and production TypeScript/Vite build passed.

## CURRENT
- Multiplayer dynamic private rooms, two-user chat, real participant rosters, and synchronized AI knowledge graph are fully working and verified.

## NEXT
- Voice room integration.
- Chat-message navigation from graph cards.
- Vendor bundle optimization.

## ISSUES
- CometChat UI Kit includes large vendor chunks; production build succeeds with a standard bundle-size advisory.
