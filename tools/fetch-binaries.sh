#!/usr/bin/env bash
#
# fetch-binaries.sh — 把 gost release tar.gz 预下载到 tools/dl/，
# 让 install.sh 在无 github 访问的主机上也能装上 gost（走面板自己的 /dl/）。
#
# 用法：
#   pnpm fetch-binaries                  # 默认拉 3.2.6 全平台
#   pnpm fetch-binaries -- 3.3.0         # 指定版本
#   GOST_PLATS="linux_amd64 linux_arm64" pnpm fetch-binaries   # 指定平台
#

set -euo pipefail

VER="${1:-${GOST_VERSION:-3.2.6}}"
DEFAULT_PLATS="linux_amd64 linux_arm64 linux_armv7 linux_386 darwin_amd64 darwin_arm64"
PLATS_ENV="${GOST_PLATS:-$DEFAULT_PLATS}"
read -r -a PLATS <<< "$PLATS_ENV"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DL_DIR="$SCRIPT_DIR/dl"
mkdir -p "$DL_DIR"

echo "下载 gost v${VER} → $DL_DIR"
for plat in "${PLATS[@]}"; do
  pkg="gost_${VER}_${plat}.tar.gz"
  out="$DL_DIR/$pkg"
  if [[ -f "$out" ]]; then
    printf "  · 已存在 %s\n" "$pkg"
    continue
  fi
  url="https://github.com/go-gost/gost/releases/download/v${VER}/${pkg}"
  printf "  ↓ %-40s " "$pkg"
  if curl -fsSL --max-time 60 "$url" -o "$out.part"; then
    mv "$out.part" "$out"
    printf "OK (%s 字节)\n" "$(stat -c%s "$out" 2>/dev/null || stat -f%z "$out")"
  else
    rm -f "$out.part"
    printf "FAIL\n"
  fi
done

echo "完成。Vite dev 重启后即可在 /dl/ 路径下载；prod build 时会自动 emit 到 dist/dl/。"
