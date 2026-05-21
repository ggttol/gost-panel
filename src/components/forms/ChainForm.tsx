import type { ResourceFormProps } from '@/components/forms/types'
import {
  FormSection,
  FieldRow,
  TextField,
  NumberField,
  SelectField,
  RowList,
} from '@/components/ui/Form'
import { SELECTOR_STRATEGIES } from '@/lib/gostTypes'
import { ResourceRefField } from '@/components/ui/ResourceRefField'
import { TypeHint } from '@/components/ui/TypeHint'
import { SELECTOR_STRATEGY_HELP } from '@/lib/help'

type Selector = {
  strategy?: string
  maxFails?: number
  failTimeout?: string
}

type HopRef = {
  name?: string
  // 内联 hop 还可能有 interface/bypass/selector/nodes，
  // 此处只用 name；其他字段透传保留以避免数据丢失
  [k: string]: unknown
}

function getSelector(value: Record<string, unknown>): Selector {
  const s = value.selector
  return s && typeof s === 'object' ? (s as Selector) : {}
}

function setSelectorPart(
  value: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void,
  patch: Partial<Selector>,
) {
  const current = getSelector(value)
  const merged: Selector = { ...current, ...patch }
  const cleaned: Selector = {}
  if (merged.strategy) cleaned.strategy = merged.strategy
  if (typeof merged.maxFails === 'number' && !Number.isNaN(merged.maxFails))
    cleaned.maxFails = merged.maxFails
  if (merged.failTimeout) cleaned.failTimeout = merged.failTimeout
  const next = { ...value }
  if (Object.keys(cleaned).length === 0) {
    delete next.selector
  } else {
    next.selector = cleaned
  }
  onChange(next)
}

export function ChainForm({ value, onChange, disabled }: ResourceFormProps) {
  const selector = getSelector(value)
  const hops: HopRef[] = Array.isArray(value.hops) ? (value.hops as HopRef[]) : []

  const updateHops = (next: HopRef[]) => {
    onChange({ ...value, hops: next })
  }

  return (
    <div className="flex flex-col gap-3">
      <FormSection
        title="选择策略"
        hint="链路有多条候选 hop 时怎么挑；通常 round 或 fifo"
      >
        <FieldRow label="策略" inline hint="轮询/随机/首选可用/一致性哈希；详见下方说明">
          <SelectField
            value={selector.strategy ?? ''}
            allowEmpty
            placeholder="— 默认 —"
            options={SELECTOR_STRATEGIES}
            onChange={(v) => setSelectorPart(value, onChange, { strategy: v || undefined })}
          />
          <TypeHint text={SELECTOR_STRATEGY_HELP[selector.strategy ?? '']} />
        </FieldRow>
        <FieldRow label="最大失败次数" inline hint="连续失败几次就把节点剔除一段时间。常用 1~3">
          <NumberField
            value={
              typeof selector.maxFails === 'number' && !Number.isNaN(selector.maxFails)
                ? selector.maxFails
                : ''
            }
            disabled={disabled}
            placeholder="1"
            min={0}
            onChange={(e) => {
              const raw = e.target.value
              const n = raw === '' ? undefined : Number(raw)
              setSelectorPart(value, onChange, { maxFails: n })
            }}
          />
        </FieldRow>
        <FieldRow label="失败超时" inline hint="剔除后多久再重试。例：30s、2m">
          <TextField
            value={selector.failTimeout ?? ''}
            disabled={disabled}
            placeholder="30s"
            onChange={(e) =>
              setSelectorPart(value, onChange, { failTimeout: e.target.value || undefined })
            }
          />
        </FieldRow>
      </FormSection>

      <FormSection
        title="跳点序列 (hops)"
        hint="按顺序把流量串过这些跳点。第 1 条是直接上游，第 2 条是上游的上游…"
      >
        <RowList<HopRef>
          items={hops}
          addLabel="＋ 添加跳点"
          empty="暂无跳点"
          onAdd={() => updateHops([...hops, { name: '' }])}
          onRemove={(i) => updateHops(hops.filter((_, idx) => idx !== i))}
          render={(item, i) => (
            <div className="flex flex-col gap-2">
              <FieldRow
                label="跳点名"
                inline
                hint="填一个已经建好的 hop 名；想内联请切到 JSON 标签"
              >
                <ResourceRefField
                  refKind="hops"
                  value={typeof item.name === 'string' ? item.name : ''}
                  disabled={disabled}
                  placeholder="— 选择跳点 —"
                  onChange={(v) => {
                    const next = hops.slice()
                    next[i] = { ...item, name: v }
                    updateHops(next)
                  }}
                />
              </FieldRow>
            </div>
          )}
        />
      </FormSection>
    </div>
  )
}

export default ChainForm
