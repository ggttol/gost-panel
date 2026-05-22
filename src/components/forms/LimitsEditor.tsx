import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextField, SelectField, RowList } from '@/components/ui/Form'

type Row = { scope: '$' | '$$' | 'custom'; custom?: string; v1?: string; v2?: string }

const SCOPE_OPTIONS = [
  { value: '$',      label: '$',      hint: '服务级（整个服务共用一份配额）' },
  { value: '$$',     label: '$$',     hint: '每个客户端独立一份' },
  { value: 'custom', label: '自定义', hint: 'CIDR 或主机名，命中后单独配额' },
]

function parseLimit(s: string, hasTwo: boolean): Row | null {
  const tokens = s.trim().split(/\s+/)
  if (tokens.length === 0) return null
  const [prefix, ...rest] = tokens
  let scope: Row['scope'] = 'custom'
  let custom: string | undefined = prefix
  if (prefix === '$') { scope = '$'; custom = undefined }
  else if (prefix === '$$') { scope = '$$'; custom = undefined }
  if (hasTwo) return { scope, custom, v1: rest[0] ?? '', v2: rest[1] ?? '' }
  return { scope, custom, v1: rest[0] ?? '' }
}

function serializeRow(r: Row, hasTwo: boolean): string {
  const prefix = r.scope === 'custom' ? (r.custom ?? '').trim() : r.scope
  if (!prefix) return ''
  const v1 = (r.v1 ?? '').trim()
  if (hasTwo) {
    const v2 = (r.v2 ?? '').trim()
    return [prefix, v1, v2].filter(Boolean).join(' ')
  }
  return [prefix, v1].filter(Boolean).join(' ')
}

export function LimitsEditor({
  value,
  onChange,
  disabled,
  kind,
  title,
  hint,
  v1Label,
  v1Placeholder,
  v2Label,
  v2Placeholder,
}: ResourceFormProps & {
  /** "bandwidth" needs two values (in/out); "count" needs one. */
  kind: 'bandwidth' | 'count'
  title: string
  hint: string
  v1Label: string
  v1Placeholder: string
  v2Label?: string
  v2Placeholder?: string
}) {
  const hasTwo = kind === 'bandwidth'
  const rawLimits: string[] = Array.isArray(value.limits) ? (value.limits as string[]) : []
  const rows: Row[] = rawLimits.map((s) => parseLimit(s, hasTwo)).filter(Boolean) as Row[]

  const writeBack = (next: Row[]) => {
    const limits = next.map((r) => serializeRow(r, hasTwo)).filter((s) => s.length > 0)
    onChange({ ...value, limits })
  }

  const patch = (i: number, partial: Partial<Row>) => {
    const next = rows.slice()
    next[i] = { ...rows[i], ...partial }
    writeBack(next)
  }

  return (
    <FormSection title={title} hint={hint}>
      <RowList<Row>
        items={rows}
        addLabel="＋ 添加规则"
        empty="暂无规则"
        onAdd={() => writeBack([...rows, { scope: '$', v1: '', v2: hasTwo ? '' : undefined }])}
        onRemove={(i) => writeBack(rows.filter((_, idx) => idx !== i))}
        render={(item, i) => (
          <div className="flex flex-col gap-2">
            <FieldRow
              label="适用对象"
              inline
              hint="$ = 服务级总额；$$ = 每个客户端各一份；自定义 = 写 CIDR/主机名做精细控制"
            >
              <SelectField
                value={item.scope}
                onChange={(v) => patch(i, { scope: v as Row['scope'] })}
                options={SCOPE_OPTIONS}
              />
            </FieldRow>
            {item.scope === 'custom' ? (
              <FieldRow
                label="CIDR / 主机"
                inline
                hint="例：192.168.0.0/24、a.example.com"
              >
                <TextField
                  value={item.custom ?? ''}
                  disabled={disabled}
                  placeholder="192.168.0.0/24"
                  onChange={(e) => patch(i, { custom: e.target.value })}
                />
              </FieldRow>
            ) : null}
            <FieldRow label={v1Label} inline hint={v1Placeholder}>
              <TextField
                value={item.v1 ?? ''}
                disabled={disabled}
                placeholder={v1Placeholder}
                onChange={(e) => patch(i, { v1: e.target.value })}
              />
            </FieldRow>
            {hasTwo && v2Label ? (
              <FieldRow label={v2Label} inline hint={v2Placeholder}>
                <TextField
                  value={item.v2 ?? ''}
                  disabled={disabled}
                  placeholder={v2Placeholder}
                  onChange={(e) => patch(i, { v2: e.target.value })}
                />
              </FieldRow>
            ) : null}
            <div className="text-[10px] font-mono text-[var(--color-muted)] tabular px-1">
              → {serializeRow(item, hasTwo) || <em>(空)</em>}
            </div>
          </div>
        )}
      />
    </FormSection>
  )
}
