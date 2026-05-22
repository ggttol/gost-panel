import { useState } from 'react'
import { toast } from 'sonner'
import { gostError } from '@/lib/api'
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
import { useDeleteResource } from '@/lib/queries'
import { RESOURCE_LABEL_ZH, T } from '@/lib/i18n'
import type { ResourceKey } from '@/lib/resources'

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  resourceKey,
  name,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  resourceKey: ResourceKey | null
  name: string | null
}) {
  const del = useDeleteResource((resourceKey ?? 'services') as ResourceKey)
  const [error, setError] = useState<string | null>(null)
  const label = resourceKey ? RESOURCE_LABEL_ZH[resourceKey] : ''

  async function confirm() {
    if (!resourceKey || !name) return
    setError(null)
    try {
      await del.mutateAsync(name)
      toast.success(T.resource.deleteSuccess(label))
      onOpenChange(false)
    } catch (e) {
      setError(`${T.resource.requestFailed}：${gostError(e)}`)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setError(null)
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{T.resource.deleteTitle(label)}</DialogTitle>
          <DialogDescription>
            {resourceKey && name ? T.resource.deleteConfirm(label, name) : null}
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="text-xs text-rose-600 dark:text-rose-400 border border-rose-500/30 bg-rose-500/5 rounded-md px-2.5 py-1.5">
            {error}
          </div>
        ) : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={del.isPending}>
              {T.common.cancel}
            </Button>
          </DialogClose>
          <Button variant="danger" onClick={confirm} disabled={del.isPending}>
            {del.isPending ? T.common.deleting : T.common.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
