import { useState } from 'react'
import { Copy, Check, Terminal } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Render the one-liner install command that bootstraps gost + gost-logfeed
 * on a target host. PANEL_URL is derived from `window.location.origin` so
 * the command is correct regardless of where the panel itself is deployed.
 *
 * The host that runs this command must be able to reach the panel URL —
 * that's the whole point: panel becomes the binary mirror, so the gost host
 * doesn't need GitHub access.
 */
export function InstallCommand({ compact = false }: { compact?: boolean }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://panel'
  // 显式把 PANEL_URL 灌进 env：prod 静态构建里 install.sh 自带的 __PANEL_URL__ 占位
  // 不会被替换，必须靠这里的 env 覆盖。
  const cmd = `curl -fsSL ${origin}/install.sh | sudo PANEL_URL=${origin} bash`
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  return (
    <div className={cn(
      'rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden',
      compact ? '' : 'mb-2',
    )}>
      <div className="px-3 py-1.5 flex items-center gap-2 border-b border-[var(--color-border)] bg-[color-mix(in_oklab,var(--color-surface-2)_60%,transparent)]">
        <Terminal size={12} className="text-[var(--color-accent)]" strokeWidth={1.75} />
        <span className="eyebrow flex-1">在主机上以 root 执行</span>
        <button
          type="button"
          onClick={copy}
          className={cn(
            'h-6 px-1.5 inline-flex items-center gap-1 text-[10px] rounded border transition-colors',
            copied
              ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-soft)]'
              : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]',
          )}
          title="复制"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <code className="block px-3 py-2 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre text-[var(--color-fg)]">
        {cmd}
      </code>
      {!compact ? (
        <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-muted)] leading-snug">
          脚本会装 gost、生成随机 API 密码、启 systemd、装 logfeed 边车，最后打印一条 <code className="font-mono">gost-panel://...</code> 链接 — 粘回此对话框上方即可。
        </div>
      ) : null}
    </div>
  )
}
