import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
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
import { api } from '@/lib/api'
import { getActiveProfile } from '@/lib/profiles'
import { defaultVars, substitute, type Recipe, type RecipeVar, type VarMap } from '@/lib/cookbook'
import { RESOURCE_LABEL_ZH } from '@/lib/i18n'

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

function Body({ recipe, onDone }: { recipe: Recipe; onDone: () => void }) {
  const profile = getActiveProfile()
  const host = profile ? safeHost(profile.apiBase) : 'host'
  const qc = useQueryClient()
  const navigate = useNavigate()

  const [vars, setVars] = useState<VarMap>(() => defaultVars(recipe, host))
  const [running, setRunning] = useState(false)
  const [log, setLog] = useState<string[]>([])

  const resolved = useMemo(
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

  async function apply() {
    setRunning(true)
    setLog([])
    let firstService: string | null = null
    for (const r of resolved) {
      const label = `${RESOURCE_LABEL_ZH[r.kind]}「${r.name}」`
      try {
        await api.post(`/config/${r.kind}`, { name: r.name, ...r.body })
        setLog((prev) => [...prev, `✓ 已创建 ${label}`])
        if (r.kind === 'services' && !firstService) firstService = r.name
      } catch (e) {
        const msg = errMsg(e)
        setLog((prev) => [...prev, `✗ ${label}: ${msg}`])
        setRunning(false)
        toast.error(`配方失败：${label}\n${msg}`)
        return
      }
    }
    qc.invalidateQueries()
    setRunning(false)
    toast.success(`已应用配方：${recipe.label}`)
    onDone()
    if (firstService) navigate(`/r/services/${encodeURIComponent(firstService)}`)
  }

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
                    disabled={running}
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
                  <li
                    key={i}
                    className={l.startsWith('✓') ? 'text-[var(--color-accent)]' : 'text-[var(--color-danger)]'}
                  >
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

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost" disabled={running}>取消</Button>
        </DialogClose>
        <Button variant="accent" onClick={apply} disabled={running}>
          {running ? (
            <>
              <Loader2 size={13} className="animate-spin" /> 应用中…
            </>
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
  if (isAxiosError(e)) {
    const data = e.response?.data as { msg?: string } | undefined
    return data?.msg ?? e.message
  }
  return (e as Error).message ?? String(e)
}
