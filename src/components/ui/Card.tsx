import { cn } from '@/lib/utils'

export function Card({
  children,
  className,
  variant = 'default',
}: {
  children: React.ReactNode
  className?: string
  /** "feature" = larger / higher contrast; used for primary KPI */
  variant?: 'default' | 'feature'
}) {
  return (
    <div
      className={cn(
        'relative rounded-lg border bg-[var(--color-surface)] transition-colors duration-150',
        variant === 'feature'
          ? 'border-[var(--color-border-strong)] p-5'
          : 'border-[var(--color-border)] p-4 hover:border-[var(--color-border-strong)]',
        className,
      )}
    >
      {variant === 'feature' ? (
        <span
          aria-hidden
          className="absolute -top-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent opacity-80"
        />
      ) : null}
      {children}
    </div>
  )
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="eyebrow mb-2">
      {children}
    </div>
  )
}

export function CardValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[26px] leading-none font-mono font-medium tabular text-[var(--color-fg)] tracking-tight">
      {children}
    </div>
  )
}
