export function TypeHint({ text }: { text?: string }) {
  if (!text) return null
  return (
    <div className="mt-1.5 flex gap-2 text-[11px] leading-relaxed text-[var(--color-fg-2)]">
      <span className="font-mono text-[10px] tracking-[0.1em] uppercase text-[var(--color-accent)] mt-px shrink-0">
        ::
      </span>
      <span>{text}</span>
    </div>
  )
}
