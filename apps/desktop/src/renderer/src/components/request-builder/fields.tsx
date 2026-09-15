import { useId, type ReactNode } from 'react'

const inputClass =
  'h-7 w-full rounded-md border border-border bg-bg-input px-2.5 text-[12px] text-text outline-none placeholder:text-faint focus:border-accent'

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  if (!children) return null
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-[11px] font-medium text-faint">
      {children}
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange(value: string): void
  placeholder?: string
  type?: 'text' | 'password'
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className={inputClass}
      />
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange(value: number): void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`${inputClass} disabled:opacity-40`}
      />
    </div>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange(value: T): void
  options: { value: T; label: string }[]
}) {
  const id = useId()
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={`${inputClass} appearance-none`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange(checked: boolean): void
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-[12px] text-text">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-4.5 w-8 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-bg-active'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  )
}
