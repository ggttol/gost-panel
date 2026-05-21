# gost-panel

一个面向 [gost](https://gost.run) v3 的中文 Web 控制台 — 不是简单的 JSON 编辑器，而是带表单、引用下拉、快速搭建预设、实时日志和指标的"运维控制台"。

> Status: 个人玩具，能跑能用；没自动化测试；接口跟着 gost v3 走。

## 特性概览

### 资源管理（CRUD）
覆盖 gost v3 全部 17 类配置资源：services / chains / hops / authers / admissions / bypasses / resolvers / hosts / ingresses / routers / observers / recorders / sds / limiters / climiters / rlimiters。每类都有：
- 列表页：单条 JSON 展开预览 + 状态徽章
- 编辑对话框：「表单 / JSON」双标签
- 删除确认 + Toast 反馈

### 表单覆盖
8 个核心资源类型有结构化表单（其余 9 类继续用 JSON 标签编辑）：
- **Services**：地址 / handler 类型（21 种下拉，每种带一句话说明）/ listener 类型（26 种）/ TLS 卡 / 转发目标列表 / 5 个关联资源下拉
- **Chains / Hops**：选择策略 + 节点序列 + connector/dialer 类型说明
- **Authers**：账号行列表
- **Bypasses / Admissions**：白/黑名单切换 + 多写法 matcher
- **Hosts / Resolvers**：映射 / DNS 上游（4 种协议示例）

### 新手友好
- 每个资源页顶部 **HelpBanner**（"是什么 / 何时建 / 关联 / 结构" 四段）+ 跳 gost.run 官方文档
- 每个字段都有 **hint**：填什么、什么格式、给例子
- 每个协议类型下拉有 **TypeHint**：动态显示当前类型简介
- 服务页 **快速搭建**：7 个预设，端口已错开，可连续套（SOCKS5 本机代理 / HTTP 代理 / HTTP 带账号 / TCP 端口转发 / SOCKS5 走上游 / Shadowsocks 服务端 / 反向 TCP 隧道）
- 跨资源引用是 **下拉**（不是手敲名字）；没数据时降级文本输入 + 「去配置 ↗」直跳
- 表单底部 **摘要条**：实时自然语言总结"你将创建 → 在 :8080 起 http 入口 · tcp 监听 · 出口走链路 chain-1"
- 名称 **自动建议**（`service-1` / `service-2`…）+ 防撞

### 实时观察
- **/metrics**：Prometheus 文本解析 → 6 张 KPI 卡 + 流量趋势图（recharts），3 秒采样、可暂停
- **/logs**：SSE 边车实时滚动日志，gost JSON 日志按级别分色，本地过滤 / 清屏 / 回到底部 / 自动跟随，循环缓冲 1000 行
- **服务详情**：监听地址 / handler / listener / 创建时间 + 状态事件时间线

### 设计语言
- 浅色优先，单一薄荷-青色（oklch 0.6 0.18 175）做信号色
- Hanken Grotesk + JetBrains Mono（避开 Inter/Geist）
- 编号导航 + eyebrow 标签 + tabular nums + slashed-zero
- 心跳脉冲 / 状态点 / 列表渐入动画

## 技术栈

| 层 | 用什么 |
|---|---|
| 前端 | React 19 + Vite + TypeScript + Tailwind v4 |
| 数据 | TanStack Query · axios |
| UI 原语 | 自写（Radix Dialog/Tabs/Tooltip/Slot 基础上）+ lucide-react 图标 |
| 编辑器 | @uiw/react-codemirror（JSON） |
| 图表 | recharts |
| 日志 | EventSource（SSE） |
| 通知 | sonner |
| 边车 | Node.js（`tools/gost-logfeed.mjs`，零依赖） |

## 架构

```
┌────────────────┐         ┌─────────────────────────────┐
│  浏览器        │         │  gost 主机 (例: 192.168.x.y) │
│  (panel SPA)   │         │                             │
│                │  REST   │  ┌─────────────────────┐    │
│   /r/services  ├────────►│  │ gost API  :18080    │    │
│   /metrics     │         │  │ (Basic Auth, CORS)  │    │
│   /logs        │         │  └─────────────────────┘    │
│                │         │                             │
│                │ Prom    │  ┌─────────────────────┐    │
│                ├────────►│  │ gost metrics :9000  │    │
│                │         │  └─────────────────────┘    │
│                │ SSE     │  ┌─────────────────────┐    │
│                ├────────►│  │ gost-logfeed :19090 │    │
│                │  ?t=xxx │  │ (token, sidecar)    │    │
└────────────────┘         │  └─────────────────────┘    │
                           └─────────────────────────────┘
```

Vite dev 对 `/proxy-metrics` 和 `/proxy-logs` 反代，避开 gost 这两个端口没 CORS。生产部署用 Caddy / nginx 同源反代。

## 部署

### 1. gost 主机一侧

启用 API + metrics。`/etc/gost/gost.yaml` 至少包含：
```yaml
api:
  addr: ":18080"
  pathPrefix: /api
  accesslog: true
  auth:
    username: admin
    password: <改成强密码>

metrics:
  addr: ":9000"
  path: /metrics
```

日志边车（可选，`/logs` 页需要）。拷贝仓库里 `tools/gost-logfeed.mjs` 到 `/usr/local/bin/`，然后：

```bash
sudo apt install -y nodejs
sudo install -m 755 tools/gost-logfeed.mjs /usr/local/bin/

# 让边车以普通用户能读 gost 日志
sudo chgrp gaotao /var/log/gost/gost.log
sudo chmod g+r /var/log/gost/gost.log

# 生成 token
TOKEN=$(openssl rand -hex 16)
echo "记下来：$TOKEN"
```

systemd unit：
```ini
# /etc/systemd/system/gost-logfeed.service
[Unit]
Description=gost log feed (SSE)
After=network.target

[Service]
Type=simple
User=gaotao
Group=gaotao
ExecStart=/usr/bin/node /usr/local/bin/gost-logfeed.mjs
Environment=LOG_FILE=/var/log/gost/gost.log
Environment=PORT=19090
Environment=TOKEN=替换为生成的 token
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadOnlyPaths=/var/log/gost

[Install]
WantedBy=multi-user.target
```
然后 `sudo systemctl enable --now gost-logfeed.service`。

### 2. 面板一侧

```bash
git clone https://github.com/ggttol/gost-panel.git
cd gost-panel
pnpm install
cp .env.example .env.local
# 编辑 .env.local：gost API 地址、账号密码、logfeed token
pnpm dev       # http://localhost:5173
pnpm build     # 静态产物到 dist/
```

### 环境变量
| 变量 | 说明 |
|---|---|
| `VITE_GOST_API_BASE`           | gost API 完整 URL，例：`http://192.168.1.10:18080/api` |
| `VITE_GOST_USER`               | API basic auth 用户名 |
| `VITE_GOST_PASS`               | API basic auth 密码 |
| `VITE_GOST_LOGFEED_TOKEN`      | logfeed token（边车 TOKEN 一致；留空表示边车未启用 token） |
| `VITE_GOST_METRICS_TARGET`     | dev 时 Vite 代理的 metrics 目标 |
| `VITE_GOST_LOGFEED_TARGET`     | dev 时 Vite 代理的 logfeed 目标 |

### 生产部署
`pnpm build` 出 `dist/` 静态目录，配 Caddy/nginx：
- 静态根 → `dist/`
- 反代 `/proxy-metrics` → gost 主机 `:9000`
- 反代 `/proxy-logs` → gost 主机 `:19090`
- 反代 `/api` → gost 主机 `:18080`（如果你想统一同源）

## 已知限制
- 没有自动化测试
- 表单覆盖 8/17 类资源，剩下的（observers / recorders / sds / limiters / climiters / rlimiters / ingresses / routers）只能切到 JSON 标签
- 单实例面板，不支持多 gost 节点统一管理
- 全中文界面，未做国际化抽象
- gost.run 文档链接基于路径映射，部分页面可能未上线

## License

MIT。随便用。

## 跟官方 webui 的关系

go-gost 团队也有官方管理界面。这个项目是独立开发的，跟官方没关系，重点在中文友好 + 新手向 + 极简部署。
