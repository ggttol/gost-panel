import { useEffect, useState } from 'react'
import axios, { isAxiosError } from 'axios'
import { toast } from 'sonner'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { FormSection, FieldRow, TextField } from '@/components/ui/Form'
import { PasswordField } from '@/components/ui/PasswordField'
import {
  newProfileId,
  setActiveProfile,
  upsertProfile,
  type HostProfile,
} from '@/lib/profiles'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'

export function AddHostDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial?: HostProfile | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <Body initial={initial ?? null} onDone={() => onOpenChange(false)} /> : null}
    </Dialog>
  )
}

type TestState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; ms: number; count: number }
  | { kind: 'fail'; msg: string }

function Body({ initial, onDone }: { initial: HostProfile | null; onDone: () => void }) {
  const editing = !!initial
  const qc = useQueryClient()

  const [name, setName] = useState(initial?.name ?? '')
  const [apiBase, setApiBase] = useState(initial?.apiBase ?? 'http://192.168.1.10:18080/api')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [logfeedUrl, setLogfeedUrl] = useState(initial?.logfeedUrl ?? '')
  const [logfeedToken, setLogfeedToken] = useState(initial?.logfeedToken ?? '')
  const [metricsUrl, setMetricsUrl] = useState(initial?.metricsUrl ?? '')
  const [test, setTest] = useState<TestState>({ kind: 'idle' })
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => setTest({ kind: 'idle' }), [apiBase, username, password])

  async function runTest() {
    setTest({ kind: 'running' })
    const t0 = performance.now()
    try {
      const res = await axios.get(`${trimSlash(apiBase)}/config/services`, {
        timeout: 6000,
        auth: username || password ? { username, password } : undefined,
      })
      const ms = Math.round(performance.now() - t0)
      const count = (res.data as { data?: { count?: number } })?.data?.count ?? 0
      setTest({ kind: 'ok', ms, count })
    } catch (e) {
      const msg = isAxiosError(e)
        ? e.response
          ? `HTTP ${e.response.status} ${(e.response.data as { msg?: string })?.msg ?? ''}`.trim()
          : e.message
        : (e as Error).message
      setTest({ kind: 'fail', msg })
    }
  }

  function submit() {
    setErr(null)
    const trimmed = name.trim() || guessName(apiBase)
    if (!apiBase.trim()) {
      setErr('API 地址不能为空')
      return
    }
    try {
      new URL(apiBase) // throws if invalid
    } catch {
      setErr('API 地址格式错误，应形如 http://host:18080/api')
      return
    }
    const profile: HostProfile = {
      id: initial?.id ?? newProfileId(),
      name: trimmed,
      apiBase: trimSlash(apiBase),
      username: username || undefined,
      password: password || undefined,
      logfeedUrl: logfeedUrl ? trimSlash(logfeedUrl) : undefined,
      logfeedToken: logfeedToken || undefined,
      metricsUrl: metricsUrl ? metricsUrl.trim() : undefined,
      createdAt: initial?.createdAt ?? Date.now(),
    }
    upsertProfile(profile)
    if (!editing) setActiveProfile(profile.id)
    qc.clear()
    toast.success(editing ? `已更新主机：${profile.name}` : `已添加主机：${profile.name}`)
    onDone()
  }

  return (
    <DialogContent wide className="max-h-[88vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? '编辑主机连接' : '添加主机连接'}</DialogTitle>
        <DialogDescription>
          连接信息存在浏览器 localStorage；切换主机即可分别管理多个 gost 实例。
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <FormSection title="基本">
          <FieldRow label="别名" hint="给这个连接起个好认的名字，例：家里 / 公司 / 测试">
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="家里 / 公司 / 测试"
            />
          </FieldRow>
          <FieldRow
            label="API 地址"
            hint="完整 URL，含 /api 后缀。例：http://192.168.1.10:18080/api"
          >
            <TextField
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="http://host:18080/api"
            />
          </FieldRow>
          <FieldRow label="账号" hint="对应 gost.yaml 里 api.auth.username">
            <TextField value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
          </FieldRow>
          <FieldRow label="密码" hint="明文存浏览器 localStorage；公用电脑慎用">
            <PasswordField value={password} onChange={setPassword} placeholder="••••••••" />
          </FieldRow>
        </FormSection>

        <FormSection
          title="可选 · 实时日志"
          hint="部署了 gost-logfeed 边车才填。SSE URL，例：http://host:19090（结尾不要带 /stream）"
        >
          <FieldRow label="边车地址" hint="留空则该主机不显示日志页">
            <TextField
              value={logfeedUrl}
              onChange={(e) => setLogfeedUrl(e.target.value)}
              placeholder="http://host:19090"
            />
          </FieldRow>
          <FieldRow label="Token" hint="边车启动时设的 TOKEN 环境变量；点「生成」一键 32 字符 hex，然后把同样的值写进边车的 systemd unit Environment=TOKEN=...，再 daemon-reload + restart">
            <PasswordField
              value={logfeedToken}
              onChange={setLogfeedToken}
              placeholder="32 位 hex"
              generate="hex-16"
            />
          </FieldRow>
        </FormSection>

        <FormSection
          title="可选 · 指标"
          hint="gost /metrics 默认无 CORS，浏览器跨域读不到；想要指标页可用，必须把它放到允许 CORS 的反代后面。"
        >
          <FieldRow label="Metrics URL" hint="完整路径，例：http://host/proxy-metrics 或 https://gost.example.com/metrics">
            <TextField
              value={metricsUrl}
              onChange={(e) => setMetricsUrl(e.target.value)}
              placeholder="留空则尝试 :9000/metrics（同主机才行）"
            />
          </FieldRow>
        </FormSection>

        <div className="border-t border-[var(--color-border)] pt-3 mt-2 flex items-center gap-3">
          <Button onClick={runTest} disabled={test.kind === 'running'}>
            {test.kind === 'running' ? (
              <>
                <Loader2 size={13} className="animate-spin" /> 测试中…
              </>
            ) : (
              '测试连接'
            )}
          </Button>
          <TestPill state={test} />
        </div>

        {err ? (
          <div className="text-[12px] text-[var(--color-danger)] border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[var(--color-danger-soft)] rounded-md px-2.5 py-1.5">
            {err}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="ghost">取消</Button>
        </DialogClose>
        <Button variant="primary" onClick={submit}>{editing ? '保存' : '添加'}</Button>
      </DialogFooter>
    </DialogContent>
  )
}

function TestPill({ state }: { state: TestState }) {
  if (state.kind === 'idle') {
    return <span className="text-[11px] text-[var(--color-muted)]">未测试</span>
  }
  if (state.kind === 'running') {
    return <span className="text-[11px] text-[var(--color-muted)]">联系中…</span>
  }
  if (state.kind === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)]">
        <CheckCircle2 size={12} />
        {`OK · ${state.ms}ms · ${state.count} 个服务`}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] text-[var(--color-danger)]')}>
      <XCircle size={12} />
      {state.msg}
    </span>
  )
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '')
}

function guessName(apiBase: string): string {
  try {
    const u = new URL(apiBase)
    return u.host
  } catch {
    return '未命名'
  }
}
