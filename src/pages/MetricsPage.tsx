import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Pause, Play, RefreshCw } from 'lucide-react'
import { Card, CardTitle, CardValue } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { T } from '@/lib/i18n'
import { groupSumByLabel, sumBy, useMetrics, type MetricSample } from '@/lib/metrics'
import { cn } from '@/lib/utils'

const SAMPLE_INTERVAL_MS = 3000
const SAMPLE_INTERVAL_S = SAMPLE_INTERVAL_MS / 1000

const WINDOW_OPTIONS = [
  { value: 60,   label: '3 min'  },
  { value: 300,  label: '15 min' },
  { value: 1200, label: '60 min' },
]

type Point = {
  t: number
  /** cumulative counters at this sample */
  req: number
  inBytes: number
  outBytes: number
  handlerErr: number
  chainErr: number
  conns: number
}

export function MetricsPage() {
  const [paused, setPaused] = useState(false)
  const [windowSize, setWindowSize] = useState(60)
  const { data, isLoading, error, refetch, isFetching } = useMetrics(SAMPLE_INTERVAL_MS, !paused)

  // Ring buffer of cumulative samples. Capped at the largest window option
  // so toggling window only re-slices, doesn't lose history within bounds.
  const [samples, setSamples] = useState<Point[]>([])

  useEffect(() => {
    if (!data) return
    const next: Point = {
      t: Date.now(),
      req:        sumBy(data, 'gost_service_requests_total'),
      inBytes:    sumBy(data, 'gost_service_transport_input_bytes_total'),
      outBytes:   sumBy(data, 'gost_service_transport_output_bytes_total'),
      handlerErr: sumBy(data, 'gost_service_handler_errors_total'),
      chainErr:   sumBy(data, 'gost_chain_errors_total'),
      conns:      sumBy(data, 'gost_service_requests_in_flight'),
    }
    const cap = WINDOW_OPTIONS[WINDOW_OPTIONS.length - 1].value
    setSamples((prev) => [...prev, next].slice(-cap))
  }, [data])

  const sliced = useMemo(() => samples.slice(-windowSize), [samples, windowSize])

  return (
    <div>
      <header className="flex items-end justify-between mb-7 gap-6 flex-wrap">
        <div>
          <div className="eyebrow mb-2">/telemetry / metrics</div>
          <h1 className="text-[28px] leading-none font-semibold tracking-tight">{T.metrics.title}</h1>
          <p className="text-[12px] font-mono text-[var(--color-muted)] mt-2 flex items-center gap-2">
            <span>GET /metrics</span>
            <span>·</span>
            <span>采样 {SAMPLE_INTERVAL_S}s</span>
            <span>·</span>
            <span className={cn(!paused ? 'text-[var(--color-accent)]' : 'text-[var(--color-warn)]')}>
              {paused ? '已暂停' : 'live'}
            </span>
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <select
            value={windowSize}
            onChange={(e) => setWindowSize(Number(e.target.value))}
            className="h-8 px-2 text-[12px] font-mono rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer"
            title="历史窗口大小"
          >
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>窗口 {o.label}</option>
            ))}
          </select>
          <Button onClick={() => setPaused((v) => !v)}>
            {paused ? <Play size={13} /> : <Pause size={13} />}
            {paused ? T.metrics.resume : T.metrics.pause}
          </Button>
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={13} className={cn(isFetching && 'animate-spin')} />
            {isFetching ? T.common.loading : T.common.refresh}
          </Button>
        </div>
      </header>

      {isLoading && !data ? (
        <div className="h-64 border border-[var(--color-border)] rounded-lg animate-pulse bg-[var(--color-surface)]/40" />
      ) : error || !data ? (
        <div className="border border-dashed border-[var(--color-border)] rounded-lg p-12 text-center">
          <div className="eyebrow mb-2">无数据</div>
          <div className="text-[14px] text-[var(--color-fg-2)]">{T.metrics.noData}</div>
          {error ? (
            <code className="block mt-3 text-[11px] font-mono text-[var(--color-danger)]">
              {(error as Error).message}
            </code>
          ) : null}
        </div>
      ) : (
        <Body samples={data} history={sliced} />
      )}
    </div>
  )
}

/** Diff a cumulative series into per-second rates. Clamps negatives to 0 to
 *  hide counter resets (gost restart) as a single zero, not a huge spike. */
function ratesOf(history: Point[], key: keyof Omit<Point, 't'>): number[] {
  if (history.length < 2) return []
  const out: number[] = []
  for (let i = 1; i < history.length; i++) {
    const dt = (history[i].t - history[i - 1].t) / 1000 || SAMPLE_INTERVAL_S
    const dv = (history[i][key] as number) - (history[i - 1][key] as number)
    out.push(dv > 0 ? dv / dt : 0)
  }
  return out
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.length > n ? arr.slice(arr.length - n) : arr
}

function Body({ samples, history }: { samples: MetricSample[]; history: Point[] }) {
  const totalReq    = sumBy(samples, 'gost_service_requests_total')
  const activeConns = sumBy(samples, 'gost_service_requests_in_flight')
  const handlerErr  = sumBy(samples, 'gost_service_handler_errors_total')
  const chainErr    = sumBy(samples, 'gost_chain_errors_total')

  const reqRates    = ratesOf(history, 'req')
  const inRates     = ratesOf(history, 'inBytes')
  const outRates    = ratesOf(history, 'outBytes')
  const errRates    = ratesOf(history, 'handlerErr').map((v, i) => v + (ratesOf(history, 'chainErr')[i] ?? 0))
  const connsSeries = history.map((p) => p.conns)

  const reqRateNow = reqRates.at(-1) ?? 0
  const inRateNow  = inRates.at(-1) ?? 0
  const outRateNow = outRates.at(-1) ?? 0
  const errRateNow = errRates.at(-1) ?? 0

  // Chart series: per-second rate of in/out bytes, aligned to history[1:].
  const chartData = history.slice(1).map((p, i) => ({
    t: p.t,
    ts: new Date(p.t).toLocaleTimeString('zh-CN', { hour12: false }),
    inRate:  inRates[i]  ?? 0,
    outRate: outRates[i] ?? 0,
  }))

  const perService = groupSumByLabel(samples, 'gost_service_requests_total', 'service')
  const windowSeconds = history.length * SAMPLE_INTERVAL_S

  return (
    <>
      <section className="grid grid-cols-12 gap-3 mb-8">
        <div className="col-span-12 md:col-span-6">
          <Card variant="feature">
            <CardTitle>{T.metrics.serviceRequests}</CardTitle>
            <div className="flex items-baseline gap-3 mb-2">
              <CardValue>{fmtInt(totalReq)}</CardValue>
              <span className="text-[12px] font-mono text-[var(--color-fg-2)] tabular">
                + {fmtRate(reqRateNow)} /s
              </span>
              <span className="text-[10px] font-mono text-[var(--color-muted)] tabular ml-auto">
                {history.length} 采样 · {fmtDuration(windowSeconds)}
              </span>
            </div>
            <Sparkline series={reqRates} height={28} stroke="var(--color-accent)" />
          </Card>
        </div>
        <KpiCard label={T.metrics.activeConns} value={fmtInt(activeConns)} series={lastN(connsSeries, 60)} />
        <KpiCard label="错误合计 /s" value={fmtRate(errRateNow)} series={lastN(errRates, 60)} accent="danger" />
        <KpiCard label="入向 /s" value={fmtBytes(inRateNow) + '/s'} series={lastN(inRates, 60)} />
        <KpiCard label="出向 /s" value={fmtBytes(outRateNow) + '/s'} series={lastN(outRates, 60)} muted />
        <KpiCard label={T.metrics.handlerErrors} value={fmtInt(handlerErr)} series={lastN(ratesOf(history, 'handlerErr'), 60)} accent="danger" />
        <KpiCard label={T.metrics.chainErrors} value={fmtInt(chainErr)} series={lastN(ratesOf(history, 'chainErr'), 60)} accent="danger" />
      </section>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="eyebrow">流量速率</h2>
          <span className="text-[10px] font-mono text-[var(--color-muted)] tabular">
            B/s · 最近 {fmtDuration(windowSeconds)}
          </span>
        </div>
        <div className="border border-[var(--color-border)] rounded-lg p-3 h-72 bg-[var(--color-surface)]">
          {chartData.length < 2 ? (
            <div className="h-full flex items-center justify-center text-[12px] text-[var(--color-muted)]">
              正在累积采样…（至少需要 2 次采样才能算速率）
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="g-in" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-out" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-fg-2)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="var(--color-fg-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 3" vertical={false} />
                <XAxis dataKey="ts" tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} stroke="var(--color-muted)" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} />
                <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} stroke="var(--color-muted)" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} tickFormatter={(v) => `${fmtBytes(v)}/s`} width={70} />
                <Tooltip
                  formatter={(v) => `${fmtBytes(Number(v))}/s`}
                  contentStyle={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 6,
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-fg)',
                  }}
                  cursor={{ stroke: 'var(--color-border-strong)' }}
                />
                <Area type="monotone" dataKey="inRate"  name="入向"  stroke="var(--color-accent)" fill="url(#g-in)"  strokeWidth={1.5} isAnimationActive={false} />
                <Area type="monotone" dataKey="outRate" name="出向"  stroke="var(--color-fg-2)"  fill="url(#g-out)" strokeWidth={1.5} strokeDasharray="3 3" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {perService.length > 0 ? (
        <section>
          <h2 className="eyebrow mb-3">按服务的请求计数</h2>
          <ul className="border border-[var(--color-border)] rounded-lg overflow-hidden">
            {perService.slice(0, 12).map((r, i) => (
              <li
                key={r.key}
                className={cn(
                  'flex items-center justify-between px-4 py-2 text-[13px] hover:bg-[var(--color-surface-2)] transition-colors',
                  i !== 0 && 'border-t border-[var(--color-border)]',
                )}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="font-mono text-[10px] tabular text-[var(--color-muted)] w-6">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-medium truncate">{r.key}</span>
                </span>
                <span className="font-mono tabular text-[var(--color-fg-2)]">{fmtInt(r.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  )
}

function KpiCard({
  label,
  value,
  series,
  accent,
  muted,
}: {
  label: string
  value: string
  series: number[]
  accent?: 'danger'
  muted?: boolean
}) {
  const stroke = accent === 'danger'
    ? 'var(--color-danger)'
    : muted
      ? 'var(--color-fg-2)'
      : 'var(--color-accent)'
  return (
    <div className="col-span-6 md:col-span-3">
      <Card>
        <CardTitle>{label}</CardTitle>
        <CardValue>{value}</CardValue>
        <div className="mt-2 h-6">
          <Sparkline series={series} height={24} stroke={stroke} />
        </div>
      </Card>
    </div>
  )
}

/** Tiny inline-SVG line chart. No deps, no axes; only the shape. */
function Sparkline({
  series,
  height,
  stroke,
}: {
  series: number[]
  height: number
  stroke: string
}) {
  if (series.length < 2) {
    return <div className="h-full text-[10px] font-mono text-[var(--color-muted)] flex items-end">—</div>
  }
  const w = 100 // viewBox width — SVG scales to container
  const h = height
  const max = Math.max(...series, 1)
  const step = w / (series.length - 1)
  const points = series.map((v, i) => {
    const x = i * step
    const y = h - (v / max) * (h - 2) - 1
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })
  const path = `M${points.join(' L')}`
  const area = `${path} L${w},${h} L0,${h} Z`
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="w-full h-full block"
      aria-hidden
    >
      <path d={area} fill={stroke} opacity={0.12} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString()
}

function fmtRate(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  if (n < 1) return n.toFixed(2)
  if (n < 100) return n.toFixed(1)
  return Math.round(n).toLocaleString()
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(Math.max(1, n)) / Math.log(1024)))
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${(seconds / 3600).toFixed(1)}h`
}
