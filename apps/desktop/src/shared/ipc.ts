export const IPC = {
  PING: 'app:ping',
  /** Generic typed call into the main-process storage service. */
  STORAGE_CALL: 'storage:call',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  /** File picker filtered to `.proto` files, for gRPC external-target import. */
  DIALOG_OPEN_PROTO_FILE: 'dialog:openProtoFile',
  /** Real undici-based execution — what the renderer's Send button calls. */
  NETWORK_EXECUTE: 'network:execute',
  /** Real RFC 6749 client-credentials token fetch — a genuine POST to the configured Token URL. */
  OAUTH2_FETCH_TOKEN: 'network:oauth2:fetchToken',
  SCRIPTS_RUN: 'scripts:run',
  GRPC_START: 'network:grpc:start',
  GRPC_UNARY: 'network:grpc:unary',
  GRPC_SERVER_STREAM: 'network:grpc:serverStream',
  GRPC_CLIENT_STREAM: 'network:grpc:clientStream',
  GRPC_BIDI_START: 'network:grpc:bidi:start',
  GRPC_BIDI_SEND: 'network:grpc:bidi:send',
  GRPC_BIDI_END: 'network:grpc:bidi:end',
  GRPC_FRAME: 'network:grpc:frame',
  /** Connects a real external `host:port` gRPC target (via reflection or an imported `.proto` file). */
  GRPC_CONNECT_EXTERNAL: 'network:grpc:connectExternal',
  GRPC_DISCONNECT: 'network:grpc:disconnect',
  WS_CONNECT: 'network:ws:connect',
  WS_SEND: 'network:ws:send',
  WS_PING: 'network:ws:ping',
  WS_CLOSE: 'network:ws:close',
  WS_EVENT: 'network:ws:event',
  SSE_CONNECT: 'network:sse:connect',
  SSE_CLOSE: 'network:sse:close',
  SSE_EVENT: 'network:sse:event',
  MOCK_START: 'mock:start',
  MOCK_STOP: 'mock:stop',
  MOCK_LOG: 'mock:log',
  PERF_START: 'perf:start',
  PERF_CANCEL: 'perf:cancel',
  PERF_PROGRESS: 'perf:progress',
  PERF_DONE: 'perf:done',
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_INSTALL: 'update:install',
  UPDATE_GET_STATUS: 'update:getStatus',
  UPDATE_STATUS: 'update:status',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]