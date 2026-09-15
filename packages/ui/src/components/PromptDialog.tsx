import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

export interface PromptDialogProps {
  open: boolean
  title: string
  label?: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  onConfirm(value: string): void
  onCancel(): void
}

/** A single-text-field Modal — "name this collection", "rename", etc. */
export function PromptDialog({
  open,
  title,
  label,
  placeholder,
  initialValue = '',
  confirmLabel = 'Create',
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    if (open) setValue(initialValue)
  }, [open, initialValue])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {label && <label className="mb-1 block text-[11px] font-medium text-faint">{label}</label>}
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
        }}
        placeholder={placeholder}
        className="h-8 w-full rounded-md border border-border bg-bg-input px-2.5 text-[13px] text-text outline-none placeholder:text-faint focus:border-accent"
      />
    </Modal>
  )
}
