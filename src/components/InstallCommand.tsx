import { useEffect, useMemo, useState } from 'react'
import { Copy, Check, Terminal, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

const LOOPBACK = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0|\[::1\]|\[::\])$/i
const STORAGE_KEY = 'gost-panel:install-host'

/**
 * Render the one-liner install command that bootstraps gost + gost-logfeed
 * on a target host.
 *
 * 这里特别处理一个坑：浏览器里访问 panel 时 window.location.origin 经常是
 * loopback（localhost / 127.0.0.1），目标主机肯定连不到。所以把 host 拎出来
 * 做成可编辑输入；只在不是 loopback 时才默认拿来当 PANEL_URL。
 */
export function InstallCommand({ compact = false }: { compact?: boolean }) {
  const browser = typeof window !== 'undefined'
  const protocol = browser ? window.location.protocol : 'http:'
  const port = browser ? window.location.port : ''
  const currentHost = browser ? window.location.hostname : ''
  const browserHostPort = browser ? window.location.host : 'panel'
  const browserIsLoopback = LOOPBACK.test(currentHost)

  // 优先级：用户上次手填 > 浏览器 origin 非 loopback > 空让用户填
  const [hostInput, setHostInput] = useState(() => {
    if (!browser) return ''
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return saved
    if (!browserIsLoopback) return browserHostPort
    return ''
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (browser && hostInput) localStorage.setItem(STORAGE_KEY, hostInput)
  }, [browser, hostInput])

  const { cmd, ready, panelUrl } = useMemo(() => {
    const raw = hostInput.trim()
    if (!raw) return { cmd: '', ready: false, panelUrl: '' }
    // 用户也许只填了 host（不带 :port），如果浏览器当前有 port 就补上；
    // 用户也许填了完整 URL，宽容处理。
    let url = raw
    if (!/^https?:\/\//i.test(url)) {
      const hasPort = /:\d+/.test(url)
      url = `${protocol}//${url}${!hasPort && port ? `:${port}` : ''}`
    }
    url = url.replace(/\/+$/, '')
    const c = `curl -fsSL ${url}/install.sh | sudo PANEL_URL=${url} bash`
    return { cmd: c, ready: true, panelUrl: url }
  }, [hostInput, port, protocol])

  function copy() {
    if (!cmd) return
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
        <span className="eyebrow flex-1">在目标主机上以 root 执行</span>
        <button
          type="button"
          onClick={copy}
          disabled={!ready}
          className={cn(
            'h-6 px-1.5 inline-flex items-center gap-1 text-[10px] rounded border transition-colors',
            !ready
              ? 'border-[var(--color-border)] text-[var(--color-muted)] opacity-50 cursor-not-allowed'
              : copied
                ? 'border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                : 'border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]',
          )}
          title={ready ? '复制' : '先填面板地址'}
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>

      <div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--color-border)]">
        <span className="text-[10px] font-mono text-[var(--color-muted)] shrink-0">面板地址</span>
        <input
          value={hostInput}
          onChange={(e) => setHostInput(e.target.value)}
          placeholder={browserIsLoopback ? '192.168.x.x:5273 或 gost.example.com' : browserHostPort}
          spellCheck={false}
          autoComplete="off"
          className="h-7 flex-1 px-2 text-[12px] font-mono rounded border border-[var(--color-border)] bg-[var(--color-surface)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
        />
      </div>

      {browserIsLoopback ? (
        <div className="px-3 py-1.5 border-b border-[var(--color-border)] flex items-start gap-1.5 text-[10.5px] leading-snug text-[var(--color-warn)] bg-[var(--color-warn-soft)]">
          <AlertTriangle size={11} className="mt-px shrink-0" />
          <span>
            浏览器现在访问的是 <code className="font-mono">{currentHost}</code>，目标主机肯定连不到。
            填一个目标主机能访问的 IP / 域名（本机查：<code className="font-mono">ip -4 a</code> 或 <code className="font-mono">hostname -I</code>）。
          </span>
        </div>
      ) : null}

      <code className={cn(
        'block px-3 py-2 text-[11px] font-mono leading-relaxed overflow-x-auto whitespace-pre',
        ready ? 'text-[var(--color-fg)]' : 'text-[var(--color-muted)] italic',
      )}>
        {ready ? cmd : '在上方填面板地址后命令会显示在这里'}
      </code>

      {!compact ? (
        <div className="px-3 py-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-muted)] leading-snug">
          脚本会装 gost、生成随机 API 密码、启 systemd、装 logfeed 边车，最后打印一条 <code className="font-mono">gost-panel://...</code> 链接 — 粘回此对话框上方即可。
          目标主机无 github 访问？先在面板这边跑 <code className="font-mono">pnpm fetch-binaries</code>，脚本会自动用 <code className="font-mono">{panelUrl || '<面板>'}/dl/</code> 拉 gost。
        </div>
      ) : null}
    </div>
  )
}
