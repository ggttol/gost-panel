import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { gostError } from '@/lib/api'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Dialog, DialogClose } from '@/components/ui/Dialog.primitives'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { EditorJson } from '@/components/ui/EditorJson'
import { TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { Tabs, TabsContent } from '@/components/ui/Tabs.primitives'
import { RESOURCES, type ResourceKey } from '@/lib/resources'
import { RESOURCE_LABEL_ZH, T } from '@/lib/i18n'
import {
  useCreateResource,
  useExistingNames,
  useUpdateResource,
  type GostItem,
} from '@/lib/queries'
import { RESOURCE_TEMPLATES } from '@/lib/templates'
import { ResourceForm } from '@/components/forms/registry'
import { hasForm } from '@/components/forms/registry.helpers'
import { HelpBanner } from '@/components/ui/HelpBanner'
import { ScenarioPicker } from '@/components/forms/ScenarioPicker'
import { RESOURCE_INTRO } from '@/lib/help'
import type { ServiceScenario } from '@/lib/help'
import { pruneEmpty } from '@/lib/utils'

export type EditorMode =
  | { kind: 'create'; key: ResourceKey; presetBody?: Record<string, unknown>; presetName?: string }
  | { kind: 'edit'; key: ResourceKey; original: GostItem }

export function ResourceEditorDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: EditorMode | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {mode ? <EditorBody mode={mode} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  )
}

function EditorBody({ mode, onDone }: { mode: EditorMode; onDone: () => void }) {
  const def = RESOURCES.find((r) => r.key === mode.key)!
  const label = RESOURCE_LABEL_ZH[mode.key]

  const initialName =
    mode.kind === 'edit' ? mode.original.name : (mode.presetName ?? '')
  const initialValue = useMemo<Record<string, unknown>>(() => {
    if (mode.kind === 'edit') {
      const rest: Record<string, unknown> = { ...mode.original }
      delete rest.name
      delete rest.status
      return rest
    }
    // 克隆模式：拿源资源的 body 当起点（已剥 name / status），仍按 create 语义走
    if (mode.presetBody) {
      return structuredClone(mode.presetBody)
    }
    const tpl = { ...RESOURCE_TEMPLATES[mode.key] }
    delete (tpl as { name?: unknown }).name
    return tpl
  }, [mode])

  const [name, setName] = useState(initialName)
  const [value, setValue] = useState<Record<string, unknown>>(initialValue)
  const [error, setError] = useState<string | null>(null)
  const formAvailable = hasForm(mode.key)
  const [tab, setTab] = useState<'form' | 'json'>(formAvailable ? 'form' : 'json')
  // JSON tab maintains its own text so users can stage half-typed JSON without losing it.
  const [jsonText, setJsonText] = useState(() => JSON.stringify(initialValue, null, 2))
  const lastSyncedTab = useRef(tab)

  // Hold onto the Query data ref directly — it's referentially stable across
  // renders, so we can safely depend on it in effects below. `existingNames`
  // (the `?? []` fallback) intentionally creates a fresh empty array each
  // render and must NOT be a dep on its own.
  const existingNamesData = useExistingNames(mode.key).data
  const existingNames = existingNamesData ?? []

  useEffect(() => {
    setName(
      mode.kind === 'create' && !initialName
        ? suggestNextName(mode.key, existingNames)
        : initialName,
    )
    setValue(initialValue)
    setJsonText(JSON.stringify(initialValue, null, 2))
    setError(null)
    setTab(formAvailable ? 'form' : 'json')
    // We deliberately do NOT depend on existingNames here so the suggestion
    // doesn't churn while the user is typing. It's evaluated once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialName, initialValue, formAvailable])

  // When existingNames finishes loading after the dialog opened (first effect
  // ran with an empty list because data was still undefined), recompute the
  // placeholder. We only touch the name if it still looks like an
  // auto-suggestion — never clobber what the user typed.
  useEffect(() => {
    if (mode.kind !== 'create' || initialName) return
    if (!existingNamesData) return
    // Intentional: syncing the name placeholder when an async list arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName((current) => {
      if (!current || isSuggestedName(current, mode.key, existingNamesData)) {
        return suggestNextName(mode.key, existingNamesData)
      }
      return current
    })
    // mode.key / initialName are stable for the lifetime of this dialog open,
    // so the only dep that should drive re-runs is existingNamesData (the
    // referentially-stable Query result).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingNamesData])

  function applyScenario(s: ServiceScenario) {
    setValue(structuredClone(s.body))
    let appliedName = ''
    setName((current) => {
      const next =
        current.trim() && !isSuggestedName(current, mode.key, existingNames)
          ? current
          : ensureUniqueName(s.name, existingNames)
      appliedName = next
      return next
    })
    toast.success(`已套用预设：${s.label}`, {
      description: appliedName ? `名称：${appliedName}` : undefined,
      duration: 2000,
    })
  }

  function switchTab(next: 'form' | 'json') {
    if (next === lastSyncedTab.current) return
    if (lastSyncedTab.current === 'form' && next === 'json') {
      setJsonText(JSON.stringify(value, null, 2))
      setError(null)
    } else if (lastSyncedTab.current === 'json' && next === 'form') {
      try {
        const parsed = JSON.parse(jsonText)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('JSON 必须是对象')
        }
        setValue(parsed as Record<string, unknown>)
        setError(null)
      } catch (e) {
        setError(`${T.resource.invalidJson}：${(e as Error).message}`)
        return
      }
    }
    lastSyncedTab.current = next
    setTab(next)
  }

  const create = useCreateResource(mode.key)
  const update = useUpdateResource(mode.key)
  const pending = create.isPending || update.isPending

  async function submit() {
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError(T.resource.nameRequired)
      return
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      setError(T.resource.namePattern)
      return
    }
    let body: Record<string, unknown>
    if (tab === 'json') {
      try {
        const parsed = JSON.parse(jsonText)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('JSON 必须是对象')
        }
        body = parsed as Record<string, unknown>
      } catch (e) {
        setError(`${T.resource.invalidJson}：${(e as Error).message}`)
        return
      }
    } else {
      body = value
    }
    // Strip empty strings / empty objects / empty arrays so gost doesn't see
    // half-finished sub-objects (e.g. `auth: {}` from a momentarily focused
    // password field). Keeps the submitted payload tight.
    const cleaned = (pruneEmpty(body) as Record<string, unknown> | undefined) ?? {}
    const payload: GostItem = { name: trimmed, ...cleaned }
    try {
      if (mode.kind === 'create') {
        await create.mutateAsync(payload)
        toast.success(T.resource.createSuccess(label))
      } else {
        await update.mutateAsync({ name: mode.original.name, payload })
        toast.success(T.resource.updateSuccess(label))
      }
      onDone()
    } catch (e) {
      setError(extractErrMsg(e))
    }
  }

  return (
    <DialogContent wide className="max-h-[88vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {mode.kind === 'create'
            ? T.resource.createTitle(label)
            : T.resource.editTitle(label)}
        </DialogTitle>
        <DialogDescription>
          /api/config/{def.key}
          {mode.kind === 'edit' ? `/${mode.original.name}` : ''}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="res-name">{T.resource.nameLabel}</Label>
          <Input
            id="res-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={T.resource.namePlaceholder}
            disabled={mode.kind === 'edit'}
          />
        </div>

        <Tabs value={tab} onValueChange={(v) => switchTab(v as 'form' | 'json')}>
          <TabsList>
            {formAvailable ? <TabsTrigger value="form">表单</TabsTrigger> : null}
            <TabsTrigger value="json">JSON</TabsTrigger>
          </TabsList>

          {formAvailable ? (
            <TabsContent value="form" className="mt-3 flex flex-col gap-3">
              <HelpBanner intro={RESOURCE_INTRO[mode.key]} resourceKey={mode.key} />
              {mode.key === 'services' && mode.kind === 'create' ? (
                <ScenarioPicker onPick={applyScenario} />
              ) : null}
              <ResourceForm
                resourceKey={mode.key}
                value={value}
                onChange={setValue}
                disabled={pending}
              />
            </TabsContent>
          ) : null}

          <TabsContent value="json" className="mt-3">
            <EditorJson value={jsonText} onChange={setJsonText} height="360px" />
          </TabsContent>
        </Tabs>

        {error ? (
          <div className="text-xs text-rose-600 dark:text-rose-400 border border-rose-500/30 bg-rose-500/5 rounded-md px-2.5 py-1.5">
            {error}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost" disabled={pending}>
            {T.common.cancel}
          </Button>
        </DialogClose>
        <Button variant="primary" onClick={submit} disabled={pending}>
          {pending ? T.common.saving : T.common.save}
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function extractErrMsg(e: unknown): string {
  return `${T.resource.requestFailed}：${gostError(e)}`
}

const NAME_STEMS: Partial<Record<ResourceKey, string>> = {
  services:   'service',
  chains:     'chain',
  hops:       'hop',
  authers:    'auther',
  admissions: 'admission',
  bypasses:   'bypass',
  resolvers:  'resolver',
  hosts:      'hosts',
  ingresses:  'ingress',
  routers:    'router',
  observers:  'observer',
  recorders:  'recorder',
  sds:        'sd',
  limiters:   'limiter',
  climiters:  'climiter',
  rlimiters:  'rlimiter',
}

function suggestNextName(key: ResourceKey, existing: string[]): string {
  const stem = NAME_STEMS[key] ?? key
  for (let i = 1; i < 999; i++) {
    const cand = `${stem}-${i}`
    if (!existing.includes(cand)) return cand
  }
  return `${stem}-${Date.now()}`
}

function isSuggestedName(name: string, key: ResourceKey, existing: string[]): boolean {
  const stem = NAME_STEMS[key] ?? key
  if (!new RegExp(`^${stem}-\\d+$`).test(name)) return false
  // Treat any auto-suggested name as "still a placeholder" even if user opened
  // multiple dialogs without typing.
  return !existing.includes(name) || name === suggestNextName(key, existing)
}

function ensureUniqueName(desired: string, existing: string[]): string {
  if (!existing.includes(desired)) return desired
  for (let i = 2; i < 99; i++) {
    const cand = `${desired}-${i}`
    if (!existing.includes(cand)) return cand
  }
  return `${desired}-${Date.now()}`
}
