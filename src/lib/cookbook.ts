import type { ResourceKey } from './resources'

export type RecipeCategory =
  | 'proxy'         // 本机/服务端代理
  | 'forward'       // 端口转发
  | 'tunnel'        // 内网穿透 / 隧道
  | 'transparent'   // 透明代理
  | 'security'      // 鉴权 / 限流 / IP 准入
  | 'observability' // 日志 / 事件回调
  | 'special'       // DNS / SS / 隐蔽传输等

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
  proxy:         '代理',
  forward:       '端口转发',
  tunnel:        '内网穿透',
  transparent:   '透明代理',
  security:      '鉴权与限流',
  observability: '日志与观测',
  special:       '特殊用法',
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

  // ───────── 服务暴露 / 反向代理 ─────────
  {
    key: 'https-reverse-proxy',
    category: 'forward',
    label: 'HTTPS 反向代理（gost 当 nginx）',
    scene: '把内网某 HTTP 服务用真实证书加 TLS 后暴露到 443。等价于 nginx 做 TLS termination。',
    describe: '需要真实域名 + Let’s Encrypt 证书。gost 在 443 监听 TLS，内部转发到 backend 明文 HTTP。注意：handler 是 http 不是 tcp，这样能保留 Host 头。',
    vars: [
      { key: 'cert_file', label: 'fullchain.pem 路径', default: '/etc/letsencrypt/live/example.com/fullchain.pem' },
      { key: 'key_file',  label: 'privkey.pem 路径',  default: '/etc/letsencrypt/live/example.com/privkey.pem' },
      { key: 'backend',   label: '内网后端 host:port', default: '192.168.1.10:8080' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'https-reverse-443',
        body: {
          addr: ':443',
          handler: { type: 'http' },
          listener: {
            type: 'tls',
            tls: { certFile: '{{cert_file}}', keyFile: '{{key_file}}' },
          },
          forwarder: { nodes: [{ name: 'backend', addr: '{{backend}}' }] },
        },
      },
    ],
    client: ['curl https://{{host}}/', '# 用真实域名访问；证书要 SAN 含该域名'],
  },

  {
    key: 'db-remote-access',
    category: 'forward',
    label: '数据库远程访问 + IP 白名单',
    scene: '把 PostgreSQL / MySQL / Redis 暴露给办公室 IP，其他全部拒。',
    describe: '建一个 admission 白名单（你的固定出口 IP），TCP forward 转给数据库端口。比直接开放给公网安全得多。',
    vars: [
      { key: 'db_target',  label: '内网数据库 host:port', default: '192.168.1.20:5432', hint: 'PG=5432, MySQL=3306, Redis=6379' },
      { key: 'allow_cidr', label: '允许的客户端 IP/CIDR', default: '203.0.113.10/32', hint: '多条用 CIDR 形式' },
      { key: 'expose',     label: '本机暴露端口',          default: '15432', type: 'number' },
    ],
    resources: [
      {
        kind: 'admissions',
        name: 'admit-db-clients',
        body: { whitelist: true, matchers: ['{{allow_cidr}}'] },
      },
      {
        kind: 'services',
        name: 'tcp-db-{{expose}}',
        body: {
          addr: ':{{expose}}',
          handler: { type: 'tcp' },
          listener: { type: 'tcp' },
          forwarder: { nodes: [{ name: 'db', addr: '{{db_target}}' }] },
          admission: 'admit-db-clients',
        },
      },
    ],
    client: ['psql -h {{host}} -p {{expose}} -U user dbname'],
  },

  {
    key: 'tcp-loadbalance',
    category: 'forward',
    label: '多后端 TCP 负载均衡',
    scene: '一个入口端口转给后面 N 个等价后端，按轮询 / 随机分发，挂掉自动剔除。',
    describe: '把多个 forwarder.nodes 放一起 + selector 策略。比单台后端直接转发增加了高可用。',
    vars: [
      { key: 'backend1', label: '后端 1', default: '192.168.1.11:8080' },
      { key: 'backend2', label: '后端 2', default: '192.168.1.12:8080' },
      { key: 'backend3', label: '后端 3', default: '192.168.1.13:8080' },
      { key: 'expose',   label: '入口端口', default: '8080', type: 'number' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'lb-tcp-{{expose}}',
        body: {
          addr: ':{{expose}}',
          handler: { type: 'tcp' },
          listener: { type: 'tcp' },
          forwarder: {
            selector: { strategy: 'round', maxFails: 2, failTimeout: '30s' },
            nodes: [
              { name: 'b1', addr: '{{backend1}}' },
              { name: 'b2', addr: '{{backend2}}' },
              { name: 'b3', addr: '{{backend3}}' },
            ],
          },
        },
      },
    ],
    client: ['curl http://{{host}}:{{expose}}/   # 每次落到不同后端'],
  },

  {
    key: 'mail-forward',
    category: 'forward',
    label: '邮件服务端口转发（SMTP/IMAP）',
    scene: '内网邮件服务器（如 Mailcow / Mailu）通过这台公网机收发邮件。',
    describe: '一次开 SMTP 25、IMAPS 993、Submission 587 三个端口转发到内网邮件服务。如果邮件服务自己处理 TLS，gost 透传裸 TCP 即可。',
    vars: [
      { key: 'mail_host', label: '内网邮件主机 IP', default: '192.168.1.30' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'mail-smtp-25',
        body: { addr: ':25', handler: { type: 'tcp' }, listener: { type: 'tcp' }, forwarder: { nodes: [{ name: 'smtp', addr: '{{mail_host}}:25' }] } },
      },
      {
        kind: 'services',
        name: 'mail-submission-587',
        body: { addr: ':587', handler: { type: 'tcp' }, listener: { type: 'tcp' }, forwarder: { nodes: [{ name: 'submission', addr: '{{mail_host}}:587' }] } },
      },
      {
        kind: 'services',
        name: 'mail-imaps-993',
        body: { addr: ':993', handler: { type: 'tcp' }, listener: { type: 'tcp' }, forwarder: { nodes: [{ name: 'imaps', addr: '{{mail_host}}:993' }] } },
      },
    ],
    client: [
      '# IMAP 客户端连：',
      'imaps://{{host}}:993',
      '# SMTP 提交连：',
      'smtp://{{host}}:587 （STARTTLS）',
    ],
  },

  // ───────── 内网穿透 ─────────
  {
    key: 'rhttp-tunnel',
    category: 'tunnel',
    label: '反向 HTTP 隧道（暴露内网网站到公网）',
    scene: '家里跑了一个 Web 应用没公网 IP，想给外面人访问。家里 gost 主动连公网 gost 把流量打通。',
    describe: '公网侧建一个 rtcp service 接收回连 + 暴露 HTTP；家里再用 gost CLI 起 -L rtcp 主动连过来。比 frp 简单，但功能也朴素。',
    vars: [
      { key: 'inner_web',  label: '家里 Web host:port',    default: '192.168.1.50:80' },
      { key: 'tunnel_id',  label: 'tunnel 标识',          default: 'home-web' },
      { key: 'expose',     label: '公网暴露端口',          default: '8080', type: 'number' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'rhttp-{{tunnel_id}}',
        body: {
          addr: ':{{expose}}',
          handler: { type: 'rtcp', metadata: { tunnelID: '{{tunnel_id}}' } },
          listener: { type: 'rtcp' },
          forwarder: { nodes: [{ name: 'inner', addr: '{{inner_web}}' }] },
        },
      },
    ],
    client: [
      '# 家里那台机器跑 gost CLI：',
      'gost -L "rtcp://:0/{{inner_web}}?tunnelID={{tunnel_id}}" \\',
      '     -F "tcp://{{host}}:{{expose}}"',
      '',
      '# 然后外面：',
      'curl http://{{host}}:{{expose}}/',
    ],
  },

  // ───────── 透明代理 ─────────
  {
    key: 'tun-vpn',
    category: 'transparent',
    label: 'TUN 三层 VPN 透明代理',
    scene: '整机所有出站流量（含 UDP / QUIC / 游戏）都走代理，不挑应用。',
    describe: 'gost 起一个 tun 设备接管系统出口，配合 chain 把流量打到上游。客户端透明，类似 sing-box / clash 的 TUN 模式。需要 root + 路由配置。',
    vars: [
      { key: 'tun_name', label: 'TUN 接口名', default: 'gost-tun0' },
      { key: 'tun_addr', label: 'TUN IP/掩码', default: '198.18.0.1/16', hint: '随便选个不冲突的私网段' },
      { key: 'mtu',      label: 'MTU',         default: '1420', type: 'number' },
      { key: 'upstream', label: '上游代理',     default: 'proxy.example.com:1080' },
    ],
    resources: [
      {
        kind: 'hops',
        name: 'hop-tun-upstream',
        body: {
          nodes: [{
            name: 'upstream',
            addr: '{{upstream}}',
            connector: { type: 'socks5' },
            dialer: { type: 'tcp' },
          }],
        },
      },
      {
        kind: 'chains',
        name: 'chain-tun',
        body: { hops: [{ name: 'hop-tun-upstream' }] },
      },
      {
        kind: 'services',
        name: 'tun-vpn',
        body: {
          addr: '{{tun_addr}}',
          handler: { type: 'tun', chain: 'chain-tun' },
          listener: {
            type: 'tun',
            metadata: { name: '{{tun_name}}', mtu: '{{mtu}}' },
          },
        },
      },
    ],
    client: [
      '# 启动后系统会出现一个 {{tun_name}} 接口；加路由让流量进来：',
      'sudo ip route add 0.0.0.0/1 dev {{tun_name}}',
      'sudo ip route add 128.0.0.0/1 dev {{tun_name}}',
      '# 撤销：sudo ip route del 0.0.0.0/1; sudo ip route del 128.0.0.0/1',
    ],
  },

  // ───────── 特殊用法 ─────────
  {
    key: 'ss-2022',
    category: 'special',
    label: 'Shadowsocks 2022（更抗检测）',
    scene: '比传统 ss aes-gcm 安全很多的新版协议（2022-blake3-aes-256-gcm）。需要 gost ≥ 3.0 + 客户端也支持 SS-2022。',
    describe: 'SS-2022 加了 EIH 鉴权和重放保护，主动探测难度大幅提升。密码必须 base64 强随机，长度由 method 决定（aes-128=16B、aes-256=32B）。',
    vars: [
      { key: 'port', label: '端口', default: '8388', type: 'number' },
      { key: 'method', label: '加密方式', default: '2022-blake3-aes-256-gcm', hint: '推荐 2022-blake3-aes-256-gcm' },
      { key: 'password', label: 'base64 密码', default: '', type: 'password', hint: '用 `openssl rand -base64 32` 生成' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'ss2022-{{port}}',
        body: {
          addr: ':{{port}}',
          handler: { type: 'ss', metadata: { method: '{{method}}', password: '{{password}}' } },
          listener: { type: 'tcp' },
        },
      },
    ],
    client: [
      '# 兼容客户端：Shadowrocket / sing-box / Xray / shadowsocks-rust',
      'ss://{{method}}:{{password}}@{{host}}:{{port}}',
      '# 注意把 method:password 整体 base64 编码后才是导入链接',
    ],
  },

  {
    key: 'private-dns-hosts',
    category: 'special',
    label: '私有 DNS + Hosts 组合（内网域名 + DoH 兜底）',
    scene: '内网用自己的域名（nas.home / svc.local），外网域名走加密 DoH。给 chain / service 引用同一份解析配置。',
    describe: 'hosts 命中的私有域名直接出 IP；没命中的走 resolver 列出的 DoH 上游。两个资源都建出来后，去 service / chain 编辑里 hosts / resolver 字段一并选上。',
    vars: [
      { key: 'nas_ip',  label: '内网 NAS IP',  default: '192.168.1.50' },
      { key: 'router_ip', label: '内网路由 IP', default: '192.168.1.1' },
      { key: 'doh_url', label: 'DoH 上游',     default: 'https://1.0.0.1/dns-query' },
    ],
    resources: [
      {
        kind: 'hosts',
        name: 'hosts-home',
        body: {
          mappings: [
            { ip: '{{nas_ip}}',    hostname: 'nas.home' },
            { ip: '{{router_ip}}', hostname: 'router.home', aliases: ['gw.home'] },
          ],
        },
      },
      {
        kind: 'resolvers',
        name: 'resolver-doh-fallback',
        body: { nameservers: [{ addr: '{{doh_url}}', prefer: 'ipv4' }] },
      },
    ],
    client: [
      '# 在任意 service 编辑里把 hosts 选 hosts-home，resolver 选 resolver-doh-fallback',
      '# 然后 curl --socks5 {{host}}:1080 http://nas.home/ 就会直接命中 hosts',
    ],
  },

  // ───────── 鉴权与限流 ─────────
  {
    key: 'mtls-listener',
    category: 'security',
    label: 'mTLS 强制客户端证书',
    scene: '只让持有你颁发的客户端证书的人能连进来，主动探测直接 reset。比账号密码强很多。',
    describe: 'listener.type=mtls 三个文件全要：certFile（服务端证书）/ keyFile（私钥）/ caFile（签客户端证书的 CA）。客户端拿不到 CA 签过的 cert 就握不上手。',
    vars: [
      { key: 'cert_file', label: '服务端证书', default: '/etc/gost/server.pem' },
      { key: 'key_file',  label: '服务端私钥', default: '/etc/gost/server.key' },
      { key: 'ca_file',   label: 'CA 证书',    default: '/etc/gost/clients-ca.pem' },
      { key: 'port',      label: '端口',       default: '8443', type: 'number' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'mtls-socks5-{{port}}',
        body: {
          addr: ':{{port}}',
          handler: { type: 'socks5' },
          listener: {
            type: 'mtls',
            tls: { certFile: '{{cert_file}}', keyFile: '{{key_file}}', caFile: '{{ca_file}}' },
          },
        },
      },
    ],
    client: [
      '# 客户端拿 CA 签的 cert 后用 gost CLI：',
      'gost -L socks5://:1080 -F "socks5+mtls://{{host}}:{{port}}?cert=client.pem&key=client.key&ca=ca.pem"',
    ],
  },

  {
    key: 'service-rate-limit',
    category: 'security',
    label: '服务带宽限速',
    scene: '某条代理被同事白嫖把家里宽带挤爆——给该 service 套一个上下行带宽上限。',
    describe: 'limits 字符串格式：`$ 入带宽 出带宽` 表示整个服务的总速率；`$$ 入 出` 是每个客户端的速率。单位 B/KB/MB/GB。',
    vars: [
      { key: 'rate_in',  label: '入向上限', default: '10MB', hint: '例：10MB = 10 MB/s' },
      { key: 'rate_out', label: '出向上限', default: '10MB' },
      { key: 'target_service', label: '应用到哪个服务', default: 'socks5-1080', hint: '该服务必须已存在；本配方只建 limiter，请去 service 编辑里把 limiter 字段填上' },
    ],
    resources: [
      {
        kind: 'limiters',
        name: 'limit-{{rate_in}}-{{rate_out}}',
        body: {
          limits: [ '$ {{rate_in}} {{rate_out}}' ],
        },
      },
    ],
    client: [
      '# 应用后：编辑 {{target_service}}，把 limiter 字段设成新建的 limiter 名',
      '# 验证：用 iperf3 / curl 大文件看带宽是否被限到 {{rate_in}}',
    ],
  },

  {
    key: 'conn-limit-per-ip',
    category: 'security',
    label: '单 IP 并发连接数限制',
    scene: '防止某个客户端开几千连接打爆服务（爬虫、滥用、扫描器）。',
    describe: 'climiter = connection limiter。`$$ N` 限制每个客户端 IP 最多 N 个并发连接；超过就拒绝新连接。建完后到 service 编辑里把 climiter 字段填上。',
    vars: [
      { key: 'per_ip_max',    label: '每 IP 最大连接', default: '50', type: 'number' },
      { key: 'service_max',   label: '服务总连接上限', default: '5000', type: 'number' },
    ],
    resources: [
      {
        kind: 'climiters',
        name: 'climit-{{per_ip_max}}-per-ip',
        body: {
          limits: [
            '$ {{service_max}}',
            '$$ {{per_ip_max}}',
          ],
        },
      },
    ],
    client: [
      '# 应用后：去 service 编辑里把 climiter 字段填成新建的 climiter 名',
    ],
  },

  // ───────── 日志与观测 ─────────
  {
    key: 'access-log-file',
    category: 'observability',
    label: '访问日志落盘（recorder）',
    scene: '想审计谁在用代理、访问了什么——把每条连接信息写到本地文件。',
    describe: 'recorder.file.path 是落盘路径；service.recorders 引用它。日志格式默认 JSON。注意 gost 进程要有写权限。',
    vars: [
      { key: 'log_path', label: '日志路径', default: '/var/log/gost/access.log' },
      { key: 'target_service', label: '应用到哪个服务', default: 'socks5-1080', hint: '本配方只建 recorder；请去对应 service 编辑里把 recorders 加上' },
    ],
    resources: [
      {
        kind: 'recorders',
        name: 'recorder-access',
        body: {
          file: { path: '{{log_path}}' },
        },
      },
    ],
    client: [
      '# 应用后到 {{target_service}} 编辑里 JSON 标签下加：',
      '"recorders": [{ "name": "recorder-access", "record": "recorder.service.handler" }]',
      '# 然后 tail -f {{log_path}} 看实时',
    ],
  },

  {
    key: 'event-webhook',
    category: 'observability',
    label: '实时事件 webhook 推送（observer）',
    scene: '想接入外部告警 / 监控系统——每当 service 有连接进来 / 出错 / 断开就 POST 一条 JSON 到你的 HTTP 端点。',
    describe: 'observer 用 plugin: http，gost 会把事件以 JSON POST 到指定 URL。配合 service.observer 引用生效。可以用来做 Bark / Telegram bot / 自家监控的入口。',
    vars: [
      { key: 'webhook_url', label: 'webhook URL', default: 'http://127.0.0.1:8000/gost-events' },
    ],
    resources: [
      {
        kind: 'observers',
        name: 'observer-webhook',
        body: {
          plugin: { type: 'http', addr: '{{webhook_url}}' },
        },
      },
    ],
    client: [
      '# 应用后到 service 编辑里把 observer 字段填 observer-webhook',
      '# 你的 webhook 端会收到形如：',
      '{ "kind": "stats", "service": "socks5-1080", "client": "1.2.3.4:5678", ... }',
    ],
  },

  // ───────── 端口转发：游戏 / VPN ─────────
  {
    key: 'minecraft-server',
    category: 'forward',
    label: 'Minecraft 服务器转发 + 白名单',
    scene: '家里跑 MC 服务器，开给固定几个朋友 IP 进来，挡爬虫/被刷。',
    describe: 'MC 默认是 TCP 25565。配合 admission 白名单只让指定 IP 段进。如果朋友家是动态 IP，请改成域名 + DDNS 解析。',
    vars: [
      { key: 'mc_inner', label: '内网 MC host:port', default: '192.168.1.50:25565' },
      { key: 'allow1',   label: '朋友 1 IP/CIDR',    default: '203.0.113.10/32' },
      { key: 'allow2',   label: '朋友 2 IP/CIDR',    default: '203.0.113.20/32' },
    ],
    resources: [
      {
        kind: 'admissions',
        name: 'admit-mc-friends',
        body: { whitelist: true, matchers: ['{{allow1}}', '{{allow2}}'] },
      },
      {
        kind: 'services',
        name: 'tcp-mc-25565',
        body: {
          addr: ':25565',
          handler: { type: 'tcp' },
          listener: { type: 'tcp' },
          forwarder: { nodes: [{ name: 'mc', addr: '{{mc_inner}}' }] },
          admission: 'admit-mc-friends',
        },
      },
    ],
    client: ['# 朋友 MC 客户端连 {{host}}:25565'],
  },

  {
    key: 'wireguard-udp',
    category: 'forward',
    label: 'WireGuard UDP 端口转发',
    scene: '家里 WireGuard 在 NAT 后面，让 vps 把 UDP 51820 流量打回内网那台。',
    describe: 'wg 是 UDP 协议。注意 wg 内部加密自管，gost 这里只做无脑 UDP 转发，几乎无开销。如果两端都在 NAT 后，请改用 rudp 反向隧道。',
    vars: [
      { key: 'wg_inner', label: '内网 WG host:port', default: '192.168.1.40:51820' },
      { key: 'expose',   label: 'VPS 暴露端口',     default: '51820', type: 'number' },
    ],
    resources: [
      {
        kind: 'services',
        name: 'udp-wg-{{expose}}',
        body: {
          addr: ':{{expose}}',
          handler: { type: 'udp' },
          listener: { type: 'udp' },
          forwarder: { nodes: [{ name: 'wg', addr: '{{wg_inner}}' }] },
        },
      },
    ],
    client: ['# wg 客户端 Endpoint 改成 {{host}}:{{expose}}'],
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
