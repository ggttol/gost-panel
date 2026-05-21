import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextField, TextareaField, RowList } from '@/components/ui/Form'

type Mapping = {
  ip?: string
  hostname?: string
  aliases?: string[]
}

function aliasesToText(v: unknown): string {
  if (!Array.isArray(v)) return ''
  return (v as unknown[]).map((s) => String(s)).join('\n')
}

function textToAliases(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

export function HostsForm({ value, onChange, disabled }: ResourceFormProps) {
  const mappings: Mapping[] = Array.isArray(value.mappings) ? (value.mappings as Mapping[]) : []

  const update = (next: Mapping[]) => {
    onChange({ ...value, mappings: next })
  }

  return (
    <FormSection
      title="主机映射"
      hint="每条 = 一条静态域名→IP 映射，命中后跳过 DNS 解析"
    >
      <RowList<Mapping>
        items={mappings}
        addLabel="＋ 添加映射"
        empty="暂无映射"
        onAdd={() => update([...mappings, { ip: '', hostname: '' }])}
        onRemove={(i) => update(mappings.filter((_, idx) => idx !== i))}
        render={(item, i) => (
          <div className="flex flex-col gap-2">
            <FieldRow
              label="IP"
              inline
              hint="目标 IP，例如 127.0.0.1、192.168.1.10、2001:db8::1"
            >
              <TextField
                value={item.ip ?? ''}
                disabled={disabled}
                placeholder="127.0.0.1"
                onChange={(e) => {
                  const next = mappings.slice()
                  next[i] = { ...item, ip: e.target.value }
                  update(next)
                }}
              />
            </FieldRow>
            <FieldRow
              label="主机名"
              inline
              hint="要映射的主域名，例如 api.internal、svc.example.com"
            >
              <TextField
                value={item.hostname ?? ''}
                disabled={disabled}
                placeholder="foo.example.com"
                onChange={(e) => {
                  const next = mappings.slice()
                  next[i] = { ...item, hostname: e.target.value }
                  update(next)
                }}
              />
            </FieldRow>
            <FieldRow
              label="别名"
              hint="每行一个别名，会和主域名等价指向同一 IP。例：foo / foo.local / svc1"
            >
              <TextareaField
                value={aliasesToText(item.aliases)}
                rows={3}
                disabled={disabled}
                placeholder={'foo\nbar'}
                onChange={(e) => {
                  const next = mappings.slice()
                  const aliases = textToAliases(e.target.value)
                  const updated: Mapping = { ...item }
                  if (aliases.length > 0) {
                    updated.aliases = aliases
                  } else {
                    delete updated.aliases
                  }
                  next[i] = updated
                  update(next)
                }}
              />
            </FieldRow>
          </div>
        )}
      />
    </FormSection>
  )
}

export default HostsForm
