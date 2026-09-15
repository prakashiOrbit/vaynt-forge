export const IPC = {
  PING: 'app:ping',
  /** Generic typed call into the main-process storage service. */
  STORAGE_CALL: 'storage:call',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]