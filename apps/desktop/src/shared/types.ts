import type {
  Workspace,
  Collection,
  Folder,
  HistoryEntry,
  TestRun,
  RequestModel,
  Environment,
  Variable,
  MockServer,
  AppSettings,
  AppNotification,
  NotificationPatch,
  WorkspaceDraft,
  CollectionDraft,
  CollectionPatch,
  FolderDraft,
  FolderPatch,
  NotificationDraft,
  ResponseModel,
  ScriptContext,
  ScriptResult,
  OpenApiSpec,
  OpenApiSpecDraft,
  GrpcUnaryResult,
  GrpcStreamResult,
  GrpcFrame,
  GrpcMetadataArg,
  GrpcService,
  ConsoleEntry,
  WsMessageFormat,
  WsPushEvent,
  SsePushEvent,
  MockLogEntry,
  PerformanceRun,
  PerfTestConfig,
  PerfSample,
  JarCookie,
  OAuth2Config,
} from '@vayntforge/engine'

/** Mirrors the engine's `OAuth2TokenResult` (networking/oauth2-client.ts) — redefined here rather than imported, since that module is Node/undici-only and this file is shared with the renderer. */
export interface OAuth2TokenResult {
  accessToken?: string
  tokenType?: string
  expiresAt?: number
  scope?: string
  error?: string
}

/** Auto-update status, pushed from `main/updater.ts` over `IPC.UPDATE_STATUS`. */
export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

/** Plain-object variable scopes — reassembled into a `ResolutionContext` (Maps) main-side. */
export interface VariableScopes {
  global?: { key: string; value: string }[]
  environment?: { key: string; value: string }[]
  collection?: { key: string; value: string }[]
  request?: { key: string; value: string }[]
  /** Session-only, never persisted — the highest-priority scope, same role Postman's "Local variables" play. */
  temporary?: { key: string; value: string }[]
}

/**
 * Everything a single workspace needs rendered. Assembled by the main process
 * from the storage provider (secret variable values already decrypted).
 */
export interface WorkspaceSnapshot {
  workspaceId: string
  collections: Collection[]
  foldersByCollection: Record<string, Folder[]>
  requests: RequestModel[]
  environments: Environment[]
  globalVariables: Variable[]
  mockServers: MockServer[]
  openApiSpecs: OpenApiSpec[]
  performanceRuns: PerformanceRun[]
  history: HistoryEntry[]
  testRuns: TestRun[]
  settings: AppSettings
  notifications: AppNotification[]
  cookies: JarCookie[]
  secretsSupported: boolean
  updatedAt: number
}

/**
 * The typed storage surface the renderer calls over IPC (`storage:call`).
 * Sits between the session/data Zustand stores and the main-process
 * SQLite-backed provider, which encrypts secret values with safeStorage.
 */
export interface StorageChannel {
  listWorkspaces(): Promise<Workspace[]>
  createWorkspace(input: WorkspaceDraft): Promise<Workspace>
  renameWorkspace(id: string, name: string): Promise<Workspace>
  deleteWorkspace(id: string): Promise<void>

  snapshot(workspaceId: string): Promise<WorkspaceSnapshot>

  createCollection(input: CollectionDraft): Promise<Collection>
  updateCollection(id: string, patch: CollectionPatch): Promise<Collection>
  deleteCollection(id: string): Promise<void>

  createFolder(input: FolderDraft): Promise<Folder>
  updateFolder(id: string, patch: FolderPatch): Promise<Folder>
  deleteFolder(id: string): Promise<void>

  saveRequest(request: RequestModel): Promise<RequestModel>
  deleteRequest(id: string): Promise<void>

  saveEnvironment(environment: Environment): Promise<Environment>
  deleteEnvironment(id: string): Promise<void>

  saveGlobalVariable(variable: Variable): Promise<Variable>
  deleteGlobalVariable(id: string): Promise<void>

  saveMockServer(server: MockServer): Promise<MockServer>
  deleteMockServer(id: string): Promise<void>

  createOpenApiSpec(input: OpenApiSpecDraft): Promise<OpenApiSpec>
  deleteOpenApiSpec(id: string): Promise<void>

  savePerformanceRun(run: PerformanceRun): Promise<PerformanceRun>
  deletePerformanceRun(id: string): Promise<void>

  addHistory(entry: Omit<HistoryEntry, 'id'>): Promise<HistoryEntry>
  deleteHistoryEntry(id: string): Promise<void>
  clearHistory(workspaceId: string): Promise<void>

  saveTestRun(run: TestRun): Promise<TestRun>
  deleteTestRun(id: string): Promise<void>

  saveSettings(workspaceId: string, settings: AppSettings): Promise<AppSettings>
  addNotification(input: NotificationDraft): Promise<AppNotification>
  updateNotification(id: string, patch: NotificationPatch): Promise<AppNotification>
  clearNotifications(workspaceId: string): Promise<void>

  /** The per-workspace cookie jar Send/network:execute reads/writes automatically — see main/ipc.ts. */
  saveCookieJar(workspaceId: string, cookies: JarCookie[]): Promise<void>
  clearCookieJar(workspaceId: string): Promise<void>

  /** Whether the platform secure store is usable (affects secret masking UX). */
  secretsSupported(): Promise<boolean>
}

export interface VayntForgeApi {
  app: {
    /** Proves the renderer ↔ main IPC round-trip works (Sprint 0). */
    ping(): Promise<string>
    version: string
  }
  storage: {
    /** Type-safe generic call into the SQLite-backed {@link StorageChannel}. */
    call<K extends keyof StorageChannel>(
      method: K,
      ...args: Parameters<StorageChannel[K]>
    ): Promise<ReturnType<StorageChannel[K]>>
  }
  dialog: {
    /** Native "open file" picker — returns the chosen path, or null if cancelled. */
    openFile(): Promise<string | null>
    /** Native "open file" picker filtered to `.proto` files, for gRPC external-target import. */
    openProtoFile(): Promise<string | null>
    /** Native "open file" picker filtered by kind, for client-certificate settings. */
    openCertFile(kind: 'cert' | 'key' | 'pfx'): Promise<string | null>
  }
  network: {
    /**
     * Real `undici`-based execution — genuine DNS/TLS/HTTP against whatever
     * URL the request resolves to. This is what `sendRequest.ts` calls for
     * the renderer's Send button (see DEVELOPMENT_ROADMAP.md's post-Sprint-13
     * note under Sprint 6 for when/why this changed from a mocked response).
     */
    execute(request: RequestModel, scopes: VariableScopes): Promise<ResponseModel>
    /** Real RFC 6749 client-credentials grant — a genuine POST to `config.tokenUrl`. */
    fetchOAuth2Token(config: OAuth2Config): Promise<OAuth2TokenResult>
  }
  scripts: {
    /** Runs a pre-request/post-response script in a sandboxed `vm` context. */
    run(code: string, context: ScriptContext): Promise<ScriptResult>
  }
  realtime: {
    /**
     * Sprint 9 — the in-app gRPC mock server (`@grpc/grpc-js`, JSON wire
     * format). Server-stream and bidi frames arrive through `onFrame`, routed
     * by the renderer tab's `channelId`.
     */
    grpc: {
      /** Lazily starts the demo server for this tab; resolves to its `host:port` and demo service descriptors. */
      start(channelId: string): Promise<{ address: string; services: GrpcService[]; protoSource?: string }>
      /**
       * Connects this tab to a real external gRPC target. With `protoPath`,
       * loads that `.proto` file; otherwise discovers services via server
       * reflection. Either way, all further calls for this `channelId` go to
       * a real client built from what's found.
       */
      connectExternal(
        channelId: string,
        address: string,
        tls: boolean,
        protoPath?: string
      ): Promise<{ services: GrpcService[]; protoSource?: string }>
      /** Closes this tab's real client and forgets its target. */
      disconnect(channelId: string): Promise<void>
      unary(
        channelId: string,
        method: string,
        message: unknown,
        metadata?: GrpcMetadataArg[]
      ): Promise<GrpcUnaryResult>
      serverStream(channelId: string, method: string, message: unknown, metadata?: GrpcMetadataArg[]): Promise<void>
      clientStream(
        channelId: string,
        method: string,
        messages: unknown[],
        metadata?: GrpcMetadataArg[]
      ): Promise<GrpcStreamResult>
      bidiStart(channelId: string, method: string): Promise<void>
      bidiSend(channelId: string, message: unknown): Promise<void>
      bidiEnd(channelId: string): Promise<void>
      /** Subscribe to gRPC frames; returns an unsubscribe function. */
      onFrame(callback: (channelId: string, frame: GrpcFrame) => void): () => void
    }
    /**
     * Real WebSocket connections (`ws` package), one socket per renderer tab
     * (`channelId` == tab id). Status/frame/log updates arrive through `onEvent`.
     */
    ws: {
      connect(channelId: string, url: string): Promise<void>
      send(channelId: string, text: string, format: WsMessageFormat): Promise<void>
      ping(channelId: string): Promise<void>
      close(channelId: string): Promise<void>
      /** Subscribe to WebSocket events; returns an unsubscribe function. */
      onEvent(callback: (channelId: string, event: WsPushEvent) => void): () => void
    }
    /**
     * Real Server-Sent Events (streamed `undici` GET parsed as
     * text/event-stream), one stream per renderer tab (`channelId` == tab id).
     */
    sse: {
      connect(channelId: string, url: string): Promise<void>
      close(channelId: string): Promise<void>
      /** Subscribe to SSE events; returns an unsubscribe function. */
      onEvent(callback: (channelId: string, event: SsePushEvent) => void): () => void
    }
  }
  console: {
    /** Subscribe to real REST/GraphQL request/response console entries (pushed after every `network:execute` call); returns an unsubscribe function. */
    onEntry(callback: (entry: ConsoleEntry) => void): () => void
  }
  mock: {
    /** Starts (or restarts) a real `node:http` server bound to `server.port`. */
    start(server: MockServer): Promise<void>
    stop(id: string): Promise<void>
    /** Subscribe to mock request-log entries; returns an unsubscribe function. */
    onLog(callback: (serverId: string, entry: MockLogEntry) => void): () => void
  }
  performance: {
    /** Starts a real load test (undici.Pool concurrency) against `request`. */
    start(runId: string, request: RequestModel, scopes: VariableScopes, config: PerfTestConfig): Promise<void>
    cancel(runId: string): Promise<void>
    /** Streamed as the run progresses; returns an unsubscribe function. */
    onProgress(callback: (runId: string, batch: PerfSample[]) => void): () => void
    /** Fired once when the run finishes (completed or cancelled). */
    onDone(callback: (runId: string, samples: PerfSample[], durationMs: number) => void): () => void
  }
  update: {
    /** Asks electron-updater to check GitHub Releases for a newer version. */
    check(): Promise<void>
    download(): Promise<void>
    /** Quits and installs the downloaded update. */
    install(): Promise<void>
    getStatus(): Promise<UpdateStatus>
    /** Subscribe to update status changes; returns an unsubscribe function. */
    onStatus(callback: (status: UpdateStatus) => void): () => void
  }
}