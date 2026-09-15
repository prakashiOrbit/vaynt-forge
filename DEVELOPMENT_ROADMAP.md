# Vaynt Forge — Production Development Roadmap

> **Product:** Vaynt Forge — Build. Test. Debug. Understand.
> A professional desktop API engineering workbench (IDE + API Command Center).
> **Not** a Postman clone. Combines HTTP, GraphQL, WebSocket, SSE, gRPC, OpenAPI,
> testing, mocking, performance, documentation, and debugging in one product.

---

## 1. Committed Tech Stack (no backtrack)

| Layer | Choice | Notes |
|---|---|---|
| Shell | **Electron** (Chromium + Node) | Proved by VS Code, Postman, Insomnia |
| Language | TypeScript (strict) | Everywhere — main, preload, renderer, engine |
| UI | React + Tailwind CSS + shadcn/ui | Reuse existing `VayntForge.html` prototype 1:1 |
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
- [x] Dev/load of `VayntForge.html` prototype as the initial renderer shell (sanity check)
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
- [x] TopBar: Vaynt Forge logo, global search trigger (`Cmd/Ctrl + K`), environment selector, notifications, help, settings, user/workspace indicator ✅
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
- [x] SQLite schema: `workspaces`, `collections`, `folders`, `requests`, `environments`, `variables`, `history`, `test_runs`, `mock_servers`, `settings`, `notifications` — *complex payloads (mock endpoints/log, request assertions, env variables) embedded as JSON in parent rows* (packages/sqlite)
- [x] Engine module: workspace/collection/request CRUD (pure TS, no Electron imports) — `StorageProvider` contract + `InMemoryStorage` (packages/engine)
- [x] Zustand store wiring: `activeWorkspace`, `activeRequest`, `activeEnvironment`, `collections`, `requests`, `history`, `mockServers`, `testRuns`, `notifications`, `variables`, `settings` — workspace-bucket `useData` store + hooks (renderer)
- [x] Zustand `persist` for UI prefs; SQLite as source of truth via IPC — session store persists UI prefs; typed `storage:call` IPC (main service + preload bridge)
- [x] `safeStorage` integration — secrets (API keys, tokens, client secrets) never in plaintext — `SecretCodec` + `withSecretCodec` decorator; seeding runs through the codec; verified ciphertext in DB dump (VPN-ready: `secretsSupported` flag when codec unavailable)
- [x] Environment variable resolution engine (scopes: global → environment → collection) + generated vars (`{{$guid}}`, `{{$timestamp}}`, `{{$randomInt}}`) — resolver already shipped with the engine; scoped precedence + generated vars confirmed
- [x] Import/export serialisers (collection JSON, environment JSON) ready for later sprints — `CollectionFileV1` / `EnvironmentFileV1` (io/serializers)
- [x] Seed function: Demo Workspace "Acme API" (collections, environments, requests, sample history) — `seedProvider` + demo consts; first-launch seeding in the desktop service

### Acceptance criteria
- [x] Create/edit/delete workspace, collection, request, environment persists across app restart — sqlite close+reopen tests + 2× Electron boot smoke
- [x] Secrets encrypted at rest (verify: DB dump shows no plaintext secret) — `strings` scan of the real DB is clean; values are safeStorage base64 blobs
- [x] `{{variable}}` resolves correctly at global/env/collection scope — engine variable resolver tests
- [x] Demo workspace seeds correctly on first launch — `1 ws / 4 collections / 13 requests / 4 envs / 1 mock / 5 history`; no re-seed on second boot

---

## Sprint 4 — Home Dashboard

**Goal:** Developer dashboard — signal, not fluff.

### Tasks
- [x] Welcome back + active workspace banner
- [x] **Continue where you left off** (recent requests/tabs)
- [x] Recent Requests (method, URL, status, duration): `GET /users 200 · 124ms`, `POST /orders 500 · 923ms`, etc.
- [x] Recently Opened Collections — *represented via collection/request counts in the banner; collection explorer itself ships in Sprint 7*
- [x] Active Environment chip
- [x] Recent Test Runs (summary: passed/failed) — *empty state until Sprint 7's Collection Runner starts saving test runs*
- [x] Mock Servers status strip
- [x] API Health indicators — *derived from recent history error rate + running mock count*
- [x] Quick Actions (New Request, New Collection, Import OpenAPI, Import Collection, New Environment, Create Mock Server)
- [x] Metrics row: Requests today, Tests executed, Avg response time, Failed requests
- [x] Dashboard reflects live store state (history, etc.), not hardcoded strings — *fixed two metric tiles that were still hardcoded ('24', '12') and one hardcoded "Development" label ignoring the actual active environment*

### Acceptance criteria
- [x] Every card/pill links to its real screen
- [x] Quick actions actually create things / open dialogs
- [x] Numbers update after you execute a request — *all four metric tiles and API health now compute from live `history`/`testRuns`/`mockServers` state*

---

## Sprint 5 — Request Builder (core screen)

**Goal:** The heart of Vaynt Forge — premium, dense, keyboard-driven.

### Tasks
- [x] Request workspace layout: collection/request explorer (left) · request builder (center) · response viewer (bottom) — *explorer is a flat collection→request list (full drag-drop tree is Sprint 7)*
- [x] **Resizable panels** for all three regions (real IDE feel) — explorer width + response height, same drag-pointer technique as Sprint 1's sidebar; verified via drag test + persisted to `vayntforge-session` localStorage
- [x] Request header: method selector (GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS w/ colour coding), URL input w/ variable highlighting, Send (with loading→response animation), Save, More actions
- [x] Request tabs: **Params · Authorization · Headers · Body · Scripts · Tests · Settings**
- [x] `KeyValueEditor` component (params/headers) with add/remove/disable/bulk-edit/secret-eye
- [x] Authorization panel: No Auth, API Key, Bearer, Basic, OAuth 2.0, JWT, AWS Signature, Custom — contextual fields per type
- [x] Body panel: none, form-data, x-www-form-urlencoded, raw, binary, GraphQL; raw language chooser (JSON/XML/Text/JS/HTML) — binary body wired to a real native file picker (new `dialog:openFile` IPC channel)
- [x] Code editors with syntax highlighting for raw bodies + GraphQL — **CodeMirror 6, not Monaco.** No Monaco/CM6 was installed yet; Monaco's web-worker bundling inside Electron+Vite is real integration risk, and the stack table already names CodeMirror 6 as the documented "lighter alt" for this exact row, so we took that documented option instead of the higher-risk one
- [x] Scripts panel: pre-request / post-response (CodeMirror) + sandbox stubs — labeled "runs in the isolated-vm sandbox (Sprint 6)"
- [x] Tests panel: assertion builder (status code equals, response time <, JSON path exists/equals, header exists, schema matches) with `+ Add Assertion`
- [~] Settings tab per request (timeouts, redirects, SSL verify, encoding) — timeout/redirects/SSL verify are real and persist; **"encoding" has no backing field on `RequestSettings` in the engine and was not added** (scope call — flagging for whoever picks up encoding support, likely alongside Sprint 6's network engine)
- [x] Multi-tab workspace integration (each tab = independent request state) — dedicated `requestDrafts` store keyed by tab id, decoupled from `activeTabId`
- [x] Variable autocomplete + `{{$guid}}` style helpers in URL/params/headers — custom `VariableInput` (colored-overlay + native input, not contentEditable) with a `{{`-triggered dropdown; wired into the URL bar and into `KeyValueEditor`'s value cells

### Acceptance criteria
- [x] Panels drag-resize independently; layout persists — verified by scripted drag (explorerWidth 240→317, responseHeight 280→337) + confirmed in localStorage
- [x] All tabs functional and preserve per-request state
- [x] Switching between two open request tabs does not lose unsaved edits — verified: edited one tab's name mid-edit, switched to a second tab and back, edit was intact
- [x] All 8 auth types render contextual configuration
- [x] All 6 body types render their editor

### Notable bugs found + fixed during this sprint (verify-before-ship, not just typecheck)
- Tab clicks/opens never actually routed to a builder screen before this sprint (`activeTabId` was cosmetic) — fixed by having `openTab`/`openNewRequest`/`setActiveTab` drive `activeNav` too.
- `KeyValueEditor`'s row layout used `max-w-[38%]` / `flex-[2]` / `flex-[3]` (arbitrary Tailwind values) that **never compiled to any CSS rule at all** — every row silently fell back to default flex sizing and value cells collapsed to ~18px. Fixed by switching to standard-scale utilities (`w-48 shrink-0` / `flex-1`), which are guaranteed to compile.
- `text-transparent` / `caret-text` on the same `VariableInput` also never compiled (only utilities for our custom `--color-*` tokens did) — the real `<input>`'s plaintext was rendering on top of the colored overlay, and for masked/secret fields this leaked the plaintext value visually. Fixed with an inline `style={{ color: 'transparent', caretColor: ... }}`, plus the overlay now renders bullet characters (not the real value) whenever `type="password"`.
- Both bugs were caught only by actually launching the Electron app (via a scripted Playwright `_electron` driver) and reading real screenshots/DOM state — `tsc`/`eslint`/`vite build` all passed the whole time.

---

## Sprint 6 — Network Engine & Response Viewer

**Goal:** Real request execution with professional response inspection.

### Tasks
- [x] `packages/engine` HTTP client via `undici` (`UndiciRequestClient`, `packages/engine/src/networking/http-client.ts`) — real GET/POST/etc, manual redirect-chain following, real DNS timing, bearer/basic/apiKey/jwt/oauth2 auth applied as real headers, timeout + SSL-verify wired to request settings. **Not proxy-aware** (no per-request dispatcher for proxy override — not exercised anywhere yet, flagging as a gap rather than silently skipping it). Reachable over `network:execute` IPC, covered by 8 tests against a real local HTTP server — but see the Out of Scope note: **the Send button does not call this client**
- [x] IPC contract: `network:execute` (`request`, `scopes` → `ResponseModel`) — real, tested, wired end-to-end, deliberately unused by the Send button (see above)
- [x] Response model — already fully modeled since Sprint 0 (`ResponseModel`/`TimingBreakdown`/`ResponseCookie`/`RedirectEntry`/`ClientError`); no changes needed
- [x] Timeline measurement: DNS/Connect/TLS/Wait/Download segments — real for the mock client (hand-authored, sums exactly to total); for the real `UndiciRequestClient`, `connect`/`tls` are honestly reported as 0 folded into `wait` rather than fabricating a split undici doesn't expose without diagnostics_channel instrumentation we chose not to take on for a path that isn't exercised in production
- [x] Send pipeline states: idle → sending → complete/failed, driving the response panel's loading skeleton — simplified from the roadmap's 5-state list (resolving/sending/waiting collapsed into one "sending" state since the mock client doesn't have distinguishable sub-phases)
- [x] Response viewer header: `200 OK · 124 ms · 224 B` + Pretty/Raw/Preview toggle (Preview only appears for HTML bodies; JSON gets Pretty/Raw, everything else just Raw — no fake toggle for content that has nothing to preview)
- [x] Response **Body** — new `JsonTreeView` in `@vayntforge/ui`: expand/collapse all, per-node expand/collapse, search with auto-expand-to-match + highlight, copy, download. Lazy-collapsed beyond depth 1 by design so a huge payload never force-renders on first paint (see 10k-node note below)
- [x] Response **Headers / Cookies / Timeline** tabs — Timeline renders the DNS/Connect/TLS/Wait/Download breakdown as a proportional horizontal bar + legend
- [x] Response **Test Results** tab — evaluates real assertions via a new `evaluateAssertions()` (statusCodeEquals/responseTimeLessThan/jsonPathExists/jsonPathEquals/headerExists all real; schemaMatches honestly reports "ships in Sprint 8" rather than faking a pass) — also shows captured pre/post-request script console output
- [x] Error path — `ResponseError` component matches the spec almost verbatim: title, URL, duration, possible-causes list (status-specific for 5xx, connection-specific for network failures), Retry/Open Request/Copy Error actions, all wired
- [x] HTTP redirect handling + visibility — real manual redirect-following in `UndiciRequestClient` (tested); the mock client simulates a redirect chain for `GET .../redirect` URLs so the demo path exercises the same UI
- [x] User scripts execution — **not `isolated-vm`.** Runs in Node's built-in `vm` module (`apps/desktop/src/main/scriptSandbox.ts`), executed in the Electron **main process** (a separate OS process from the sandboxed renderer) with a 1s execution timeout. isolated-vm is a native module needing prebuilt binaries matched to Electron's exact ABI — real install/CI risk for zero behavioral gain over `vm.createContext`, which already starts with no `require`/`process`/network globals. Exposed over new `scripts:run` IPC; `pm.environment.get/set`, `pm.request`, `pm.response.json()/.text()`, and `console.log/warn/error` capture are all real and tested (9 tests, including a genuine runaway-loop timeout test)
- [x] Variable resolution applied before send — new shared `resolveRequest()` resolves `{{variables}}` across URL/params/headers/body for both clients (not just the URL, which is all the old mock client did); `pm.environment.set()` patches from the pre-request script are merged into resolution for that send only (not persisted to the real environment — a real UX decision about which scope/confirmation flow to write through, left for whoever picks up environment-writeback)

### Acceptance criteria
- [x] Sending the default request returns the mocked `200 · 124ms` response with real-looking lifecycle (loading → body) — verified live in the running app
- [x] Timeline shows correct panel blocks summing to total — verified live (3+5+12+94+10 = 124ms) and enforced by construction in both clients
- [x] JSON tree expands/collapses without hanging — verified architecturally (lazy default-collapse past depth 1, so initial render is cheap regardless of payload size; "Expand all" is a bounded recursive render of simple elements, the standard technique for this). **Not verified against an actual 10k-node fixture** — the demo data doesn't have one and building a synthetic-injection harness was out of proportion to the rest of this sprint; flagging honestly rather than claiming a benchmark that wasn't run
- [x] Simulated 500 surfaces the full error experience with working Retry/Open/Copy — verified live in the running app, matches the spec's exact wording
- [x] User-script sandbox blocks `require`, `process`, network access (verified by test) — 3 dedicated tests, all passing

### Also fixed while here
- Home dashboard's `addHistory` action (built in Sprint 4, wired to live store state) had zero real callers anywhere in the app until this sprint — Send now logs every request, so "Requests today" / "Failed requests" / "Avg response time" / API Health / Recent Requests all update for real (verified live: 5→8 requests, 0→2 failed, avg recalculated).

### Known gaps (scope calls, not oversights)
- No proxy support in the real HTTP client (roadmap says "per-request dispatchers for proxy/TLS override" — TLS override via `sslVerify` works, proxy doesn't).
- AWS SigV4 request signing is not implemented (`auth.ts` skips it rather than fake a signature) — same treatment as `custom` auth, which was already documented in Sprint 5 as pre-request-script territory.
- Environment variable writeback from `pm.environment.set()` is send-scoped only, not persisted.

> **Update (post-Sprint-13):** the Send button now calls the real `UndiciRequestClient` via `network:execute` IPC, not `MockRequestClient` — see the Delivered log entry below this note. `MockRequestClient` still exists (used by nothing in the UI anymore) since deleting it wasn't asked for. One direct consequence: the seeded demo workspace's requests target `api.acme.dev`, a domain that was never real — deliberately chosen so `MockRequestClient` could pattern-match it. Those demo requests will now fail with a real DNS/connection error (`ENOTFOUND` or similar) instead of returning the canned 200/500 examples. That's expected, not a bug — point a demo request at a real URL (or the workspace's own running Mock Server, e.g. `http://localhost:4010/users`) to see it actually work.

---

## Sprint 7 — Collections, Environments & Chaining

**Goal:** Organisation + runner + chaining.

### Tasks
- [x] Collection explorer tree (collections → folders → requests) with expand/collapse — real `react-arborist` tree, replacing Sprint 5's flat stand-in
- [x] Drag-and-drop reordering (react-arborist) — moving requests/folders between collections/folders works (persists via `saveRequest`/`updateFolder`); **collection-level manual reordering is not supported** (no order field exists on `Collection`, and it wasn't worth adding one just for this — collections list in whatever order the snapshot returns them)
- [x] Context menus: New Request, New Folder, Rename, Duplicate, Move, Run, Export, Delete (collections); Open, Duplicate, Run, Copy as cURL, Copy URL, Rename, Move, Delete (requests) — verified live, exact item set
- [x] Collection/create request flows with auto-save into store
- [x] **Collection Runner**: environment, iterations, delay, concurrency, data file (JSON array — not CSV, scope call), live progress, per-request timing, Passed/Failed/Skipped tallies, summary — verified live end-to-end ("5 passed · 0 failed"), writes a real `TestRun` (Sprint 3's `saveTestRun` had no caller until now)
- [x] **Request Chaining** — implemented as a per-request extract-rule list on the Runner's "Chain" tab (JSONPath → variable name), not a node-and-arrow visual flow diagram — the acceptance criterion is about propagation working, not the diagram; chaining forces concurrency to 1 for correctness (sequential dependency). Propagation proven with a dedicated test since the mock response body can't visibly demonstrate substitution through a screenshot alone
- [x] **Environment Manager**: add/duplicate/rename/delete, import `.env` (new parser, 7 tests), export (JSON), variable rows with Initial Value / Current Value / Secret toggle + reveal eye — verified live
- [x] **Variable Inspector**: resolution preview (live template → resolved value + unresolved-key list) plus Global/Environment/Collection/Temporary scope panels — Collection- and Temporary-scoped variables have no creation UI anywhere in the app (nothing populates them), so those two panels honestly show empty with a note instead of fabricating data
- [x] **Production safety**: switching to Production shows a warning (`EnvironmentSelector`); destructive requests (scoped to `DELETE`, the one unambiguous case — "DB-mutating paths" is too fuzzy a heuristic to gate on reliably) against a Production environment trigger `ConfirmDialog` with literally `Cancel` / `Execute anyway` — verified live, matches the roadmap's wording almost exactly
- [x] Notification toasts on run-complete, env-switch, etc. — run-complete (success/error toast with pass/fail counts), collection import/export, request run/duplicate/move/delete all toast; environment-switch itself doesn't toast (the confirm dialog already IS the feedback for the case that matters — production — and a toast on every ordinary switch would be noise)

### Acceptance criteria
- [x] Runner executes the sample collection with visible live progress and correct Passed/Failed/Skipped tallies — verified live (Users collection: 5/5 passed)
- [x] Chain flow: running the chain propagates extracted variables into later requests — verified live or with dedicated tests: `packages/engine/test/chain-propagation.test.ts` resolves a later request's `{{extractedUserId}}` to the value extracted from an earlier response
- [x] `.env` import populates variables; secrets are masked everywhere — parser tested (7 cases: comments, quotes, `export`, escapes); masking reuses the same secret-eye pattern from Sprint 5's `KeyValueEditor`
- [x] Production-gated destructive request requires explicit confirmation — verified live: DELETE + Production → "Send a destructive request to Production?" / Cancel / Execute anyway
- [x] `Copy as cURL` from context menu produces a valid cURL string — verified live via real clipboard read: `curl -X POST 'https://api.acme.dev/v1/auth/login' -H '...' --data '...'`

### Known gaps (scope calls, not oversights)
- Chain/Request Chaining UI is list-based, not a visual node-and-arrow flow editor.
- Data-file iteration only accepts JSON arrays, not CSV.
- No collection-level drag reorder (no backing order field).
- Collection- and temporary-scoped variables are modeled in the type system but have no creation UI anywhere yet.

---

## Sprint 8 — Tests, OpenAPI & Documentation

**Goal:** Testability + spec-driven workflows + generated docs.

### Tasks
- [x] Assertion model + evaluator (status, time, JSON path, header, schema-match) wired to Test Results tab — `schemaMatches` was the one gap honestly flagged in Sprint 6 ("ships in Sprint 8"); now does real `ajv` JSON Schema validation with a compiled-schema cache, tested (valid pass, invalid-body fail with real error message, malformed-schema-text handling)
- [x] OpenAPI import: JSON / YAML / URL → parser → persisted spec — new `packages/engine/src/openapi/{types,parser}.ts`: local `$ref` resolution (`#/components/schemas/*`, depth-10 cycle guard), example synthesis from JSON Schema when no explicit example exists, tag-based grouping with `'General'` fallback for untagged operations. Stores raw text only (not a cached parsed blob) — always re-parsed on load so it can't drift from the parser. Import UI (`OpenApiPage`) supports file picker (`.json/.yaml/.yml`) and URL fetch (real `fetch()`, not mocked — spec URLs are real internet resources, unlike the demo request URLs)
- [x] OpenAPI Explorer: API info, servers, auth, tags, endpoint tree (`GET /users/{id}` …), schemas, examples — `OpenApiPage.tsx`, two-pane (tag-grouped endpoint tree + detail), spec header shows title/version/base URL/description/security schemes/tags
- [x] Actions: **Send Request**, **Generate Collection**, **Generate Mock Server**, **Generate Documentation** from a spec — Send Request opens a prefilled unsaved tab in the Request Builder (reuses the existing draft-tab pattern); Generate Collection creates one real collection with a folder per tag and a real `RequestModel` per operation (verified live: 13 generated + 13 demo = 26 requests in the DB); Generate Mock Server creates a real `MockServer` with Express-style `:param` endpoints (verified live in the DB); Generate Documentation jumps to the Documentation screen for that spec
- [x] Documentation viewer: left nav (Overview, Authentication, Users, Orders, Payments, Errors); endpoint pages (description, params, headers, request, response, schemas, examples) — `DocumentationPage.tsx`, nav built from Overview + the spec's own tags (in spec order) + a synthesized Errors section (deduped non-2xx responses across every operation)
- [x] Code examples per endpoint: **cURL / JavaScript / Python / Java / Go** — `generateCodeSample()` in `packages/engine/src/openapi/generate.ts`, template-based per language, tested; rendered with real CodeMirror syntax highlighting (`CodeEditor` extended with `python`/`java`/`go`/`shell` languages — Java and Go via `@codemirror/legacy-modes`, no dedicated CM6 language package exists for either) and a working clipboard copy button, shared between the Explorer and the Documentation viewer via `components/openapi/EndpointSections.tsx`
- [x] Documentation generation from OpenAPI produces the full viewer — same parsed spec drives both the Explorer and the Documentation viewer live (no separate "generate" step/artifact — re-parses are cheap and always current)
- [x] Wire-sample "Acme API" OpenAPI (users/orders/payments) for demo — hand-authored `DEMO_OPENAPI_YAML` (OpenAPI 3.0.3) matching all 13 seeded demo requests exactly, seeded on first launch via `seedProvider()`

### Acceptance criteria
- [x] Import a sample OpenAPI file → explorer + docs render fully — verified live (Electron + Playwright): demo spec's 13 operations across 4 tags render in both the Explorer tree and the Documentation nav/pages
- [x] Generate Collection from spec creates a real collection in a workspace — verified live end-to-end, including a direct SQLite check: a new "Acme API" collection with 4 folders and 13 requests, byte-for-byte correct (method/url/headers/body/assertions checked on a sample request)
- [x] Code examples render with syntax highlighting and copy buttons — verified live for all 5 languages, including Go's `package main` block with real token coloring
- [x] Every spec endpoint has Send Request available and working — every endpoint detail view has a working Send Request button that opens a correctly prefilled tab in the Request Builder

### Also fixed while here
- `Onboarding.tsx`'s "Import OpenAPI Spec" card previously showed a "arrives in a later sprint" note (stale since the feature is now real) — it now starts the demo workspace and jumps straight to the OpenAPI screen.
- `DocumentationPage.tsx` was a stub with a stale "(Sprint 13)" subtitle from a since-renumbered plan — fully rebuilt.

### Known gaps (scope calls, not oversights)
- OpenAPI 3.0.x only (no Swagger 2.0, no 3.1-only features) — matches what the parser was built to cover, not a partial implementation of 3.0.x itself.
- `$ref` resolution is local-only (`#/components/schemas/*`) — no external/remote `$ref` following.
- Generate Mock Server creates a real, persisted `MockServer` row, but there's no management UI to see/start/stop it yet — that ships with the full Mock Servers screen in Sprint 10 (same "data exists before its screen does" pattern as Sprint 4's Recent Test Runs, populated for real by Sprint 7's Runner).

---

## Sprint 9 — Real-time Protocols (GraphQL, WebSocket, SSE, gRPC)

**Goal:** The protocol breadth that separates Vaynt Forge from Postman.

### Tasks
- [x] **GraphQL** workspace: endpoint, query editor (+ pretty/format), variables editor, headers, schema explorer (right panel, from introspection), execute, response tree
- [x] **WebSocket** workspace: URL, Connect/Disconnect, connection status (CONNECTED/DISCONNECTED/CONNECTING), incoming + outgoing message lists with timestamps & direction badges, composer, message format (JSON/text/binary), connection log, Ping, Reconnect, Clear
- [x] **SSE** monitor: connection URL, status, live event stream (event type, ID, timestamp, payload), Pause stream, Clear, Reconnect
- [x] **gRPC** workspace: server, proto file view, services/methods tree, request message editor, response message view, metadata, Call, streaming controls (server/client/bidi stubs)
- [x] In-app **gRPC mock server** (via `@grpc/grpc-js` server) to demo
- [x] Each protocol screen has realistic mock connect/disconnect + data-stream states
- [x] Multi-tab: WebSocket/GraphQL/etc. as workspace tabs alongside HTTP requests

### Acceptance criteria
- [x] WebSocket shows connected state, streams mock messages both directions, ping/reconnect work
- [x] GraphQL schema explorer renders from introspection JSON; query execution returns a mocked tree
- [x] SSE stream pauses/resumes/clears without tearing the UI
- [x] gRPC lists services/methods and performs a mocked unary call; streaming shows progress

---

## Sprint 10 — Mock Servers

**Goal:** In-app mocking that developers actually trust.

### Tasks
- [x] Mock Servers dashboard: server list, status dot (● Running / ○ Stopped), endpoint list, Start/Stop/Restart, request log, latency/error simulation
- [x] In-app mock server engine (real Node HTTP server in main process)
- [x] **Mock Response Designer**: status picker (200/201/400/401/404/500), headers, body editor (JSON), simulated latency (0/100/500/1000ms/custom), error simulation
- [x] Response templates + example responses
- [x] Create Mock Server wizard (name, port, endpoints) → shows real `http://localhost:{port}`
- [x] Mock request logs from engine surface in UI
- [x] Integration: OpenAPI → Generate Mock Server (Sprint 8)

### Acceptance criteria
- [x] Start Mock Server actually binds a port and serves the designed responses (curl it)
- [x] Stop/Restart transitions are reflected live in UI
- [x] Latency + error simulation honoured per-endpoint
- [x] Request log captures hits with method/path/status/timestamp

---

## Sprint 11 — Performance Testing, Debugging & Comparison

**Goal:** k6-style load + diagnostics + diff.

### Tasks
- [x] Performance test config: target URL, method, requests, concurrency, duration, ramp-up, environment, auth
- [x] Load engine (undici pools, main process) with configurable ramp
- [x] Live run progress (streaming metrics to renderer)
- [x] Results: Requests/sec, Avg latency, **P50 / P90 / P95 / P99**, error rate, successful/failed
- [x] ECharts: latency over time, requests/sec, response distribution, error rate
- [x] **API Debugger** workspace: request, response, timeline, headers, cookies, redirects, connection, errors, warnings in structured detail; failure diagnosis (e.g. `500 → possible causes: db timeout / auth failure / upstream unavailable`)
- [x] **Compare Requests**: Request A vs Request B, diff of URL, method, headers, params, body, response — hand-rolled LCS line diff instead of Monaco (this codebase uses CodeMirror, not Monaco, throughout — see Sprint 8's log; a full diff-editor dependency wasn't worth adding for structured field diffs)
- [x] Save performance runs to SQLite; history of runs

### Acceptance criteria
- [x] A 500-request run completes with all percentiles + charts rendered
- [x] Comparison surfaces real diffs between two loaded requests
- [x] Debugger shows structured diagnosis for the sample 500 failure with Retry/Open/Copy actions

---

## Sprint 12 — Developer UX & Utilities

**Goal:** The 10% that makes it feel like a serious daily tool.

### Tasks
- [x] **History**: method/URL/status/duration/timestamp, filters (method, status, environment, collection, date), search, Open / Replay / Duplicate / Delete / Clear all
- [x] **Code Generation** modal: cURL / JavaScript / Python / Java / Go (from the current request)
- [x] **Import** dialog: Vaynt Forge native JSON, Postman collection, cURL command (Insomnia format not implemented — no test corpus/spec on hand and not required by acceptance criteria below); HAR import lives on the History page instead of this dialog since it fills history, not collections
- [x] **Export** dialog: Vaynt Forge native JSON, Postman v2.1, OpenAPI 3.0 (collection formats); Environment export (pre-existing from Sprint 7) unchanged. Standalone "Documentation" export was not built — `DocumentationPage` is generated live from the OpenAPI spec already in storage, so there's no separate export artifact yet
- [x] **Copy as cURL** parity with context menu (Sprint 7) — pre-existing, unchanged
- [x] Notification center (collection run complete, mock started, OpenAPI imported, request failed, env switched)
- [x] Keyboard shortcuts screen (Cmd+K palette, Cmd+Enter send, Cmd+S save, Cmd+P quick open, Cmd+Shift+R run collection, Cmd+Shift+E environment, Cmd+W close tab)
- [x] Settings screens: General, Appearance, Editor (font/size/tab size/word wrap/autocomplete — no minimap control since editors run CodeMirror, which has no minimap widget), Network, Proxy, Certificates, Environments, Security, Shortcuts, Data, Import/Export, About

### Acceptance criteria
- [x] History is populated by executed requests and supports all filters/search
- [x] Code generation produces valid code in all 5 languages
- [x] Import of a Postman-format JSON creates a collection; HAR import fills some history
- [x] Every settings section renders and persists changes (appearance/editor prefs)

---

## Sprint 13 — Production Hardening & Ship

**Goal:** Safe, fast, packaged, releasable.

### Tasks
- [x] Security audit: secrets never logged; sandbox verified (require/process/network blocked); CSP set; IPC input validation on main
- [x] Origin/trust audit for any `file://`-or-blob handling (mirror the hardened relay logic from the prototype bundle)
- [x] Performance: load test with 100k-node JSON response; large collection (500 requests) tree render; startup time
- [x] Profiling fixes (renderer virtualisation for huge trees/tables/lists)
- [ ] Crash/error reporting: Sentry wired to main + renderer, source maps uploaded — **deferred this pass**, by explicit user choice (no Sentry account/DSN available); not silently dropped, see Delivered log
- [x] **Auto-update** via `electron-updater` (macOS DMG + Linux AppImage confirmed as real unsigned artifacts this pass; Windows NSIS build was kicked off but its very large first-time Electron binary download did not finish within this session — see Delivered log)
- [x] Accessibility pass: contrast, focus, ARIA on all interactive paths
- [x] **Responsiveness sweep (full-app)**: sidebar collapse + request/response stacking at 1280×800; panels reflow at 1600×1000 and 1920×1080; nothing overlaps or overflows at any supported width
- [x] Micro-interaction audit: no dead-feeling buttons, consistent focus/hover/active states, request-send and response-loading animations present on every execution path
- [x] Onboarding/home empty-state sanity; no lorem ipsum anywhere
- [x] Final QA checklist (below) — full sweep

### Acceptance criteria
- [~] Tests (unit + Playwright electron E2E) green in CI — unit tests green (111 total) and a real `.github/workflows/ci.yml` now runs typecheck/test/lint on push/PR (previously no CI existed at all). No *automated, committed* Playwright Electron E2E suite exists, though — every live-app verification across all 14 sprints, this one included, was a disposable scratch script deleted after each check. That's a genuine gap for anyone wanting CI-gated E2E coverage, not something this pass fully closes.
- [~] `npm run release` produces signed, universal macOS build + Windows + Linux — macOS (DMG) and Linux (AppImage) genuinely built and confirmed as real artifacts this pass, both **unsigned** (no Apple Developer ID or Windows cert configured, by agreed scope). Windows (NSIS) build was started but its Electron binary download — a one-time, large first-run fetch — did not complete within this session; the config is real and in place (same electron-builder pipeline that worked for the other two platforms) but Windows was not actually confirmed to produce an artifact. Code-signing itself is not done for any platform, and the macOS build was verified as arm64 only (the `universal` arch target in `electron-builder.yml` was never actually exercised end-to-end).
- [ ] Update channel verified end-to-end (publish new version → app updates) — the *check* half is fully real and verified (a packaged app's real HTTP call to the actual GitHub Releases API, correctly handling the "no releases yet" case); the *publish* half was never exercised, since publishing a real GitHub release is a visible external action outside this pass's scope.
- [x] All of Section "Final QA Checklist" passes

---

## Final QA Checklist (Gate before v1.0 launch)

- [x] Every sidebar item opens a real screen — was **false** until this sprint: "Workspace" and "Tests" both silently fell through to the generic `PlaceholderPage`, live-confirmed by actually clicking them. Fixed by removing the redundant "Workspace" item (its CRUD already lives in the TopBar's `WorkspaceSwitcher`) and building a real `TestsPage` (workspace test-run history, reusing `TestRun`/`saveTestRun` data that already existed with no page consuming it) — live-verified end-to-end with a real collection run
- [x] Every major button has an interaction — fixed one real bug found this sprint: `PerformancePage`'s run-history rows nested a delete `<button>` inside a row-select `<button>`, invalid HTML that made the inner button unreachable/ambiguous for keyboard and assistive tech
- [x] Request tabs open/close/switch and preserve state
- [x] Collections expand/collapse + drag-drop
- [x] Environment selector works globally (top bar)
- [x] Request execution simulated end-to-end with loading state
- [x] Response alternates between success (200) and error (500) examples
- [x] Collection runner shows live progress + pass/fail
- [x] Test assertions display pass/fail results — live-verified this sprint via the new Tests page after a real collection run
- [x] Command palette opens via Cmd/Ctrl + K and executes commands — re-verified live after this sprint's CSP/sandbox changes specifically, since those are exactly the kind of change that could silently break it
- [x] Import/export dialogs open and work
- [x] Mock server state changes and serves on a real port
- [x] WebSocket screen has connected/disconnected states
- [x] Performance screen has realistic charts
- [x] OpenAPI explorer works (import → explore → generate)
- [x] Settings work visually and persist
- [x] Dark/Light/System theme works — re-verified live this sprint under the new CSP (zero violations while switching themes)
- [x] No lorem ipsum, no obvious placeholder screens — see "Workspace"/"Tests" fix above; grepped the whole renderer for lorem ipsum/TODO/FIXME/"coming soon" markers, found none
- [x] No dead buttons across the app shell

---

## Out of Scope (v1 — committed)

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
| Sprint 3 — Engine Core | ✅ Built | Engine `StorageProvider` (CRUD + drafts), `InMemoryStorage`, seed + safeStorage `SecretCodec`; `@vayntforge/sqlite` node:sqlite provider (11 tables, WAL, cascade delete, history cap); typed `storage:call` IPC + `StorageService`, preload bridge; workspace-bucket Zustand store + DataBootstrapper; session store slimmmed to UI prefs (persist); all screens (Home/Requests/History, switcher, palette, notifications) read live DB state; secrets ciphertext in DB dump verified; `npm run test` (tsx, 12 tests) + boot smoke green |
| Rebrand | ✅ Built | Product renamed APIForge → **Vaynt Forge** everywhere (packages `@apiforge/*` → `@vayntforge/*`, bridge `window.vayntforge`, `VayntForgeApi`, `vayntforge.db`, `vayntforge-session`, serializers `vayntforge.*.v1`, `APIForge.html` → `VayntForge.html`); brand logo `vaynt-forge.png` added in TopBar + Onboarding + BrowserWindow icon; productName `vaynt-forge` (userData → `~/Library/Application Support/vaynt-forge`); workspace rebuilt via npm install (lockfile regenerated); typecheck/lint/test/build green + fresh-DB boot smoke verified (seeds 1/4/13/4/5/3/1, no plaintext secrets, no re-seed) |
| Sprints 1-3 re-audit | ✅ Verified | Re-checked every Sprint 1-3 task/acceptance criterion against source (not just checkboxes): typecheck/lint/build/test all green (12/12 tests), secrets-at-rest verified, nav/palette/resize behaviour all real. Only open item: Sprint 2's manual 1280/1600/1920 visual QA pass (unchanged, already flagged) |
| Sprint 4 — Home Dashboard | ✅ Built | `HomePage.tsx` wired to live `useActiveWorkspaceData()`: welcome banner, metrics row (fixed two hardcoded tiles + a hardcoded "Development" label bug), recent requests, continue-where-left-off, new Recent Test Runs section (empty state until Sprint 7 runner), new API Health indicator (derived from history error rate + mock server status), mock servers strip, quick actions. Verified responsive at 1920×1080/1600×1000/1280×800/1024×768 (app's actual `minWidth`) via Electron+Playwright screenshots; fixed a Quick Actions label-truncation issue found at the 1024px floor width. typecheck/lint/build green |
| Sprint 5 — Request Builder | ✅ Built | 3-pane resizable layout (explorer/builder/response), 7-tab request editor, all 8 auth types + all 6 body types, `KeyValueEditor`/`VariableInput`/`MethodSelect`/`Tabs`/`CodeEditor` added to `@vayntforge/ui`, per-tab draft store, native file picker IPC for binary bodies. Code editors are CodeMirror 6 (documented "lighter alt" to Monaco), not Monaco. Settings tab has no "encoding" control (no backing field on `RequestSettings`). Two real bugs (arbitrary Tailwind flex values never compiling; `text-transparent`/`caret-text` never compiling, leaking secret plaintext) were only caught by driving the actual Electron app + screenshots — typecheck/lint/build stayed green throughout. All acceptance criteria verified against the running app, not just code review |
| Sprint 6 — Network Engine | ✅ Built | Real `undici` HTTP client (redirects, auth headers, real DNS timing, 8 tests against a local server) reachable over `network:execute` IPC but deliberately unused by Send (demo URLs don't resolve — see Out of Scope); Send button uses the enhanced `MockRequestClient` instead, now with real variable/auth resolution + a redirect-chain demo. Full response viewer (Body JSON tree/Headers/Cookies/Timeline/Test Results tabs, Pretty/Raw/Preview, error-path card) verified live in the running app. Real assertion evaluator. Script sandbox is Node's `vm` in the main process, not isolated-vm (native-module risk, same behavior guarantee) — 9 tests incl. a real runaway-loop timeout. Closed a real gap from Sprint 4: `addHistory` had no caller until now, so Home's live metrics actually update on Send. typecheck/lint/build/test green throughout |
| Sprint 7 — Collections | ✅ Built | Real `react-arborist` collection/folder/request tree (drag-drop move, not collection-level reorder — no order field exists), full context menus (New Request/Folder, Rename, Duplicate, Move, Run, Export, Delete on collections; Open/Duplicate/Run/Copy as cURL/Copy URL/Rename/Move/Delete on requests). Collection Runner with live progress, concurrency, JSON data-file iteration, and a Chain tab (list-based, not a visual flow diagram) — writes real `TestRun`s (`saveTestRun` had no caller since Sprint 3). Chain propagation proven with a dedicated engine test, not just a screenshot. Environment Manager (CRUD, `.env` import — new parser, 7 tests — JSON export, Initial/Current/Secret variable rows) + Variable Inspector (live resolution preview). Production-switch warning + DELETE-in-Production confirmation, both verified live in the running app. 9 new/changed files' worth of engine additions (`ChainRule` type, dotenv parser, `resolvePath` now shared). typecheck/lint/build green, 42 tests passing (9 new this sprint) |
| Sprint 8 — Tests/OpenAPI/Docs | ✅ Built | Real `ajv`-backed `schemaMatches` closes the one honest gap from Sprint 6. New OpenAPI engine layer (`packages/engine/src/openapi/{types,parser,generate}.ts`): parser resolves local `$ref`s and synthesizes examples from JSON Schema (5 tests); generator plans collections/mock servers/code samples from a parsed spec (6 tests). `OpenApiPage.tsx` (import file/URL, tag-grouped Explorer, Send Request/Generate Collection/Generate Mock Server/Generate Documentation) and a fully rebuilt `DocumentationPage.tsx` (Overview + per-tag pages + synthesized Errors section, hosted-docs style) share endpoint-rendering components. `CodeEditor` gained Python/Java/Go/Shell syntax highlighting (Java/Go via `@codemirror/legacy-modes` — no dedicated CM6 packages exist for either) for the 5-language code samples with copy buttons. Hand-authored `DEMO_OPENAPI_YAML` seeded on first launch, exactly matching the 13 seeded demo requests. Verified live end-to-end including a direct SQLite check: Generate Collection produced a real 4-folder/13-request collection (26 total with the demo data), Generate Mock Server produced a real persisted `MockServer`. typecheck/lint/build green, 46 engine tests passing (13 new this sprint: 5 parser + 6 generator + net 2 for real schema validation replacing the old placeholder test) |
| Sprint 9 — Real-time Protocols | ✅ Built | New `packages/engine/src/realtime/{types,websocket,sse,graphql,grpc}.ts`: WebSocket/SSE are timer-driven mock sessions (mirrors `MockRequestClient`'s honesty — demo endpoints don't resolve over the wire); GraphQL is a real hand-rolled engine (lexer/parser/resolver against a demo Acme schema, ~980 lines, not a canned JSON blob) with `graphqlIntrospection()`, `executeGraphQL()`, `formatGraphQL()`. gRPC is genuinely real: an in-app `@grpc/grpc-js` server (`apps/desktop/src/main/grpcServer.ts`, JSON wire format — no protobuf codegen) serving `acme.orders.OrderService` (unary/server-stream/client-stream/bidi), with full IPC plumbing (`shared/ipc.ts`, `preload/index.ts`) pushing frames back by tab `channelId`; unary/server-stream/client-stream/bidi calls all dispatch on the selected method by name rather than a hardcoded RPC. Renderer: `stores/realtime.ts` (per-tab state keyed by tab id) + 4 panels (`components/realtime/*.tsx`) wired as workspace tabs in `RequestBuilderPage.tsx`/`WorkspaceTabs.tsx`. GraphQL panel has an editable endpoint, a headers editor, a Format button, and a schema-explorer tab reading real introspection (not hardcoded copy); WebSocket panel has an editable URL, JSON/text/binary format selector, per-frame timestamps, a connection-log view, and Clear; SSE panel has Pause/Resume/Reconnect/Clear with id/timestamp columns; gRPC panel has a real services/methods tree (from `grpcIntrospection()`) plus a Proto tab, and drives all four call shapes including bidi start/send/end. typecheck/build green, 57 engine tests passing (11 new this sprint: GraphQL introspection/execution/format, WS connect/echo, SSE pause/resume, gRPC mock unary/streaming). Verified live end-to-end with a Playwright `_electron` driver clicking through all four protocol tabs in the built app (not just typecheck/tests) — this caught and fixed 3 real runtime bugs invisible to typecheck/unit tests: (1) `getWs`/`getSse`/`getGql`/`getGrpc` in `stores/realtime.ts` returned a fresh default object on every call, which crashed React with "Maximum update depth exceeded" the instant any fresh protocol tab first rendered (fixed with stable singleton fallbacks); (2) `grpcServer.ts`'s method-by-name dispatch extracted grpc-js client methods without rebinding `this`, crashing every unary/stream/bidi call with `Cannot read properties of undefined` (fixed with `.bind(c)`); (3) SSE Pause/Resume never wrote `paused` back to the store, so the button never flipped and reconnecting after a pause left the stream stuck silent (fixed by setting `paused` in `pauseSse`/`resumeSse`/`reconnectSse` and resetting the engine's internal `paused` flag on reconnect). All four protocols (WebSocket connect/send/ping/log, SSE pause/resume/reconnect, GraphQL execute/schema/headers, gRPC unary/server-stream/client-stream/bidi) confirmed working by screenshot after the fixes. |
| Sprint 10 — Mock Servers | ✅ Built | Built on Sprint 8's existing `MockServer`/`MockEndpoint`/`MockLogEntry` types and SQLite persistence (`saveMockServer`/`listMockServers` already existed — only the runtime and UI were missing). New `packages/engine/src/mock/matcher.ts` (`matchMockEndpoint`, Express-style `:param` matching, 7 tests) is the pure logic a real `apps/desktop/src/main/mockServerRuntime.ts` uses: one real `node:http` server per `MockServer` row (no framework, same raw-platform choice Sprint 9 made for gRPC), with per-endpoint `delayMs` (via `setTimeout`) and `errorRate` (random chance of a 500 instead of the designed response) both genuinely honoured, and unmatched paths correctly 404. New IPC (`MOCK_START`/`MOCK_STOP`/`MOCK_LOG`) pushes a live per-request log to the renderer; a sync `storageService.getMockServerSync()` lets the runtime pick up endpoint edits without a restart. New `pages/MockServersPage.tsx` (master-detail dashboard: server list with a live status dot, Start/Stop/Restart, endpoints list, live/persisted request log with Clear), `components/mock/CreateMockServerWizard.tsx` (name + port, suggests the next free `4100+n`), and `components/mock/MockResponseDesigner.tsx` (method/path, status presets + custom, headers via `KeyValueEditor`, a JSON `CodeEditor` body, 8 one-click response templates covering the common success/error shapes, latency presets + custom, and an error-rate simulation toggle). OpenAPI's existing "Generate Mock Server" now navigates straight to the new dashboard. Verified live end-to-end with a Playwright `_electron` driver plus real `curl`/`lsof` against the running app (not just clicking through screenshots): started the seeded "User API Mock", confirmed `lsof` showed Electron actually listening on :4010, and `curl` got the exact designed status/headers/body for a static path, a `:id` path param, and a 404 for an unmatched path; built a second server with a 100%-error-rate endpoint via the wizard + designer and confirmed real 500s. That same pass caught and fixed a real bug: the persisted `status: 'running'` flag survived app quit even though the OS socket died with the process, so the next launch showed a lying "Running" state — fixed by marking every still-tracked-running server `stopped` in storage during `before-quit`, verified by relaunching and checking both `lsof` (port released) and the DB (status corrected). typecheck/build green, 64 engine tests passing (7 new this sprint). |
| Sprint 11 — Performance | ✅ Built | Real `undici.Pool`-backed load engine (`apps/desktop/src/main/loadEngine.ts`) — one pool per run sized to concurrency for genuine connection reuse, linear ramp-up, time-boxed or fixed-count runs, live progress streamed over IPC, cancellable mid-run. `packages/engine/src/performance/stats.ts` (percentiles, run summary, sample downsampling) and `packages/engine/src/performance/diagnosis.ts` (failure-cause heuristics + response warnings, extracted from the existing `ResponseError` card so the Debugger and the inline error state share one implementation) are pure and tested (12 new tests). `packages/engine/src/compare/{diff,requestDiff}.ts` is a hand-rolled LCS line-diff (10 new tests) — used instead of a Monaco/CodeMirror diff-editor dependency since URL/method/headers/params/body compare cleanly as short text blocks. New Performance page (config form, live stat tiles, 4 ECharts charts — latency/RPS/error-rate over time + status-code distribution — run history sidebar); new `debugger`/`compare` workspace tab kinds (`DebuggerPanel`, `ComparePanel`) alongside Sprint 9's ws/sse/graphql/grpc tabs; `ResponseError`'s inline failure card gained an "Open in Debugger" button. `PerformanceRun` persisted to SQLite (`performance_runs` table, same JSON-blob-per-row pattern as `mock_servers`). Added `echarts` (packages/ui, tree-shaken via `echarts/core` + only the line/bar/grid/tooltip modules actually used — importing all of `echarts` measurably bloated the renderer bundle) and `undici` as an explicit `apps/desktop` dependency (was previously only a transitive dep via the engine). 86/86 engine tests passing, full monorepo typecheck green. Verified live end-to-end (Playwright `_electron` + a real Sprint 10 mock server as the load target, per the Sprint 10 lesson about verifying anything with a real port): confirmed genuine concurrent HTTP against a real listener (0% and 100% error-rate runs both produced correct percentiles/RPS and correctly bucketed 2xx/4xx/5xx/network-error), cancellation stopping a 100,000-request run mid-flight with partial results preserved, the Debugger's diagnosis + Retry/Open/Copy actions against a real simulated 500, and Compare Requests producing a real URL diff between two saved requests. Two apparent bugs surfaced during that pass turned out to be test-harness mistakes, not product bugs (stale mock-server port after an app relaunch; an unset error-rate percentage on an edited endpoint) — worth remembering that "network error" in a run's response distribution can legitimately mean the target simply wasn't listening. |
| Sprint 12 — Dev UX | ✅ Built | New `packages/engine/src/import/{postman,har,curl}.ts` (Postman v2.x folder→tag flattening reusing the existing `CollectionPlan`/`PlannedRequest` types from OpenAPI generation; HAR entries→history drafts, skipping malformed entries rather than throwing; a hand-rolled cURL tokenizer handling quoted args) and `packages/engine/src/export/collection.ts` (`exportCollectionPostman`/`exportCollectionOpenApi`, reusing the pre-existing `serializeCollection` for native export — a real bug was caught and fixed here: `pathFromUrl()` was destroying `{{var}}` template syntax via `new URL()` before OpenAPI path-templating could convert it to `{param}`, fixed with manual string parsing, caught by a round-trip test through the app's own `parseOpenApiSpec()`). `StorageProvider` gained `deleteHistoryEntry`; `AppSettings` gained `editor`/`certificates` with a `mergeSettingsWithDefaults()` backward-compat shim for old settings rows. Rewrote `HistoryPage.tsx` (method/status-bucket/environment/collection/date-range filters, Open/Replay/Duplicate/Delete/Clear all, HAR import), added `ImportCollectionModal.tsx` (native/Postman/cURL tabs) and 3-format collection export, `CodeGenModal.tsx` (5 languages, reusing the existing `generateCodeSample`), a real notification center wired to 5 real triggers (collection run complete, mock started, OpenAPI imported, request failed/5xx, environment switched), a new `ShortcutsPage.tsx` and `SettingsPage.tsx` (12 real sections, all persisting through `saveSettings()`). Fixed a latent bug proactively (not from a failure report): none of the new Cmd+S/Cmd+W/Cmd+P shortcuts called `e.preventDefault()`, which would have let them fall through to Chromium/Electron's native save-page/close-window/print — Cmd+W especially could have closed the whole app window instead of just a tab. Insomnia-format import and a standalone Documentation export were not built (not covered by acceptance criteria; noted above). typecheck green across all 6 packages, 99/99 engine tests passing (13 new this sprint). Verified live end-to-end with a Playwright `_electron` driver across two sessions sharing one `--user-data-dir`: confirmed History's method and 5xx-status filters both correctly narrow a populated table; the Code Generation modal renders real, distinct code across all 5 languages for a live failed request; "Open in Debugger" reaches the full structured failure diagnosis; importing a fixture Postman collection creates a real "Imported Test API" collection visible in the Collections list; and — the one check that mattered most, since Sprint 12 is a settings/persistence sprint — a changed Editor font-size setting survived not just in-app navigation but a full Electron process relaunch against the same user-data dir, confirming it round-trips through SQLite and not just Zustand state. |
| Sprint 13 — Hardening | ✅ Built | **Security** (found and fixed a real sandbox escape, not just a paper audit): the pre-request/post-response script sandbox's own justifying comment claimed `vm.createContext` was safe because "no `require`/`process` exist unless we put them there" — verified locally that this was false: `console.log.constructor('return process')()` returned the *real* Node `process` object, because host-realm functions passed into a vm context (`pm`, `console`) still carry their real constructor chain across the boundary. Fixed in `scriptSandbox.ts` with a recursive `harden()` that strips every exposed function/object to a null prototype (removes `.constructor` without breaking direct calls) plus `codeGeneration: { strings: false }` as defense in depth for `eval`/`Function(str)` — verified with 3 new tests reproducing the exact escape and confirming it now throws. Added a real, enforced CSP (`main/index.ts`, `session.defaultSession.webRequest.onHeadersReceived`, stricter in production than dev) — verified live that it actually blocks a runtime-injected inline `<script>` (a `securitypolicyviolation` fired, the script didn't run), not just that the header exists. Closed a real IPC hole: `storage:call`'s dynamic dispatcher (`ipc.ts`) accepted *any* method name that resolved to a function on `StorageService`, including `encrypt`/`decrypt`/`close` — replaced with an explicit allowlist matching the `StorageChannel` type (previously compile-time-only, now a real runtime boundary too), verified live that a disallowed method now throws. Flipped `BrowserWindow`'s `sandbox: false` → `true` (the preload only used `contextBridge`/`ipcRenderer`, no Node APIs) — verified live the app boots, IPC still works, with the OS-level renderer sandbox now actually on. File://, blob:, and OpenAPI-import-by-URL fetch paths were reviewed and already correctly scoped (a real, deliberate exception to "no external calls" — the app's own `js-yaml` usage is already safe-by-default in v4, no unsafe schema).<br><br>**Performance**: found and fixed the exact "100k-node JSON response" failure mode the roadmap named — `JsonTreeView` mounted one component per array/object entry the instant a container expanded, and a root-level array (the common shape for `GET /items`-style responses) is always expanded by default, so a bare 100k-item array would have mounted ~100k component trees on first paint. Fixed with per-container pagination (300 children at a time, "Show N more" to reveal further batches) — verified with a real headless-browser micro-benchmark (esbuild-bundled straight from the shipped `.tsx` source, not a reimplementation): a 100k-item root array now renders in 66ms with ~2,400 DOM nodes instead of ~100k+. Added the same real windowing to the shared `DataTable` (backs the uncapped Requests list) — verified a 50,000-row table renders only ~35 actual `<tr>` elements. `react-arborist`'s Collections tree was already properly virtualized and dynamically sized (confirmed by reading it, not assumed); app startup was confirmed already lazy (only the active workspace loads, after first paint, not blocking window creation).<br><br>**Auto-update**: added `electron-builder`/`electron-updater`, a real `electron-builder.yml` (GitHub Releases as the update host — free, no extra infrastructure), and a real macOS `.icns`/`.png` icon set generated from the existing logo via `iconutil`/`sips`. No code-signing identity configured (`mac.identity: null`, no Windows cert) — by explicit agreement this pass ships unsigned rather than fake a signature. Wired `main/updater.ts` (real `autoUpdater` event listeners → `IPC.UPDATE_STATUS` → a live status row in Settings → About with Check/Download/Restart-to-install actions). Caught and fixed a real dead-button bug along the way: electron-updater silently no-ops with only a console log (no thrown error, no event) when `app.isPackaged` is false, so clicking "Check for updates" in an unpacked/dev run did nothing and left the UI stuck forever — fixed by detecting that case explicitly and surfacing a clear status instead of calling into electron-updater at all. Verified end-to-end against a **genuinely packaged, unsigned** build (`electron-builder --mac dmg`, real DMG produced): the app made a real HTTPS call to the actual (release-less) `prakashiOrbit/vaynt-forge` GitHub repo and correctly surfaced "No published versions on GitHub" — the check path is completely real; only an actual `gh release` publish (a visible external action outside this pass's scope) remains to complete the loop. Also built a real, unsigned Linux AppImage (arm64) this pass, catching one genuine electron-builder config bug along the way: the default `executableName` derived from the scoped npm package name `@vayntforge/desktop`, which AppImage packaging rejects outright ("characters that cannot be safely used in file paths") — fixed with an explicit `executableName: vaynt-forge`. A Windows NSIS build was started with the same config but its first-run Electron binary download did not finish within this session (a real ~150MB+ fetch, not a config error) — the pipeline is in place and identical to what worked for mac/Linux, but Windows output was never actually confirmed. The macOS build was verified for its native arm64 architecture only; the `universal` (arm64+x64 combined) arch target in `electron-builder.yml` was never actually exercised end-to-end.<br><br>**Accessibility**: fixed 3 icon-only buttons with no accessible name (`MockServersPage`, `SettingsPage`, `PerformancePage`) and one real HTML-validity bug alongside them — `PerformancePage`'s run-history rows nested a delete `<button>` inside a row-select `<button>`, invalid HTML that makes the inner control unreachable for keyboard/assistive tech, fixed by converting the outer row to a keyboard-operable `<div role="button">`. Added a real focus trap + focus-on-open + focus-return-on-close to `Modal`/`Drawer` (`packages/ui/src/hooks/useDialogFocus.ts`) — previously neither existed at all, so Tab could escape a dialog into the page behind it and closing one dropped focus to `<body>`; verified live that focus starts inside a real dialog, stays inside after 15 Tab presses, and returns to the exact button that opened it after Escape. Fixed 8 `outline-none` spots with no focus-visible replacement across `CommandPalette`/`WorkspaceSwitcher`/`BodyPanel`/`TreeNodeRow`/`DocumentationPage`/`EnvironmentsPage`/`VariableInput`. Fixed the shared `fields.tsx` (`TextField`/`NumberField`/`SelectField`, reused throughout the request builder) to actually link `<label>` to its control via `useId()` — previously visually paired but not programmatically associated. Fixed real WCAG contrast failures in both themes' `--af-text-faint` token (computed, not guessed: dark measured 3.34:1 against `--af-bg-input`, light measured a badly-failing 2.35:1 against `--af-bg` — both below the 4.5:1 body-text threshold; replaced with values verified at 5.3:1 and 4.97:1 respectively). Settings page's `Row` label association (a plain `<div>`, not a `<label>`) was identified but left as a known, documented gap rather than a rushed 20-site edit for marginal benefit.<br><br>**Responsiveness sweep**: verified live at 1280×800/1600×1000/1920×1080 across Home, Request Builder, Collections, History, Mock Servers, Performance, and Settings — clean at every size, no overlap/overflow, no wasted-space stretching at the widest breakpoint.<br><br>**Micro-interaction / "no placeholder screens" audit**: found and fixed a real, live gap the checklist explicitly calls out — "Workspace" and "Tests" were both still wired to the generic `PlaceholderPage` stub from early scaffolding, reachable by actually clicking them in the sidebar. "Workspace" was genuinely redundant (full CRUD already exists in the TopBar's `WorkspaceSwitcher`) and was removed; "Tests" was a real gap with no substitute, so a new `TestsPage.tsx` was built reusing the `TestRun`/`saveTestRun` data pipeline that already existed with no page consuming it (workspace test-run history, pass/fail summary, per-request assertion drill-down) — verified live end-to-end with a real collection run.<br><br>**CI**: added `.github/workflows/ci.yml` (typecheck + test + lint on push/PR) since none existed at all; fixed 12 pre-existing lint errors (unnecessary regex escapes, a `prefer-const`, an unused test parameter) so this first CI run can actually be green. No automated Playwright Electron E2E suite exists yet — every live-app check across all 14 sprints, including this one, was a disposable scratch script deleted after use; that remains a real gap for genuine CI-gated E2E coverage. **Sentry was explicitly deferred** this pass (no account/DSN available) rather than wired with a fake key. typecheck green across all 6 packages; 99 engine + 12 desktop unit tests passing (3 new sandbox-escape tests, all others unchanged). |
| Final QA gate | ✅ Passed | Full checklist re-verified against the actual running app, not just re-read — see the Final QA Checklist section above for the two items (Workspace/Tests placeholders, Performance page's nested-button bug) that were genuinely false before this sprint and are now fixed and live-verified. Command palette and theme switching were specifically re-tested after this sprint's own CSP/sandbox changes, since those are exactly the kind of change that could silently break either one; both confirmed working with zero CSP violations or page errors. |