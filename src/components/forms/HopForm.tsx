import type { ResourceFormProps } from '@/components/forms/types'
import {
  FormSection,
  FieldRow,
  TextField,
  NumberField,
  SelectField,
  Switch,
  RowList,
} from '@/components/ui/Form'
import { CONNECTOR_TYPES, DIALER_TYPES, SELECTOR_STRATEGIES } from '@/lib/gostTypes'
import { ResourceRefField } from '@/components/ui/ResourceRefField'
import { TypeHint } from '@/components/ui/TypeHint'
import {
  CONNECTOR_TYPE_HELP,
  DIALER_TYPE_HELP,
  SELECTOR_STRATEGY_HELP,
} from '@/lib/help'

type Auth = { username?: string; password?: string }
type TLSConfig = { caFile?: string; secure?: boolean; serverName?: string }
type Connector = {
  type?: string
  auth?: Auth
  metadata?: Record<string, unknown>
}
type Dialer = {
  type?: string
  auth?: Auth
  tls?: TLSConfig
  metadata?: Record<string, unknown>
}
type Node = {
  name?: string
  addr?: string
  interface?: string
  bypass?: string
  connector?: Connector
  dialer?: Dialer
}
type Selector = {
  strategy?: string
  maxFails?: number
  failTimeout?: string
}

const TLS_DIALER_TYPES = new Set(['tls', 'mtls', 'wss', 'mwss', 'h2', 'h2c', 'grpc', 'quic', 'http2'])

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
  // Strip empty fields
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

export function HopForm({ value, onChange, disabled }: ResourceFormProps) {
  const selector = getSelector(value)
  const nodes: Node[] = Array.isArray(value.nodes) ? (value.nodes as Node[]) : []
  const ifaceVal = typeof value.interface === 'string' ? (value.interface as string) : ''
  const bypassVal = typeof value.bypass === 'string' ? (value.bypass as string) : ''

  const updateNodes = (next: Node[]) => {
    onChange({ ...value, nodes: next })
  }

  const patchNode = (i: number, patch: Partial<Node>) => {
    const next = nodes.slice()
    next[i] = { ...nodes[i], ...patch }
    updateNodes(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <FormSection
        title="选择策略"
        hint="本 hop 有多个节点时怎么挑；留空段相当于 fifo（按顺序）"
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
            placeholder="3"
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

      <FormSection title="绑定" hint="整个 hop 层级的默认设置；可以被节点 override">
        <FieldRow label="网卡 / 出口 IP" inline hint="走哪个网卡或源 IP，例：eth0">
          <TextField
            value={ifaceVal}
            disabled={disabled}
            placeholder="eth0 / 192.168.1.2"
            onChange={(e) => {
              const next = { ...value }
              if (e.target.value) next.interface = e.target.value
              else delete next.interface
              onChange(next)
            }}
          />
        </FieldRow>
        <FieldRow
          label="bypass"
          inline
          hint="整个 hop 用哪个旁路规则（命中规则的目标会跳过本 hop）"
        >
          <ResourceRefField
            refKind="bypasses"
            value={bypassVal}
            disabled={disabled}
            onChange={(v) => {
              const next = { ...value }
              if (v) next.bypass = v
              else delete next.bypass
              onChange(next)
            }}
          />
        </FieldRow>
      </FormSection>

      <FormSection
        title="节点 (nodes)"
        hint="一条节点 = 一个可用上游。多个节点会按选择策略挑用"
      >
        <RowList<Node>
          items={nodes}
          addLabel="＋ 添加节点"
          empty="暂无节点"
          onAdd={() =>
            updateNodes([
              ...nodes,
              {
                name: '',
                addr: '',
                connector: { type: 'http' },
                dialer: { type: 'tcp' },
              },
            ])
          }
          onRemove={(i) => updateNodes(nodes.filter((_, idx) => idx !== i))}
          render={(item, i) => {
            const connector: Connector = item.connector ?? {}
            const dialer: Dialer = item.dialer ?? {}
            const connectorAuth: Auth = connector.auth ?? {}
            const dialerAuth: Auth = dialer.auth ?? {}
            const tls: TLSConfig = dialer.tls ?? {}
            const showTLS = TLS_DIALER_TYPES.has(dialer.type ?? '')

            const patchConnector = (patch: Partial<Connector>) =>
              patchNode(i, { connector: { ...connector, ...patch } })
            const patchConnectorAuth = (patch: Partial<Auth>) => {
              const nextAuth: Auth = { ...connectorAuth, ...patch }
              const cleaned: Auth = {}
              if (nextAuth.username) cleaned.username = nextAuth.username
              if (nextAuth.password) cleaned.password = nextAuth.password
              const nextConnector: Connector = { ...connector }
              if (Object.keys(cleaned).length === 0) delete nextConnector.auth
              else nextConnector.auth = cleaned
              patchNode(i, { connector: nextConnector })
            }
            const patchDialer = (patch: Partial<Dialer>) =>
              patchNode(i, { dialer: { ...dialer, ...patch } })
            const patchDialerAuth = (patch: Partial<Auth>) => {
              const nextAuth: Auth = { ...dialerAuth, ...patch }
              const cleaned: Auth = {}
              if (nextAuth.username) cleaned.username = nextAuth.username
              if (nextAuth.password) cleaned.password = nextAuth.password
              const nextDialer: Dialer = { ...dialer }
              if (Object.keys(cleaned).length === 0) delete nextDialer.auth
              else nextDialer.auth = cleaned
              patchNode(i, { dialer: nextDialer })
            }
            const patchTLS = (patch: Partial<TLSConfig>) => {
              const nextTLS: TLSConfig = { ...tls, ...patch }
              const cleaned: TLSConfig = {}
              if (nextTLS.caFile) cleaned.caFile = nextTLS.caFile
              if (nextTLS.serverName) cleaned.serverName = nextTLS.serverName
              if (typeof nextTLS.secure === 'boolean') cleaned.secure = nextTLS.secure
              const nextDialer: Dialer = { ...dialer }
              if (Object.keys(cleaned).length === 0) delete nextDialer.tls
              else nextDialer.tls = cleaned
              patchNode(i, { dialer: nextDialer })
            }

            return (
              <div className="flex flex-col gap-2.5">
                <FieldRow label="名称" inline hint="节点标识，任意字符串">
                  <TextField
                    value={item.name ?? ''}
                    disabled={disabled}
                    placeholder="node-0"
                    onChange={(e) => patchNode(i, { name: e.target.value })}
                  />
                </FieldRow>
                <FieldRow
                  label="地址"
                  inline
                  hint="上游地址，例：1.2.3.4:1080 或 example.com:443"
                >
                  <TextField
                    value={item.addr ?? ''}
                    disabled={disabled}
                    placeholder="192.168.1.1:1234"
                    onChange={(e) => patchNode(i, { addr: e.target.value })}
                  />
                </FieldRow>

                <FormSection title="连接器 (connector)">
                  <FieldRow
                    label="类型"
                    inline
                    hint='节点之上用什么"代理协议"连通信。socks5/http 等。'
                  >
                    <SelectField
                      value={connector.type ?? ''}
                      options={CONNECTOR_TYPES}
                      onChange={(v) => patchConnector({ type: v })}
                    />
                    <TypeHint text={CONNECTOR_TYPE_HELP[connector.type ?? '']} />
                  </FieldRow>
                  <FieldRow label="用户名" inline hint="上游需要账号时填；不需要留空">
                    <TextField
                      value={connectorAuth.username ?? ''}
                      disabled={disabled}
                      placeholder="可选"
                      onChange={(e) => patchConnectorAuth({ username: e.target.value })}
                    />
                  </FieldRow>
                  <FieldRow label="密码" inline hint="上游需要账号时填；不需要留空">
                    <TextField
                      value={connectorAuth.password ?? ''}
                      disabled={disabled}
                      placeholder="可选"
                      autoComplete="off"
                      onChange={(e) => patchConnectorAuth({ password: e.target.value })}
                    />
                  </FieldRow>
                </FormSection>

                <FormSection title="拨号器 (dialer)">
                  <FieldRow
                    label="类型"
                    inline
                    hint='节点之下用什么"传输层"连。tcp 最常见；tls/wss 等需要证书参数'
                  >
                    <SelectField
                      value={dialer.type ?? ''}
                      options={DIALER_TYPES}
                      onChange={(v) => patchDialer({ type: v })}
                    />
                    <TypeHint text={DIALER_TYPE_HELP[dialer.type ?? '']} />
                  </FieldRow>
                  <FieldRow label="用户名" inline hint="传输层级账号（少见，通常留空）">
                    <TextField
                      value={dialerAuth.username ?? ''}
                      disabled={disabled}
                      placeholder="可选"
                      onChange={(e) => patchDialerAuth({ username: e.target.value })}
                    />
                  </FieldRow>
                  <FieldRow label="密码" inline hint="传输层级账号（少见，通常留空）">
                    <TextField
                      value={dialerAuth.password ?? ''}
                      disabled={disabled}
                      placeholder="可选"
                      autoComplete="off"
                      onChange={(e) => patchDialerAuth({ password: e.target.value })}
                    />
                  </FieldRow>
                  {showTLS ? (
                    <FormSection title="TLS" hint="仅 TLS 系拨号器">
                      <FieldRow label="CA 文件" inline hint="双向 TLS 时给信任的 CA 证书路径">
                        <TextField
                          value={tls.caFile ?? ''}
                          disabled={disabled}
                          placeholder="ca.pem"
                          onChange={(e) => patchTLS({ caFile: e.target.value })}
                        />
                      </FieldRow>
                      <FieldRow label="ServerName" inline hint="SNI，例：example.com">
                        <TextField
                          value={tls.serverName ?? ''}
                          disabled={disabled}
                          placeholder="example.com"
                          onChange={(e) => patchTLS({ serverName: e.target.value })}
                        />
                      </FieldRow>
                      <FieldRow label="验证证书" inline>
                        <Switch
                          checked={tls.secure === true}
                          onChange={(v) => patchTLS({ secure: v ? true : undefined })}
                          label={tls.secure ? '校验 (secure)' : '跳过校验'}
                          hint="关闭=不校验证书（仅测试用）；开启=严格校验"
                        />
                      </FieldRow>
                    </FormSection>
                  ) : null}
                </FormSection>

                <FieldRow label="节点网卡" inline hint="覆盖 hop 层级的默认值">
                  <TextField
                    value={item.interface ?? ''}
                    disabled={disabled}
                    placeholder="可选，覆盖 hop"
                    onChange={(e) => {
                      const next: Node = { ...item }
                      if (e.target.value) next.interface = e.target.value
                      else delete next.interface
                      const arr = nodes.slice()
                      arr[i] = next
                      updateNodes(arr)
                    }}
                  />
                </FieldRow>
                <FieldRow label="节点 bypass" inline hint="覆盖 hop 层级的默认值">
                  <ResourceRefField
                    refKind="bypasses"
                    value={item.bypass ?? ''}
                    disabled={disabled}
                    onChange={(v) => {
                      const next: Node = { ...item }
                      if (v) next.bypass = v
                      else delete next.bypass
                      const arr = nodes.slice()
                      arr[i] = next
                      updateNodes(arr)
                    }}
                  />
                </FieldRow>
              </div>
            )
          }}
        />
      </FormSection>
    </div>
  )
}

export default HopForm
