export const IPC = {
  PING: 'app:ping',
  /** Generic typed call into the main-process storage service. */
  STORAGE_CALL: 'storage:call',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  /** Real undici-based execution — not what the Send button calls, see Out of Scope. */
  NETWORK_EXECUTE: 'network:execute',
  SCRIPTS_RUN: 'scripts:run',
  GRPC_START: 'network:grpc:start',
  GRPC_UNARY: 'network:grpc:unary',
  GRPC_SERVER_STREAM: 'network:grpc:serverStream',
  GRPC_CLIENT_STREAM: 'network:grpc:clientStream',
  GRPC_BIDI_START: 'network:grpc:bidi:start',
  GRPC_BIDI_SEND: 'network:grpc:bidi:send',
  GRPC_BIDI_END: 'network:grpc:bidi:end',
  GRPC_FRAME: 'network:grpc:frame',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]