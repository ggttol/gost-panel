import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextField, RowList } from '@/components/ui/Form'

type Rule = { hostname?: string; endpoint?: string }

export function IngressForm({ value, onChange, disabled }: ResourceFormProps) {
  const rules: Rule[] = Array.isArray(value.rules) ? (value.rules as Rule[]) : []

  const update = (next: Rule[]) => {
    onChange({ ...value, rules: next })
  }

  return (
    <FormSection
      title="路由规则"
      hint="把同一端口的流量按 SNI/主机名分发到不同后端（endpoint）。常配合 tunnel 协议。"
    >
      <RowList<Rule>
        items={rules}
        addLabel="＋ 添加规则"
        empty="暂无规则"
        onAdd={() => update([...rules, { hostname: '', endpoint: '' }])}
        onRemove={(i) => update(rules.filter((_, idx) => idx !== i))}
        render={(item, i) => (
          <div className="flex flex-col gap-2">
            <FieldRow
              label="主机名"
              inline
              hint="客户端在 TLS SNI / Host 头里报的名字，例：a.example.com、tenant-1"
            >
              <TextField
                value={item.hostname ?? ''}
                disabled={disabled}
                placeholder="a.example.com"
                onChange={(e) => {
                  const next = rules.slice()
                  next[i] = { ...item, hostname: e.target.value }
                  update(next)
                }}
              />
            </FieldRow>
            <FieldRow
              label="endpoint"
              inline
              hint="命中后流量去哪。一般填一个隧道 ID 或后端节点名"
            >
              <TextField
                value={item.endpoint ?? ''}
                disabled={disabled}
                placeholder="backend-0"
                onChange={(e) => {
                  const next = rules.slice()
                  next[i] = { ...item, endpoint: e.target.value }
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

export default IngressForm
