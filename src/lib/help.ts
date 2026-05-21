import type { ResourceKey } from './resources'

export type ResourceIntro = {
  /** 一句话功能描述 */
  what: string
  /** 什么场景该建这种资源 */
  when: string
  /** 与其它资源的关系 */
  relate?: string
  /** 配置范式（一两句话总结字段在干嘛） */
  shape?: string
}

export const RESOURCE_INTRO: Record<ResourceKey, ResourceIntro> = {
  services: {
    what: '服务（service）是 gost 的入口：在一个本机端口上跑一个协议（HTTP/SOCKS5/Shadowsocks/relay/端口转发…），等客户端连入。',
    when: '新建一个服务 = 在本机起一个监听端口。最常见的两种用法：① 当本机代理（让浏览器走 SOCKS5/HTTP）；② 端口转发（把进来的连接送到另一台机器）。',
    relate: '想"走上游再出网"就配合 chain；想加用户名密码登录就引用 auther；想限制谁能连接就引用 admission / bypass。',
    shape: '一条 service = 监听地址(addr) + 入口协议(handler) + 传输层(listener) + 可选转发目标(forwarder)。',
  },
  chains: {
    what: '链路（chain）= 一组按顺序串起来的"跳点"。一条流量进来后，会按链路里的顺序依次穿过这些跳点出去。',
    when: '想让服务的出口走代理（一级或多级代理串联）时建一条 chain，然后在 service.handler.chain 里引用它。',
    relate: 'chain 引用 hop（跳点组）。一个 hop 里可以有多个等价节点供选择。',
    shape: '一条 chain = 选择策略 selector + 跳点序列 hops。每个 hop 项要么是已配置 hop 的名字，要么内联一组节点。',
  },
  hops: {
    what: '跳点（hop）= 一组等价的上游节点。链路在一个 hop 上会按 selector 策略挑一个节点用。',
    when: '你有多个等价上游代理时（比如多个 SOCKS5 出口）放一个 hop 里做负载/容灾。哪怕只有一个上游也建议建个 hop，方便日后扩。',
    relate: '被 chain 引用。每个节点有自己的 connector（用什么代理协议）和 dialer（怎么建底层连接）。',
    shape: '一条 hop = 选择策略 selector + 节点列表 nodes。每个节点 = 地址 + connector + dialer。',
  },
  authers: {
    what: '认证器（auther）= 一份用户名/密码清单。被 handler/listener/connector 引用后即可启用账号认证。',
    when: '想给入口加用户名密码登录、或访问上游需要用户名密码时建一个。',
    relate: '在 service.handler.auther 或 listener.auther 字段里按名称引用。',
    shape: '一条 auther = 一组 {username, password} 键值对。',
  },
  admissions: {
    what: '准入规则（admission）= "白名单/黑名单"。命中规则的来源 IP/CIDR 才允许进入（或反过来）。',
    when: '想限制谁能用你这个 gost 服务时建一个。',
    relate: '在 service.admission 里引用。',
    shape: '一条 admission = whitelist 开关 + matcher 列表。matcher 支持 IP、CIDR。',
  },
  bypasses: {
    what: '旁路规则（bypass）= "命中则跳过 chain 直连"。例如局域网或常见国内站点不走代理。',
    when: '配 chain 走上游代理时，几乎一定要配 bypass 把本地/国内流量绕过去。',
    relate: '在 service / chain / hop / node 各级都可以引用，按层级生效。',
    shape: '一条 bypass = whitelist 开关 + matcher 列表。matcher 支持 IP、CIDR、glob 域名。',
  },
  resolvers: {
    what: '解析器（resolver）= 自定义 DNS 上游列表。gost 会用它做域名解析。',
    when: '想强制走某些 DNS（防污染、走 DoT/DoH）或者特定服务用特定 DNS 时建一个。',
    relate: '在 service.resolver 里引用。',
    shape: '一条 resolver = nameserver 列表，每个可以是 udp / tcp / tls / https 形式。',
  },
  hosts: {
    what: '主机表（hosts）= 内置的 /etc/hosts 等价物，把域名直接映射到 IP，跳过 DNS。',
    when: '想给 chain/服务一份私有 DNS（如把 example.internal 指向某内网 IP）时建一个。',
    relate: '在 service.hosts 里引用。',
    shape: '一条 hosts = mapping 列表，每条 {ip, hostname, aliases}。',
  },
  ingresses: {
    what: '入口路由（ingress）= 按 SNI/hostname 把同一端口的流量分发给不同后端（hop/endpoint）。',
    when: '想用一个端口同时承载多个上游/租户时用，配合 tunnel 协议常见。',
  },
  routers: {
    what: '路由器（router）= TUN/TAP 模式下的路由表（哪些网段走哪个节点）。',
    when: '只在 tun/tap 透明组网场景用得到。',
  },
  observers: {
    what: '观察者（observer）= 把 gost 内部事件回调出去（HTTP/插件），自己做监控/告警。',
    when: '想拿到流量、连接、错误的实时事件做外部系统集成时配置。',
  },
  recorders: {
    what: '记录器（recorder）= 把请求/连接元数据写入文件或 Redis 等存储。',
    when: '需要做访问日志、审计、流量留档时配置。',
  },
  sds: {
    what: '服务发现（sd）= 让 gost 从插件/外部源动态发现上游节点列表，不必手写 hop。',
    when: '上游节点动态变化（K8s、注册中心）时使用。',
  },
  limiters: {
    what: '限流器（limiter）= 按服务/客户端做带宽限速（bps）。',
    when: '想限制每个服务或每个客户端的带宽上限时配置。',
    shape: 'limits 是规则字符串数组，例如 "$ 1MB 2MB" 表示服务上下行 1MB/2MB 起步。',
  },
  climiters: {
    what: '连接限流（climiter）= 限制并发连接数。',
    when: '想给服务设最大并发或每客户端最大连接时配置。',
  },
  rlimiters: {
    what: '速率限流（rlimiter）= 限制请求速率（QPS）。',
    when: '想给服务做 QPS 限流时配置。',
  },
}

export const HANDLER_TYPE_HELP: Record<string, string> = {
  http:        'HTTP 代理。客户端用 http_proxy=http://host:port 接入。',
  http2:       'HTTP/2 代理（含 h2c）。需要 HTTP/2 客户端。',
  socks4:      'SOCKS4 代理。老协议，建议用 socks5。',
  socks5:      'SOCKS5 代理。最通用的本机代理形式。',
  ss:          'Shadowsocks 协议入口。metadata 里要给 method 和 password。',
  relay:       'gost 自家 relay 协议，常用来把端口转发或反向隧道串起来。',
  forward:     '通用转发：连接进来就送到 forwarder.nodes 里的目标。',
  tcp:         'TCP 端口转发。需要在 forwarder.nodes 里指定目标 host:port。',
  udp:         'UDP 端口转发。同 tcp，但走 UDP。',
  redirect:    'Linux iptables REDIRECT 透明代理入口。需要 root + iptables 规则。',
  tproxy:      'Linux TPROXY 透明代理（支持 UDP）。需要 root + iptables。',
  dns:         'DNS 代理。把进来的 DNS 查询转给指定上游。',
  sshd:        'SSH 服务端隧道：让客户端通过 ssh 协议连进来再分发。',
  serial:      '串口转发：把 TCP 连接转到串口设备。',
  unix:        '把流量转给 unix socket。',
  rtcp:        '反向 TCP 隧道：客户端连出，服务端被动转发（内网穿透常用）。',
  rudp:        '反向 UDP 隧道。',
  tun:         'TUN 设备：三层 VPN。',
  tap:         'TAP 设备：二层 VPN。',
  file:        '简单文件服务。',
}

export const LISTENER_TYPE_HELP: Record<string, string> = {
  tcp:      '裸 TCP。最常见。',
  udp:      '裸 UDP。',
  tls:      'TLS：必须配 certFile + keyFile。',
  mtls:     '双向 TLS，再加 caFile 校验客户端。',
  ws:       'WebSocket：握手走 HTTP/1.1 升级，便于穿过 7 层网关。',
  wss:      'WebSocket over TLS：需要证书。',
  mws:      'WebSocket 复用（多路）。',
  mwss:     'WebSocket+TLS+复用。',
  http2:    'HTTP/2 over TLS。',
  h2:       'HTTP/2 over TLS。',
  h2c:      'HTTP/2 明文。',
  grpc:     'gRPC over HTTP/2 TLS。',
  kcp:      'KCP（UDP 之上的可靠传输）。',
  quic:     'QUIC（HTTP/3 的传输层）。',
  ftcp:     '伪装的 TCP，复用场景。',
  ssh:      'SSH 客户端模式。',
  sshd:     'SSH 服务端模式。',
  redirect: '配合 redirect handler 的透明代理监听。',
  tproxy:   '配合 tproxy handler 的透明代理监听。',
  serial:   '串口。',
  unix:     'unix socket。',
  rtcp:     '反向 TCP 隧道接入。',
  rudp:     '反向 UDP 隧道接入。',
  tun:      'TUN 设备。',
  tap:      'TAP 设备。',
}

export const CONNECTOR_TYPE_HELP: Record<string, string> = {
  http:    '走 HTTP 代理协议连上游。',
  http2:   '走 HTTP/2 代理协议连上游。',
  socks4:  '走 SOCKS4 代理。',
  socks5:  '走 SOCKS5 代理连上游。最常见。',
  ss:      '走 Shadowsocks 协议连上游。',
  relay:   '走 gost relay 协议连上游。',
  forward: '不包代理协议，直接转发。',
  sshd:    '走 ssh 协议连上游（客户端侧）。',
  tunnel:  'gost tunnel 协议。',
}

export const DIALER_TYPE_HELP: Record<string, string> = {
  tcp:   'TCP 拨号（最常见）。',
  udp:   'UDP 拨号。',
  tls:   'TLS over TCP。',
  mtls:  '双向 TLS。',
  ws:    'WebSocket（HTTP/1.1 升级）。',
  wss:   'WebSocket over TLS。',
  http2: 'HTTP/2 over TLS 拨号。',
  h2:    'HTTP/2 TLS。',
  h2c:   'HTTP/2 明文。',
  grpc:  'gRPC TLS。',
  kcp:   'KCP over UDP。',
  quic:  'QUIC。',
  ssh:   'SSH 拨号。',
}

export const SELECTOR_STRATEGY_HELP: Record<string, string> = {
  round: '轮询：依次使用每个节点。',
  rand:  '随机挑一个。',
  fifo:  '首选可用：从前往后挑第一个健康的。',
  hash:  '一致性哈希：按源做粘性选择。',
}

export type ServiceScenario = {
  key: string
  label: string
  summary: string
  /** 预设套用后会同时填入 name 和 body —— 用户改改就能直接保存。 */
  name: string
  body: Record<string, unknown>
}

/** 服务表单的"快速搭建"预设。端口故意全部错开，可以连续套多个不冲突。 */
export const SERVICE_SCENARIOS: ServiceScenario[] = [
  {
    key: 'socks5-local',
    label: 'SOCKS5 本机代理',
    summary: '本机起 SOCKS5，浏览器/系统设为 host:1080 即可走 gost。',
    name: 'socks5-1080',
    body: {
      addr: ':1080',
      handler: { type: 'socks5' },
      listener: { type: 'tcp' },
    },
  },
  {
    key: 'http-local',
    label: 'HTTP 代理',
    summary: '本机起 HTTP 代理（兼容 https），浏览器 http_proxy=host:8080。',
    name: 'http-8080',
    body: {
      addr: ':8080',
      handler: { type: 'http' },
      listener: { type: 'tcp' },
    },
  },
  {
    key: 'http-with-auth',
    label: 'HTTP 代理（带账号）',
    summary: '加用户名/密码再开放。下方"认证用户名/密码"直接填好；或者在 认证器 里建 auther 再引用。',
    name: 'http-auth-8081',
    body: {
      addr: ':8081',
      handler: {
        type: 'http',
        auth: { username: 'admin', password: 'changeme' },
      },
      listener: { type: 'tcp' },
    },
  },
  {
    key: 'tcp-forward',
    label: 'TCP 端口转发',
    summary: '把本机 :2222 转到内网主机 22 端口（远程登录跳板常用）。',
    name: 'tcp-forward-2222',
    body: {
      addr: ':2222',
      handler: { type: 'tcp' },
      listener: { type: 'tcp' },
      forwarder: { nodes: [{ name: 'target', addr: '192.168.1.10:22' }] },
    },
  },
  {
    key: 'socks5-via-chain',
    label: 'SOCKS5 出口走上游',
    summary: '本机 SOCKS5 收进，按下方"链路"字段指定的 chain 走上游。需先在 链路/跳点 里配好。',
    name: 'socks5-via-chain-1081',
    body: {
      addr: ':1081',
      handler: { type: 'socks5' },
      listener: { type: 'tcp' },
    },
  },
  {
    key: 'ss-server',
    label: 'Shadowsocks 服务端',
    summary: '对外开 SS 端口；method / password 默认 aes-128-gcm / changeme，请改成你的密码。',
    name: 'ss-8388',
    body: {
      addr: ':8388',
      handler: {
        type: 'ss',
        metadata: { method: 'aes-128-gcm', password: 'changeme' },
      },
      listener: { type: 'tcp' },
    },
  },
  {
    key: 'rtcp-tunnel',
    label: '反向 TCP 隧道（内网穿透）',
    summary: '从有公网的机器接收回连，把流量转给内网某端口；要配合另一端的客户端使用。',
    name: 'rtcp-22',
    body: {
      addr: ':0',
      handler: { type: 'rtcp' },
      listener: { type: 'rtcp' },
      forwarder: { nodes: [{ name: 'inner', addr: '192.168.1.10:22' }] },
    },
  },
]

/** 资源整体外部参考链接。 */
export const DOCS_URL = 'https://gost.run/'

/**
 * gost.run 实际文档路径 — 单数 / 自定义路径，而非简单复数。
 * 命中映射的资源跳到对应概念页；未命中的跳到配置总览。
 */
const DOC_PATHS: Partial<Record<ResourceKey, string>> = {
  services:   'docs/concepts/service',
  chains:     'docs/concepts/chain',
  hops:       'docs/concepts/hop',
  authers:    'docs/concepts/auther',
  admissions: 'docs/concepts/admission',
  bypasses:   'docs/concepts/bypass',
  resolvers:  'docs/concepts/resolver',
  hosts:      'docs/concepts/hosts',
  ingresses:  'docs/concepts/ingress',
  routers:    'docs/concepts/router',
  observers:  'docs/concepts/observer',
  recorders:  'docs/concepts/recorder',
  sds:        'docs/concepts/sd',
  limiters:   'docs/concepts/limiter',
  climiters:  'docs/concepts/limiter',
  rlimiters:  'docs/concepts/limiter',
}

export function docUrlFor(key: ResourceKey): string {
  const path = DOC_PATHS[key] ?? 'docs/configuration'
  return `${DOCS_URL}${path}/`
}
