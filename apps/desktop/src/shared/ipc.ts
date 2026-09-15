export const IPC = {
  PING: 'app:ping',
  /** Generic typed call into the main-process storage service. */
  STORAGE_CALL: 'storage:call',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  /** Real undici-based execution — not what the Send button calls, see Out of Scope. */
  NETWORK_EXECUTE: 'network:execute',
  SCRIPTS_RUN: 'scripts:run',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]