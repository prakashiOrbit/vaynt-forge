export type NotificationTone = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: string
  workspaceId: string
  tone: NotificationTone
  title: string
  message?: string
  /** Epoch ms. The renderer renders a relative label ("2m ago"). */
  createdAt: number
  read: boolean
  dismissed: boolean
}

export interface NotificationPatch {
  read?: boolean
  dismissed?: boolean
}