import { useEffect, useRef, useState } from 'react'
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
const HISTORY = 60

type Point = { t: number; req: number; inBytes: number; outBytes: number }

export function MetricsPage() {
  const [paused, setPaused] = useState(false)
  const { data, isLoading, error, refetch, isFetching } = useMetrics(SAMPLE_INTERVAL_MS, !paused)

  const samplesRef = useRef<Point[]>([])
  const [, force] = useState(0)

  useEffect(() => {
    if (!data) return
    const next: Point = {
      t: Date.now(),
      req: sumBy(data, 'gost_service_requests_total'),
      inBytes: sumBy(data, 'gost_service_transport_input_bytes_total'),
      outBytes: sumBy(data, 'gost_service_transport_output_bytes_total'),
    }
    samplesRef.current = [...samplesRef.current, next].slice(-HISTORY)
    force((n) => n + 1)
  }, [data])

  return (
    <div>
      <header className="flex items-end justify-between mb-7 gap-6 flex-wrap">
        <div>
          <div className="eyebrow mb-2">/telemetry / metrics</div>
          <h1 className="text-[28px] leading-none font-semibold tracking-tight">{T.metrics.title}</h1>
          <p className="text-[12px] font-mono text-[var(--color-muted)] mt-2 flex items-center gap-2">
            <span>GET /metrics</span>
            <span>·</span>
            <span>采样 {SAMPLE_INTERVAL_MS / 1000}s</span>
            <span>·</span>
            <span className={cn(!paused ? 'text-[var(--color-accent)]' : 'text-[var(--color-warn)]')}>
              {paused ? '已暂停' : 'live'}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
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
        <Body samples={data} history={samplesRef.current} />
      )}
    </div>
  )
}

function Body({ samples, history }: { samples: MetricSample[]; history: Point[] }) {
  const totalReq    = sumBy(samples, 'gost_service_requests_total')
  const activeConns = sumBy(samples, 'gost_service_requests_in_flight')
  const handlerErr  = sumBy(samples, 'gost_service_handler_errors_total')
  const chainErr    = sumBy(samples, 'gost_chain_errors_total')
  const inBytes     = sumBy(samples, 'gost_service_transport_input_bytes_total')
  const outBytes    = sumBy(samples, 'gost_service_transport_output_bytes_total')

  const perService = groupSumByLabel(samples, 'gost_service_requests_total', 'service')

  return (
    <>
      <section className="grid grid-cols-12 gap-3 mb-8">
        {/* Feature: total requests dominates */}
        <div className="col-span-12 md:col-span-6">
          <Card variant="feature">
            <CardTitle>{T.metrics.serviceRequests}</CardTitle>
            <div className="flex items-baseline gap-3">
              <CardValue>{fmtInt(totalReq)}</CardValue>
              <span className="text-[11px] font-mono text-[var(--color-muted)] tabular">
                live · {history.length} 采样
              </span>
            </div>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-3"><Card><CardTitle>{T.metrics.activeConns}</CardTitle><CardValue>{fmtInt(activeConns)}</CardValue></Card></div>
        <div className="col-span-12 md:col-span-3"><Card><CardTitle>错误合计</CardTitle><CardValue>{fmtInt(handlerErr + chainErr)}</CardValue></Card></div>
        <div className="col-span-6 md:col-span-3"><Card><CardTitle>{T.metrics.inputBytes}</CardTitle><CardValue>{fmtBytes(inBytes)}</CardValue></Card></div>
        <div className="col-span-6 md:col-span-3"><Card><CardTitle>{T.metrics.outputBytes}</CardTitle><CardValue>{fmtBytes(outBytes)}</CardValue></Card></div>
        <div className="col-span-6 md:col-span-3"><Card><CardTitle>{T.metrics.handlerErrors}</CardTitle><CardValue>{fmtInt(handlerErr)}</CardValue></Card></div>
        <div className="col-span-6 md:col-span-3"><Card><CardTitle>{T.metrics.chainErrors}</CardTitle><CardValue>{fmtInt(chainErr)}</CardValue></Card></div>
      </section>

      <section className="mb-8">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="eyebrow">流量趋势</h2>
          <span className="text-[10px] font-mono text-[var(--color-muted)] tabular">
            in/out · 最近 {history.length * (SAMPLE_INTERVAL_MS / 1000)}s
          </span>
        </div>
        <div className="border border-[var(--color-border)] rounded-lg p-3 h-72 bg-[var(--color-surface)]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history.map((p) => ({ ...p, ts: new Date(p.t).toLocaleTimeString('zh-CN', { hour12: false }) }))}>
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
              <YAxis tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }} stroke="var(--color-muted)" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} tickFormatter={fmtBytes} width={60} />
              <Tooltip
                formatter={(v) => fmtBytes(Number(v))}
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
              <Area
                type="monotone"
                dataKey="inBytes"
                name="入向"
                stroke="var(--color-accent)"
                fill="url(#g-in)"
                strokeWidth={1.5}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="outBytes"
                name="出向"
                stroke="var(--color-fg-2)"
                fill="url(#g-out)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
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

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString()
}

function fmtBytes(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(Math.max(1, n)) / Math.log(1024)))
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
