import { SERVICE_SCENARIOS, type ServiceScenario } from '@/lib/help'

export function ScenarioPicker({
  onPick,
}: {
  onPick: (s: ServiceScenario) => void
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-2)_50%,transparent)]">
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
        <span className="eyebrow">快速搭建 · 一键套用</span>
        <span className="text-[11px] text-[var(--color-muted)]">端口已错开，可连续套多个</span>
      </div>
      <div className="p-3 flex flex-wrap gap-1.5">
        {SERVICE_SCENARIOS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onPick(s)}
            title={`${s.summary}\n\n名称: ${s.name}`}
            className="group text-[12px] h-7 px-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-fg-2)] hover:text-[var(--color-fg)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] transition-colors tracking-tight"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}
