import type { GostItem } from './queries'
import { getActiveProfile } from './profiles'

export type ClientHint = {
  title: string
  desc?: string
  code: string
  /** Render as multi-line code block vs inline. Defaults to inline if single line. */
  block?: boolean
}

type Auth = { username?: string; password?: string } | undefined

type Forwarder = { nodes?: Array<{ name?: string; addr?: string }> } | undefined

type Ctx = {
  host: string
  port: string
  addr: string
  handlerType: string
  handlerAuth: Auth
  handlerAutherName: string | undefined
  metadata: Record<string, unknown>
  listenerType: string
  forwarder: Forwarder
}

export function buildClientHints(service: GostItem): ClientHint[] {
  const ctx = buildCtx(service)
  const builder = BUILDERS[ctx.handlerType] ?? generic
  return builder(ctx)
}

function buildCtx(service: GostItem): Ctx {
  const profile = getActiveProfile()
  const host = profile ? hostnameOf(profile.apiBase) : 'host'
  const addr = String((service as { addr?: string }).addr ?? '')
  const port = parsePort(addr)
  const handler = (service.handler ?? {}) as {
    type?: string
    auth?: Auth
    auther?: string
    metadata?: Record<string, unknown>
  }
  const listener = (service.listener ?? {}) as { type?: string }
  return {
    host,
    port,
    addr,
    handlerType: handler.type ?? '',
    handlerAuth: handler.auth,
    handlerAutherName: handler.auther,
    metadata: handler.metadata ?? {},
    listenerType: listener.type ?? '',
    forwarder: (service as { forwarder?: Forwarder }).forwarder,
  }
}

function authPart(ctx: Ctx): { creds: string; note?: string } {
  if (ctx.handlerAuth?.username) {
    return { creds: `${ctx.handlerAuth.username}:${ctx.handlerAuth.password ?? ''}` }
  }
  if (ctx.handlerAutherName) {
    return {
      creds: `USERNAME:PASSWORD`,
      note: `把 USERNAME:PASSWORD 换成认证器「${ctx.handlerAutherName}」里配置的账号。`,
    }
  }
  return { creds: '' }
}

/* ------------------------------------------------------------------ */

const BUILDERS: Record<string, (ctx: Ctx) => ClientHint[]> = {
  socks5: (ctx) => {
    const { creds, note } = authPart(ctx)
    const userInfo = creds ? `${creds}@` : ''
    return [
      {
        title: 'curl 命令行',
        desc: '走这个 SOCKS5 代理 curl 任意 https URL，用来快速测试。',
        code: `curl --socks5-hostname ${userInfo}${ctx.host}:${ctx.port} https://ifconfig.me`,
      },
      {
        title: 'Shell 环境变量',
        desc: '设了之后 git / pip / npm / wget 等遵守 ALL_PROXY 的工具自动走。',
        code: `export ALL_PROXY=socks5h://${userInfo}${ctx.host}:${ctx.port}`,
      },
      {
        title: 'Chrome / Edge（用 SwitchyOmega 等扩展）',
        code:
          `协议: SOCKS5\n` +
          `服务器: ${ctx.host}\n` +
          `端口:   ${ctx.port}` +
          (creds ? `\n账号:   ${creds.split(':')[0]}\n密码:   (用配置的密码)` : ''),
        block: true,
      },
      {
        title: '手机 / Shadowrocket / Surge',
        desc: '导入 SOCKS5 节点；如不带账号留空即可。',
        code: `socks5://${userInfo}${ctx.host}:${ctx.port}`,
      },
      ...(note ? [{ title: '提示', code: note } as ClientHint] : []),
    ]
  },

  http: (ctx) => {
    const { creds, note } = authPart(ctx)
    const userInfo = creds ? `${creds}@` : ''
    const url = `http://${userInfo}${ctx.host}:${ctx.port}`
    return [
      {
        title: 'Shell 环境变量',
        desc: '所有遵守 http_proxy 的程序（curl / wget / apt / pip / docker）都走。',
        code: `export http_proxy=${url}\nexport https_proxy=${url}`,
        block: true,
      },
      {
        title: 'curl 命令行',
        code: `curl -x ${url} https://ifconfig.me`,
      },
      {
        title: 'Git',
        code: `git config --global http.proxy ${url}`,
      },
      {
        title: 'Chrome 启动参数（临时）',
        code: `chrome --proxy-server="http://${ctx.host}:${ctx.port}"`,
      },
      ...(note ? [{ title: '提示', code: note } as ClientHint] : []),
    ]
  },

  http2: (ctx) => BUILDERS.http(ctx),

  socks4: (ctx) => [
    {
      title: 'curl 命令行',
      code: `curl --socks4 ${ctx.host}:${ctx.port} https://ifconfig.me`,
    },
    {
      title: '环境变量',
      code: `export ALL_PROXY=socks4://${ctx.host}:${ctx.port}`,
    },
  ],

  ss: (ctx) => {
    const method = String(ctx.metadata.method ?? 'aes-128-gcm')
    const password = String(ctx.metadata.password ?? 'CHANGEME')
    const userinfo = btoaSafe(`${method}:${password}`)
    const ssUrl = `ss://${userinfo}@${ctx.host}:${ctx.port}#${encodeURIComponent('gost-' + ctx.port)}`
    return [
      {
        title: 'SS 链接（粘贴到 Shadowrocket / Clash / V2RayN）',
        desc: '主流 SS 客户端都能直接导入。',
        code: ssUrl,
      },
      {
        title: '客户端字段对照',
        code:
          `服务器:   ${ctx.host}\n` +
          `端口:     ${ctx.port}\n` +
          `加密方式: ${method}\n` +
          `密码:     ${password}`,
        block: true,
      },
    ]
  },

  tcp: (ctx) => forwardHints(ctx, 'TCP'),
  udp: (ctx) => forwardHints(ctx, 'UDP'),
  forward: (ctx) => forwardHints(ctx, 'TCP/UDP'),
  rudp: (ctx) => forwardHints(ctx, 'UDP（反向）'),

  rtcp: (ctx) => {
    const fwd = ctx.forwarder?.nodes?.[0]
    const tunnelID = String(ctx.metadata.tunnelID ?? '')
    return [
      {
        title: '内网那台机器（gost CLI 客户端）',
        desc: '不是这里，是真正在内网那台机器上跑 gost 二进制。',
        code:
          tunnelID
            ? `gost -L "rtcp://:0/${fwd?.addr ?? 'inner:port'}?tunnelID=${tunnelID}" \\\n     -F "tcp://${ctx.host}:${ctx.port}"`
            : `gost -L "rtcp://:0/${fwd?.addr ?? 'inner:port'}" \\\n     -F "tcp://${ctx.host}:${ctx.port}"`,
        block: true,
      },
      {
        title: '外部接入',
        desc: '隧道建立后从任何地方连这个公网端口，会被打到内网目标。',
        code: `# 例：${fwd?.addr?.endsWith(':22') ? `ssh -p ${ctx.port} user@${ctx.host}` : `连 ${ctx.host}:${ctx.port}`}`,
        block: true,
      },
    ]
  },

  dns: (ctx) => [
    {
      title: 'dig 测试',
      code: `dig @${ctx.host} -p ${ctx.port} example.com`,
    },
    {
      title: '系统 DNS 指过来',
      desc: 'Linux 改 /etc/resolv.conf，macOS / Windows 改网卡 DNS 设置。',
      code: `nameserver ${ctx.host}`,
    },
  ],

  sshd: (ctx) => [
    {
      title: 'SSH 客户端',
      desc: 'gost sshd 把进入的 ssh 连接当隧道入口；具体用法看 metadata 配置。',
      code: `ssh -p ${ctx.port} user@${ctx.host}`,
    },
  ],

  redirect: () => [
    {
      title: '不直接连',
      desc: '这是透明代理入口，由 iptables / 路由把流量重定向过来。客户端无需感知。详见 cookbook · 「Linux iptables 透明代理」。',
      code: '',
    },
  ],

  tproxy: () => [
    {
      title: '不直接连',
      desc: '透明代理 (TPROXY)，由内核重定向 UDP/TCP，需要 root 加 iptables 规则。客户端无感。',
      code: '',
    },
  ],

  tun: () => [
    {
      title: 'TUN 设备',
      desc: '三层 VPN 形态。需要主机上配置路由表把目标网段送进 tun 接口。',
      code: '',
    },
  ],
  tap: () => [
    {
      title: 'TAP 设备',
      desc: '二层 VPN 形态。配置 bridge 把目标加入。',
      code: '',
    },
  ],

  relay: (ctx) => [
    {
      title: '客户端（另一个 gost）',
      code: `gost -L "tcp://:LOCAL_PORT" -F "relay://${ctx.host}:${ctx.port}"`,
      block: true,
      desc: '由本地某端口转发到这个 relay 入口；relay 后端通常配合 forwarder.nodes 或 tunnel。',
    },
  ],
}

function forwardHints(ctx: Ctx, kind: string): ClientHint[] {
  const targets = ctx.forwarder?.nodes ?? []
  const targetSummary = targets.length
    ? targets.map((n) => n.addr ?? '?').join(', ')
    : '（未配置 forwarder.nodes — 转发目标缺失）'
  return [
    {
      title: '怎么用',
      desc: `${kind} 端口转发：客户端连 ${ctx.host}:${ctx.port}，会被转给：${targetSummary}`,
      code: '',
    },
    ...(targets.length
      ? [
          {
            title: '快速验证',
            code: targetSummary.includes(':22')
              ? `ssh -p ${ctx.port} user@${ctx.host}`
              : kind === 'UDP（反向）' || kind === 'UDP'
                ? `nc -u ${ctx.host} ${ctx.port}`
                : `nc -vz ${ctx.host} ${ctx.port}`,
          },
        ]
      : []),
  ]
}

function generic(ctx: Ctx): ClientHint[] {
  return [
    {
      title: '通用接入',
      desc: `客户端按 ${ctx.handlerType || '?'} 协议连 ${ctx.host}:${ctx.port}。具体姿势看 gost.run/docs/concepts。`,
      code: ctx.addr ? `${ctx.host}:${ctx.port}` : '',
    },
  ]
}

/* ------------------------------------------------------------------ */

function parsePort(addr: string): string {
  // addr forms: ":1080", "host:1080", "0.0.0.0:1080", "[::]:1080"
  const m = addr.match(/:([0-9]+)$/)
  return m ? m[1] : addr || '?'
}

function hostnameOf(url: string): string {
  try { return new URL(url).hostname } catch { return 'host' }
}

function btoaSafe(s: string): string {
  try { return btoa(s) } catch { return s }
}
