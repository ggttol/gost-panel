import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as Dropdown from '@radix-ui/react-dropdown-menu'
import { Check, ChevronsUpDown, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  deleteProfile,
  setActiveProfile,
  useProfilesState,
  type HostProfile,
} from '@/lib/profiles'
import { AddHostDialog } from '@/components/AddHostDialog'
import { cn } from '@/lib/utils'

export function HostSwitcher() {
  const { profiles, activeId } = useProfilesState()
  const qc = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<HostProfile | null>(null)

  const active = profiles.find((p) => p.id === activeId)

  function pick(p: HostProfile) {
    if (p.id === activeId) return
    setActiveProfile(p.id)
    qc.clear()
  }
  function onEdit(p: HostProfile) {
    setEditing(p)
  }
  function onDelete(p: HostProfile) {
    if (!confirm(`删除主机「${p.name}」？\n（只删本地连接记录，不影响远端 gost）`)) return
    deleteProfile(p.id)
    qc.clear()
  }

  return (
    <div className="px-4 pt-5 pb-4 border-b border-[var(--color-border)]">
      <div className="flex items-baseline gap-2">
        <div className="text-[15px] font-semibold tracking-tight text-[var(--color-fg)]">gost</div>
        <div className="eyebrow leading-none">control plane</div>
      </div>

      <Dropdown.Root>
        <Dropdown.Trigger asChild>
          <button
            className={cn(
              'mt-3 w-full flex items-center gap-2 px-2 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors',
              'text-left',
            )}
          >
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-[12px] font-medium truncate">
                {active ? active.name : '未选择主机'}
              </span>
              <span className="text-[10px] font-mono text-[var(--color-muted)] truncate">
                {active ? hostOf(active.apiBase) : '点这里添加'}
              </span>
            </span>
            <ChevronsUpDown size={13} className="text-[var(--color-muted)] shrink-0" />
          </button>
        </Dropdown.Trigger>

        <Dropdown.Portal>
          <Dropdown.Content
            sideOffset={6}
            align="start"
            className="z-50 min-w-[260px] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.06)] p-1"
          >
            {profiles.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-[var(--color-muted)]">
                还没有任何主机连接
              </div>
            ) : (
              profiles.map((p) => (
                <Row
                  key={p.id}
                  profile={p}
                  active={p.id === activeId}
                  onPick={() => pick(p)}
                  onEdit={() => onEdit(p)}
                  onDelete={() => onDelete(p)}
                />
              ))
            )}
            <Dropdown.Separator className="my-1 h-px bg-[var(--color-border)]" />
            <Dropdown.Item
              onSelect={() => {
                setEditing(null)
                setAdding(true)
              }}
              className="flex items-center gap-2 px-2 py-1.5 text-[12px] rounded-sm cursor-pointer outline-none data-[highlighted]:bg-[var(--color-accent-soft)] data-[highlighted]:text-[var(--color-accent)]"
            >
              <Plus size={12} /> 添加新主机
            </Dropdown.Item>
          </Dropdown.Content>
        </Dropdown.Portal>
      </Dropdown.Root>

      <AddHostDialog
        open={adding || !!editing}
        onOpenChange={(v) => {
          if (!v) {
            setAdding(false)
            setEditing(null)
          }
        }}
        initial={editing}
      />
    </div>
  )
}

function Row({
  profile,
  active,
  onPick,
  onEdit,
  onDelete,
}: {
  profile: HostProfile
  active: boolean
  onPick: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'group flex items-center gap-1 px-2 py-1.5 rounded-sm text-[12px]',
        active && 'bg-[var(--color-accent-soft)]',
      )}
    >
      <Dropdown.Item
        onSelect={onPick}
        className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer outline-none"
      >
        <Check
          size={12}
          className={cn(active ? 'text-[var(--color-accent)]' : 'text-transparent')}
        />
        <span className="flex-1 min-w-0">
          <span className="block truncate font-medium">{profile.name}</span>
          <span className="block truncate text-[10px] font-mono text-[var(--color-muted)]">
            {hostOf(profile.apiBase)}
          </span>
        </span>
      </Dropdown.Item>
      <button
        onClick={onEdit}
        className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
        title="编辑"
      >
        <Pencil size={11} />
      </button>
      <button
        onClick={onDelete}
        className="p-1 rounded text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)]"
        title="删除（仅本地记录）"
      >
        <Trash2 size={11} />
      </button>
    </div>
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}
