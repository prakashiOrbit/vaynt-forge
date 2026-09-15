import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  onConfirm(): void
  onCancel(): void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            size="sm"
            onClick={() => {
              onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description !== undefined ? (
        <div className="flex items-start gap-3">
          {tone === 'danger' && (
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--af-err)]" />
          )}
          <div className="text-[12px] leading-relaxed text-muted">{description}</div>
        </div>
      ) : null}
    </Modal>
  )
}