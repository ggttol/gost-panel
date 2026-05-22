import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextField, SelectField, NumberField } from '@/components/ui/Form'

type Plugin = { type?: string; addr?: string; timeout?: string; token?: string }

const PLUGIN_TYPES = [
  { value: 'http', label: 'http', hint: 'HTTP 回调（最常见）' },
  { value: 'grpc', label: 'grpc', hint: 'gRPC 回调' },
]

function asDict(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}
function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function ObserverForm({ value, onChange, disabled }: ResourceFormProps) {
  const plugin: Plugin = asDict(value.plugin)
  const period = typeof value.period === 'number' ? (value.period as number) : undefined

  const patchPlugin = (patch: Partial<Plugin>) => {
    onChange({ ...value, plugin: { ...plugin, ...patch } })
  }

  return (
    <div className="flex flex-col gap-3">
      <FormSection
        title="插件回调"
        hint="gost 把内部事件（流量、连接、错误）POST 到这个地址；你自己接住做监控/告警"
      >
        <FieldRow label="协议" inline hint="HTTP 兼容性最好；gRPC 性能更高">
          <SelectField
            value={asString(plugin.type)}
            onChange={(v) => patchPlugin({ type: v })}
            options={PLUGIN_TYPES}
            allowEmpty
            placeholder="— 选择协议 —"
          />
        </FieldRow>
        <FieldRow
          label="回调地址"
          inline
          hint="HTTP 形如 http://127.0.0.1:8000/observer；gRPC 形如 127.0.0.1:8001"
        >
          <TextField
            value={asString(plugin.addr)}
            disabled={disabled}
            placeholder="http://127.0.0.1:8000/observer"
            onChange={(e) => patchPlugin({ addr: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="超时" inline hint="例：3s、500ms；留空默认 3s">
          <TextField
            value={asString(plugin.timeout)}
            disabled={disabled}
            placeholder="3s"
            onChange={(e) => patchPlugin({ timeout: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="共享 token" inline hint="可选；服务端做认证用">
          <TextField
            value={asString(plugin.token)}
            disabled={disabled}
            placeholder="可选"
            onChange={(e) => patchPlugin({ token: e.target.value })}
          />
        </FieldRow>
      </FormSection>

      <FormSection title="上报频率">
        <FieldRow label="周期(秒)" inline hint="多久聚合上报一次。留空走默认（通常 30s）">
          <NumberField
            value={period ?? ''}
            disabled={disabled}
            placeholder="30"
            min={1}
            onChange={(e) => {
              const raw = e.target.value
              const next = { ...value }
              if (raw === '') delete next.period
              else next.period = Number(raw)
              onChange(next)
            }}
          />
        </FieldRow>
      </FormSection>
    </div>
  )
}

export default ObserverForm
