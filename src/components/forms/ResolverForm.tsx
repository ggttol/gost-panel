import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextField, SelectField, RowList } from '@/components/ui/Form'

type Nameserver = {
  addr?: string
  chain?: string
  ttl?: string
  prefer?: string
  clientIP?: string
  timeout?: string
  hostname?: string
  async?: boolean
}

const PREFER_OPTIONS = [
  { value: 'ipv4', label: 'IPv4 优先' },
  { value: 'ipv6', label: 'IPv6 优先' },
]

export function ResolverForm({ value, onChange, disabled }: ResourceFormProps) {
  const nameservers: Nameserver[] = Array.isArray(value.nameservers)
    ? (value.nameservers as Nameserver[])
    : []

  const update = (next: Nameserver[]) => {
    onChange({ ...value, nameservers: next })
  }

  const patch = (i: number, item: Nameserver, partial: Partial<Nameserver>) => {
    const next = nameservers.slice()
    next[i] = { ...item, ...partial }
    update(next)
  }

  return (
    <FormSection
      title="上游解析器"
      hint="每条 = 一个 DNS 上游，按顺序使用；想强制走加密 DNS（DoT/DoH）就只填那一条"
    >
      <RowList<Nameserver>
        items={nameservers}
        addLabel="＋ 添加上游"
        empty="暂无上游"
        onAdd={() => update([...nameservers, { addr: '' }])}
        onRemove={(i) => update(nameservers.filter((_, idx) => idx !== i))}
        render={(item, i) => (
          <div className="flex flex-col gap-2">
            <FieldRow
              label="地址"
              hint={
                '填一个 DNS 上游地址，支持四种协议：\n· UDP（默认）：udp://8.8.8.8:53\n· TCP：tcp://1.1.1.1:53\n· DoT（DNS-over-TLS）：tls://1.1.1.1:853\n· DoH（DNS-over-HTTPS）：https://1.0.0.1/dns-query'
              }
            >
              <TextField
                value={item.addr ?? ''}
                disabled={disabled}
                placeholder="udp://8.8.8.8:53"
                onChange={(e) => patch(i, item, { addr: e.target.value })}
              />
            </FieldRow>
            <FieldRow
              label="协议偏好"
              inline
              hint="偏好返回 ipv4 还是 ipv6 记录；留空走默认（A/AAAA 都返）"
            >
              <SelectField
                value={item.prefer ?? ''}
                onChange={(v) => {
                  const next = nameservers.slice()
                  const updated: Nameserver = { ...item }
                  if (v) {
                    updated.prefer = v
                  } else {
                    delete updated.prefer
                  }
                  next[i] = updated
                  update(next)
                }}
                options={PREFER_OPTIONS}
                allowEmpty
                placeholder="— 不指定 —"
              />
            </FieldRow>
            <FieldRow
              label="链路"
              inline
              hint="让这次 DNS 查询也走某条链路（如经过代理出去解析）；留空走本机直连"
            >
              <TextField
                value={item.chain ?? ''}
                disabled={disabled}
                placeholder="chain-0"
                onChange={(e) => patch(i, item, { chain: e.target.value })}
              />
            </FieldRow>
            <FieldRow
              label="TTL"
              inline
              hint="本地缓存时长。例：60s、5m、1h；留空使用上游返回的 TTL"
            >
              <TextField
                value={item.ttl ?? ''}
                disabled={disabled}
                placeholder="60s"
                onChange={(e) => patch(i, item, { ttl: e.target.value })}
              />
            </FieldRow>
            <FieldRow
              label="超时"
              inline
              hint="等待上游响应的超时。例：3s、500ms；留空走默认"
            >
              <TextField
                value={item.timeout ?? ''}
                disabled={disabled}
                placeholder="3s"
                onChange={(e) => patch(i, item, { timeout: e.target.value })}
              />
            </FieldRow>
          </div>
        )}
      />
    </FormSection>
  )
}

export default ResolverForm
