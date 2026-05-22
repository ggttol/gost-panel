import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, Eraser, ArrowDownToLine, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useProfilesState } from '@/lib/profiles'
import { cn } from '@/lib/utils'

const BUFFER_OPTIONS = [
  { value: 1000, label: '1k' },
  { value: 5000, label: '5k' },
  { value: 20000, label: '20k' },
]

const LEVEL_CHIPS = [
  { value: 'error', label: 'error', tone: 'text-[var(--color-danger)]' },
  { value: 'warn',  label: 'warn',  tone: 'text-[var(--color-warn)]' },
  { value: 'info',  label: 'info',  tone: 'text-[var(--color-accent)]' },
  { value: 'debug', label: 'debug', tone: 'text-[var(--color-muted)]' },
]

function buildSseUrl(logfeedUrl: string | undefined, token: string | undefined): string | null {
  // In dev mode, route through Vite proxy when the user hasn't set an explicit
  // URL — keeps the convenient localhost setup. In prod, must be explicit.
  const base = (logfeedUrl ?? '').trim() || (import.meta.env.DEV ? '/proxy-logs' : '')
  if (!base) return null
  const url = `${base.replace(/\/+$/, '')}/stream`
  return token ? `${url}?t=${encodeURIComponent(token)}` : url
}

type Line = {
  /** Monotonic counter so React keys are unique even with identical lines. */
  id: number
  ts: number
  text: string
  /** Parsed level from gost JSON when present. Normalized: warning→warn, fatal→error, trace→debug. */
  level?: string
  /** Whether the original line was valid JSON. */
  json?: boolean
}

function normalizeLevel(raw?: string): string | undefined {
  if (!raw) return undefined
  const l = raw.toLowerCase()
  if (l === 'warning') return 'warn'
  if (l === 'fatal') return 'error'
  if (l === 'trace') return 'debug'
  return l
}

export function LogsPage() {
  const { profiles, activeId } = useProfilesState()
  const active = profiles.find((p) => p.id === activeId) ?? null
  const sseUrl = buildSseUrl(active?.logfeedUrl, active?.logfeedToken)

  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const [enabledLevels, setEnabledLevels] = useState<Set<string>>(new Set())
  const [bufferCap, setBufferCap] = useState(1000)
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(false)
  const [lines, setLines] = useState<Line[]>([])

  // Refs so the EventSource handler doesn't re-create on every state change.
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const bufferCapRef = useRef(bufferCap)
  useEffect(() => { bufferCapRef.current = bufferCap }, [bufferCap])
  const counterRef = useRef(0)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Pending lines that accumulate between flushes — keeps a high-rate stream
  // from triggering one React render per line.
  const pendingRef = useRef<Line[]>([])

  useEffect(() => {
    // Reset feed state when switching profile / URL.
    setLines([])
    pendingRef.current = []
    setConnected(false)
    if (!sseUrl) return
    const es = new EventSource(sseUrl)
    es.onopen = () => setConnected(true)
    es.onerror = () => setConnected(false)
    es.onmessage = (ev) => {
      if (pausedRef.current) return
      const text = ev.data
      const parsed = tryJson(text)
      pendingRef.current.push({
        id: ++counterRef.current,
        ts: Date.now(),
        text,
        level: normalizeLevel(typeof parsed?.level === 'string' ? parsed.level : undefined),
        json: !!parsed,
      })
    }
    const flush = setInterval(() => {
      if (pendingRef.current.length === 0) return
      const incoming = pendingRef.current
      pendingRef.current = []
      setLines((prev) => {
        const cap = bufferCapRef.current
        const merged = prev.concat(incoming)
        return merged.length > cap ? merged.slice(merged.length - cap) : merged
      })
    }, 100)
    return () => {
      clearInterval(flush)
      es.close()
    }
  }, [sseUrl])

  useEffect(() => {
    if (!autoScroll || !bodyRef.current) return
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [lines, autoScroll])

  // Detect manual scroll-up → suspend autoscroll until user scrolls back to bottom.
  function onScroll() {
    const el = bodyRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    setAutoScroll(atBottom)
  }

  function clearAll() {
    setLines([])
  }
  function jumpToEnd() {
    setAutoScroll(true)
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }
  function toggleLevel(lv: string) {
    setEnabledLevels((prev) => {
      const next = new Set(prev)
      if (next.has(lv)) next.delete(lv)
      else next.add(lv)
      return next
    })
  }

  const filterLower = filter.trim().toLowerCase()
  const filtered = useMemo(() => {
    const levelActive = enabledLevels.size > 0
    return lines.filter((l) => {
      if (levelActive) {
        // unknown level (level == undefined) shows only when 'debug' is enabled
        const lv = l.level ?? 'debug'
        if (!enabledLevels.has(lv)) return false
      }
      if (filterLower && !l.text.toLowerCase().includes(filterLower)) return false
      return true
    })
  }, [lines, enabledLevels, filterLower])

  function downloadVisible() {
    const blob = new Blob(
      filtered.map((l) => `${formatTs(l.ts)} ${l.text}\n`),
      { type: 'text/plain;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.href = url
    a.download = `gost-logs-${stamp}.log`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <header className="flex items-end justify-between mb-7 gap-6 flex-wrap">
        <div>
          <div className="eyebrow mb-2">/telemetry / logs</div>
          <h1 className="text-[28px] leading-none font-semibold tracking-tight">日志</h1>
          <p className="text-[12px] font-mono text-[var(--color-muted)] mt-2 flex items-center gap-2">
            <span>{sseUrl ? `SSE ${maskQuery(sseUrl)}` : '未配置 logfeed'}</span>
            <span>·</span>
            <span className={connected ? 'text-[var(--color-accent)]' : 'text-[var(--color-warn)]'}>
              {connected ? 'streaming' : '断开中…'}
            </span>
            <span>·</span>
            <span>缓冲 {lines.length}/{bufferCap} 行</span>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setPaused((v) => !v)}>
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? '继续' : '暂停'}
          </Button>
          <Button onClick={clearAll} title="清空当前显示（仅清空浏览器侧）">
            <Eraser size={13} /> 清屏
          </Button>
          <Button onClick={jumpToEnd} disabled={autoScroll} title="回到底部并恢复自动滚动">
            <ArrowDownToLine size={13} /> 回到底部
          </Button>
          <Button onClick={downloadVisible} disabled={filtered.length === 0} title="把当前过滤后可见的行导出为 .log 文件">
            <Download size={13} /> 下载
          </Button>
        </div>
      </header>

      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="过滤关键字（区分大小写不严格，按文本子串）"
          className="flex-1 max-w-md min-w-[220px]"
        />
        <div className="flex items-center gap-1">
          {LEVEL_CHIPS.map((c) => {
            const active = enabledLevels.has(c.value)
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => toggleLevel(c.value)}
                className={cn(
                  'h-7 px-2 text-[10px] font-mono uppercase tracking-[0.1em] rounded-md border transition-colors',
                  active
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                  c.tone,
                )}
                title={active ? `仅显示 ${c.label}（再点取消）` : `添加 ${c.label} 到筛选`}
              >
                {c.label}
              </button>
            )
          })}
          {enabledLevels.size > 0 ? (
            <button
              type="button"
              onClick={() => setEnabledLevels(new Set())}
              className="text-[10px] text-[var(--color-muted)] hover:text-[var(--color-fg)] px-1.5"
              title="清除等级筛选"
            >
              ✕
            </button>
          ) : null}
        </div>
        <select
          value={bufferCap}
          onChange={(e) => {
            const cap = Number(e.target.value)
            setBufferCap(cap)
            // Shrink in-place when the user picks a smaller cap.
            setLines((prev) => (prev.length > cap ? prev.slice(prev.length - cap) : prev))
          }}
          className="h-7 px-2 text-[11px] font-mono rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer"
          title="浏览器侧保留的最大行数"
        >
          {BUFFER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>缓冲 {o.label}</option>
          ))}
        </select>
        {filter || enabledLevels.size > 0 ? (
          <span className="text-[11px] font-mono text-[var(--color-muted)]">
            {filtered.length} / {lines.length}
          </span>
        ) : null}
      </div>

      <div
        ref={bodyRef}
        onScroll={onScroll}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] font-mono text-[11.5px] leading-[1.55] h-[68vh] overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[12px] text-[var(--color-muted)] gap-1 px-4 text-center">
            {!sseUrl ? (
              <>
                <span className="text-[var(--color-fg-2)] font-medium">当前主机未配置日志边车</span>
                <span>在「主机连接」里填上 gost-logfeed 的 URL + token 后即可看日志。</span>
                <span className="text-[10px] opacity-70">部署边车看 README · 「日志边车」一节</span>
              </>
            ) : lines.length === 0 ? (
              connected ? <span>已连接，等待 gost 输出…（触发一些流量看效果）</span> : <span>正在连接日志流…</span>
            ) : (
              <span>当前筛选无匹配（共 {lines.length} 行）</span>
            )}
          </div>
        ) : (
          <ul>
            {filtered.map((l) => (
              <LogRow key={l.id} line={l} highlight={filterLower} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 text-[11px] text-[var(--color-muted)]">
        仅在浏览器内显示最近 {bufferCap} 行；关闭/刷新即清空。
      </div>
    </div>
  )
}

function LogRow({ line, highlight }: { line: Line; highlight: string }) {
  const tone = levelTone(line.level)
  const j = line.json ? tryJson(line.text) : null
  return (
    <li className="grid grid-cols-[78px_44px_1fr] items-baseline gap-2 px-3 py-[3px] border-b border-[var(--color-border)]/40 hover:bg-[var(--color-surface-2)]">
      <span className="text-[var(--color-muted)] tabular text-[10px]">
        {formatTs(line.ts)}
      </span>
      <span
        className={cn(
          'text-[9px] font-semibold uppercase tracking-[0.1em] tabular',
          tone,
        )}
      >
        {line.level ?? '·'}
      </span>
      <span className="break-words whitespace-pre-wrap">
        {j ? <Pretty obj={j} highlight={highlight} /> : <Hl text={line.text} q={highlight} />}
      </span>
    </li>
  )
}

function Pretty({ obj, highlight }: { obj: Record<string, unknown>; highlight: string }) {
  const { time: _t, level: _l, msg, ...rest } = obj as { time?: unknown; level?: unknown; msg?: unknown; [k: string]: unknown }
  return (
    <span>
      {typeof msg === 'string' ? (
        <span className="text-[var(--color-fg)]"><Hl text={msg} q={highlight} /></span>
      ) : null}
      {Object.keys(rest).length > 0 ? (
        <span className="text-[var(--color-muted)] ml-2">
          <Hl
            text={Object.entries(rest)
              .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
              .join(' ')}
            q={highlight}
          />
        </span>
      ) : null}
    </span>
  )
}

function Hl({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>
  const lower = text.toLowerCase()
  const out: React.ReactNode[] = []
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) {
      out.push(text.slice(i))
      break
    }
    if (idx > i) out.push(text.slice(i, idx))
    out.push(
      <mark
        key={idx}
        className="bg-[var(--color-accent-soft)] text-[var(--color-fg)] rounded-[2px] px-[1px]"
      >
        {text.slice(idx, idx + q.length)}
      </mark>,
    )
    i = idx + q.length
  }
  return <>{out}</>
}

function maskQuery(url: string): string {
  return url.replace(/([?&]t=)[^&]+/g, '$1***')
}

function tryJson(s: string): Record<string, unknown> | null {
  if (s.charAt(0) !== '{') return null
  try {
    const v = JSON.parse(s)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function levelTone(level?: string): string {
  switch (level) {
    case 'error':
      return 'text-[var(--color-danger)]'
    case 'warn':
      return 'text-[var(--color-warn)]'
    case 'info':
      return 'text-[var(--color-accent)]'
    case 'debug':
      return 'text-[var(--color-muted)]'
    default:
      return 'text-[var(--color-muted)]'
  }
}

function formatTs(epochMs: number): string {
  const d = new Date(epochMs)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}
