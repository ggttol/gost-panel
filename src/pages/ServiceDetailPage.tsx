import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useResource, type GostItem } from '@/lib/queries'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle, CardValue } from '@/components/ui/Card'
import { EditorJson } from '@/components/ui/EditorJson'
import { ResourceEditorDialog, type EditorMode } from '@/components/ResourceEditorDialog'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { STATE_LABEL_ZH, T } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export function ServiceDetailPage() {
  const { name = '' } = useParams<{ name: string }>()
  const navigate = useNavigate()
  const { data: item, isLoading, error, refetch, isFetching } = useResource('services', name || undefined)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null)
  const [delOpen, setDelOpen] = useState(false)

  function openEdit() {
    if (!item) return
    setEditorMode({ kind: 'edit', key: 'services', original: item })
    setEditorOpen(true)
  }

  if (!name) return <Navigate to="/r/services" replace />

  if (isLoading) {
    return <div className="h-64 border border-[var(--color-border)] rounded-lg animate-pulse bg-[var(--color-surface)]/40" />
  }
  if (error || !item) {
    return (
      <div className="border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[var(--color-danger-soft)] text-[var(--color-danger)] rounded-lg p-4">
        <div className="eyebrow mb-1">{T.resource.requestFailed}</div>
        <code className="text-[12px] font-mono">
          {error instanceof Error ? error.message : '未知错误'}
        </code>
      </div>
    )
  }

  const state = item.status?.state
  const createTime = item.status?.createTime
  const events = item.status?.events ?? []

  return (
    <div>
      <header className="mb-7 flex items-end justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <Link to="/r/services" className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--color-muted)] hover:text-[var(--color-accent)] transition-colors mb-3">
            <ArrowLeft size={11} /> 返回服务列表
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[28px] leading-none font-semibold tracking-tight">
              {item.name}
            </h1>
            {state ? (
              <Badge tone={stateTone(state)}>{STATE_LABEL_ZH[state] ?? state}</Badge>
            ) : null}
          </div>
          <p className="text-[12px] font-mono text-[var(--color-muted)] mt-2">
            GET /api/config/services/{item.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={13} className={cn(isFetching && 'animate-spin')} />
            {isFetching ? T.common.loading : T.common.refresh}
          </Button>
          <Button onClick={openEdit}>{T.common.edit}</Button>
          <Button variant="danger" onClick={() => setDelOpen(true)}>{T.common.delete}</Button>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Card variant="feature">
          <CardTitle>{T.service.address}</CardTitle>
          <CardValue>{String(item.addr ?? '—')}</CardValue>
        </Card>
        <Card>
          <CardTitle>{T.service.handler}</CardTitle>
          <CardValue>{String(handlerType(item) ?? '—')}</CardValue>
        </Card>
        <Card>
          <CardTitle>{T.service.listener}</CardTitle>
          <CardValue>{String(listenerType(item) ?? '—')}</CardValue>
        </Card>
        <Card>
          <CardTitle>{T.service.createdAt}</CardTitle>
          <div className="text-[15px] font-mono text-[var(--color-fg)] tabular">
            {createTime ? formatTime(createTime) : '—'}
          </div>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="eyebrow mb-3">{T.service.events}</h2>
        {events.length === 0 ? (
          <div className="border border-dashed border-[var(--color-border)] rounded-lg p-6 text-center text-[12px] text-[var(--color-muted)]">
            {T.service.noEvents}
          </div>
        ) : (
          <ol className="relative border-l-2 border-[var(--color-border)] ml-1 pl-5 space-y-3">
            {events.map((ev, i) => (
              <li key={i} className="relative">
                <span className="absolute left-[-23px] top-1 h-2 w-2 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-bg)]" />
                <div className="flex items-baseline gap-3">
                  <span className="text-[11px] font-mono tabular text-[var(--color-muted)] whitespace-nowrap">
                    {formatTime(ev.time)}
                  </span>
                  <span className="text-[13px] text-[var(--color-fg-2)]">{ev.msg}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h2 className="eyebrow mb-3">{T.service.fields}</h2>
        <EditorJson value={JSON.stringify(stripStatus(item), null, 2)} readOnly height="40vh" />
      </section>

      <ResourceEditorDialog
        open={editorOpen}
        onOpenChange={(v) => {
          setEditorOpen(v)
          if (!v) refetch()
        }}
        mode={editorMode}
      />
      <DeleteConfirmDialog
        open={delOpen}
        onOpenChange={(v) => {
          setDelOpen(v)
          if (!v && !item) navigate('/r/services')
        }}
        resourceKey="services"
        name={item.name}
      />
    </div>
  )
}

function handlerType(item: GostItem): string | undefined {
  return (item.handler as { type?: string } | undefined)?.type
}
function listenerType(item: GostItem): string | undefined {
  return (item.listener as { type?: string } | undefined)?.type
}
function stripStatus(item: GostItem) {
  const { status: _s, ...rest } = item
  return rest
}
function stateTone(state: string): 'good' | 'bad' | 'warn' | 'neutral' {
  if (state === 'ready' || state === 'running') return 'good'
  if (state === 'failed' || state === 'closed') return 'bad'
  return 'warn'
}
function formatTime(epoch: number): string {
  const d = new Date(epoch * 1000)
  return d.toLocaleString('zh-CN', { hour12: false })
}
