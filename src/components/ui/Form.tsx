import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function FormSection({
  title,
  children,
  hint,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <fieldset className="form-section border-t border-[var(--color-border)] pt-4 mt-4 first:border-t-0 first:pt-0 first:mt-0">
      <legend className="flex items-baseline gap-2 mb-3 px-0">
        <span className="form-seq eyebrow" aria-hidden />
        <span className="text-[13px] font-semibold tracking-tight text-[var(--color-fg)]">
          {title}
        </span>
        {hint ? (
          <span className="text-[11px] font-normal text-[var(--color-muted)] flex-1 min-w-0 whitespace-pre-line leading-snug">
            {hint}
          </span>
        ) : null}
      </legend>
      <div className="flex flex-col gap-3">{children}</div>
    </fieldset>
  )
}

export function FieldRow({
  label,
  hint,
  error,
  children,
  htmlFor,
  inline,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
  htmlFor?: string
  inline?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', inline && 'sm:flex-row sm:items-start sm:gap-3')}>
      <label
        htmlFor={htmlFor}
        className={cn('eyebrow shrink-0', inline && 'sm:w-32 sm:pt-2')}
      >
        {label}
      </label>
      <div className="flex-1 min-w-0">
        {children}
        {hint ? (
          <div className="text-[11px] text-[var(--color-muted)] mt-1 whitespace-pre-line leading-snug">
            {hint}
          </div>
        ) : null}
        {error ? <div className="text-[11px] text-[var(--color-danger)] mt-1">{error}</div> : null}
      </div>
    </div>
  )
}

const fieldBase =
  'h-8 w-full px-2.5 text-[13px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] outline-none placeholder:text-[var(--color-muted)] transition-[border-color,box-shadow] duration-100'

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...props} />
  ),
)
TextField.displayName = 'TextField'

export const NumberField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      type="number"
      inputMode="numeric"
      className={cn(fieldBase, 'font-mono tabular', className)}
      {...props}
    />
  ),
)
NumberField.displayName = 'NumberField'

export const TextareaField = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full px-2.5 py-1.5 text-[12px] font-mono rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] outline-none placeholder:text-[var(--color-muted)] resize-y transition-[border-color,box-shadow] duration-100',
      className,
    )}
    {...props}
  />
))
TextareaField.displayName = 'TextareaField'

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  className,
  allowEmpty,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string; hint?: string }>
  placeholder?: string
  className?: string
  allowEmpty?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          fieldBase,
          'appearance-none pr-8 cursor-pointer font-mono text-[12px]',
        )}
      >
        {allowEmpty ? <option value="">{placeholder ?? '— 不选 —'}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.hint ? `  ·  ${o.hint}` : ''}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] text-[10px]">
        ▾
      </span>
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  hint?: string
}) {
  return (
    <label className="inline-flex items-start gap-2 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-[18px] w-8 rounded-full border transition-colors duration-150 shrink-0 mt-0.5',
          checked
            ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
            : 'bg-[var(--color-surface-2)] border-[var(--color-border-strong)]',
        )}
      >
        <span
          className={cn(
            'absolute top-[2px] h-3 w-3 rounded-full transition-transform duration-150',
            checked
              ? 'translate-x-[16px] bg-[var(--color-accent-fg)]'
              : 'translate-x-[2px] bg-[var(--color-fg)]',
          )}
        />
      </button>
      {label ? (
        <span className="text-[13px] text-[var(--color-fg)]">
          {label}
          {hint ? (
            <span className="block text-[11px] mt-0.5 text-[var(--color-muted)] font-normal whitespace-pre-line leading-snug">
              {hint}
            </span>
          ) : null}
        </span>
      ) : null}
    </label>
  )
}

export function RowList<T>({
  items,
  onAdd,
  onRemove,
  render,
  addLabel = '＋ 添加',
  empty = '暂无',
}: {
  items: T[]
  onAdd: () => void
  onRemove: (i: number) => void
  render: (item: T, i: number) => ReactNode
  addLabel?: string
  empty?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 ? (
        <div className="text-xs text-[var(--color-muted)] border border-dashed border-[var(--color-border)] rounded-md px-3 py-4 text-center">
          {empty}
        </div>
      ) : (
        items.map((it, i) => (
          <div
            key={i}
            className="relative rounded-md border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-2)_60%,transparent)] p-3 pr-8 transition-colors hover:border-[var(--color-border-strong)]"
          >
            <span className="absolute left-[-1px] top-3 bottom-3 w-0.5 bg-[var(--color-accent)] opacity-0 transition-opacity group-hover:opacity-100" />
            {render(it, i)}
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute top-1.5 right-1.5 h-5 w-5 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-danger)] rounded flex items-center justify-center"
              aria-label="移除"
              title="移除"
            >
              ✕
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        onClick={onAdd}
        className="text-[11px] h-7 px-2.5 self-start rounded-md border border-dashed border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-colors"
      >
        {addLabel}
      </button>
    </div>
  )
}
