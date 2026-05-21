import type { ResourceIntro } from '@/lib/help'
import { docUrlFor } from '@/lib/help'
import type { ResourceKey } from '@/lib/resources'

export function HelpBanner({
  intro,
  resourceKey,
}: {
  intro: ResourceIntro
  resourceKey: ResourceKey
}) {
  const href = docUrlFor(resourceKey)
  return (
    <aside className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-[var(--color-accent)] to-transparent opacity-70"
      />
      <div className="p-4 space-y-2.5 text-[12.5px] leading-relaxed text-[var(--color-fg-2)]">
        <Line label="是什么">{intro.what}</Line>
        <Line label="何时建">{intro.when}</Line>
        {intro.relate ? <Line label="关联">{intro.relate}</Line> : null}
        {intro.shape ? <Line label="结构">{intro.shape}</Line> : null}
      </div>
      <div className="border-t border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-2)_55%,transparent)] px-4 py-2 flex items-center justify-between">
        <span className="eyebrow truncate">官方文档 · {new URL(href).pathname}</span>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-[11px] text-[var(--color-accent)] hover:underline tracking-tight"
        >
          打开 ↗
        </a>
      </div>
    </aside>
  )
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[64px_1fr] gap-x-3 items-baseline">
      <span className="eyebrow">{label}</span>
      <span>{children}</span>
    </div>
  )
}
