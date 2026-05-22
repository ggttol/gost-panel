# gost-panel

[gost v3](https://gost.run) 的中文 Web 控制台 —— 纯静态 React SPA，直连 gost REST API 管理 16 种资源；附 Prometheus 指标、SSE 实时日志、场景"菜谱"，以及一行命令在目标主机部署的 install.sh。

> Status: 个人玩具，无自动化测试；接口跟 gost v3 走。

```
┌──────────────────────┐         http://gost-host:18080/api
│  浏览器：gost-panel  │ ──────► REST CRUD（16 种资源）
│  （纯静态 SPA）       │ ──────► :9000/metrics（Prometheus）
└──────────────────────┘ ──────► :19090/stream（gost-logfeed SSE）
```

## 它能干什么

- **结构化表单** — 16 种资源全部覆盖（services / chains / hops / authers / admissions / bypasses / resolvers / hosts / ingresses / routers / observers / recorders / sds / limiters / climiters / rlimiters），handler/listener/connector 等类型自带下拉 + 一句话说明，不用对着 YAML 抄字段
- **场景菜谱** — 30+ 条预设配方（SOCKS5 出口走机场 + 国内直连 / Shadowsocks 2022 / 反向 TCP 内网穿透 / mTLS / 限流 / iptables 透明代理 …），点一下应用就建好整套 service+chain+hop+bypass；冲突预检、高风险二次确认、失败可一键撤销
- **多主机管理** — localStorage 里存连接信息，下拉切主机即可分别管理多个 gost 实例；切换前自动失效缓存
- **YAML 全量导入导出** — 把整套配置以 YAML 备份；新机器粘贴 YAML 后看 diff 预览再写入；显式拒绝 nameless 项防数据丢失
- **实时遥测** — metrics 页 cumulative counter → 每秒速率，KPI 卡片 sparkline，窗口可切 3/15/60 min；日志页 SSE 实时尾随，等级 chip 筛选 / 关键字高亮 / 暂停滚动 / 下载
- **一键部署** — 一行 `curl … | sudo bash` 在目标主机装好 gost + logfeed 边车（可选附带 Caddy 反代解决 CORS），回面板粘贴 join URL 即接入；无 github 访问的内网主机也能用（面板自带二进制镜像）
- **设计语言** — 浅色 / 薄荷-青色信号 / Hanken Grotesk + JetBrains Mono / 编号导航 / 心跳脉冲

## 一键部署（推荐）

```sh
# 1) 面板侧（一次性）：预下载 gost 二进制到 tools/dl/
pnpm fetch-binaries

# 2) 起面板
pnpm build && npx serve dist     # 或 nginx / Caddy / 任意静态服务

# 3) 浏览器打开面板 → Welcome 页复制安装命令 → ssh 到目标主机执行：
curl -fsSL http://<面板>/install.sh | sudo PANEL_URL=http://<面板> bash

# 4) 脚本最后打印 gost-panel://add?... 链接；粘回面板「添加主机 → 一键链接」
#    粘贴后自动测连、剪贴板有链接时打开对话框自动嗅探
```

脚本会装 gost ≥ 3.2.6、写 `/etc/gost/gost.yaml`（带随机 API 密码、metrics、JSON 日志）、起 `gost.service` + `gost-logfeed.service` 两个 systemd 单元、最后打印 join URL。支持 Linux（amd64/arm64/armv7/386）、macOS（amd64/arm64）。需要 root + node ≥ 18（脚本自动通过 apt/dnf/apk 安装 node）。

**生产部署推荐加 `--with-caddy`**：

```sh
curl -fsSL http://<面板>/install.sh | sudo PANEL_URL=http://<面板> bash -s -- --with-caddy
```

会在 `:18000` 端口起一个 Caddy 反代 gost API/metrics/logfeed 并自动加 CORS 头，浏览器面板跨域调用无需额外配置。打印的 join URL 直接走 Caddy 端口。

**无 github 访问场景**：步骤 1 `pnpm fetch-binaries` 把各平台 tar.gz 下载到 `tools/dl/`，build 时 emit 到 `dist/dl/`，install.sh 会优先用面板的 `/dl/` 镜像。

## 本地开发

```sh
pnpm install
pnpm dev          # vite on :5273（strictPort）
pnpm build        # tsc -b && vite build
pnpm lint         # eslint
```

可选 `.env.local`（也可以跳过、走 Welcome 页 / AddHost 流程）：

```
VITE_GOST_API_BASE=http://192.168.x.x:18080/api
VITE_GOST_USER=admin
VITE_GOST_PASS=<api 密码>
VITE_GOST_METRICS_TARGET=http://192.168.x.x:9000      # 给 vite dev 代理避开 CORS
VITE_GOST_LOGFEED_TARGET=http://192.168.x.x:19090
VITE_GOST_LOGFEED_TOKEN=<logfeed token>
```

## 生产部署的 CORS 注意

浏览器从面板域名出发跨域调 gost API（`:18080/api`）和 metrics（`:9000`）时，gost 默认不发 CORS 头会被卡。两种解法：

**推荐 · 让 install.sh 顺手装 Caddy**（见上方 `--with-caddy`）。一行搞定，无需面板侧或 gost 侧另外配。

**或者自己在 gost 前面配 nginx/Caddy**，加 `Access-Control-Allow-Origin: *` 等响应头。

logfeed 边车（`tools/gost-logfeed.mjs`）自带 `Access-Control-Allow-Origin: *`，单独用时浏览器可直连。

## 架构

```
src/
├── lib/                  # 数据层：profiles / api / queries / metrics / resources / cookbook
├── pages/                # 7 个路由页面（lazy: Metrics/Config/Cookbook）
├── components/
│   ├── forms/            # 16 种资源的结构化表单 + 共享 LimitsEditor
│   └── ui/               # 通用 UI primitives（Card/Button/Dialog/Form/EditorJson/EditorYaml/...）
tools/
├── install.sh            # 目标主机一键部署脚本（含内联 gost-logfeed.mjs）
├── gost-logfeed.mjs      # SSE 桥（零依赖，仅需 node ≥ 18）
├── fetch-binaries.sh     # 拉 gost 各平台 release，给无 github 主机用
└── dl/                   # 预下载的 gost 二进制（gitignored）
```

技术栈：React 19 + Vite + TS + Tailwind v4 / TanStack Query + axios / Radix Dialog+Tabs+Tooltip / @uiw/react-codemirror（JSON+YAML）/ recharts / EventSource / sonner。

## 已知限制

- 无自动化测试（面板是 gost API 的薄包装，主要靠手动验）
- 仅中文界面，未做 i18n 抽象
- 密码以明文存浏览器 localStorage —— 公用电脑慎用
- 单实例面板，不支持多管理员协作

## License

MIT。随便用。

## 跟官方 webui 的关系

go-gost 团队也有官方管理界面。这个项目是独立开发，重点在中文友好 + 新手向 + 极简部署。
