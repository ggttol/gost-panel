import type { ResourceKey } from './resources'

export type RecipeCategory =
  | 'proxy'        // 本机/服务端代理
  | 'forward'      // 端口转发
  | 'tunnel'       // 内网穿透 / 隧道
  | 'transparent'  // 透明代理
  | 'special'      // DNS / 隐蔽 / SS 等

export type RecipeVar = {
  key: string
  label: string
  default: string
  hint?: string
  type?: 'text' | 'number' | 'password'
}

export type RecipeResource = {
  kind: ResourceKey
  name: string                       // 可含 {{var}}
  body: Record<string, unknown>      // body 内字符串值可含 {{var}}
}

export type Recipe = {
  key: string
  category: RecipeCategory
  label: string
  /** 一句话场景：写给"我应该选哪个"那一秒的人 */
  scene: string
  /** 2-3 句详细背景：给点选完想了解更多的人 */
  describe: string
  resources: RecipeResource[]
  vars?: RecipeVar[]
  /** 客户端怎么接 —— 几行就够，可以含 {{var}} 和 {{host}}（host 来自当前激活的 profile） */
  client?: string[]
}

const CATEGORY_LABEL: Record<RecipeCategory, string> = {
  proxy:       '代理',
  forward:     '端口转发',
  tunnel:      '内网穿透',
  transparent: '透明代理',
  special:     '特殊用法',
}

export const RECIPE_CATEGORIES: Array<{ key: RecipeCategory; label: string }> =
  (Object.keys(CATEGORY_LABEL) as RecipeCategory[]).map((k) => ({
    key: k,
    label: CATEGORY_LABEL[k],
  }))

/* ------------------------------------------------------------------ */
/*  Recipes — 都是可直接 POST 给 gost 的真实配置，端口尽量错开避免冲突。 */
/*  自定义参数用 {{var}} 占位；apply 时做字符串替换。                  */
/* ------------------------------------------------------------------ */

export const RECIPES: Recipe[] = [
  // ───────── 代理 ─────────
  {
    key: 'socks5-basic',
    category: 'proxy',
    label: 'SOCKS5 本机代理',
    scene: '电脑/手机上开个本地 SOCKS5 入口，浏览器或系统全局走这个 IP:1080 即可。',
    describe: '最常用的代理形态。不带账号，只在内网或本机用。如果要带账号请看「带账号的 SOCKS5」。',
    resources: [
      {
        kind: 'services',
        name: 'socks5-1080',
        body: {
          addr: ':1080',
          handler: { type: 'socks5' },
          listener: { type: 'tcp' },
        },
      },
    ],
    client: [
      '# curl 走代理',
      'curl --socks5 {{host}}:1080 https://ifconfig.me',
      '# ssh 动态转发也可以做 SOCKS5（不需要 gost）',
      '# Chrome 推荐 SwitchyOmega 配置: SOCKS5  {{host}}:1080',
    ],
  },

  {
    key: 'http-basic',
    category: 'proxy',
    label: 'HTTP 代理',
    scene: '需要 http_proxy / https_proxy 环境变量形式的代理（apt、wget、Docker 等都吃这个）。',
    describe: 'HTTP CONNECT 隧道。监听 :8080，等同 Squid / Tinyproxy 的最常见用法。',
    resources: [
      {
        kind: 'services',
        name: 'http-8080',
        body: {
          addr: ':8080',
          handler: { type: 'http' },
          listener: { type: 'tcp' },
        },
      },
    ],
    client: [
      'export http_proxy=http://{{host}}:8080',
      'export https_proxy=http://{{host}}:8080',
      'curl https://ifconfig.me',
    ],
  },

  {
    key: 'http-auth',
    category: 'proxy',
    label: 'HTTP 代理（账号鉴权）',
    scene: '把 HTTP 代理开放给同事/朋友，要求账号密码才能用。',
    describe: '先建一个 auther（账号清单），再让 service 引用它。多用户也支持 — 直接编辑 auther 加行即可。',
    vars: [
      { key: 'user', label: '用户名', default: 'alice' },
      { key: 'pass', label: '密码', default: 'changeme', type: 'password' },
    ],
    resources: [
      {
        kind: 'authers',
        name: 'auth-http',
        body: { auths: [{ username: '{{user}}', password: '{{pass}}' }] },
      },
      {
        kind: 'services',
        name: 'http-auth-8081',
        body: {
          addr: ':8081',
          handler: { type: 'http', auther: 'auth-http' },
          listener: { type: 'tcp' },
        },
      },
    ],
    client: [
      'curl -x http://{{user}}:{{pass}}@{{host}}:8081 https://ifconfig.me',
      '# 或环境变量',
      'export http_proxy=http://{{user}}:{{pass}}@{{host}}:8081',
    ],
  },

  {
    key: 'socks5-via-upstream',
    category: 'proxy',
    label: 'SOCKS5 出口走上游 + 国内直连',
    scene: '"家用梯子"最常见形态：本机 SOCKS5 收流量，国内直连，国外走你买的机场 SOCKS5/SS。',
    describe: '会同时建 bypass（国内常见域名直连）+ hop（你的上游）+ chain（穿过 hop）+ service。bypass 是关键，没有的话所有流量都走上游浪费带宽。',
    vars: [
      { key: 'upstream_addr', label: '上游地址', default: 'proxy.example.com:1080', hint: 'host:port' },
      { key: 'upstream_user', label: '上游用户名', default: '', hint: '没账号留空' },
      { key: 'upstream_pass', label: '上游密码', default: '', type: 'password', hint: '没账号留空' },
    ],
    resources: [
      {
        kind: 'bypasses',
        name: 'bypass-cn',
        body: {
          whitelist: false,
          matchers: [
            '127.0.0.0/8',
            '10.0.0.0/8',
            '172.16.0.0/12',
            '192.168.0.0/16',
            '*.cn',
            '*.baidu.com',
            '*.bilibili.com',
            '*.qq.com',
            '*.taobao.com',
            '*.jd.com',
            '*.aliyun.com',
            '*.weixin.qq.com',
          ],
        },
      },
      {
        kind: 'hops',
        name: 'hop-upstream',
        body: {
          nodes: [
            {
              name: 'upstream',
              addr: '{{upstream_addr}}',
              connector: {
                type: 'socks5',
                auth: { username: '{{upstream_user}}', password: '{{upstream_pass}}' },
              },
              dialer: { type: 'tcp' },
            },
          ],
        },
      },
      {
        kind: 'chains',
        name: 'chain-out',
        body: { hops: [{ name: 'hop-upstream' }] },
      },
      {
        kind: 'services',
        name: 'socks5-via-chain-1082',
        body: {
          addr: ':1082',
          handler: { type: 'socks5', chain: 'chain-out' },
          listener: { type: 'tcp' },
          bypass: 'bypass-cn',
        },
      },
    ],
    client: [
      'curl --socks5 {{host}}:1082 https://ifconfig.me   # 国外目标走上游',
      'curl --socks5 {{host}}:1082 https://baidu.com    # 国内目标直连',
    ],
  },

  // ───────── 端口转发 ─────────
  {
    key: 'ssh-jump',
    category: 'forward',
    label: 'SSH 跳板',
    scene: '内网机器没公网 IP，但 gost 主机能访问内网。把 gost 的 :2222 转给内网某机的 22 端口。',
    describe: '最朴素的 TCP 端口转发。没有任何加密 — 因为 ssh 自己已经加密了。',
    vars: [
      { key: 'target', label: '内网目标', default: '192.168.1.10:22', hint: 'host:port' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'tcp-ssh-jump-2222',
        body: {
          addr: ':2222',
          handler: { type: 'tcp' },
          listener: { type: 'tcp' },
          forwarder: { nodes: [{ name: 'target', addr: '{{target}}' }] },
        },
      },
    ],
    client: ['ssh -p 2222 user@{{host}}'],
  },

  {
    key: 'internal-web',
    category: 'forward',
    label: '把内网 Web 暴露到本机',
    scene: '内网某机跑了 HTTP 服务，想从 gost 主机网段访问 — 比如 NAS 管理页、内网监控。',
    describe: '跟 SSH 跳板一样是 TCP forward，只是目标端口换成 80/443/8080 等。HTTPS 也可以转发，原样透传。',
    vars: [
      { key: 'target', label: '内网 web 地址', default: '192.168.1.10:80', hint: 'host:port' },
      { key: 'expose_port', label: '本地暴露端口', default: '8888', type: 'number' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'tcp-web-{{expose_port}}',
        body: {
          addr: ':{{expose_port}}',
          handler: { type: 'tcp' },
          listener: { type: 'tcp' },
          forwarder: { nodes: [{ name: 'target', addr: '{{target}}' }] },
        },
      },
    ],
    client: ['curl http://{{host}}:{{expose_port}}'],
  },

  {
    key: 'udp-forward',
    category: 'forward',
    label: 'UDP 端口转发',
    scene: 'Minecraft 联机、WireGuard 跳转、DNS 中转 — 用 UDP 协议的服务都用这个。',
    describe: 'UDP 转发跟 TCP 转发一样的形式，只是 handler/listener 类型换成 udp。',
    vars: [
      { key: 'target', label: '内网 UDP 目标', default: '192.168.1.10:25565' },
      { key: 'expose_port', label: '本地暴露端口', default: '25565', type: 'number' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'udp-forward-{{expose_port}}',
        body: {
          addr: ':{{expose_port}}',
          handler: { type: 'udp' },
          listener: { type: 'udp' },
          forwarder: { nodes: [{ name: 'target', addr: '{{target}}' }] },
        },
      },
    ],
    client: [],
  },

  // ───────── 内网穿透 ─────────
  {
    key: 'rtcp-tunnel',
    category: 'tunnel',
    label: '反向 TCP 隧道（公网 → 家里）',
    scene: '家里有 NAS / 工作站，想从公网 SSH 进来。在家里运行客户端连公网 gost，公网开 :2222 把流量送回家。',
    describe: 'rtcp = reverse TCP。本配方建的是**公网侧**的"接收端"；家里那台需要另外配 gost 客户端用 rtcp connector 主动连进来。详见 gost.run/docs/concepts/tunnel。',
    vars: [
      { key: 'inner', label: '家里目标 host:port', default: '192.168.1.10:22' },
      { key: 'tunnel_id', label: 'tunnel 标识', default: 'home-ssh', hint: '客户端要用同样的标识连过来' },
      { key: 'expose_port', label: '公网暴露端口', default: '12022', type: 'number' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'rtcp-{{tunnel_id}}',
        body: {
          addr: ':{{expose_port}}',
          handler: { type: 'rtcp', metadata: { tunnelID: '{{tunnel_id}}' } },
          listener: { type: 'rtcp' },
          forwarder: { nodes: [{ name: 'inner', addr: '{{inner}}' }] },
        },
      },
    ],
    client: [
      '# 在家里那台机器跑（注意是 gost CLI，不是面板）：',
      'gost -L "rtcp://:0/{{inner}}?tunnelID={{tunnel_id}}" -F "tcp://{{host}}:{{expose_port}}"',
      '',
      '# 然后从任何地方:',
      'ssh -p {{expose_port}} user@{{host}}',
    ],
  },

  // ───────── 透明代理 ─────────
  {
    key: 'redirect-tproxy',
    category: 'transparent',
    label: 'Linux iptables 透明代理（旁路由）',
    scene: '把 gost 主机做"旁路由"。其它机器把网关指过来，所有出站流量被透明拦截 → 走 chain 上游。',
    describe: '只在 Linux 上跑（需要 NET_ADMIN）。还要在主机上加 iptables NAT 规则把流量 REDIRECT 到本服务。透明代理 + bypass 是分流的核心组合。',
    vars: [
      { key: 'upstream_addr', label: '上游代理', default: 'proxy.example.com:1080' },
    ],
    resources: [
      {
        kind: 'bypasses',
        name: 'bypass-cn-redirect',
        body: {
          whitelist: false,
          matchers: ['127.0.0.0/8','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16','*.cn'],
        },
      },
      {
        kind: 'hops',
        name: 'hop-redirect-upstream',
        body: {
          nodes: [{
            name: 'upstream',
            addr: '{{upstream_addr}}',
            connector: { type: 'socks5' },
            dialer: { type: 'tcp' },
          }],
        },
      },
      {
        kind: 'chains',
        name: 'chain-redirect',
        body: { hops: [{ name: 'hop-redirect-upstream' }] },
      },
      {
        kind: 'services',
        name: 'redir-12345',
        body: {
          addr: ':12345',
          handler: { type: 'redirect', chain: 'chain-redirect' },
          listener: { type: 'redirect' },
          bypass: 'bypass-cn-redirect',
        },
      },
    ],
    client: [
      '# gost 主机上加 iptables 规则（root）',
      'iptables -t nat -N GOST',
      'iptables -t nat -A GOST -p tcp -j REDIRECT --to-ports 12345',
      '# 把本机出站打到 GOST 链（按需调整）',
      'iptables -t nat -A OUTPUT -p tcp -j GOST',
      '# 其它设备改默认路由到 gost 主机后流量自然进来',
    ],
  },

  // ───────── 特殊用法 ─────────
  {
    key: 'ss-server',
    category: 'special',
    label: 'Shadowsocks 服务端',
    scene: '在 VPS 上跑一个 SS 服务端，给客户端（Shadowrocket / clash 等）连。',
    describe: '比 socks5 多了协议层加密。method + password 写在 handler.metadata 里。AES-128-GCM 是兼容性最好的选择。',
    vars: [
      { key: 'port', label: '监听端口', default: '8388', type: 'number' },
      { key: 'method', label: '加密方式', default: 'aes-128-gcm' },
      { key: 'password', label: 'SS 密码', default: '', type: 'password' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'ss-{{port}}',
        body: {
          addr: ':{{port}}',
          handler: { type: 'ss', metadata: { method: '{{method}}', password: '{{password}}' } },
          listener: { type: 'tcp' },
        },
      },
    ],
    client: [
      '# SS 链接（导入 Shadowrocket / Clash 等）',
      'ss://{{method}}:{{password}}@{{host}}:{{port}}',
      '# 注意：上面是裸的，实际客户端导入要 base64 编码',
    ],
  },

  {
    key: 'socks5-wss',
    category: 'special',
    label: 'SOCKS5 over WebSocket TLS（绕 DPI）',
    scene: '想让流量看起来像 https + websocket，绕过简单 DPI / CDN 后面藏起来。',
    describe: 'service 端用 wss 监听 + socks5 处理；客户端要对应用 socks5 connector + wss dialer。证书必须真实可信（建议 acme），不然 TLS 握手就识别了。',
    vars: [
      { key: 'port', label: '监听端口', default: '443', type: 'number' },
      { key: 'cert_file', label: 'cert 文件路径', default: '/etc/letsencrypt/live/example.com/fullchain.pem' },
      { key: 'key_file',  label: 'key 文件路径',  default: '/etc/letsencrypt/live/example.com/privkey.pem' },
      { key: 'ws_path',   label: 'WS 路径',       default: '/api/ws' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'socks5-wss-{{port}}',
        body: {
          addr: ':{{port}}',
          handler: { type: 'socks5' },
          listener: {
            type: 'wss',
            tls: { certFile: '{{cert_file}}', keyFile: '{{key_file}}' },
            metadata: { path: '{{ws_path}}' },
          },
        },
      },
    ],
    client: [
      '# gost 客户端示例（在你那台机器上）：',
      'gost -L socks5://:1080 -F "socks5+wss://{{host}}:{{port}}?path={{ws_path}}"',
    ],
  },

  {
    key: 'dns-doh',
    category: 'special',
    label: 'DoH 加密 DNS 解析器',
    scene: '想让 gost 自己的查询走 DoH/DoT 而不是明文 UDP 53，防污染。',
    describe: '建一个 resolver，service 里 resolver 字段引用它。整条 chain 的域名解析都会走加密。',
    vars: [
      { key: 'doh_url', label: 'DoH 上游', default: 'https://1.0.0.1/dns-query', hint: 'Cloudflare / Google / 阿里都有，按口味选' },
    ],
    resources: [
      {
        kind: 'resolvers',
        name: 'resolver-doh',
        body: {
          nameservers: [{ addr: '{{doh_url}}', prefer: 'ipv4' }],
        },
      },
    ],
    client: [
      '# 用法：去任何 service / chain 编辑里把 resolver 选成 resolver-doh',
    ],
  },

  {
    key: 'multi-tenant-socks5',
    category: 'proxy',
    label: '多用户 SOCKS5（每人独立账号）',
    scene: '把代理开放给团队，但要按账号区分谁在用 — 可以配合 access log 知道是谁',
    describe: '一个 auther 里塞多个账号；service 引用它即可。要看谁连进来，开启 service.handler.metadata.observer + observer 资源（这条 cookbook 暂未涵盖）。',
    vars: [
      { key: 'u1', label: '账号 1', default: 'alice' },
      { key: 'p1', label: '密码 1', default: 'changeme1', type: 'password' },
      { key: 'u2', label: '账号 2', default: 'bob' },
      { key: 'p2', label: '密码 2', default: 'changeme2', type: 'password' },
    ],
    resources: [
      {
        kind: 'authers',
        name: 'auth-team',
        body: {
          auths: [
            { username: '{{u1}}', password: '{{p1}}' },
            { username: '{{u2}}', password: '{{p2}}' },
          ],
        },
      },
      {
        kind: 'services',
        name: 'socks5-team-1083',
        body: {
          addr: ':1083',
          handler: { type: 'socks5', auther: 'auth-team' },
          listener: { type: 'tcp' },
        },
      },
    ],
    client: [
      'curl --socks5-hostname {{u1}}:{{p1}}@{{host}}:1083 https://ifconfig.me',
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Substitution                                                      */
/* ------------------------------------------------------------------ */

export type VarMap = Record<string, string>

/** Replace every {{key}} in the structure with its value. */
export function substitute<T>(input: T, vars: VarMap): T {
  if (typeof input === 'string') {
    return input.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '') as unknown as T
  }
  if (Array.isArray(input)) {
    return input.map((v) => substitute(v, vars)) as unknown as T
  }
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = substitute(v, vars)
    }
    return out as T
  }
  return input
}

/** Default value map for a recipe (with optional host injected). */
export function defaultVars(recipe: Recipe, host: string): VarMap {
  const vars: VarMap = { host }
  for (const v of recipe.vars ?? []) vars[v.key] = v.default
  return vars
}
