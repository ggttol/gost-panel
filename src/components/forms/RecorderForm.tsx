import { useMemo } from 'react'
import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextField, SelectField, NumberField } from '@/components/ui/Form'
import { PasswordField } from '@/components/ui/PasswordField'

type Dict = Record<string, unknown>

function asDict(v: unknown): Dict {
  return v && typeof v === 'object' ? (v as Dict) : {}
}
function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

const KINDS = [
  { value: 'file',   label: 'file',   hint: '写入本地日志文件（最常用）' },
  { value: 'tcp',    label: 'tcp',    hint: '发到 TCP 端口（如 logstash）' },
  { value: 'redis',  label: 'redis',  hint: '写到 Redis 队列' },
  { value: 'http',   label: 'http',   hint: 'HTTP POST 给外部接口' },
  { value: 'plugin', label: 'plugin', hint: '自定义插件回调（HTTP/gRPC）' },
]

function detectKind(value: Dict): string {
  for (const k of ['file', 'tcp', 'redis', 'http', 'plugin']) {
    if (value[k] && typeof value[k] === 'object') return k
  }
  return 'file'
}

export function RecorderForm({ value, onChange, disabled }: ResourceFormProps) {
  const kind = useMemo(() => detectKind(value), [value])

  const switchKind = (next: string) => {
    // Strip all "kind" keys, keep top-level extras (name etc.), set new empty one
    const cleaned: Dict = { ...value }
    for (const k of ['file', 'tcp', 'redis', 'http', 'plugin']) delete cleaned[k]
    cleaned[next] = {}
    onChange(cleaned)
  }

  const file = asDict(value.file)
  const tcp = asDict(value.tcp)
  const redis = asDict(value.redis)
  const http = asDict(value.http)
  const plugin = asDict(value.plugin)

  const patch = (key: string, patchObj: Dict) => {
    onChange({ ...value, [key]: { ...asDict(value[key]), ...patchObj } })
  }

  return (
    <div className="flex flex-col gap-3">
      <FormSection
        title="记录器类型"
        hint="记录器把请求/连接元数据写到某处。不同后端字段不同。"
      >
        <FieldRow label="类型" inline>
          <SelectField value={kind} onChange={switchKind} options={KINDS} />
        </FieldRow>
      </FormSection>

      {kind === 'file' ? (
        <FormSection title="写入文件">
          <FieldRow label="路径" inline hint="绝对路径，例 /var/log/gost/recorder.log。所在目录需可写。">
            <TextField
              value={asString(file.path)}
              disabled={disabled}
              placeholder="/var/log/gost/recorder.log"
              onChange={(e) => patch('file', { path: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="sep" inline hint="多条记录之间的分隔符。留空走默认换行符">
            <TextField
              value={asString(file.sep)}
              disabled={disabled}
              placeholder="\n"
              onChange={(e) => patch('file', { sep: e.target.value })}
            />
          </FieldRow>
        </FormSection>
      ) : null}

      {kind === 'tcp' ? (
        <FormSection title="写入 TCP">
          <FieldRow label="地址" inline hint="远端 host:port，例：10.0.0.5:5000">
            <TextField
              value={asString(tcp.addr)}
              disabled={disabled}
              placeholder="10.0.0.5:5000"
              onChange={(e) => patch('tcp', { addr: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="超时" inline hint="例 3s">
            <TextField
              value={asString(tcp.timeout)}
              disabled={disabled}
              placeholder="3s"
              onChange={(e) => patch('tcp', { timeout: e.target.value })}
            />
          </FieldRow>
        </FormSection>
      ) : null}

      {kind === 'redis' ? (
        <FormSection title="写入 Redis">
          <FieldRow label="addr" inline hint="例 127.0.0.1:6379">
            <TextField
              value={asString(redis.addr)}
              disabled={disabled}
              placeholder="127.0.0.1:6379"
              onChange={(e) => patch('redis', { addr: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="db" inline hint="DB 索引">
            <NumberField
              value={typeof redis.db === 'number' ? (redis.db as number) : ''}
              disabled={disabled}
              placeholder="0"
              min={0}
              onChange={(e) => {
                const raw = e.target.value
                const next = { ...redis }
                if (raw === '') delete next.db
                else next.db = Number(raw)
                onChange({ ...value, redis: next })
              }}
            />
          </FieldRow>
          <FieldRow label="key" inline hint="队列/列表的 key 名">
            <TextField
              value={asString(redis.key)}
              disabled={disabled}
              placeholder="gost:recorder"
              onChange={(e) => patch('redis', { key: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="password" inline hint="如有">
            <PasswordField
              value={asString(redis.password)}
              disabled={disabled}
              placeholder="可选"
              onChange={(v) => patch('redis', { password: v })}
            />
          </FieldRow>
          <FieldRow label="type" inline hint="list / publish 等，留空默认 list">
            <TextField
              value={asString(redis.type)}
              disabled={disabled}
              placeholder="list"
              onChange={(e) => patch('redis', { type: e.target.value })}
            />
          </FieldRow>
        </FormSection>
      ) : null}

      {kind === 'http' ? (
        <FormSection title="HTTP POST">
          <FieldRow label="URL" inline>
            <TextField
              value={asString(http.url)}
              disabled={disabled}
              placeholder="https://example.com/ingest"
              onChange={(e) => patch('http', { url: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="超时" inline hint="例 3s">
            <TextField
              value={asString(http.timeout)}
              disabled={disabled}
              placeholder="3s"
              onChange={(e) => patch('http', { timeout: e.target.value })}
            />
          </FieldRow>
        </FormSection>
      ) : null}

      {kind === 'plugin' ? (
        <FormSection title="插件回调">
          <FieldRow label="协议" inline>
            <SelectField
              value={asString(plugin.type)}
              onChange={(v) => patch('plugin', { type: v })}
              options={[
                { value: 'http', label: 'http' },
                { value: 'grpc', label: 'grpc' },
              ]}
              allowEmpty
              placeholder="— 选择 —"
            />
          </FieldRow>
          <FieldRow label="地址" inline>
            <TextField
              value={asString(plugin.addr)}
              disabled={disabled}
              placeholder="http://127.0.0.1:8000/recorder"
              onChange={(e) => patch('plugin', { addr: e.target.value })}
            />
          </FieldRow>
          <FieldRow label="超时" inline>
            <TextField
              value={asString(plugin.timeout)}
              disabled={disabled}
              placeholder="3s"
              onChange={(e) => patch('plugin', { timeout: e.target.value })}
            />
          </FieldRow>
        </FormSection>
      ) : null}
    </div>
  )
}

export default RecorderForm
