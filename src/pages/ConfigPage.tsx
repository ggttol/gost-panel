import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { useFullConfig, useReloadConfig } from '@/lib/queries'
import { api } from '@/lib/api'
import { RESOURCES, type ResourceKey } from '@/lib/resources'
import { Button } from '@/components/ui/Button'
import { EditorJson } from '@/components/ui/EditorJson'
import { EditorYaml } from '@/components/ui/EditorYaml'
import { Dialog, DialogClose } from '@/components/ui/Dialog.primitives'
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog'
import { Tabs, TabsContent } from '@/components/ui/Tabs.primitives'
import { TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Switch } from '@/components/ui/Form'
import { T } from '@/lib/i18n'
import { toast } from 'sonner'
import { RefreshCw, RotateCcw, Upload, Download, FileJson, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

type GostItem = { name?: string; [k: string]: unknown }

/** gost returns config either bare or wrapped in {code,msg,data}; normalize. */
function unwrapConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  if ('data' in r && r.data && typeof r.data === 'object' && ('code' in r || 'msg' in r)) {
    return r.data as Record<string, unknown>
  }
  return r
}

function downloadBlob(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function ConfigPage() {
  const { data, isLoading, error, refetch, isFetching } = useFullConfig()
  const reload = useReloadConfig()
  const [importOpen, setImportOpen] = useState(false)

  const unwrapped = useMemo(() => unwrapConfig(data), [data])
  const jsonText = useMemo(() => JSON.stringify(unwrapped, null, 2), [unwrapped])
  const yamlText = useMemo(() => {
    try { return stringifyYaml(unwrapped, { indent: 2, lineWidth: 0 }) }
    catch (e) { return `# YAML 序列化失败：${(e as Error).message}` }
  }, [unwrapped])

  async function doReload() {
    try {
      await reload.mutateAsync()
      toast.success(T.common.reloaded)
    } catch (e) {
      toast.error(`${T.resource.requestFailed}：${(e as Error).message}`)
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

  return (
    <div>
      <header className="flex items-end justify-between mb-7 gap-6 flex-wrap">
        <div>
          <div className="eyebrow mb-2">/global / config</div>
          <h1 className="text-[28px] leading-none font-semibold tracking-tight">{T.config.title}</h1>
          <p className="text-[12px] font-mono text-[var(--color-muted)] mt-2">GET /api/config</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setImportOpen(true)} title="从 YAML 文件 / 粘贴板批量导入资源">
            <Upload size={13} /> 导入
          </Button>
          <Button onClick={() => downloadBlob(jsonText, `gost-config-${stamp}.json`, 'application/json')} disabled={!data}>
            <Download size={13} /> 导出 JSON
          </Button>
          <Button onClick={() => downloadBlob(yamlText, `gost-config-${stamp}.yaml`, 'application/yaml')} disabled={!data}>
            <Download size={13} /> 导出 YAML
          </Button>
          <Button onClick={doReload} disabled={reload.isPending} title={T.config.reloadTooltip}>
            <RotateCcw size={13} className={cn(reload.isPending && 'animate-spin')} />
            {reload.isPending ? T.common.reloading : T.common.reload}
          </Button>
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={13} className={cn(isFetching && 'animate-spin')} />
            {isFetching ? T.common.loading : T.common.refresh}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="h-64 border border-[var(--color-border)] rounded-lg animate-pulse bg-[var(--color-surface)]/40" />
      ) : error ? (
        <div className="border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[var(--color-danger-soft)] text-[var(--color-danger)] rounded-lg p-4">
          <div className="eyebrow mb-1">{T.resource.requestFailed}</div>
          <code className="text-[12px] font-mono">
            {error instanceof Error ? error.message : String(error)}
          </code>
        </div>
      ) : (
        <Tabs defaultValue="json">
          <TabsList className="mb-3">
            <TabsTrigger value="json"><FileJson size={12} className="inline mr-1" />JSON</TabsTrigger>
            <TabsTrigger value="yaml"><FileText size={12} className="inline mr-1" />YAML</TabsTrigger>
          </TabsList>
          <TabsContent value="json">
            <EditorJson value={jsonText} readOnly height="68vh" />
          </TabsContent>
          <TabsContent value="yaml">
            <EditorYaml value={yamlText} readOnly height="68vh" />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <ImportDialog currentConfig={unwrapped} onClose={() => setImportOpen(false)} />
      </Dialog>
    </div>
  )
}

/* ───────────────────────── Import dialog ───────────────────────── */

type DiffSummary = {
  key: ResourceKey
  add: string[]
  update: string[]
  remove: string[]
  /** Number of items in the incoming list that have no `name` — silently
   *  unusable, we surface them so the user can fix the YAML. */
  nameless: number
}

function computeDiff(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>,
): DiffSummary[] {
  const out: DiffSummary[] = []
  for (const def of RESOURCES) {
    const cur = Array.isArray(current[def.key]) ? (current[def.key] as GostItem[]) : []
    const inc = Array.isArray(incoming[def.key]) ? (incoming[def.key] as GostItem[]) : []
    const curNames = new Set(cur.map((i) => i.name).filter(Boolean) as string[])
    const incNames = new Set(inc.map((i) => i.name).filter(Boolean) as string[])
    const nameless = inc.filter((i) => !i.name).length
    const add: string[] = []
    const update: string[] = []
    for (const n of incNames) {
      if (curNames.has(n)) update.push(n)
      else add.push(n)
    }
    const remove: string[] = []
    for (const n of curNames) {
      if (!incNames.has(n)) remove.push(n)
    }
    if (add.length || update.length || remove.length || nameless) {
      out.push({ key: def.key, add, update, remove, nameless })
    }
  }
  return out
}

type ApplyStatus = {
  total: number
  done: number
  failed: Array<{ key: string; name: string; error: string }>
  running: boolean
}

function ImportDialog({
  currentConfig,
  onClose,
}: {
  currentConfig: Record<string, unknown>
  onClose: () => void
}) {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [yamlText, setYamlText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)
  const [deleteMissing, setDeleteMissing] = useState(false)
  const [reloadAfter, setReloadAfter] = useState(false)
  const [applyStatus, setApplyStatus] = useState<ApplyStatus | null>(null)

  const diff = useMemo(
    () => (parsed ? computeDiff(currentConfig, parsed) : []),
    [parsed, currentConfig],
  )
  const namelessTotal = useMemo(
    () => diff.reduce((acc, d) => acc + d.nameless, 0),
    [diff],
  )

  // Auto-close on full success, give the user 1.5s to see the green check.
  useEffect(() => {
    if (!applyStatus) return
    if (applyStatus.running) return
    if (applyStatus.failed.length > 0) return
    const id = setTimeout(onClose, 1500)
    return () => clearTimeout(id)
  }, [applyStatus, onClose])

  function onFile(file: File) {
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      setYamlText(text)
      doParse(text)
    }
    reader.readAsText(file)
  }

  function doParse(text: string) {
    setParseError(null)
    setParsed(null)
    setApplyStatus(null)
    if (!text.trim()) {
      setParseError('内容为空')
      return
    }
    try {
      const obj = parseYaml(text)
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        setParseError('顶层必须是对象（resource key → 列表）')
        return
      }
      setParsed(obj as Record<string, unknown>)
    } catch (e) {
      setParseError((e as Error).message)
    }
  }

  async function applyImport() {
    if (!parsed) return
    // Build plan
    type Op =
      | { kind: 'put'; key: ResourceKey; name: string; body: GostItem }
      | { kind: 'post'; key: ResourceKey; body: GostItem }
      | { kind: 'delete'; key: ResourceKey; name: string }
    const ops: Op[] = []
    for (const d of diff) {
      const incList = Array.isArray(parsed[d.key]) ? (parsed[d.key] as GostItem[]) : []
      const byName = new Map(incList.filter((i) => i.name).map((i) => [i.name as string, i]))
      for (const n of d.update) {
        const body = byName.get(n)
        if (body) ops.push({ kind: 'put', key: d.key, name: n, body })
      }
      for (const n of d.add) {
        const body = byName.get(n)
        if (body) ops.push({ kind: 'post', key: d.key, body })
      }
      if (deleteMissing) {
        for (const n of d.remove) ops.push({ kind: 'delete', key: d.key, name: n })
      }
    }

    setApplyStatus({ total: ops.length, done: 0, failed: [], running: true })
    const failed: ApplyStatus['failed'] = []
    let done = 0
    for (const op of ops) {
      try {
        if (op.kind === 'put') {
          await api.put(`/config/${op.key}/${op.name}`, op.body)
        } else if (op.kind === 'post') {
          await api.post(`/config/${op.key}`, op.body)
        } else {
          await api.delete(`/config/${op.key}/${op.name}`)
        }
      } catch (e) {
        const err = e as { response?: { data?: { msg?: string } }; message?: string }
        const msg = err.response?.data?.msg || err.message || 'unknown'
        const name = op.kind === 'post' ? (op.body.name ?? '(unnamed)') : op.name
        failed.push({ key: op.key, name, error: msg })
      }
      done++
      setApplyStatus({ total: ops.length, done, failed: failed.slice(), running: true })
    }

    if (reloadAfter && failed.length === 0) {
      try { await api.post('/config/reload') } catch { /* non-fatal */ }
    }

    setApplyStatus({ total: ops.length, done, failed, running: false })
    qc.invalidateQueries()
    if (failed.length === 0) {
      toast.success(`导入完成：${done} 条都成功了`)
    } else {
      toast.error(`导入有 ${failed.length} 条失败，详见下方`)
    }
  }

  const totalCount = diff.reduce((acc, d) => acc + d.add.length + d.update.length + (deleteMissing ? d.remove.length : 0), 0)

  return (
    <DialogContent wide>
      <DialogHeader>
        <DialogTitle>导入配置</DialogTitle>
        <DialogDescription>
          粘贴或上传 YAML —— 解析后会列出"将创建 / 更新 / 删除"的资源，确认后再写入。
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto -mx-1 px-1">
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".yaml,.yml,.json,text/yaml,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
          <Button onClick={() => fileRef.current?.click()}>
            <Upload size={13} /> 选择文件
          </Button>
          <Button onClick={() => doParse(yamlText)} disabled={!yamlText.trim()}>
            解析并预览
          </Button>
          {parseError ? (
            <span className="text-[11px] font-mono text-[var(--color-danger)] truncate">
              {parseError}
            </span>
          ) : parsed ? (
            <span className="text-[11px] font-mono text-[var(--color-accent)]">
              解析成功
            </span>
          ) : null}
        </div>

        <EditorYaml value={yamlText} onChange={setYamlText} height="240px" />

        {parsed ? (
          <>
            <div className="border border-[var(--color-border)] rounded-md p-3 bg-[var(--color-surface)] text-[12px]">
              <div className="eyebrow mb-2">变更摘要</div>
              {diff.length === 0 ? (
                <div className="text-[var(--color-muted)]">与当前配置一致，无变更。</div>
              ) : (
                <ul className="space-y-1.5">
                  {diff.map((d) => (
                    <li key={d.key} className="flex items-baseline gap-3 font-mono text-[11.5px]">
                      <span className="w-24 shrink-0 text-[var(--color-fg-2)]">{d.key}</span>
                      {d.add.length > 0 ? (
                        <span className="text-[var(--color-accent)]">+{d.add.length}</span>
                      ) : null}
                      {d.update.length > 0 ? (
                        <span className="text-[var(--color-warn)]">~{d.update.length}</span>
                      ) : null}
                      {d.remove.length > 0 ? (
                        <span className={deleteMissing ? 'text-[var(--color-danger)]' : 'text-[var(--color-muted)] line-through'}>
                          −{d.remove.length}
                        </span>
                      ) : null}
                      {d.nameless > 0 ? (
                        <span className="text-[var(--color-warn)]">
                          ⚠ {d.nameless} 条无 name 已跳过
                        </span>
                      ) : null}
                      <span className="text-[var(--color-muted)] truncate min-w-0">
                        {[
                          d.add.length    ? `新增 ${d.add.join(', ')}`    : '',
                          d.update.length ? `更新 ${d.update.join(', ')}` : '',
                          d.remove.length ? `${deleteMissing ? '删除' : '保留'} ${d.remove.join(', ')}` : '',
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {namelessTotal > 0 ? (
              <div className="border border-[color-mix(in_oklab,var(--color-warn)_45%,transparent)] bg-[color-mix(in_oklab,var(--color-warn)_12%,transparent)] text-[var(--color-warn)] rounded-md p-3 text-[12px] leading-snug">
                <div className="eyebrow mb-1">无法导入：检测到 {namelessTotal} 条无 name 的资源</div>
                <div>
                  gost 用 name 作为资源主键。请在 YAML 里为每条资源补上 <code className="font-mono">name:</code> 字段后重新解析。
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Switch
                checked={deleteMissing}
                onChange={setDeleteMissing}
                label="也删除当前存在、但导入中没有的资源"
                hint="默认关闭，避免误删。开启后导入 = 全量同步"
              />
              <Switch
                checked={reloadAfter}
                onChange={setReloadAfter}
                label="导入完成后调用 /config/reload"
                hint="⚠️ 仅当 gost 配置文件已同步到磁盘时再勾选；否则 reload 会用磁盘旧版覆盖刚导入的资源。"
              />
            </div>

            {applyStatus ? (
              <div className="border border-[var(--color-border)] rounded-md p-3 bg-[var(--color-surface)] text-[12px]">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="eyebrow">写入进度</span>
                  <span className="font-mono text-[11px] tabular text-[var(--color-fg-2)]">
                    {applyStatus.done} / {applyStatus.total}
                    {applyStatus.running ? ' · 进行中…' : ' · 完成'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--color-accent)] transition-[width]"
                    style={{ width: `${applyStatus.total === 0 ? 0 : (applyStatus.done / applyStatus.total) * 100}%` }}
                  />
                </div>
                {applyStatus.failed.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-[11px] font-mono">
                    {applyStatus.failed.map((f, i) => (
                      <li key={i} className="text-[var(--color-danger)]">
                        {f.key}/{f.name}: {f.error}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button>关闭</Button>
        </DialogClose>
        <Button
          onClick={applyImport}
          disabled={!parsed || totalCount === 0 || namelessTotal > 0 || (applyStatus?.running ?? false)}
          title={namelessTotal > 0 ? '请先修正 YAML 中无 name 的资源' : undefined}
        >
          {applyStatus?.running ? '写入中…' : `应用 (${totalCount})`}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
