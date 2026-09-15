import { create } from 'zustand'

export type NotificationTone = 'info' | 'success' | 'error' | 'warn'

export interface AppNotification {
  id: string
  title: string
  message?: string
  tone: NotificationTone
  time: string
  read: boolean
}

interface NotificationsState {
  items: AppNotification[]
  markAllRead(): void
  dismiss(id: string): void
  clear(): void
}

export const useNotifications = create<NotificationsState>((set) => ({
  items: [
    {
      id: 'n1',
      title: 'Mock server started',
      message: 'Acme API › CRUD on port 4010',
      tone: 'success',
      time: '2m',
      read: false,
    },
    {
      id: 'n2',
      title: 'Environment switched to Production',
      message: 'Requests will run against the live API.',
      tone: 'warn',
      time: '1h',
      read: false,
    },
    {
      id: 'n3',
      title: 'Collection synced',
      message: 'Users Collection · 12 requests',
      tone: 'info',
      time: '1d',
      read: true,
    },
  ],
markAllRead: () => set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })) })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((n) => n.id !== id) })),
  clear: () => set({ items: [] }),
}))