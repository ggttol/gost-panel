// Common gost type catalogs used by form dropdowns.
// Not exhaustive; users can always fall back to JSON tab for exotic types.

export const HANDLER_TYPES = [
  { value: 'http',         label: 'http',         hint: 'HTTP 代理' },
  { value: 'http2',        label: 'http2',        hint: 'HTTP/2 代理' },
  { value: 'socks4',       label: 'socks4',       hint: 'SOCKS4 代理' },
  { value: 'socks5',       label: 'socks5',       hint: 'SOCKS5 代理' },
  { value: 'ss',           label: 'ss',           hint: 'Shadowsocks' },
  { value: 'relay',        label: 'relay',        hint: 'gost relay 协议' },
  { value: 'forward',      label: 'forward',      hint: '通用转发' },
  { value: 'tcp',          label: 'tcp',          hint: 'TCP 端口转发' },
  { value: 'udp',          label: 'udp',          hint: 'UDP 端口转发' },
  { value: 'redirect',     label: 'redirect',     hint: 'Linux REDIRECT 透明代理' },
  { value: 'tproxy',       label: 'tproxy',       hint: 'Linux TPROXY' },
  { value: 'dns',          label: 'dns',          hint: 'DNS 代理' },
  { value: 'sshd',         label: 'sshd',         hint: 'SSH 服务端隧道' },
  { value: 'serial',       label: 'serial',       hint: '串口转发' },
  { value: 'unix',         label: 'unix',         hint: 'unix socket' },
  { value: 'rtcp',         label: 'rtcp',         hint: '反向 TCP 隧道' },
  { value: 'rudp',         label: 'rudp',         hint: '反向 UDP 隧道' },
  { value: 'tun',          label: 'tun',          hint: 'TUN 设备' },
  { value: 'tap',          label: 'tap',          hint: 'TAP 设备' },
  { value: 'file',         label: 'file',         hint: '文件服务' },
]

export const LISTENER_TYPES = [
  { value: 'tcp',   label: 'tcp' },
  { value: 'udp',   label: 'udp' },
  { value: 'tls',   label: 'tls' },
  { value: 'mtls',  label: 'mtls' },
  { value: 'ws',    label: 'ws',    hint: 'WebSocket' },
  { value: 'wss',   label: 'wss',   hint: 'WebSocket over TLS' },
  { value: 'mws',   label: 'mws' },
  { value: 'mwss',  label: 'mwss' },
  { value: 'http2', label: 'http2' },
  { value: 'h2',    label: 'h2' },
  { value: 'h2c',   label: 'h2c' },
  { value: 'grpc',  label: 'grpc' },
  { value: 'kcp',   label: 'kcp' },
  { value: 'quic',  label: 'quic' },
  { value: 'ftcp',  label: 'ftcp' },
  { value: 'ssh',   label: 'ssh' },
  { value: 'sshd',  label: 'sshd' },
  { value: 'redirect', label: 'redirect' },
  { value: 'tproxy',   label: 'tproxy' },
  { value: 'serial',   label: 'serial' },
  { value: 'unix',     label: 'unix' },
  { value: 'rtcp',     label: 'rtcp' },
  { value: 'rudp',     label: 'rudp' },
  { value: 'tun',      label: 'tun' },
  { value: 'tap',      label: 'tap' },
]

export const CONNECTOR_TYPES = [
  { value: 'http',     label: 'http' },
  { value: 'http2',    label: 'http2' },
  { value: 'socks4',   label: 'socks4' },
  { value: 'socks5',   label: 'socks5' },
  { value: 'ss',       label: 'ss' },
  { value: 'relay',    label: 'relay' },
  { value: 'forward',  label: 'forward' },
  { value: 'sshd',     label: 'sshd' },
  { value: 'tunnel',   label: 'tunnel' },
]

export const DIALER_TYPES = [
  { value: 'tcp',   label: 'tcp' },
  { value: 'udp',   label: 'udp' },
  { value: 'tls',   label: 'tls' },
  { value: 'mtls',  label: 'mtls' },
  { value: 'ws',    label: 'ws' },
  { value: 'wss',   label: 'wss' },
  { value: 'http2', label: 'http2' },
  { value: 'h2',    label: 'h2' },
  { value: 'h2c',   label: 'h2c' },
  { value: 'grpc',  label: 'grpc' },
  { value: 'kcp',   label: 'kcp' },
  { value: 'quic',  label: 'quic' },
  { value: 'ssh',   label: 'ssh' },
]

export const SELECTOR_STRATEGIES = [
  { value: 'round',    label: 'round',    hint: '轮询' },
  { value: 'rand',     label: 'rand',     hint: '随机' },
  { value: 'fifo',     label: 'fifo',     hint: '首选可用' },
  { value: 'hash',     label: 'hash',     hint: '一致性哈希' },
]
