import { useState } from 'react'
import { Plus, ServerCog } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AddHostDialog } from '@/components/AddHostDialog'

export function WelcomePage() {
  const [adding, setAdding] = useState(false)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <span aria-hidden className="live-wire" />
      <div className="max-w-md w-full">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-accent)]">
            <ServerCog size={16} strokeWidth={1.75} />
          </span>
          <div>
            <div className="text-[15px] font-semibold tracking-tight">gost</div>
            <div className="eyebrow leading-none">control plane · setup</div>
          </div>
        </div>
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight mt-4 mb-2">
          先添加一台 gost 主机
        </h1>
        <p className="text-[13px] text-[var(--color-fg-2)] leading-relaxed">
          面板把连接信息存在浏览器本地，可以同时管理多个 gost 实例，切换无需重新构建。
        </p>
        <ul className="mt-4 text-[12px] text-[var(--color-muted)] leading-relaxed list-none flex flex-col gap-1.5">
          <li>· 至少需要填 gost API 地址 + 账号密码</li>
          <li>· 可选：实时日志（gost-logfeed 边车）和指标（Prometheus URL）</li>
          <li>· 密码以明文存 localStorage，请只在自己电脑上用</li>
        </ul>
        <div className="mt-6 flex gap-2">
          <Button variant="accent" onClick={() => setAdding(true)}>
            <Plus size={14} /> 添加第一台主机
          </Button>
          <a
            href="https://github.com/ggttol/gost-panel#部署"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center h-8 px-3 text-[13px] rounded-md border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] text-[var(--color-fg-2)] hover:text-[var(--color-fg)] transition-colors"
          >
            部署说明 ↗
          </a>
        </div>
      </div>
      <AddHostDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
