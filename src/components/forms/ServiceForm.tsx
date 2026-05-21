import type { ResourceFormProps } from '@/components/forms/types'
import {
  FormSection,
  FieldRow,
  TextField,
  SelectField,
  RowList,
} from '@/components/ui/Form'
import { TypeHint } from '@/components/ui/TypeHint'
import { ResourceRefField } from '@/components/ui/ResourceRefField'
import { HANDLER_TYPES, LISTENER_TYPES } from '@/lib/gostTypes'
import { HANDLER_TYPE_HELP, LISTENER_TYPE_HELP } from '@/lib/help'

type Dict = Record<string, unknown>

function asDict(v: unknown): Dict {
  return v && typeof v === 'object' ? (v as Dict) : {}
}

function asString(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

type ForwarderNode = { name?: string; addr?: string }

const TLS_LISTENER_TYPES = new Set([
  'tls',
  'mtls',
  'wss',
  'mwss',
  'http2',
  'h2',
  'grpc',
  'quic',
])

const FORWARDER_HANDLER_TYPES = new Set([
  'forward',
  'tcp',
  'udp',
  'relay',
  'rtcp',
  'rudp',
])

export function ServiceForm({ value, onChange, disabled }: ResourceFormProps) {
  const handler = asDict(value.handler)
  const listener = asDict(value.listener)
  const forwarder = asDict(value.forwarder)
  const handlerAuth = asDict(handler.auth)
  const listenerAuth = asDict(listener.auth)
  const listenerTls = asDict(listener.tls)

  const handlerType = asString(handler.type)
  const listenerType = asString(listener.type)

  const nodes: ForwarderNode[] = Array.isArray(forwarder.nodes)
    ? (forwarder.nodes as ForwarderNode[])
    : []

  const patchHandler = (patch: Dict) => {
    onChange({ ...value, handler: { ...handler, ...patch } })
  }
  const patchHandlerAuth = (patch: Dict) => {
    const nextAuth = { ...handlerAuth, ...patch }
    const hasAny =
      asString(nextAuth.username).length > 0 ||
      asString(nextAuth.password).length > 0
    const nextHandler: Dict = { ...handler }
    if (hasAny) {
      nextHandler.auth = nextAuth
    } else {
      delete nextHandler.auth
    }
    onChange({ ...value, handler: nextHandler })
  }
  const patchListener = (patch: Dict) => {
    onChange({ ...value, listener: { ...listener, ...patch } })
  }
  const patchListenerAuth = (patch: Dict) => {
    const nextAuth = { ...listenerAuth, ...patch }
    const hasAny =
      asString(nextAuth.username).length > 0 ||
      asString(nextAuth.password).length > 0
    const nextListener: Dict = { ...listener }
    if (hasAny) {
      nextListener.auth = nextAuth
    } else {
      delete nextListener.auth
    }
    onChange({ ...value, listener: nextListener })
  }
  const patchListenerTls = (patch: Dict) => {
    onChange({
      ...value,
      listener: { ...listener, tls: { ...listenerTls, ...patch } },
    })
  }

  const setForwarderNodes = (next: ForwarderNode[]) => {
    onChange({
      ...value,
      forwarder: { ...forwarder, nodes: next },
    })
  }

  const setTopString = (key: string, v: string) => {
    const next: Dict = { ...value }
    if (v.length > 0) {
      next[key] = v
    } else {
      delete next[key]
    }
    onChange(next)
  }

  const showTls = TLS_LISTENER_TYPES.has(listenerType)
  const showForwarder = FORWARDER_HANDLER_TYPES.has(handlerType)

  return (
    <div className="flex flex-col gap-4">
      <FormSection title="基础">
        <FieldRow
          label="监听地址"
          hint="例如 :1080 监听全网卡，或 127.0.0.1:8080 只本地，或 0.0.0.0:8388"
        >
          <TextField
            value={asString(value.addr)}
            disabled={disabled}
            placeholder=":1080"
            onChange={(e) => onChange({ ...value, addr: e.target.value })}
          />
        </FieldRow>
        <FieldRow
          label="绑定网卡"
          hint="填网卡名（如 eth0）或源 IP，留空跟默认路由"
        >
          <TextField
            value={asString(value.interface)}
            disabled={disabled}
            placeholder="eth0"
            onChange={(e) => setTopString('interface', e.target.value)}
          />
        </FieldRow>
      </FormSection>

      <FormSection title="处理器 (handler)">
        <FieldRow label="类型" hint="决定入口协议；下方有该类型的简短说明">
          <SelectField
            value={handlerType}
            onChange={(v) => patchHandler({ type: v })}
            options={HANDLER_TYPES}
            placeholder="— 选择类型 —"
            allowEmpty
          />
          <TypeHint text={HANDLER_TYPE_HELP[handlerType]} />
        </FieldRow>
        <FieldRow
          label="链路 chain"
          hint="想让出口走代理时选已建的链路；不需要就保持「不绑定」"
        >
          <ResourceRefField
            refKind="chains"
            value={asString(handler.chain)}
            disabled={disabled}
            onChange={(v) => {
              const next: Dict = { ...handler }
              if (v.length > 0) next.chain = v
              else delete next.chain
              onChange({ ...value, handler: next })
            }}
          />
        </FieldRow>
        <FieldRow
          label="认证用户名"
          hint="留空表示不要求认证；与 auther 引用二选一即可"
        >
          <TextField
            value={asString(handlerAuth.username)}
            disabled={disabled}
            placeholder="user"
            onChange={(e) => patchHandlerAuth({ username: e.target.value })}
          />
        </FieldRow>
        <FieldRow
          label="认证密码"
          hint="留空表示不要求认证；与 auther 引用二选一即可"
        >
          <TextField
            type="password"
            value={asString(handlerAuth.password)}
            disabled={disabled}
            placeholder="pass"
            onChange={(e) => patchHandlerAuth({ password: e.target.value })}
          />
        </FieldRow>
      </FormSection>

      <FormSection title="监听器 (listener)">
        <FieldRow label="类型" hint="决定底层传输；TLS/WSS 等需要再填证书">
          <SelectField
            value={listenerType}
            onChange={(v) => patchListener({ type: v })}
            options={LISTENER_TYPES}
            placeholder="— 选择类型 —"
            allowEmpty
          />
          <TypeHint text={LISTENER_TYPE_HELP[listenerType]} />
        </FieldRow>
        <FieldRow
          label="认证用户名"
          hint="留空表示不要求认证；与 auther 引用二选一即可"
        >
          <TextField
            value={asString(listenerAuth.username)}
            disabled={disabled}
            placeholder="user"
            onChange={(e) => patchListenerAuth({ username: e.target.value })}
          />
        </FieldRow>
        <FieldRow
          label="认证密码"
          hint="留空表示不要求认证；与 auther 引用二选一即可"
        >
          <TextField
            type="password"
            value={asString(listenerAuth.password)}
            disabled={disabled}
            placeholder="pass"
            onChange={(e) => patchListenerAuth({ password: e.target.value })}
          />
        </FieldRow>
        {showTls ? (
          <>
            <FieldRow
              label="TLS certFile"
              hint="证书路径，例如 /etc/gost/cert.pem"
            >
              <TextField
                value={asString(listenerTls.certFile)}
                disabled={disabled}
                placeholder="/etc/gost/cert.pem"
                onChange={(e) => patchListenerTls({ certFile: e.target.value })}
              />
            </FieldRow>
            <FieldRow
              label="TLS keyFile"
              hint="私钥路径，例如 /etc/gost/key.pem"
            >
              <TextField
                value={asString(listenerTls.keyFile)}
                disabled={disabled}
                placeholder="/etc/gost/key.pem"
                onChange={(e) => patchListenerTls({ keyFile: e.target.value })}
              />
            </FieldRow>
            <FieldRow
              label="TLS caFile"
              hint="双向 TLS 时填，例如 /etc/gost/ca.pem，否则留空"
            >
              <TextField
                value={asString(listenerTls.caFile)}
                disabled={disabled}
                placeholder="/etc/gost/ca.pem"
                onChange={(e) => patchListenerTls({ caFile: e.target.value })}
              />
            </FieldRow>
          </>
        ) : null}
      </FormSection>

      {showForwarder ? (
        <FormSection title="转发目标 (forwarder.nodes)">
          <RowList<ForwarderNode>
            items={nodes}
            onAdd={() =>
              setForwarderNodes([...nodes, { name: '', addr: '' }])
            }
            onRemove={(i) =>
              setForwarderNodes(nodes.filter((_, idx) => idx !== i))
            }
            addLabel="＋ 添加目标"
            empty="尚未添加转发目标"
            render={(node, i) => (
              <div className="flex flex-col gap-2">
                <FieldRow label="名称" hint="任意标识，便于识别该目标">
                  <TextField
                    value={asString(node.name)}
                    disabled={disabled}
                    placeholder={`target-${i}`}
                    onChange={(e) => {
                      const next = nodes.slice()
                      next[i] = { ...next[i], name: e.target.value }
                      setForwarderNodes(next)
                    }}
                  />
                </FieldRow>
                <FieldRow label="地址" hint="形如 192.168.1.1:1234，host:port">
                  <TextField
                    value={asString(node.addr)}
                    disabled={disabled}
                    placeholder="192.168.1.1:1234"
                    onChange={(e) => {
                      const next = nodes.slice()
                      next[i] = { ...next[i], addr: e.target.value }
                      setForwarderNodes(next)
                    }}
                  />
                </FieldRow>
              </div>
            )}
          />
        </FormSection>
      ) : null}

      <FormSection title="关联">
        <FieldRow label="准入规则 admission" hint="想限制谁能连入时选一个；否则不绑定">
          <ResourceRefField
            refKind="admissions"
            value={asString(value.admission)}
            disabled={disabled}
            onChange={(v) => setTopString('admission', v)}
          />
        </FieldRow>
        <FieldRow label="旁路规则 bypass" hint="命中规则的目标会跳过 chain 直连；本地/国内域名常用">
          <ResourceRefField
            refKind="bypasses"
            value={asString(value.bypass)}
            disabled={disabled}
            onChange={(v) => setTopString('bypass', v)}
          />
        </FieldRow>
        <FieldRow label="DNS 解析 resolver" hint="想强制走特定 DNS 时选一个；否则跟系统">
          <ResourceRefField
            refKind="resolvers"
            value={asString(value.resolver)}
            disabled={disabled}
            onChange={(v) => setTopString('resolver', v)}
          />
        </FieldRow>
        <FieldRow label="主机表 hosts" hint="想用私有域名映射时选一个；否则不绑定">
          <ResourceRefField
            refKind="hosts"
            value={asString(value.hosts)}
            disabled={disabled}
            onChange={(v) => setTopString('hosts', v)}
          />
        </FieldRow>
      </FormSection>

      <ServiceSummary value={value} />
    </div>
  )
}

function ServiceSummary({ value }: { value: Dict }) {
  const addr = asString(value.addr)
  const handler = asDict(value.handler)
  const listener = asDict(value.listener)
  const forwarder = asDict(value.forwarder)
  const handlerType = asString(handler.type)
  const listenerType = asString(listener.type)
  const chain = asString(handler.chain)
  const hasHandlerAuth = !!asDict(handler.auth).username
  const nodes = Array.isArray(forwarder.nodes) ? (forwarder.nodes as ForwarderNode[]) : []
  const bypass = asString(value.bypass)

  let line: React.ReactNode
  if (!addr) {
    line = <span className="text-[var(--color-muted)]">先填监听地址再来看摘要。</span>
  } else if (!handlerType) {
    line = (
      <span>
        将在 <Tok>{addr}</Tok> 监听，但还没选 handler 类型。
      </span>
    )
  } else {
    const parts: React.ReactNode[] = [
      <span key="a">
        在 <Tok>{addr}</Tok> 起 <Tok>{handlerType}</Tok>
        {hasHandlerAuth ? ' (带账号)' : ''} 入口
      </span>,
    ]
    if (listenerType) parts.push(<span key="l"> · <Tok>{listenerType}</Tok> 监听</span>)
    if (chain) parts.push(<span key="c"> · 出口走链路 <Tok>{chain}</Tok></span>)
    if (nodes.length > 0)
      parts.push(<span key="f"> · 转发到 <Tok>{nodes.length}</Tok> 个目标</span>)
    if (bypass) parts.push(<span key="b"> · 旁路 <Tok>{bypass}</Tok></span>)
    line = <>{parts}</>
  }

  return (
    <div className="rounded-md border border-[color-mix(in_oklab,var(--color-accent)_30%,var(--color-border))] bg-[color-mix(in_oklab,var(--color-accent-soft)_45%,transparent)] px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="eyebrow" style={{ color: 'var(--color-accent)' }}>摘要</span>
        <span className="text-[10px] font-mono text-[var(--color-muted)] tracking-wider">
          你将创建 →
        </span>
      </div>
      <div className="text-[13px] leading-relaxed text-[var(--color-fg)]">{line}</div>
    </div>
  )
}

function Tok({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[12px] px-1 py-px rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-fg)]">
      {children}
    </code>
  )
}

export default ServiceForm
