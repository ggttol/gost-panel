import { cn } from '@/lib/utils'

type Tone = 'neutral' | 'good' | 'bad' | 'warn' | 'accent'

const tones: Record<Tone, string> = {
  neutral:
    'border-[var(--color-border-strong)] text-[var(--color-fg-2)] bg-[var(--color-surface-2)]',
  good:
    'border-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--color-accent)] bg-[var(--color-accent-soft)]',
  bad:
    'border-[color-mix(in_oklab,var(--color-danger)_40%,transparent)] text-[var(--color-danger)] bg-[var(--color-danger-soft)]',
  warn:
    'border-[color-mix(in_oklab,var(--color-warn)_40%,transparent)] text-[var(--color-warn)] bg-[var(--color-warn-soft)]',
  accent:
    'border-[color-mix(in_oklab,var(--color-accent)_40%,transparent)] text-[var(--color-accent)] bg-[var(--color-accent-soft)]',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: Tone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono uppercase tracking-[0.08em]',
        'text-[10px] leading-[18px] px-1.5 rounded border',
        tones[tone],
        className,
      )}
    >
      {tone === 'good' ? (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] pulse-dot" />
      ) : null}
      {children}
    </span>
  )
}
