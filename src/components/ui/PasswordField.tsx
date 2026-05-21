import { useState } from 'react'
import { toast } from 'sonner'
import { Copy, Eye, EyeOff, Sparkles } from 'lucide-react'
import { TextField } from '@/components/ui/Form'
import { generateVarValue, type RecipeVar } from '@/lib/cookbook'
import { cn } from '@/lib/utils'

export type GenerateKind = NonNullable<RecipeVar['generate']>

/**
 * 密码 / 高熵 token 类输入框。
 * 默认以掩码渲染；输入框右侧最多 3 个 mini 按钮：
 *  - 👁 显示/隐藏
 *  - 📋 复制
 *  - ✨ 一键随机生成（仅当 generate prop 给定时显示）
 */
export function PasswordField({
  value,
  onChange,
  placeholder,
  disabled,
  generate,
  autoComplete = 'new-password',
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  disabled?: boolean
  generate?: GenerateKind
  autoComplete?: string
  className?: string
}) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  function gen() {
    if (!generate) return
    onChange(generateVarValue(generate))
    setRevealed(true)
    toast.success(`已生成 ${labelFor(generate)}`)
  }
  function copy() {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    })
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TextField
        type={revealed ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className="flex-1"
      />
      {value ? (
        <button
          type="button"
          onClick={() => setRevealed((x) => !x)}
          className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
          title={revealed ? '隐藏' : '显示'}
          aria-label={revealed ? '隐藏密码' : '显示密码'}
        >
          {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      ) : null}
      {value ? (
        <button
          type="button"
          onClick={copy}
          className="h-8 px-2 inline-flex items-center gap-1 text-[11px] rounded-md border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
          title="复制"
        >
          <Copy size={11} />{copied ? '已复制' : '复制'}
        </button>
      ) : null}
      {generate ? (
        <button
          type="button"
          onClick={gen}
          disabled={disabled}
          className="h-8 px-2 inline-flex items-center gap-1 text-[11px] rounded-md border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] disabled:opacity-50"
          title={`随机生成 ${labelFor(generate)}`}
        >
          <Sparkles size={11} /> 生成
        </button>
      ) : null}
    </div>
  )
}

function labelFor(kind: GenerateKind): string {
  switch (kind) {
    case 'base64-16':   return '16 字节 base64'
    case 'base64-32':   return '32 字节 base64'
    case 'hex-8':       return '8 字节 hex'
    case 'hex-16':      return '16 字节 hex'
    case 'password-16': return '16 位随机密码'
    case 'password-32': return '32 位随机密码'
    case 'uuid':        return 'UUID'
  }
}
