import { useState } from 'react'
import { Plus, ServerCog } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AddHostDialog } from '@/components/AddHostDialog'
import { InstallCommand } from '@/components/InstallCommand'

export function WelcomePage() {
  const [adding, setAdding] = useState(false)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <span aria-hidden className="live-wire" />
      <div className="max-w-lg w-full">
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
          两条路：① 在目标主机执行下面这行装好 gost + 边车，把它打印的 <code className="font-mono text-[12px]">gost-panel://…</code> 链接粘回面板；② 已经有 gost 实例就点「手动添加」直接填地址账号。
        </p>

        <div className="mt-4">
          <InstallCommand />
        </div>

        <ul className="mt-4 text-[12px] text-[var(--color-muted)] leading-relaxed list-none flex flex-col gap-1.5">
          <li>· 脚本生成随机 API 密码、启 systemd、配 metrics 与 JSON 日志</li>
          <li>· 无 github 访问的主机：先在面板这边 <code className="font-mono">pnpm fetch-binaries</code> 预下载 gost 二进制，脚本会自动用面板的 <code className="font-mono">/dl/</code> 镜像</li>
          <li>· 连接信息只存浏览器 localStorage；公用电脑别勾住</li>
        </ul>

        <div className="mt-6 flex gap-2">
          <Button variant="accent" onClick={() => setAdding(true)}>
            <Plus size={14} /> 手动添加
          </Button>
        </div>
      </div>
      <AddHostDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
