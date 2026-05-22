#!/usr/bin/env bash
#
# gost-panel · install.sh — 一键在本机部署 gost + gost-logfeed
#
# 用法：
#   curl -fsSL http://<panel-host>/install.sh | sudo bash
#   curl -fsSL http://<panel-host>/install.sh | sudo bash -s -- --name 家里
#   curl -fsSL http://<panel-host>/install.sh | sudo bash -s -- --with-caddy
#
# 参数：
#   --name <字符串>       面板里显示的别名（默认 hostname）
#   --with-caddy          顺手装 Caddy 反代 18000 → api/metrics/logfeed 并加
#                         CORS 头，省去面板端手动配跨域。生产部署强烈推荐。
#   --api-port <n>        gost API 端口（默认 18080）
#   --metrics-port <n>    metrics 端口（默认 9000）
#   --logfeed-port <n>    logfeed SSE 端口（默认 19090）
#   --caddy-port <n>      Caddy 统一暴露端口（默认 18000，仅 --with-caddy 用）
#   --gost-version <x.y.z>  指定 gost 版本（默认 3.2.6）
#
# 干的事：
#   1. 优先从面板拉 gost 二进制（适合无 github 访问的内网主机）；
#      面板没预置才回退到 GitHub Release
#   2. 生成随机 API 密码、logfeed token
#   3. 写入 /etc/gost/gost.yaml，启用 API + metrics + JSON 日志
#   4. 创建 gost.service systemd unit
#   5. 部署内联的 gost-logfeed.mjs 到 /usr/local/bin（需要 node）
#   6. 创建 gost-logfeed.service systemd unit
#   6.5 [--with-caddy] 装 Caddy、写 /etc/gost/Caddyfile、起 gost-caddy.service
#   7. 打印 gost-panel://add?... 链接 — 粘到面板即可
#
# 默认端口：
#   18080  gost API
#   9000   metrics
#   19090  logfeed SSE
#   18000  Caddy 反代（仅 --with-caddy）
#
# 已存在的 /etc/gost/gost.yaml 不会被覆盖；重新跑会直接读已有配置生成链接。
#

set -euo pipefail

# PANEL_URL 由面板在 serve 时替换。如果你看到尖括号，说明这份脚本是从 git 仓库里直接看到的、
# 还没经过面板的中间件——通过 panel 域名访问 /install.sh 后会自动注入。
PANEL_URL="${PANEL_URL:-__PANEL_URL__}"
if [[ "$PANEL_URL" == "__PANEL_URL__" || -z "$PANEL_URL" ]]; then
  PANEL_URL=""
fi

GOST_VERSION="${GOST_VERSION:-3.2.6}"
GOST_API_PORT="${GOST_API_PORT:-18080}"
METRICS_PORT="${METRICS_PORT:-9000}"
LOGFEED_PORT="${LOGFEED_PORT:-19090}"
CADDY_PORT="${CADDY_PORT:-18000}"
WITH_CADDY=0
PANEL_NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --name) PANEL_NAME="${2:-}"; shift 2 ;;
    --gost-version) GOST_VERSION="${2:-}"; shift 2 ;;
    --api-port) GOST_API_PORT="${2:-}"; shift 2 ;;
    --metrics-port) METRICS_PORT="${2:-}"; shift 2 ;;
    --logfeed-port) LOGFEED_PORT="${2:-}"; shift 2 ;;
    --caddy-port) CADDY_PORT="${2:-}"; shift 2 ;;
    --with-caddy) WITH_CADDY=1; shift ;;
    *) echo "未知参数: $1" >&2; exit 1 ;;
  esac
done

#
# 颜色 / 输出 helper
#
if [[ -t 1 ]]; then
  c_red=$'\e[31m'; c_grn=$'\e[32m'; c_yel=$'\e[33m'; c_cyn=$'\e[36m'; c_rst=$'\e[0m'
else
  c_red=""; c_grn=""; c_yel=""; c_cyn=""; c_rst=""
fi
log()  { printf "%s\n" "$*"; }
ok()   { printf "%s✓%s %s\n" "$c_grn" "$c_rst" "$*"; }
warn() { printf "%s!%s %s\n" "$c_yel" "$c_rst" "$*"; }
die()  { printf "%s✗%s %s\n" "$c_red" "$c_rst" "$*" >&2; exit 1; }
step() { printf "\n%s%s%s\n" "$c_cyn" "$*" "$c_rst"; }

[[ $EUID -eq 0 ]] || die "需要 root。重试：curl -fsSL ... | sudo bash"

#
# 1. 平台检测
#
step "[1/7] 检测平台"
OS_KERNEL="$(uname -s | tr '[:upper:]' '[:lower:]')"
case "$OS_KERNEL" in
  linux)  OS=linux ;;
  darwin) OS=darwin ;;
  *) die "暂不支持的系统: $OS_KERNEL（当前只支持 linux / darwin）" ;;
esac

ARCH_RAW="$(uname -m)"
case "$ARCH_RAW" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  armv7*) ARCH=armv7 ;;
  i386|i686) ARCH=386 ;;
  *) die "暂不支持的 CPU 架构: $ARCH_RAW" ;;
esac
ok "$OS / $ARCH"

PUBLIC_IP="$(curl -fsSL --max-time 3 https://api.ipify.org 2>/dev/null || true)"
LOCAL_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
HOST_IP="${PUBLIC_IP:-${LOCAL_IP:-127.0.0.1}}"
HOST_NAME="${PANEL_NAME:-$(hostname -s 2>/dev/null || echo gost-host)}"

#
# 2. 装 gost — 优先面板本地，github 兜底
#
step "[2/7] gost 二进制"
if command -v gost >/dev/null 2>&1; then
  existing="$(gost -V 2>/dev/null | head -1 || true)"
  ok "已有 gost：$existing"
else
  tmp="$(mktemp -d)"
  pkg="gost_${GOST_VERSION}_${OS}_${ARCH}.tar.gz"

  panel_url=""
  if [[ -n "$PANEL_URL" ]]; then
    panel_url="${PANEL_URL%/}/dl/${pkg}"
  fi
  gh_url="https://github.com/go-gost/gost/releases/download/v${GOST_VERSION}/${pkg}"

  downloaded=0
  if [[ -n "$panel_url" ]]; then
    log "尝试从面板下载 $panel_url"
    if curl -fsSL --max-time 30 "$panel_url" -o "$tmp/gost.tgz" 2>/dev/null; then
      ok "已从面板拉到 $pkg（$(stat -c%s "$tmp/gost.tgz" 2>/dev/null || stat -f%z "$tmp/gost.tgz") 字节）"
      downloaded=1
    else
      warn "面板没有这个二进制；回退到 GitHub"
    fi
  fi
  if [[ "$downloaded" -eq 0 ]]; then
    log "下载 $gh_url"
    curl -fsSL "$gh_url" -o "$tmp/gost.tgz" \
      || die "gost 下载失败。无 github 访问？让面板管理员跑 pnpm fetch-binaries 后重试"
  fi

  tar -xzf "$tmp/gost.tgz" -C "$tmp"
  install -m 0755 "$tmp/gost" /usr/local/bin/gost
  rm -rf "$tmp"
  ok "/usr/local/bin/gost 已安装"
fi

#
# 3. 装 node（logfeed 需要）
#
step "[3/7] node（gost-logfeed 运行时）"
if command -v node >/dev/null 2>&1; then
  ok "已有 node：$(node -v)"
else
  if command -v apt-get >/dev/null 2>&1; then
    log "通过 apt 安装 nodejs"
    apt-get update -qq
    apt-get install -y -qq nodejs
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q nodejs
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q nodejs
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache nodejs
  else
    die "未识别包管理器；请自行安装 node ≥ 18 后重试"
  fi
  ok "已安装 $(node -v)"
fi

#
# 4. /etc/gost/gost.yaml — 已存在则读密码、否则新建
#
step "[4/7] /etc/gost/gost.yaml"
mkdir -p /etc/gost /var/log/gost
chmod 0750 /etc/gost

if [[ -f /etc/gost/gost.yaml ]]; then
  warn "已存在 /etc/gost/gost.yaml — 不覆盖，仅读取认证信息"
  # 用 grep 拎出 username / password。容错不强，要求用户配置文件是 install.sh 写出来的格式。
  GOST_USER="$(awk -F: '/^[[:space:]]+username:/ {gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); gsub(/^"|"$/, "", $2); print $2; exit}' /etc/gost/gost.yaml)"
  GOST_PASS="$(awk -F: '/^[[:space:]]+password:/ {gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); gsub(/^"|"$/, "", $2); print $2; exit}' /etc/gost/gost.yaml)"
  if [[ -z "${GOST_USER:-}" || -z "${GOST_PASS:-}" ]]; then
    die "未能从已有配置里解析出 api.auth；手动给面板加这台主机吧"
  fi
  ok "复用现有 api.auth：$GOST_USER / (•••)"
else
  GOST_USER="admin"
  GOST_PASS="$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 24)"
  cat > /etc/gost/gost.yaml <<EOF
# gost 主配置 — 由 gost-panel install.sh 生成
# API 启用，让面板能调；metrics 启用，让面板能画图；日志写文件，让边车 tail。
# 业务服务（service / chain / hop 等）请通过面板创建，不要手写在这里。

api:
  addr: ":${GOST_API_PORT}"
  pathPrefix: "/api"
  accesslog: true
  auth:
    username: ${GOST_USER}
    password: ${GOST_PASS}

metrics:
  addr: ":${METRICS_PORT}"
  path: "/metrics"

log:
  output: /var/log/gost/gost.log
  format: json
  level: info
EOF
  chmod 0640 /etc/gost/gost.yaml
  ok "新建：/etc/gost/gost.yaml（API 用户 $GOST_USER）"
fi

#
# 5. gost.service
#
step "[5/7] systemd: gost.service"
if [[ ! -f /etc/systemd/system/gost.service ]]; then
  cat > /etc/systemd/system/gost.service <<'EOF'
[Unit]
Description=gost v3 — proxy / forwarder
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/gost -C /etc/gost/gost.yaml
Restart=on-failure
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
  ok "/etc/systemd/system/gost.service"
else
  ok "gost.service 已存在"
fi

#
# 6. gost-logfeed.mjs + service
#
step "[6/7] systemd: gost-logfeed.service"
LOGFEED_TOKEN="$(head -c 16 /dev/urandom | xxd -p)"

cat > /usr/local/bin/gost-logfeed.mjs <<'__EOF_GOST_LOGFEED_zfXq7K2pM__'
__GOST_LOGFEED_MJS__
__EOF_GOST_LOGFEED_zfXq7K2pM__
chmod 0755 /usr/local/bin/gost-logfeed.mjs

if [[ ! -f /etc/systemd/system/gost-logfeed.service ]]; then
  cat > /etc/systemd/system/gost-logfeed.service <<EOF
[Unit]
Description=gost-logfeed — SSE bridge for gost log
After=network-online.target

[Service]
Type=simple
Environment=LOG_FILE=/var/log/gost/gost.log
Environment=PORT=${LOGFEED_PORT}
Environment=HOST=0.0.0.0
Environment=TOKEN=${LOGFEED_TOKEN}
ExecStart=/usr/bin/env node /usr/local/bin/gost-logfeed.mjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
  ok "新建 gost-logfeed.service（token 已生成）"
else
  # service 已存在 — 复用其中的 TOKEN，让重复跑 install.sh 仍能产生可用链接
  existing_token="$(awk -F= '/Environment=TOKEN=/ {print $3; exit}' /etc/systemd/system/gost-logfeed.service)"
  if [[ -n "$existing_token" ]]; then
    LOGFEED_TOKEN="$existing_token"
    ok "复用现有 logfeed token"
  fi
fi

systemctl daemon-reload
systemctl enable --now gost.service >/dev/null
systemctl enable --now gost-logfeed.service >/dev/null

# 等一下，让两个 service 起来
sleep 1

if ! systemctl is-active --quiet gost.service; then
  warn "gost.service 启动失败，看：journalctl -u gost -n 50"
fi
if ! systemctl is-active --quiet gost-logfeed.service; then
  warn "gost-logfeed.service 启动失败，看：journalctl -u gost-logfeed -n 50"
fi

#
# 6.5. 可选：Caddy 反代解决 CORS
#
if [[ "$WITH_CADDY" -eq 1 ]]; then
  step "[+] 可选：Caddy 反代（CORS）"

  if ! command -v caddy >/dev/null 2>&1; then
    # 没现成的 caddy，直接拉 caddyserver.com 的静态二进制
    case "$ARCH" in
      amd64) CADDY_ARCH=amd64 ;;
      arm64) CADDY_ARCH=arm64 ;;
      armv7) CADDY_ARCH=armv7 ;;
      *) die "暂不支持给这个架构装 caddy: $ARCH（手动装 caddy 再 --with-caddy 重跑）" ;;
    esac
    cd_url="https://caddyserver.com/api/download?os=${OS}&arch=${CADDY_ARCH}"
    log "下载 caddy: $cd_url"
    curl -fsSL "$cd_url" -o /usr/local/bin/caddy \
      || die "caddy 下载失败"
    chmod +x /usr/local/bin/caddy
    ok "/usr/local/bin/caddy 已安装：$(/usr/local/bin/caddy version | head -1)"
  else
    ok "已有 caddy：$(caddy version | head -1)"
  fi

  mkdir -p /etc/gost
  cat > /etc/gost/Caddyfile <<EOF
# 由 gost-panel install.sh --with-caddy 生成
# 目的：在一个端口上统一暴露 gost API / metrics / logfeed，并加 CORS 响应头，
# 让面板（浏览器 SPA）能直接跨域访问。
:${CADDY_PORT} {
    # OPTIONS 预检直接 204
    @preflight method OPTIONS
    handle @preflight {
        header Access-Control-Allow-Origin "*"
        header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS"
        header Access-Control-Allow-Headers "*"
        header Access-Control-Max-Age "86400"
        respond 204
    }

    # 其它所有响应都加 CORS 头
    header {
        Access-Control-Allow-Origin "*"
        Access-Control-Allow-Credentials "true"
        defer
    }

    # gost REST API
    handle /api/* {
        reverse_proxy localhost:${GOST_API_PORT}
    }

    # Prometheus 指标
    handle /metrics {
        reverse_proxy localhost:${METRICS_PORT}
    }

    # logfeed SSE — flush_interval -1 关掉响应缓冲，让 event 立刻流出去
    handle /stream {
        reverse_proxy localhost:${LOGFEED_PORT} {
            flush_interval -1
        }
    }
    handle /health {
        reverse_proxy localhost:${LOGFEED_PORT}
    }
}
EOF
  ok "/etc/gost/Caddyfile（监听 :${CADDY_PORT}）"

  if [[ ! -f /etc/systemd/system/gost-caddy.service ]]; then
    cat > /etc/systemd/system/gost-caddy.service <<'EOF'
[Unit]
Description=Caddy reverse proxy for gost (CORS-enabled)
After=network-online.target gost.service gost-logfeed.service

[Service]
Type=simple
ExecStart=/usr/local/bin/caddy run --config /etc/gost/Caddyfile --adapter caddyfile
ExecReload=/usr/local/bin/caddy reload --config /etc/gost/Caddyfile --adapter caddyfile
Restart=on-failure
RestartSec=3
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF
    ok "新建 gost-caddy.service"
  else
    ok "gost-caddy.service 已存在"
  fi
  systemctl daemon-reload
  systemctl enable --now gost-caddy.service >/dev/null
  sleep 1
  if ! systemctl is-active --quiet gost-caddy.service; then
    warn "gost-caddy.service 启动失败，看：journalctl -u gost-caddy -n 50"
  fi
fi

#
# 7. 输出
#
step "[7/7] 完成"

# URL-encode helper（纯 bash，仅处理常见情况：字母/数字/-._~ 不编码）
urlenc() {
  local s="$1" out="" i c
  for (( i=0; i<${#s}; i++ )); do
    c="${s:i:1}"
    case "$c" in
      [a-zA-Z0-9._~-]) out+="$c" ;;
      *) printf -v out '%s%%%02X' "$out" "'$c" ;;
    esac
  done
  printf '%s' "$out"
}

if [[ "$WITH_CADDY" -eq 1 ]]; then
  # Caddy 模式：所有路径走统一端口，浏览器面板拿到的是 CORS 友好的地址
  API_URL="http://${HOST_IP}:${CADDY_PORT}/api"
  METRICS_URL="http://${HOST_IP}:${CADDY_PORT}/metrics"
  LOGFEED_URL="http://${HOST_IP}:${CADDY_PORT}"
else
  API_URL="http://${HOST_IP}:${GOST_API_PORT}/api"
  METRICS_URL="http://${HOST_IP}:${METRICS_PORT}/metrics"
  LOGFEED_URL="http://${HOST_IP}:${LOGFEED_PORT}"
fi

JOIN_URL="gost-panel://add"
JOIN_URL+="?name=$(urlenc "$HOST_NAME")"
JOIN_URL+="&api=$(urlenc "$API_URL")"
JOIN_URL+="&user=$(urlenc "$GOST_USER")"
JOIN_URL+="&pass=$(urlenc "$GOST_PASS")"
JOIN_URL+="&logfeed=$(urlenc "$LOGFEED_URL")"
JOIN_URL+="&token=$(urlenc "$LOGFEED_TOKEN")"
JOIN_URL+="&metrics=$(urlenc "$METRICS_URL")"

echo
echo "${c_grn}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c_rst}"
echo "gost + logfeed${WITH_CADDY:+ + caddy} 已就绪。把下面这一行粘到面板「添加主机 → 一键链接」："
echo
echo "${c_cyn}${JOIN_URL}${c_rst}"
echo
echo "明文回显（如需手动填）："
echo "  名称        $HOST_NAME"
echo "  API 地址    $API_URL"
echo "  API 账号    $GOST_USER"
echo "  API 密码    $GOST_PASS"
echo "  logfeed     $LOGFEED_URL"
echo "  logfeed tok $LOGFEED_TOKEN"
echo "  metrics     $METRICS_URL"
if [[ "$WITH_CADDY" -eq 1 ]]; then
  echo
  echo "Caddy 反代：:${CADDY_PORT} → api(:${GOST_API_PORT}) / metrics(:${METRICS_PORT}) / logfeed(:${LOGFEED_PORT})"
  echo "原始端口仍开放，仅供本机排错；浏览器面板走 Caddy 端口避开 CORS"
fi
echo "${c_grn}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${c_rst}"
echo
echo "排错命令："
echo "  systemctl status gost         # gost 自身"
echo "  systemctl status gost-logfeed # 日志边车"
if [[ "$WITH_CADDY" -eq 1 ]]; then
  echo "  systemctl status gost-caddy   # CORS 反代"
fi
echo "  curl -u ${GOST_USER}:${GOST_PASS} ${API_URL}/config/services"
