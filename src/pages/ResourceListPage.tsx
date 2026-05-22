import { useState } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import { ChevronRight, Plus, RefreshCw, Copy, Trash2, ChefHat } from 'lucide-react'
import { toast } from 'sonner'
import { isResourceKey, RESOURCES, type ResourceKey } from '@/lib/resources'
import { useDeleteResource, useResourceList, type GostItem } from '@/lib/queries'
import { gostError } from '@/lib/api'
import { RESOURCE_LABEL_ZH, STATE_LABEL_ZH, T } from '@/lib/i18n'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  ResourceEditorDialog,
  type EditorMode,
} from '@/components/ResourceEditorDialog'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { ClientAccessCard } from '@/components/ClientAccessCard'
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
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const del = useDeleteResource(k)

  // 切换资源类型时清空多选 —— 避免「不同 key 下相同名字误中招」
  if (selected.size > 0 && data && !data.list.some((it) => selected.has(it.name))) {
    setSelected(new Set())
  }

  function openCreate() {
    setEditorMode({ kind: 'create', key: k })
    setEditorOpen(true)
  }
  function openEdit(item: GostItem) {
    setEditorMode({ kind: 'edit', key: k, original: item })
    setEditorOpen(true)
  }
  function openClone(item: GostItem) {
    // 把源资源剥掉 name/status，留下 body 当 preset；新名字默认 -copy 后缀
    const body: Record<string, unknown> = { ...item }
    delete body.name
    delete body.status
    const existing = new Set((data?.list ?? []).map((it) => it.name))
    let presetName = `${item.name}-copy`
    let i = 2
    while (existing.has(presetName)) presetName = `${item.name}-copy-${i++}`
    setEditorMode({ kind: 'create', key: k, presetBody: body, presetName })
    setEditorOpen(true)
  }
  function openDelete(name: string) {
    setDelName(name)
    setDelOpen(true)
  }
  function toggleSelect(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }
  function selectAll() {
    setSelected(new Set((data?.list ?? []).map((it) => it.name).filter(Boolean)))
  }
  function clearSelection() {
    setSelected(new Set())
  }
  async function bulkDelete() {
    const names = Array.from(selected)
    if (names.length === 0) return
    if (!confirm(`确认删除 ${names.length} 条「${label}」？\n\n${names.join(' · ')}\n\n该操作不可撤销。`)) return
    setBulkRunning(true)
    const failed: Array<{ name: string; msg: string }> = []
    for (const name of names) {
      try {
        await del.mutateAsync(name)
      } catch (e) {
        failed.push({ name, msg: gostError(e) })
      }
    }
    setBulkRunning(false)
    setSelected(new Set())
    if (failed.length === 0) {
      toast.success(`已删除 ${names.length} 条`)
    } else {
      toast.error(`${names.length - failed.length} 条成功，${failed.length} 条失败：${failed.map((f) => f.name).join(', ')}`)
    }
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

      {selected.size > 0 ? (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md border border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[12px]">
          <span className="font-medium">已选 {selected.size} 条</span>
          <span className="text-[var(--color-muted)] truncate flex-1 font-mono text-[11px]">
            {Array.from(selected).slice(0, 6).join(' · ')}{selected.size > 6 ? ' …' : ''}
          </span>
          <Button size="sm" variant="ghost" onClick={selectAll} disabled={!data || selected.size >= data.count}>
            全选
          </Button>
          <Button size="sm" variant="ghost" onClick={clearSelection}>
            取消
          </Button>
          <Button size="sm" variant="danger" onClick={bulkDelete} disabled={bulkRunning}>
            <Trash2 size={12} /> {bulkRunning ? '删除中…' : '删除选中'}
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <Skeleton />
      ) : error ? (
        <ErrorBox error={error} />
      ) : !data || data.count === 0 ? (
        <Empty label={label} resourceKey={k} onCreate={openCreate} />
      ) : (
        <ul className="reveal-stagger flex flex-col">
          {data.list.map((item, idx) => (
            <ItemRow
              key={item.name || `__${idx}`}
              index={idx}
              resourceKey={k}
              item={item}
              selected={selected.has(item.name)}
              onToggleSelect={() => toggleSelect(item.name)}
              onEdit={() => openEdit(item)}
              onClone={() => openClone(item)}
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
  selected,
  onToggleSelect,
  onEdit,
  onClone,
  onDelete,
}: {
  index: number
  resourceKey: ResourceKey
  item: GostItem
  selected: boolean
  onToggleSelect: () => void
  onEdit: () => void
  onClone: () => void
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
        selected && 'bg-[var(--color-accent-soft)]',
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 h-3.5 w-3.5 accent-[var(--color-accent)] cursor-pointer"
          aria-label={`选中 ${item.name}`}
        />
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
          <Button size="sm" variant="ghost" onClick={onClone} title="基于这一条新建">
            <Copy size={12} /> 克隆
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            {T.common.delete}
          </Button>
        </div>
      </div>
      {open ? (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-12 py-3">
          {resourceKey === 'services' ? (
            <>
              {/* 列表里直接告诉用户「这条服务客户端怎么连」，比扔一堆 JSON
                  有用得多。JSON 仍留在 details 里供排错。 */}
              <ClientAccessCard service={item} />
              <details className="text-[11px]">
                <summary className="cursor-pointer text-[var(--color-muted)] hover:text-[var(--color-fg)] select-none">
                  查看完整 JSON
                </summary>
                <pre className="mt-2 overflow-x-auto font-mono leading-relaxed text-[var(--color-fg-2)]">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </details>
            </>
          ) : (
            <pre className="text-[11px] overflow-x-auto font-mono leading-relaxed">
              {JSON.stringify(item, null, 2)}
            </pre>
          )}
        </div>
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
  if (key === 'ingresses') {
    const n = ((item as { rules?: unknown[] }).rules ?? []).length
    return `${n} 规则`
  }
  if (key === 'routers') {
    const n = ((item as { routes?: unknown[] }).routes ?? []).length
    return `${n} 路由`
  }
  if (key === 'observers' || key === 'sds') {
    const p = (item as { plugin?: { type?: string; addr?: string } }).plugin
    const type = p?.type ?? ''
    const addr = p?.addr ?? ''
    if (!type && !addr) return null
    const short = addr.length > 36 ? `${addr.slice(0, 34)}…` : addr
    return [type, short].filter(Boolean).join(' → ')
  }
  if (key === 'recorders') {
    type RecorderSink =
      | { file?: { path?: string } }
      | { tcp?: { addr?: string } }
      | { redis?: { addr?: string } }
      | { http?: { url?: string; addr?: string } }
      | { plugin?: { type?: string; addr?: string } }
    const r = item as RecorderSink
    if ('file' in r && r.file) return `→ file: ${r.file.path ?? ''}`
    if ('tcp' in r && r.tcp) return `→ tcp: ${r.tcp.addr ?? ''}`
    if ('redis' in r && r.redis) return `→ redis: ${r.redis.addr ?? ''}`
    if ('http' in r && r.http) return `→ http: ${r.http.url ?? r.http.addr ?? ''}`
    if ('plugin' in r && r.plugin) {
      const t = r.plugin.type ?? ''
      const a = r.plugin.addr ?? ''
      return `→ plugin ${t}: ${a}`
    }
    return null
  }
  if (key === 'limiters' || key === 'climiters' || key === 'rlimiters') {
    const n = ((item as { limits?: unknown[] }).limits ?? []).length
    return `${n} 条规则`
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

function Empty({
  label,
  resourceKey,
  onCreate,
}: {
  label: string
  resourceKey: ResourceKey
  onCreate: () => void
}) {
  // 菜谱里全部都是基于 services 的整套配方，所以只在 services / chains / hops /
  // bypasses / admissions / hosts / resolvers / limiters 这类「会被 service 引用的」
  // 资源页面才指向菜谱。telemetry 几个不引导，避免误导新手。
  const cookbookHelpful = new Set<ResourceKey>([
    'services', 'chains', 'hops', 'bypasses', 'admissions',
    'hosts', 'resolvers', 'limiters', 'climiters', 'rlimiters',
  ])
  return (
    <div className="border border-dashed border-[var(--color-border)] rounded-lg p-12 text-center">
      <div className="eyebrow mb-2">没有配置</div>
      <div className="text-[14px] text-[var(--color-fg-2)]">
        当前没有任何「{label}」配置。
      </div>
      <div className="text-[12px] text-[var(--color-muted)] mt-1">
        点右上角「{T.common.create}」开始第一条。
      </div>
      <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
        <Button variant="accent" size="sm" onClick={onCreate}>
          <Plus size={12} /> {T.common.create}
        </Button>
        {cookbookHelpful.has(resourceKey) ? (
          <Button asChild variant="secondary" size="sm">
            <Link to="/cookbook">
              <ChefHat size={12} /> 看场景菜谱
            </Link>
          </Button>
        ) : null}
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
