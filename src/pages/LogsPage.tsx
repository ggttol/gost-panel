import { useEffect, useRef, useState } from 'react'
import { Pause, Play, Eraser, ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useProfilesState } from '@/lib/profiles'
import { cn } from '@/lib/utils'

const BUFFER_CAP = 1000

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
  /** Parsed level from gost JSON when present. */
  level?: string
  /** Whether the original line was valid JSON. */
  json?: boolean
}

export function LogsPage() {
  const { profiles, activeId } = useProfilesState()
  const active = profiles.find((p) => p.id === activeId) ?? null
  const sseUrl = buildSseUrl(active?.logfeedUrl, active?.logfeedToken)

  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [connected, setConnected] = useState(false)
  const [lines, setLines] = useState<Line[]>([])

  // Refs so the EventSource handler doesn't re-create on every state change.
  const pausedRef = useRef(paused)
  pausedRef.current = paused
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
        level: typeof parsed?.level === 'string' ? parsed.level : undefined,
        json: !!parsed,
      })
    }
    const flush = setInterval(() => {
      if (pendingRef.current.length === 0) return
      const incoming = pendingRef.current
      pendingRef.current = []
      setLines((prev) => {
        const merged = prev.concat(incoming)
        return merged.length > BUFFER_CAP
          ? merged.slice(merged.length - BUFFER_CAP)
          : merged
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

  const filtered = filter
    ? lines.filter((l) => l.text.toLowerCase().includes(filter.toLowerCase()))
    : lines

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
            <span>缓冲 {lines.length}/{BUFFER_CAP} 行</span>
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </header>

      <div className="mb-3 flex items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="过滤（区分大小写不严格，按文本子串）"
          className="flex-1 max-w-md"
        />
        {filter ? (
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
            ) : connected ? (
              <span>已连接，等待 gost 输出…（触发一些流量看效果）</span>
            ) : (
              <span>正在连接日志流…</span>
            )}
          </div>
        ) : (
          <ul>
            {filtered.map((l) => (
              <LogRow key={l.id} line={l} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 text-[11px] text-[var(--color-muted)]">
        仅在浏览器内显示最近 {BUFFER_CAP} 行；关闭/刷新即清空。
      </div>
    </div>
  )
}

function LogRow({ line }: { line: Line }) {
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
        {j ? <Pretty obj={j} /> : line.text}
      </span>
    </li>
  )
}

function Pretty({ obj }: { obj: Record<string, unknown> }) {
  const { time: _t, level: _l, msg, ...rest } = obj as { time?: unknown; level?: unknown; msg?: unknown; [k: string]: unknown }
  return (
    <span>
      {typeof msg === 'string' ? <span className="text-[var(--color-fg)]">{msg}</span> : null}
      {Object.keys(rest).length > 0 ? (
        <span className="text-[var(--color-muted)] ml-2">
          {Object.entries(rest)
            .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
            .join(' ')}
        </span>
      ) : null}
    </span>
  )
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
    case 'fatal':
      return 'text-[var(--color-danger)]'
    case 'warn':
    case 'warning':
      return 'text-[var(--color-warn)]'
    case 'info':
      return 'text-[var(--color-accent)]'
    case 'debug':
    case 'trace':
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
