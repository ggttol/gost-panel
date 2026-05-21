import { useState } from 'react'
import { Copy, Check, Plug } from 'lucide-react'
import { buildClientHints, type ClientHint } from '@/lib/clientRecipes'
import type { GostItem } from '@/lib/queries'
import { cn } from '@/lib/utils'

export function ClientAccessCard({ service }: { service: GostItem }) {
  const hints = buildClientHints(service)
  if (hints.length === 0) return null

  return (
    <section className="mb-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <header className="px-4 py-2.5 border-b border-[var(--color-border)] flex items-center gap-2 bg-[color-mix(in_oklab,var(--color-accent-soft)_40%,transparent)]">
        <Plug size={13} strokeWidth={1.75} className="text-[var(--color-accent)]" />
        <span className="text-[13px] font-semibold tracking-tight">客户端怎么接</span>
        <span className="text-[10px] font-mono text-[var(--color-muted)] ml-auto">
          gost 没有"客户端 SDK" — 直接用现成工具就好
        </span>
      </header>
      <ul className="divide-y divide-[var(--color-border)]">
        {hints.map((h, i) => (
          <HintRow key={i} hint={h} />
        ))}
      </ul>
    </section>
  )
}

function HintRow({ hint }: { hint: ClientHint }) {
  const [copied, setCopied] = useState(false)
  const block = hint.block || /\n/.test(hint.code)

  function copy() {
    if (!hint.code) return
    navigator.clipboard.writeText(hint.code).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      },
      () => { /* ignore */ },
    )
  }

  return (
    <li className="px-4 py-3 flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12.5px] font-medium tracking-tight">{hint.title}</div>
          {hint.desc ? (
            <div className="text-[11px] text-[var(--color-muted)] mt-0.5 leading-relaxed">
              {hint.desc}
            </div>
          ) : null}
        </div>
        {hint.code ? (
          <button
            onClick={copy}
            className={cn(
              'shrink-0 h-7 px-2 text-[11px] rounded-md border transition-colors inline-flex items-center gap-1.5',
              copied
                ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-[var(--color-border)] text-[var(--color-fg-2)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]',
            )}
            title="复制"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? '已复制' : '复制'}
          </button>
        ) : null}
      </div>
      {hint.code ? (
        block ? (
          <pre className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[11.5px] font-mono p-2.5 leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {hint.code}
          </pre>
        ) : (
          <code className="block rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[11.5px] font-mono px-2.5 py-1.5 overflow-x-auto whitespace-nowrap">
            {hint.code}
          </code>
        )
      ) : null}
    </li>
  )
}
