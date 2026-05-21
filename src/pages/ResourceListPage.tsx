import { useState } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import { ChevronRight, Plus, RefreshCw } from 'lucide-react'
import { isResourceKey, RESOURCES, type ResourceKey } from '@/lib/resources'
import { useResourceList, type GostItem } from '@/lib/queries'
import { RESOURCE_LABEL_ZH, STATE_LABEL_ZH, T } from '@/lib/i18n'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  ResourceEditorDialog,
  type EditorMode,
} from '@/components/ResourceEditorDialog'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { HelpBanner } from '@/components/ui/HelpBanner'
import { RESOURCE_INTRO } from '@/lib/help'
import { cn } from '@/lib/utils'

export function ResourceListPage() {
  const { key = '' } = useParams<{ key: string }>()
  if (!isResourceKey(key)) return <Navigate to="/r/services" replace />
  return <Inner k={key} />
}

function Inner({ k }: { k: ResourceKey }) {
  const def = RESOURCES.find((r) => r.key === k)!
  const label = RESOURCE_LABEL_ZH[k]
  const { data, isLoading, error, refetch, isFetching } = useResourceList(k)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null)
  const [delName, setDelName] = useState<string | null>(null)
  const [delOpen, setDelOpen] = useState(false)

  function openCreate() {
    setEditorMode({ kind: 'create', key: k })
    setEditorOpen(true)
  }
  function openEdit(item: GostItem) {
    setEditorMode({ kind: 'edit', key: k, original: item })
    setEditorOpen(true)
  }
  function openDelete(name: string) {
    setDelName(name)
    setDelOpen(true)
  }

  return (
    <div>
      <header className="flex items-end justify-between mb-7 gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="eyebrow mb-2">/{def.group.toLowerCase()} / {def.key}</div>
          <h1 className="text-[28px] leading-none font-semibold tracking-tight text-[var(--color-fg)]">
            {label}
          </h1>
          <p className="text-[12px] font-mono text-[var(--color-muted)] mt-2 flex items-center gap-2">
            <span>GET /api/config/{def.key}</span>
            {data ? (
              <>
                <span>·</span>
                <span className="tabular">{data.count} 条</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openCreate} variant="accent">
            <Plus size={14} strokeWidth={2} /> {T.common.create}
          </Button>
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={13} className={cn(isFetching && 'animate-spin')} strokeWidth={2} />
            {isFetching ? T.common.loading : T.common.refresh}
          </Button>
        </div>
      </header>

      <div className="mb-6">
        <HelpBanner intro={RESOURCE_INTRO[k]} resourceKey={k} />
      </div>

      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data || data.count === 0 ? (
        <Empty label={label} />
      ) : (
        <ul className="reveal-stagger flex flex-col">
          {data.list.map((item, idx) => (
            <ItemRow
              key={item.name}
              index={idx}
              resourceKey={k}
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => openDelete(item.name)}
            />
          ))}
        </ul>
      )}

      <ResourceEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editorMode}
      />
      <DeleteConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        resourceKey={k}
        name={delName}
      />
    </div>
  )
}

function ItemRow({
  index,
  resourceKey,
  item,
  onEdit,
  onDelete,
}: {
  index: number
  resourceKey: ResourceKey
  item: GostItem
  onEdit: () => void
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  const state = item.status?.state
  const subtitle = describe(resourceKey, item)
  return (
    <li
      className={cn(
        'group border-b border-[var(--color-border)] last:border-b-0',
        'hover:bg-[var(--color-surface-2)] transition-colors duration-100',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-3 min-w-0 text-left flex-1 -mx-1 px-1"
          aria-expanded={open}
        >
          <span className="font-mono text-[10px] tabular text-[var(--color-muted)] w-6 shrink-0">
            {String(index + 1).padStart(2, '0')}
          </span>
          <ChevronRight
            size={14}
            strokeWidth={2}
            className={cn(
              'shrink-0 text-[var(--color-muted)] transition-transform duration-150',
              open && 'rotate-90 text-[var(--color-accent)]',
            )}
          />
          <span className="text-[13px] font-medium tracking-tight truncate">{item.name}</span>
          {subtitle ? (
            <span className="hidden md:inline-block font-mono text-[11px] text-[var(--color-muted)] truncate">
              {subtitle}
            </span>
          ) : null}
          {state ? (
            <Badge tone={stateTone(state)}>{STATE_LABEL_ZH[state] ?? state}</Badge>
          ) : null}
        </button>
        <div className="flex gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
          {resourceKey === 'services' ? (
            <Button asChild size="sm" variant="ghost">
              <Link to={`/r/services/${encodeURIComponent(item.name)}`}>{T.service.detail}</Link>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onEdit}>
            {T.common.edit}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            {T.common.delete}
          </Button>
        </div>
      </div>
      {open ? (
        <pre className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] text-[11px] px-12 py-3 overflow-x-auto font-mono leading-relaxed">
          {JSON.stringify(item, null, 2)}
        </pre>
      ) : null}
    </li>
  )
}

function describe(key: ResourceKey, item: GostItem): string | null {
  if (key === 'services') {
    const addr = (item as { addr?: string }).addr ?? ''
    const h = (item as { handler?: { type?: string } }).handler?.type ?? ''
    const l = (item as { listener?: { type?: string } }).listener?.type ?? ''
    return [addr, [h, l].filter(Boolean).join('/')].filter(Boolean).join(' · ')
  }
  if (key === 'authers') {
    const n = ((item as { auths?: unknown[] }).auths ?? []).length
    return `${n} 账号`
  }
  if (key === 'bypasses' || key === 'admissions') {
    const wl = (item as { whitelist?: boolean }).whitelist
    const n = ((item as { matchers?: unknown[] }).matchers ?? []).length
    return `${wl ? '白名单' : '黑名单'} · ${n} 规则`
  }
  if (key === 'hosts') {
    const n = ((item as { mappings?: unknown[] }).mappings ?? []).length
    return `${n} 映射`
  }
  if (key === 'resolvers') {
    const n = ((item as { nameservers?: unknown[] }).nameservers ?? []).length
    return `${n} 上游`
  }
  if (key === 'hops') {
    const n = ((item as { nodes?: unknown[] }).nodes ?? []).length
    return `${n} 节点`
  }
  if (key === 'chains') {
    const n = ((item as { hops?: unknown[] }).hops ?? []).length
    return `${n} 跳点`
  }
  return null
}

function stateTone(state: string): 'good' | 'bad' | 'warn' | 'neutral' {
  if (state === 'ready' || state === 'running') return 'good'
  if (state === 'failed' || state === 'closed') return 'bad'
  return 'warn'
}

function Skeleton() {
  return (
    <div className="flex flex-col">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-12 border-b border-[var(--color-border)] last:border-b-0 animate-pulse bg-[var(--color-surface)]/40"
        />
      ))}
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="border border-dashed border-[var(--color-border)] rounded-lg p-12 text-center">
      <div className="eyebrow mb-2">没有配置</div>
      <div className="text-[14px] text-[var(--color-fg-2)]">
        当前没有任何「{label}」配置。
      </div>
      <div className="text-[12px] text-[var(--color-muted)] mt-1">
        点右上角「{T.common.create}」开始第一条。
      </div>
    </div>
  )
}

function ErrorBox({ error }: { error: unknown }) {
  const msg = error instanceof Error ? error.message : String(error)
  return (
    <div className="border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[var(--color-danger-soft)] text-[var(--color-danger)] rounded-lg p-4">
      <div className="eyebrow mb-1">{T.resource.requestFailed}</div>
      <code className="text-[12px] font-mono">{msg}</code>
    </div>
  )
}
