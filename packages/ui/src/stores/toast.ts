import { create } from 'zustand'

export type ToastTone = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  tone: ToastTone
  title: string
  message?: string
}

interface ToastState {
  toasts: Toast[]
  push(t: Omit<Toast, 'id'>): number
  dismiss(id: number): void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }))
    return id
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  info(title: string, message?: string) {
    useToastStore.getState().push({ tone: 'info', title, message })
  },
  success(title: string, message?: string) {
    useToastStore.getState().push({ tone: 'success', title, message })
  },
  error(title: string, message?: string) {
    useToastStore.getState().push({ tone: 'error', title, message })
  },
  dismiss(id: number) {
    useToastStore.getState().dismiss(id)
  },
}