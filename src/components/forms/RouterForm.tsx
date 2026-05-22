import type { ResourceFormProps } from '@/components/forms/types'
import { FormSection, FieldRow, TextField, RowList } from '@/components/ui/Form'

type Route = { net?: string; gateway?: string }

export function RouterForm({ value, onChange, disabled }: ResourceFormProps) {
  const routes: Route[] = Array.isArray(value.routes) ? (value.routes as Route[]) : []

  const update = (next: Route[]) => {
    onChange({ ...value, routes: next })
  }

  return (
    <FormSection
      title="路由表"
      hint="TUN/TAP 透明组网下的「哪个网段走哪个节点」。普通代理用不到。"
    >
      <RowList<Route>
        items={routes}
        addLabel="＋ 添加路由"
        empty="暂无路由"
        onAdd={() => update([...routes, { net: '', gateway: '' }])}
        onRemove={(i) => update(routes.filter((_, idx) => idx !== i))}
        render={(item, i) => (
          <div className="flex flex-col gap-2">
            <FieldRow
              label="目标网段"
              inline
              hint="CIDR 或 IP，例：10.0.0.0/8、192.168.1.0/24"
            >
              <TextField
                value={item.net ?? ''}
                disabled={disabled}
                placeholder="10.0.0.0/8"
                onChange={(e) => {
                  const next = routes.slice()
                  next[i] = { ...item, net: e.target.value }
                  update(next)
                }}
              />
            </FieldRow>
            <FieldRow
              label="网关节点"
              inline
              hint="把该网段的流量送给哪个节点（hop 内的节点名）"
            >
              <TextField
                value={item.gateway ?? ''}
                disabled={disabled}
                placeholder="node-0"
                onChange={(e) => {
                  const next = routes.slice()
                  next[i] = { ...item, gateway: e.target.value }
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

export default RouterForm
