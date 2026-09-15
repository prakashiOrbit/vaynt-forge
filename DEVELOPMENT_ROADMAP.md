# APIForge — Production Development Roadmap

> **Product:** APIForge — Build. Test. Debug. Understand.
> A professional desktop API engineering workbench (IDE + API Command Center).
> **Not** a Postman clone. Combines HTTP, GraphQL, WebSocket, SSE, gRPC, OpenAPI,
> testing, mocking, performance, documentation, and debugging in one product.

---

## 1. Committed Tech Stack (no backtrack)

| Layer | Choice | Notes |
|---|---|---|
| Shell | **Electron** (Chromium + Node) | Proved by VS Code, Postman, Insomnia |
| Language | TypeScript (strict) | Everywhere — main, preload, renderer, engine |
| UI | React + Tailwind CSS + shadcn/ui | Reuse existing `APIForge.html` prototype 1:1 |
| Icons | Lucide | |
| State | Zustand (`persist` middleware) | |
| Editors | Monaco (`@monaco-editor/react`) | CodeMirror 6 as lighter alt |
| Command palette | `cmdk` | |
| Tables | `@tanstack/react-table` | |
| Collection tree + DND | `react-arborist` | |
| Charts | ECharts | Dense/technical look (P50–P99, load gauges) |
| HTTP engine | `undici` (native fetch) + libcurl fallback for exotic TLS/SSH | Main-process |
| WebSocket | `undici.WebSocket` / `ws` | Main-process |
| SSE | `undici` EventSource / `eventsource` | Main-process |
| gRPC | `@grpc/grpc-js` | Client **and** server (powers in-app gRPC mock) |
| User-script sandbox | `isolated-vm` in worker threads | Security boundary |
| Storage | SQLite (`better-sqlite3` / `node:sqlite`), WAL | Main-process |
| Secrets | Electron `safeStorage` | Keychain / DPAPI / libsecret |
| Packaging / updates | `electron-builder` + `electron-updater` | arm64 + x64 (universal DMG on macOS) |
| Crash/telemetry | Sentry | |
| Charts / diff | ECharts + Monaco diff editor | |
| Monorepo | Turborepo | `apps/desktop`, `apps/web`, `packages/engine`, `packages/ui` |

### Architecture rule (makes "no backtrack" safe)

```
packages/engine      → networking, storage, sandbox — PURE TypeScript, ZERO Electron imports
apps/desktop        → Electron shell (main + preload) + renderer
apps/web            → browser fallback (PWA) sharing the engine via a transport adapter
packages/ui         → shared React components + design tokens
```

Everything we actually build lives in `packages/engine` + `packages/ui`. Electron only
adds packaging, keychain, tray, dialogs. If we ever migrate shells, we migrate the thin
shell — not the product.

### Deliverables per sprint
1. Code complete + type-checks (`tsc --strict` clean)
2. Working in `electron .` (dev mode), no dead buttons
3. Acceptance criteria below verified and checked off
4. This file **updated** (checkboxes ticked) before moving to the next sprint

---

## Sprint 0 — Foundations & Project Setup

**Goal:** Repo boots, Electron runs, design tokens live, CI green.

### Tasks
- [x] Scaffold Turborepo monorepo (`apps/desktop`, `apps/web`, `packages/engine`, `packages/ui`, `packages/config`)
- [x] Electron + Vite + React + TypeScript scaffold (contextBridge IPC, `contextIsolation: on`, `nodeIntegration: off`, `sandbox: on`)
- [x] Strict TS config shared via `packages/config`
- [x] Tailwind CSS + shadcn/ui initialised, components configured
- [x] Toolbar: `tsc --noEmit`, ESLint, Prettier; pre-commit hooks (Husky)
- [x] Base project structure for main / preload / renderer
- [x] Dev/load of `APIForge.html` prototype as the initial renderer shell (sanity check)
- [x] README with run instructions (`npm run dev`, `npm run build`)

### Acceptance criteria
- [x] `npm run dev` opens an Electron window showing the app shell
- [x] `npm run lint` + `npm run typecheck` pass on a fresh clone
- [x] preload exposes a minimal typed API and proves the IPC round-trip (renderer ↔ main)
- [x] `npm run build` produces a runnable output

---

## Sprint 1 — Application Shell & Navigation

**Goal:** Full shell (TopBar / Sidebar / StatusBar), all nav items live, workspace tabs, onboarding, environment selector.

### Tasks
- [x] `AppShell` layout: TopBar, left Sidebar, main content area, StatusBar
- [x] Sidebar with all 13 primary nav items: Home, Workspace, Requests, Collections, Tests, Mock Servers, OpenAPI, History, Performance, WebSockets, Environments, Documentation, Settings (bottom)
- [x] Sidebar collapse/expand + persistent width (drag-resize handle, 52–320px, persisted)
- [x] TopBar: APIForge logo, global search trigger (`Cmd/Ctrl + K`), environment selector, notifications, help, settings, user/workspace indicator ✅
- [x] IDE-style **workspace tabs** (`[GET /users] [POST /login] [WebSocket] [+]`) with: method colour, name, unsaved dot, close button, active state, scrolling (+ `[+]` opens a real new-request tab)
- [x] Placeholder screens for **every** sidebar item (no dead buttons — all open real screens)
- [x] First-launch onboarding flow (Welcome → Create Workspace / Import OpenAPI / Import Collection / Start with Demo Workspace) — default prototype path = Demo Workspace ("Acme API")
- [x] Workspace switcher (My Workspace, Acme API, iTouch, Project ARC; create/rename/duplicate/delete/export)
- [x] Keyboard shortcuts foundation (registered once, used everywhere — `lib/shortcuts.ts`)

### Acceptance criteria
- [x] Every sidebar item opens its own real screen
- [x] Tabs can open/close/switch; unsaved indicator works
- [x] `Cmd/Ctrl + K` opens a working command palette
- [x] Workspace switcher switches data context
- [x] First launch shows onboarding; subsequent launches skip it

---

## Sprint 2 — Design System & Shared UI Primitives

**Goal:** One consistent design system reusable across every screen.

### Tasks
- [x] Design tokens: background surfaces (deep charcoal / dark slate), borders (subtle), text contrast, accent (blue→violet), success/error, focus rings
- [x] Dark (default) + Light + System themes; theme toggle functional
- [x] Typography: Barlow / technical sans + Barlow Condensed for logo/brand; JetBrains Mono for code
- [x] `StatusBadge` (method, status codes, severity)
- [x] `DataTable` (dense, sortable, resizable columns)
- [x] `EmptyState`, `ErrorState`, `LoadingState` (skeletons) — technical visual language, no stock illustrations
- [x] `ConfirmDialog` (support for dangerous-action warnings)
- [x] Toasts + `NotificationCenter`
- [x] Desktop-style **context menus** (collections/requests/explorer)
- [x] `Modal` / `Drawer` primitives
- [x] Tooltips with sensible delay; keyboard-focusable; ARIA labels throughout
- [x] Full `CommandPalette` with sections (Requests, Collections, Environments, Variables, History, Documentation, Settings, Commands)
- [x] **Interaction-layer micro-interactions** (shared, consistent): hover states, active-nav state, tab switch feedback, request-send animation, response-loading sweep, success confirmation, slide-in toasts, expandable JSON, collapsible sidebar, palette open/close animation — fast, never playful
- [~] **Resize behaviour**: 1440×900 primary; verify 1280×800 (panels collapse, sidebar collapses, request/response can stack), 1600×1000, 1920×1080 — *structural layout is responsive; manual 1280/1600/1920 visual pass pending on user side (tabs/responsive toasts/EmptyState polish was fold into Sprint 5+)*

### Acceptance criteria
- [x] Theme toggle works across all screens (dark/light/system)
- [x] All these components rendered and used on at least one screen
- [x] No visual regressions in dev vs the design spec (dense, panels, no huge cards)
- [x] Keyboard navigation + visible focus verified on primary flows

---

## Sprint 3 — Engine Core: Storage, State & Secrets

**Goal:** Data layer that the whole product hangs on.

### Tasks
- [ ] SQLite schema: `workspaces`, `collections`, `folders`, `requests`, `environments`, `variables`, `history`, `testRuns`, `mockServers`, `mockEndpoints`, `assertions`, `settings`, `notifications`
- [ ] Engine module: workspace/collection/request CRUD (pure TS, no Electron imports)
- [ ] Zustand store wiring: `activeWorkspace`, `activeRequest`, `activeEnvironment`, `collections`, `requests`, `history`, `mockServers`, `testRuns`, `notifications`, `variables`, `settings`
- [ ] Zustand `persist` for UI prefs; SQLite as source of truth via IPC
- [ ] `safeStorage` integration — secrets (API keys, tokens, client secrets) never in plaintext
- [ ] Environment variable resolution engine (scopes: global → environment → collection) + generated vars (`{{$guid}}`, `{{$timestamp}}`, `{{$randomInt}}`)
- [ ] Import/export serialisers (collection JSON, environment JSON) ready for later sprints
- [ ] Seed function: Demo Workspace "Acme API" (collections, environments, requests, sample history)

### Acceptance criteria
- [ ] Create/edit/delete workspace, collection, request, environment persists across app restart
- [ ] Secrets encrypted at rest (verify: DB dump shows no plaintext secret)
- [ ] `{{variable}}` resolves correctly at global/env/collection scope
- [ ] Demo workspace seeds correctly on first launch

---

## Sprint 4 — Home Dashboard

**Goal:** Developer dashboard — signal, not fluff.

### Tasks
- [ ] Welcome back + active workspace banner
- [ ] **Continue where you left off** (recent requests/tabs)
- [ ] Recent Requests (method, URL, status, duration): `GET /users 200 · 124ms`, `POST /orders 500 · 923ms`, etc.
- [ ] Recently Opened Collections
- [ ] Active Environment chip
- [ ] Recent Test Runs (summary: passed/failed)
- [ ] Mock Servers status strip
- [ ] API Health indicators
- [ ] Quick Actions (New Request, New Collection, Import OpenAPI, Import Collection, New Environment, Create Mock Server)
- [ ] Metrics row: Requests today, Tests executed, Avg response time, Failed requests
- [ ] Dashboard reflects live store state (history, etc.), not hardcoded strings

### Acceptance criteria
- [ ] Every card/pill links to its real screen
- [ ] Quick actions actually create things / open dialogs
- [ ] Numbers update after you execute a request

---

## Sprint 5 — Request Builder (core screen)

**Goal:** The heart of APIForge — premium, dense, keyboard-driven.

### Tasks
- [ ] Request workspace layout: collection/request explorer (left) · request builder (center) · response viewer (bottom)
- [ ] **Resizable panels** for all three regions (real IDE feel)
- [ ] Request header: method selector (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS w/ colour coding), URL input w/ variable highlighting, Send (with loading→response animation), Save, More actions
- [ ] Request tabs: **Params · Authorization · Headers · Body · Scripts · Tests · Settings**
- [ ] `KeyValueEditor` component (params/headers) with add/remove/disable/bulk-edit/secret-eye
- [ ] Authorization panel: No Auth, API Key, Bearer, Basic, OAuth 2.0, JWT, AWS Signature, Custom — contextual fields per type
- [ ] Body panel: none, form-data, x-www-form-urlencoded, raw, binary, GraphQL; raw language chooser (JSON/XML/Text/JS/HTML)
- [ ] Monaco editors with syntax highlighting for raw bodies + GraphQL
- [ ] Scripts panel: pre-request / post-response (Monaco) + sandbox stubs
- [ ] Tests panel: assertion builder (status code equals, response time <, JSON path exists/equals, header exists, schema matches) with `+ Add Assertion`
- [ ] Settings tab per request (timeouts, redirects, SSL verify, encoding)
- [ ] Multi-tab workspace integration (each tab = independent request state)
- [ ] Variable autocomplete + `{{$guid}}` style helpers in URL/params/headers

### Acceptance criteria
- [ ] Panels drag-resize independently; layout persists
- [ ] All tabs functional and preserve per-request state
- [ ] Switching between two open request tabs does not lose unsaved edits
- [ ] All 8 auth types render contextual configuration
- [ ] All 6 body types render their editor

---

## Sprint 6 — Network Engine & Response Viewer

**Goal:** Real request execution with professional response inspection.

### Tasks
- [ ] `packages/engine` HTTP client via `undici` (per-request dispatchers for proxy/TLS override)
- [ ] IPC contract: `request.execute(requestModel, envContext) → responseModel`
- [ ] Response model: status, statusText, headers, body (parsed), size, timing breakdown, cookies
- [ ] Timeline measurement: **DNS lookup · TCP connect · TLS · Waiting (TTFB) · Download** segments
- [ ] Send pipeline states: idle → resolving → sending → waiting → complete / failed (drive loading skeletons)
- [ ] Response viewer header: `200 OK · 124 ms · 2.4 KB` + pretty/raw/preview toggles
- [ ] Response **Body** — JSON tree viewer: expand/collapse all, search, copy, download
- [ ] Response **Headers / Cookies / Timeline** tabs (timeline as horizontal visual segments)
- [ ] Response **Test Results** tab (pair with Sprint 8 assertions)
- [ ] Error path: `Request failed — 500 Internal Server Error` with URL, duration, response, possible causes, debug suggestions, actions (Retry / Open Request / Copy Error)
- [ ] HTTP Redirect handling + visibility (count + redirect chain)
- [ ] User scripts execution in `isolated-vm` worker: pre-request & post-response lifecycle
- [ ] Variable resolution applied before send; response writing `pm.*`/`environment.*`-style back is protocol-defined

### Acceptance criteria
- [ ] Sending the default request returns the mocked `200 · 124ms` response with real-looking lifecycle (loading → body)
- [ ] Timeline shows correct panel blocks summing to total
- [ ] JSON tree expands/collapses 10k-node mock without hang
- [ ] Simulated 500 surfaces the full error experience with working Retry/Open/Copy
- [ ] User-script sandbox blocks `require`, `process`, network access (verified by test)

---

## Sprint 7 — Collections, Environments & Chaining

**Goal:** Organisation + runner + chaining.

### Tasks
- [ ] Collection explorer tree (collections → folders → requests) with expand/collapse
- [ ] Drag-and-drop reordering (react-arborist)
- [ ] Context menus: New Request, New Folder, Rename, Duplicate, Move, Run, Export, Delete (collections); Open, Duplicate, Run, Copy as cURL, Copy URL, Move, Delete (requests)
- [ ] Collection/create request flows with auto-save into store
- [ ] **Collection Runner**: select collection, iterations, delay, environment, data file, concurrency; live progress; per-request timing; Passed/Failed/Skipped results; summary (e.g. `23 passed · 2 failed`)
- [ ] **Request Chaining**: visual flow editor (`POST /login → extract $.token → GET /users → extract $.users[0].id → ...`), configure extract var, source, JSONPath, variable name
- [ ] **Environment Manager**: add/duplicate/rename/delete, import `.env`, export, variable rows (Initial Value / Current Value / Secret toggle + reveal eye)
- [ ] **Variable Inspector**: global/env/collection/request/temporary scopes, resolution preview, generated-variable values
- [ ] **Production safety**: switching to Production shows warning; destructive requests (DELETE / DB-mutating paths / dangerous actions) trigger ConfirmDialog `Cancel / Execute anyway`
- [ ] Notification toasts on run-complete, env-switch, etc.

### Acceptance criteria
- [ ] Runner executes the sample collection with visible live progress and correct Passed/Failed/Skipped tallies
- [ ] Chain flow: running the chain propagates extracted variables into later requests
- [ ] `.env` import populates variables; secrets are masked everywhere
- [ ] Production-gated destructive request requires explicit confirmation
- [ ] `Copy as cURL` from context menu produces a valid cURL string

---

## Sprint 8 — Tests, OpenAPI & Documentation

**Goal:** Testability + spec-driven workflows + generated docs.

### Tasks
- [ ] Assertion model + evaluator (status, time, JSON path, header, schema-match) wired to Test Results tab
- [ ] OpenAPI import: JSON / YAML / URL → parser → persisted spec
- [ ] OpenAPI Explorer: API info, servers, auth, tags, endpoint tree (`GET /users/{id}` …), schemas, examples
- [ ] Actions: **Send Request**, **Generate Collection**, **Generate Mock Server**, **Generate Documentation** from a spec
- [ ] Documentation viewer: left nav (Overview, Authentication, Users, Orders, Payments, Errors); endpoint pages (description, params, headers, request, response, schemas, examples)
- [ ] Code examples per endpoint: **cURL / JavaScript / Python / Java / Go**
- [ ] Documentation generation from OpenAPI produces the full viewer
- [ ] Wire-sample "Acme API" OpenAPI (users/orders/payments) for demo

### Acceptance criteria
- [ ] Import a sample OpenAPI file → explorer + docs render fully
- [ ] Generate Collection from spec creates a real collection in a workspace
- [ ] Code examples render with syntax highlighting and copy buttons
- [ ] Every spec endpoint has Send Request available and working

---

## Sprint 9 — Real-time Protocols (GraphQL, WebSocket, SSE, gRPC)

**Goal:** The protocol breadth that separates APIForge from Postman.

### Tasks
- [ ] **GraphQL** workspace: endpoint, query editor (+ pretty/format), variables editor, headers, schema explorer (right panel, from introspection), execute, response tree
- [ ] **WebSocket** workspace: URL, Connect/Disconnect, connection status (CONNECTED/DISCONNECTED/CONNECTING), incoming + outgoing message lists with timestamps & direction badges, composer, message format (JSON/text/binary), connection log, Ping, Reconnect, Clear
- [ ] **SSE** monitor: connection URL, status, live event stream (event type, ID, timestamp, payload), Pause stream, Clear, Reconnect
- [ ] **gRPC** workspace: server, proto file view, services/methods tree, request message editor, response message view, metadata, Call, streaming controls (server/client/bidi stubs)
- [ ] In-app **gRPC mock server** (via `@grpc/grpc-js` server) to demo
- [ ] Each protocol screen has realistic mock connect/disconnect + data-stream states
- [ ] Multi-tab: WebSocket/GraphQL/etc. as workspace tabs alongside HTTP requests

### Acceptance criteria
- [ ] WebSocket shows connected state, streams mock messages both directions, ping/reconnect work
- [ ] GraphQL schema explorer renders from introspection JSON; query execution returns a mocked tree
- [ ] SSE stream pauses/resumes/clears without tearing the UI
- [ ] gRPC lists services/methods and performs a mocked unary call; streaming shows progress

---

## Sprint 10 — Mock Servers

**Goal:** In-app mocking that developers actually trust.

### Tasks
- [ ] Mock Servers dashboard: server list, status dot (● Running / ○ Stopped), endpoint list, Start/Stop/Restart, request log, latency/error simulation
- [ ] In-app mock server engine (real Node HTTP server in main process)
- [ ] **Mock Response Designer**: status picker (200/201/400/401/404/500), headers, body editor (JSON), simulated latency (0/100/500/1000ms/custom), error simulation
- [ ] Response templates + example responses
- [ ] Create Mock Server wizard (name, port, endpoints) → shows real `http://localhost:{port}`
- [ ] Mock request logs from engine surface in UI
- [ ] Integration: OpenAPI → Generate Mock Server (Sprint 8)

### Acceptance criteria
- [ ] Start Mock Server actually binds a port and serves the designed responses (curl it)
- [ ] Stop/Restart transitions are reflected live in UI
- [ ] Latency + error simulation honoured per-endpoint
- [ ] Request log captures hits with method/path/status/timestamp

---

## Sprint 11 — Performance Testing, Debugging & Comparison

**Goal:** k6-style load + diagnostics + diff.

### Tasks
- [ ] Performance test config: target URL, method, requests, concurrency, duration, ramp-up, environment, auth
- [ ] Load engine (undici pools, main process) with configurable ramp
- [ ] Live run progress (streaming metrics to renderer)
- [ ] Results: Requests/sec, Avg latency, **P50 / P90 / P95 / P99**, error rate, successful/failed
- [ ] ECharts: latency over time, requests/sec, response distribution, error rate
- [ ] **API Debugger** workspace: request, response, timeline, headers, cookies, redirects, connection, errors, warnings in structured detail; failure diagnosis (e.g. `500 → possible causes: db timeout / auth failure / upstream unavailable`)
- [ ] **Compare Requests**: Request A vs Request B, diff of URL, method, headers, params, body, response — Monaco diff viewer
- [ ] Save performance runs to SQLite; history of runs

### Acceptance criteria
- [ ] A 500-request run completes with all percentiles + charts rendered
- [ ] Comparison surfaces real diffs between two loaded requests
- [ ] Debugger shows structured diagnosis for the sample 500 failure with Retry/Open/Copy actions

---

## Sprint 12 — Developer UX & Utilities

**Goal:** The 10% that makes it feel like a serious daily tool.

### Tasks
- [ ] **History**: method/URL/status/duration/timestamp, filters (method, status, environment, collection, date), search, Open / Replay / Duplicate / Delete / Clear all
- [ ] **Code Generation** modal: cURL / JavaScript / Python / Java / Go (from the current request)
- [ ] **Import** dialog: OpenAPI, Postman collection, Insomnia, HAR, cURL
- [ ] **Export** dialog: OpenAPI, Collection, Environment, Documentation
- [ ] **Copy as cURL** parity with context menu (Sprint 7)
- [ ] Notification center (collection run complete, mock started, OpenAPI imported, request failed, env switched)
- [ ] Keyboard shortcuts screen (Cmd+K palette, Cmd+Enter send, Cmd+S save, Cmd+P quick open, Cmd+Shift+R run collection, Cmd+Shift+E environment, Cmd+W close tab)
- [ ] Settings screens: General, Appearance, Editor (font/size/tab size/word wrap/minimap/autocomplete), Network, Proxy, Certificates, Environments, Security, Shortcuts, Data, Import/Export, About

### Acceptance criteria
- [ ] History is populated by executed requests and supports all filters/search
- [ ] Code generation produces valid code in all 5 languages
- [ ] Import of a Postman-format JSON creates a collection; HAR import fills some history
- [ ] Every settings section renders and persists changes (appearance/editor prefs)

---

## Sprint 13 — Production Hardening & Ship

**Goal:** Safe, fast, packaged, releasable.

### Tasks
- [ ] Security audit: secrets never logged; `isolated-vm` sandbox verified (require/process/network blocked); CSP set; IPC input validation on main
- [ ] Origin/trust audit for any `file://`-or-blob handling (mirror the hardened relay logic from the prototype bundle)
- [ ] Performance: load test with 100k-node JSON response; large collection (500 requests) tree render; startup time
- [ ] Profiling fixes (renderer virtualisation for huge trees/tables/lists)
- [ ] Crash/error reporting: Sentry wired to main + renderer, source maps uploaded
- [ ] **Auto-update** via `electron-updater` (macOS universal DMG `arm64`+`x64`, Windows NSIS, Linux AppImage)
- [ ] Accessibility pass: contrast, focus, ARIA on all interactive paths
- [ ] **Responsiveness sweep (full-app)**: sidebar collapse + request/response stacking at 1280×800; panels reflow at 1600×1000 and 1920×1080; nothing overlaps or overflows at any supported width
- [ ] Micro-interaction audit: no dead-feeling buttons, consistent focus/hover/active states, request-send and response-loading animations present on every execution path
- [ ] Onboarding/home empty-state sanity; no lorem ipsum anywhere
- [ ] Final QA checklist (below) — full sweep

### Acceptance criteria
- [ ] Tests (unit + Playwright electron E2E) green in CI
- [ ] `npm run release` produces signed, universal macOS build + Windows + Linux
- [ ] Update channel verified end-to-end (publish new version → app updates)
- [ ] All of Section "Final QA Checklist" passes

---

## Final QA Checklist (Gate before v1.0 launch)

- [ ] Every sidebar item opens a real screen
- [ ] Every major button has an interaction
- [ ] Request tabs open/close/switch and preserve state
- [ ] Collections expand/collapse + drag-drop
- [ ] Environment selector works globally (top bar)
- [ ] Request execution simulated end-to-end with loading state
- [ ] Response alternates between success (200) and error (500) examples
- [ ] Collection runner shows live progress + pass/fail
- [ ] Test assertions display pass/fail results
- [ ] Command palette opens via Cmd/Ctrl + K and executes commands
- [ ] Import/export dialogs open and work
- [ ] Mock server state changes and serves on a real port
- [ ] WebSocket screen has connected/disconnected states
- [ ] Performance screen has realistic charts
- [ ] OpenAPI explorer works (import → explore → generate)
- [ ] Settings work visually and persist
- [ ] Dark/Light/System theme works
- [ ] No lorem ipsum, no obvious placeholder screens
- [ ] No dead buttons across the app shell

---

## Out of Scope (v1 — committed)

- Real external-network calls to arbitrary servers (all networking is mocked/simulated
  for the prototype; engine code paths ready but not exercised in production builds)
- Backend/cloud sync, real multi-user team workspaces (concept only)
- Tauri shell, Rust sidecar (deferred; shell-agnostic engine keeps this open)
- Mobile UI

## Notes (how to use this file)

- One sprint at a time. Check boxes as you complete them.
- Do not start Sprint N+1 until Sprint N acceptance criteria are all ticked.
- Update the "Delivered" log below after each sprint with short notes.

## Delivered log

| Sprint | Status | Notes |
|---|---|---|
| Sprint 0 — Foundations | ✅ Built | Monorepo, Electron+react shell, engine/ui/config packages, typecheck+build green, app boots |
| Sprint 1 — Application Shell & Navigation | ✅ Built | Onboarding, workspace switcher (CRUD), Cmd+K command palette, resizable sidebar, keyboard-shortcut foundation, live tab/home actions |
| Sprint 2 — Design System & Shared UI Primitives | ✅ Built | Dark/Light/System themes + Barlow/JetBrains Mono type; DataTable, Empty/Error/Loading states, ConfirmDialog, Toasts + NotificationCenter, ContextMenu, Modal/Drawer, Tooltips, full palette sections; real Requests & History screens; micro-interaction animations |
| Sprint 1 — App Shell | Not started | |
| Sprint 2 — Design System | Not started | |
| Sprint 3 — Engine Core | Not started | |
| Sprint 4 — Home Dashboard | Not started | |
| Sprint 5 — Request Builder | Not started | |
| Sprint 6 — Network Engine | Not started | |
| Sprint 7 — Collections | Not started | |
| Sprint 8 — Tests/OpenAPI/Docs | Not started | |
| Sprint 9 — Real-time Protocols | Not started | |
| Sprint 10 — Mock Servers | Not started | |
| Sprint 11 — Performance | Not started | |
| Sprint 12 — Dev UX | Not started | |
| Sprint 13 — Hardening | Not started | |
| Final QA gate | Not started | |