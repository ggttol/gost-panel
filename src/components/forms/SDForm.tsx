import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextField, SelectField } from '@/components/ui/Form'

type Plugin = { type?: string; addr?: string; timeout?: string; token?: string }

function asDict(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}
function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function SDForm({ value, onChange, disabled }: ResourceFormProps) {
  const plugin: Plugin = asDict(value.plugin)

  const patchPlugin = (patch: Partial<Plugin>) => {
    onChange({ ...value, plugin: { ...plugin, ...patch } })
  }

  return (
    <FormSection
      title="服务发现"
      hint="让 gost 从外部插件拿动态节点列表，不必手写 hop。常对接 K8s / Consul / 自家注册中心"
    >
      <FieldRow label="协议" inline>
        <SelectField
          value={asString(plugin.type)}
          onChange={(v) => patchPlugin({ type: v })}
          options={[
            { value: 'http', label: 'http', hint: 'HTTP 拉取（最常用）' },
            { value: 'grpc', label: 'grpc', hint: 'gRPC 拉取' },
          ]}
          allowEmpty
          placeholder="— 选择协议 —"
        />
      </FieldRow>
      <FieldRow
        label="地址"
        inline
        hint="HTTP 形如 http://127.0.0.1:8000/sd；gRPC 形如 127.0.0.1:8001"
      >
        <TextField
          value={asString(plugin.addr)}
          disabled={disabled}
          placeholder="http://127.0.0.1:8000/sd"
          onChange={(e) => patchPlugin({ addr: e.target.value })}
        />
      </FieldRow>
      <FieldRow label="超时" inline hint="例：3s、500ms">
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
  )
}

export default SDForm
