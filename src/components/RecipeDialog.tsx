import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { PasswordField } from '@/components/ui/PasswordField'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Dialog, DialogClose } from '@/components/ui/Dialog.primitives'
import { Button } from '@/components/ui/Button'
import { FormSection, FieldRow, TextField } from '@/components/ui/Form'
import { TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Tabs, TabsContent } from '@/components/ui/Tabs.primitives'
import { EditorJson } from '@/components/ui/EditorJson'
import { api, gostError, type ListResponse } from '@/lib/api'
import { getActiveProfile } from '@/lib/profiles'
import { defaultVars, substitute, type Recipe, type RecipeVar, type VarMap } from '@/lib/cookbook'
import { RESOURCE_LABEL_ZH } from '@/lib/i18n'
import type { ResourceKey } from '@/lib/resources'
import { pruneEmpty } from '@/lib/utils'

export function RecipeDialog({
  open,
  onOpenChange,
  recipe,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  recipe: Recipe | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {recipe ? <Body recipe={recipe} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  )
}

type ResolvedResource = {
  kind: ResourceKey
  name: string
  body: Record<string, unknown>
}

type CreatedResource = { kind: ResourceKey; name: string }

/**
 * Phase state machine.
 * - 'idle': initial; user can edit vars and click apply
 * - 'conflicts': pre-check found existing names; user picks rename / cancel
 * - 'high-impact': red-flag services detected; user must explicitly confirm
 * - 'running': posting to gost
 * - 'failed': one POST failed; show undo button for the already-created ones
 */
type Phase = 'idle' | 'conflicts' | 'high-impact' | 'running' | 'failed'

function Body({ recipe, onDone }: { recipe: Recipe; onDone: () => void }) {
  const profile = getActiveProfile()
  const host = profile ? safeHost(profile.apiBase) : 'host'
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [vars, setVars] = useState<VarMap>(() => defaultVars(recipe, host))
  const [phase, setPhase] = useState<Phase>('idle')
  const [log, setLog] = useState<string[]>([])
  const [createdSoFar, setCreatedSoFar] = useState<CreatedResource[]>([])
  // Resources to be created, possibly rewritten after a rename pass.
  const [pendingResolved, setPendingResolved] = useState<ResolvedResource[] | null>(null)
  // Conflicts discovered by the pre-check: list of original "kind:name" pairs.
  const [conflicts, setConflicts] = useState<Array<{ kind: ResourceKey; name: string }>>([])

  const resolved = useMemo<ResolvedResource[]>(
    () =>
      recipe.resources.map((r) => ({
        kind: r.kind,
        name: substitute(r.name, vars),
        body: substitute(r.body, vars),
      })),
    [recipe, vars],
  )

  const clientLines = useMemo(
    () => (recipe.client ?? []).map((s) => substitute(s, vars)),
    [recipe, vars],
  )
  const setupLines = useMemo(
    () => (recipe.setup ?? []).map((s) => substitute(s, vars)),
    [recipe, vars],
  )

  const running = phase === 'running'
  const formDisabled = phase !== 'idle'

  /** Step 1: pre-check name conflicts against gost's current config. */
  async function startApply() {
    setLog([])
    setCreatedSoFar([])
    setPendingResolved(null)
    setConflicts([])

    // Group required (kind → set of names) so we GET each /config/<kind> once.
    const wantedByKind = new Map<ResourceKey, Set<string>>()
    for (const r of resolved) {
      if (!r.name) continue
      const set = wantedByKind.get(r.kind) ?? new Set<string>()
      set.add(r.name)
      wantedByKind.set(r.kind, set)
    }

    const found: Array<{ kind: ResourceKey; name: string }> = []
    try {
      for (const [kind, names] of wantedByKind) {
        const { data } = await api.get<ListResponse<{ name: string }>>(`/config/${kind}`)
        const existing = new Set((data.data?.list ?? []).map((it) => it.name).filter(Boolean))
        for (const n of names) {
          if (existing.has(n)) found.push({ kind, name: n })
        }
      }
    } catch (e) {
      // If the pre-check itself failed, surface it and bail without touching anything.
      toast.error(`冲突预检失败：${errMsg(e)}`)
      return
    }

    if (found.length > 0) {
      setConflicts(found)
      setPhase('conflicts')
      return
    }

    proceedWithResolved(resolved)
  }

  /** Step 2: after conflicts cleared (or none), check for high-impact services. */
  function proceedWithResolved(target: ResolvedResource[]) {
    const flags = detectHighImpact(target)
    if (flags.length > 0) {
      setPendingResolved(target)
      setPhase('high-impact')
      return
    }
    doCreate(target)
  }

  /** Step 3: actually POST. Tracks createdSoFar in state for undo on failure. */
  async function doCreate(target: ResolvedResource[]) {
    setPhase('running')
    setLog([])
    setCreatedSoFar([])
    let firstService: string | null = null
    const created: CreatedResource[] = []
    for (const r of target) {
      const label = `${RESOURCE_LABEL_ZH[r.kind]}「${r.name}」`
      try {
        const cleanBody = pruneEmpty(r.body) ?? {}
        await api.post(`/config/${r.kind}`, { name: r.name, ...cleanBody })
        created.push({ kind: r.kind, name: r.name })
        setCreatedSoFar([...created])
        setLog((prev) => [...prev, `✓ 已创建 ${label}`])
        if (r.kind === 'services' && !firstService) firstService = r.name
      } catch (e) {
        const msg = errMsg(e)
        setLog((prev) => [...prev, `✗ ${label}: ${msg}`])
        setPhase('failed')
        toast.error(`配方失败：${label}\n${msg}`)
        return
      }
    }
    qc.invalidateQueries()
    setPhase('idle')
    toast.success(`已应用配方：${recipe.label}`)
    onDone()
    if (firstService) navigate(`/r/services/${encodeURIComponent(firstService)}`)
  }

  /** Undo the partial apply by DELETE-ing already-created resources in reverse. */
  async function undo() {
    setPhase('running')
    const reversed = [...createdSoFar].reverse()
    const remaining = [...createdSoFar]
    for (const r of reversed) {
      const label = `${RESOURCE_LABEL_ZH[r.kind]}「${r.name}」`
      try {
        await api.delete(`/config/${r.kind}/${r.name}`)
        setLog((prev) => [...prev, `↶ 已撤销 ${label}`])
        // Remove from createdSoFar so the button count stays accurate.
        const idx = remaining.findIndex((x) => x.kind === r.kind && x.name === r.name)
        if (idx >= 0) remaining.splice(idx, 1)
        setCreatedSoFar([...remaining])
      } catch (e) {
        setLog((prev) => [...prev, `✗ 撤销失败 ${label}: ${errMsg(e)}`])
      }
    }
    qc.invalidateQueries()
    setPhase('failed')
  }

  /** Auto-rename: walk conflicts and append -2/-3/... until each name is unique. */
  function applyAutoRename() {
    const conflictSet = new Set(conflicts.map((c) => `${c.kind}:${c.name}`))
    // Per-kind: union of (existing-from-server, names already chosen by this run).
    // We only have server-side info for conflicting names; that's enough because
    // the suffix walk only avoids THOSE — collisions with newly minted suffixes
    // within the same recipe are unlikely (recipe names are typically distinct).
    const usedByKind = new Map<ResourceKey, Set<string>>()
    for (const c of conflicts) {
      const set = usedByKind.get(c.kind) ?? new Set<string>()
      set.add(c.name)
      usedByKind.set(c.kind, set)
    }
    const renameMap = new Map<string, string>() // "kind:oldName" → newName

    for (const r of resolved) {
      if (!conflictSet.has(`${r.kind}:${r.name}`)) continue
      const used = usedByKind.get(r.kind) ?? new Set<string>()
      let n = 2
      let candidate = `${r.name}-${n}`
      while (used.has(candidate)) {
        n += 1
        candidate = `${r.name}-${n}`
      }
      used.add(candidate)
      usedByKind.set(r.kind, used)
      renameMap.set(`${r.kind}:${r.name}`, candidate)
    }

    // Build a rename-aware var snapshot to use as substitute() input,
    // so that body references to {{name}} stay consistent. We rebuild resources
    // directly: rewrite the chosen `name` and rewrite any string body field that
    // equals the old name to the new one (covers chain/hop/bypass cross-refs).
    const oldToNew: Record<string, string> = {}
    for (const [k, v] of renameMap) {
      const old = k.split(':').slice(1).join(':')
      oldToNew[old] = v
    }

    const rewriteString = (s: string): string => (oldToNew[s] ?? s)
    const rewrite = (value: unknown): unknown => {
      if (typeof value === 'string') return rewriteString(value)
      if (Array.isArray(value)) return value.map(rewrite)
      if (value && typeof value === 'object') {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          out[k] = rewrite(v)
        }
        return out
      }
      return value
    }

    const rewritten: ResolvedResource[] = resolved.map((r) => ({
      kind: r.kind,
      name: renameMap.get(`${r.kind}:${r.name}`) ?? r.name,
      body: rewrite(r.body) as Record<string, unknown>,
    }))
    setConflicts([])
    setPhase('idle')
    proceedWithResolved(rewritten)
  }

  function cancelConflicts() {
    setConflicts([])
    setPhase('idle')
  }

  function cancelHighImpact() {
    setPendingResolved(null)
    setPhase('idle')
  }

  function confirmHighImpact() {
    const target = pendingResolved ?? resolved
    setPendingResolved(null)
    doCreate(target)
  }

  const highImpactFlags = useMemo(
    () => (phase === 'high-impact' ? detectHighImpact(pendingResolved ?? resolved) : []),
    [phase, pendingResolved, resolved],
  )

  return (
    <DialogContent wide className="max-h-[88vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{recipe.label}</DialogTitle>
        <DialogDescription>{recipe.scene}</DialogDescription>
      </DialogHeader>

      <p className="text-[12.5px] leading-relaxed text-[var(--color-fg-2)]">
        {recipe.describe}
      </p>

      <Tabs defaultValue={setupLines.length ? 'setup' : 'form'}>
        <TabsList>
          {setupLines.length ? <TabsTrigger value="setup">部署前置</TabsTrigger> : null}
          <TabsTrigger value="form">参数与预览</TabsTrigger>
          <TabsTrigger value="json">完整 JSON</TabsTrigger>
          {clientLines.length ? <TabsTrigger value="client">客户端怎么接</TabsTrigger> : null}
        </TabsList>

        {setupLines.length ? (
          <TabsContent value="setup" className="mt-3">
            <pre className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[12px] font-mono p-3 leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {setupLines.join('\n')}
            </pre>
            <p className="text-[11px] text-[var(--color-muted)] mt-2 leading-relaxed">
              先把这里所有步骤跑完再回「参数与预览」点「应用此配方」。否则 gost 启动后会因为证书 / DNS / 端口未就绪报错。
            </p>
          </TabsContent>
        ) : null}

        <TabsContent value="form" className="mt-3 flex flex-col gap-3">
          {recipe.vars && recipe.vars.length > 0 ? (
            <FormSection title="参数">
              {recipe.vars.map((v) => (
                <FieldRow key={v.key} label={v.label} hint={v.hint}>
                  <VarInput
                    v={v}
                    value={vars[v.key] ?? ''}
                    onChange={(val) => setVars((m) => ({ ...m, [v.key]: val }))}
                    disabled={formDisabled}
                  />
                </FieldRow>
              ))}
            </FormSection>
          ) : null}

          <FormSection title="将会创建">
            <ul className="flex flex-col gap-1.5">
              {resolved.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[12px]"
                >
                  <span className="font-mono text-[10px] tabular text-[var(--color-muted)] w-5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="eyebrow shrink-0">{RESOURCE_LABEL_ZH[r.kind]}</span>
                  <code className="font-mono text-[12px] text-[var(--color-fg)]">{r.name}</code>
                </li>
              ))}
            </ul>
          </FormSection>

          {log.length > 0 ? (
            <FormSection title="执行记录">
              <ul className="font-mono text-[11px] leading-relaxed">
                {log.map((l, i) => (
                  <li key={i} className={logToneClass(l)}>
                    {l}
                  </li>
                ))}
              </ul>
            </FormSection>
          ) : null}
        </TabsContent>

        <TabsContent value="json" className="mt-3">
          <EditorJson
            value={JSON.stringify(
              resolved.map((r) => ({ kind: r.kind, name: r.name, ...r.body })),
              null,
              2,
            )}
            readOnly
            height="44vh"
          />
        </TabsContent>

        {clientLines.length ? (
          <TabsContent value="client" className="mt-3">
            <pre className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[12px] font-mono p-3 leading-relaxed overflow-x-auto whitespace-pre-wrap">
              {clientLines.join('\n')}
            </pre>
            <p className="text-[11px] text-[var(--color-muted)] mt-2 leading-relaxed">
              `{'{{host}}'}` 已经替换成当前主机 <code className="font-mono">{host}</code>。从外部访问时请用真实可达地址替换。
            </p>
          </TabsContent>
        ) : null}
      </Tabs>

      {phase === 'conflicts' ? (
        <div className="rounded-md border border-[color-mix(in_oklab,var(--color-warn,#d97706)_45%,transparent)] bg-[var(--color-surface)] p-3 mt-2">
          <div className="eyebrow mb-2 text-[var(--color-fg)]">
            检测到 {conflicts.length} 个 name 已被占用：
          </div>
          <ul className="font-mono text-[11.5px] leading-relaxed mb-3">
            {conflicts.map((c, i) => (
              <li key={i}>
                <span className="text-[var(--color-muted)]">{RESOURCE_LABEL_ZH[c.kind]}</span>{' '}
                <span className="text-[var(--color-fg)]">{c.name}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-[var(--color-muted)] mb-3 leading-relaxed">
            可以自动给冲突的名字加 <code className="font-mono">-2</code>（继续重复则 -3、-4 …），跨资源引用也会一起重写；也可以取消后回到上方手动改参数。
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={cancelConflicts}>取消，去手动改 vars</Button>
            <Button variant="accent" onClick={applyAutoRename}>自动加 -2 后缀</Button>
          </div>
        </div>
      ) : null}

      {phase === 'high-impact' ? (
        <div className="rounded-md border border-[color-mix(in_oklab,var(--color-warn,#d97706)_60%,transparent)] bg-[color-mix(in_oklab,var(--color-warn,#d97706)_8%,var(--color-surface))] p-3 mt-2">
          <div className="eyebrow mb-2 text-[var(--color-fg)]">高风险配方，请确认</div>
          <ul className="text-[12px] leading-relaxed list-disc pl-5 mb-3 text-[var(--color-fg-2)]">
            {highImpactFlags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
          <p className="text-[11px] text-[var(--color-muted)] mb-3 leading-relaxed">
            这些设置通常需要主机端配合（占用低端口 / 提权 / iptables / TUN 接口）。如果只是想体验配方，建议先取消、改个高端口再应用。
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={cancelHighImpact}>取消</Button>
            <Button variant="accent" onClick={confirmHighImpact}>我已了解，继续应用</Button>
          </div>
        </div>
      ) : null}

      {phase === 'failed' && createdSoFar.length > 0 ? (
        <div className="rounded-md border border-[color-mix(in_oklab,var(--color-danger)_45%,transparent)] bg-[var(--color-danger-soft)] p-3 mt-2">
          <div className="eyebrow mb-2 text-[var(--color-danger)]">应用失败，已建 {createdSoFar.length} 个</div>
          <p className="text-[11.5px] text-[var(--color-fg-2)] mb-3 leading-relaxed">
            为避免半成品配置留在 gost 里影响后续运行，可以一键回滚已建项。下面的执行记录会同步刷新。
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="danger" onClick={undo} disabled={running}>
              {running ? <><Loader2 size={13} className="animate-spin" /> 撤销中…</> : `撤销已建（${createdSoFar.length} 个）`}
            </Button>
          </div>
        </div>
      ) : null}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost" disabled={running}>关闭</Button>
        </DialogClose>
        <Button
          variant="accent"
          onClick={startApply}
          disabled={phase !== 'idle' && phase !== 'failed'}
        >
          {running ? (
            <>
              <Loader2 size={13} className="animate-spin" /> 应用中…
            </>
          ) : phase === 'failed' ? (
            '重新应用'
          ) : (
            '应用此配方'
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function VarInput({
  v,
  value,
  onChange,
  disabled,
}: {
  v: RecipeVar
  value: string
  onChange: (s: string) => void
  disabled?: boolean
}) {
  if (v.type === 'password' || v.generate) {
    return (
      <PasswordField
        value={value}
        onChange={onChange}
        placeholder={v.default}
        disabled={disabled}
        generate={v.generate}
      />
    )
  }
  return (
    <TextField
      type={v.type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={v.default}
      disabled={disabled}
    />
  )
}

function safeHost(url: string): string {
  try { return new URL(url).hostname } catch { return 'host' }
}

function errMsg(e: unknown): string {
  return gostError(e)
}

/** Color the log line based on its leading marker. */
function logToneClass(line: string): string {
  if (line.startsWith('✓')) return 'text-[var(--color-accent)]'
  if (line.startsWith('↶')) return 'text-[var(--color-fg-2)]'
  return 'text-[var(--color-danger)]'
}

/**
 * Returns user-friendly warnings if any service in `target` looks like it
 * needs root / iptables / a privileged listener — empty array means "safe".
 */
const HIGH_IMPACT_HANDLERS = new Set(['tun', 'tap', 'redirect', 'tproxy'])
const LOW_PORTS = new Set(['80', '443', '25', '53', '993', '587', '500', '4500'])

function detectHighImpact(
  target: Array<{ kind: ResourceKey; name: string; body: Record<string, unknown> }>,
): string[] {
  const flags: string[] = []
  for (const r of target) {
    if (r.kind !== 'services') continue
    const addr = typeof r.body.addr === 'string' ? r.body.addr : ''
    const handler = (r.body.handler as { type?: string } | undefined)?.type ?? ''
    // addr can be ":443" or "1.2.3.4:443" — grab the trailing port.
    const m = addr.match(/:(\d+)$/)
    const port = m ? m[1] : ''
    if (port && LOW_PORTS.has(port)) {
      flags.push(`服务「${r.name}」将占用 :${port} 端口（well-known，需要 root 或 setcap）`)
    }
    if (handler && HIGH_IMPACT_HANDLERS.has(handler)) {
      if (handler === 'tun' || handler === 'tap') {
        flags.push(`服务「${r.name}」使用 ${handler}，需要 CAP_NET_ADMIN 或 root，并占用一个内核虚拟网卡`)
      } else if (handler === 'redirect' || handler === 'tproxy') {
        flags.push(`服务「${r.name}」使用 ${handler}，需要预先配置 iptables 规则才能拿到流量`)
      }
    }
  }
  return flags
}
