export const IPC = {
  PING: 'app:ping',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]