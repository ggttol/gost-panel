import { Link } from 'react-router-dom'
import { useExistingNames } from '@/lib/queries'
import { RESOURCE_LABEL_ZH } from '@/lib/i18n'
import type { ResourceKey } from '@/lib/resources'
import { cn } from '@/lib/utils'

/**
 * 跨资源引用字段：把"填一个 chain 名字"变成"从已有 chain 里选一个"。
 * 没数据时降级为文本输入，并给出"去配置一个"的链接提示。
 */
export function ResourceRefField({
  refKind,
  value,
  onChange,
  disabled,
  placeholder = '— 不绑定 —',
  className,
}: {
  refKind: ResourceKey
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const q = useExistingNames(refKind)
  const names = q.data ?? []
  const label = RESOURCE_LABEL_ZH[refKind]

  // Make sure the current value is always selectable even if it's not in the list
  // (e.g. user wrote a name that's been deleted, or freshly typed).
  const options = [...new Set([...names, value].filter(Boolean))]

  if (options.length === 0) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={`没有可用的${label}`}
          className="h-8 flex-1 px-2.5 text-[13px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] outline-none placeholder:text-[var(--color-muted)]"
        />
        <Link
          to={`/r/${refKind}`}
          target="_blank"
          className="text-[11px] font-mono text-[var(--color-accent)] hover:underline whitespace-nowrap"
          title={`打开${label}列表新建一个，回来再选`}
        >
          去配置 ↗
        </Link>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative flex-1">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="appearance-none h-8 w-full pr-8 pl-2.5 text-[13px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] outline-none cursor-pointer font-mono"
        >
          <option value="">{placeholder}</option>
          {options.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-muted)] text-[10px]">
          ▾
        </span>
      </div>
      <Link
        to={`/r/${refKind}`}
        target="_blank"
        className="text-[11px] font-mono text-[var(--color-muted)] hover:text-[var(--color-accent)] hover:underline whitespace-nowrap"
        title={`管理${label}`}
      >
        {names.length} 项 ↗
      </Link>
    </div>
  )
}
