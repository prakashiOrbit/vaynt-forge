import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: ReactNode
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--af-accent)] text-white hover:opacity-90 active:opacity-80 shadow-sm',
  ghost:
    'bg-transparent text-[var(--af-text-muted)] hover:bg-[var(--af-bg-hover)] hover:text-[var(--af-text)]',
  outline:
    'border border-[var(--af-border-strong)] text-[var(--af-text)] hover:bg-[var(--af-bg-hover)]',
  danger: 'bg-red-500/15 text-red-400 hover:bg-red-500/25',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-md font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--af-accent)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}