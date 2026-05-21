import { useFullConfig, useReloadConfig } from '@/lib/queries'
import { Button } from '@/components/ui/Button'
import { EditorJson } from '@/components/ui/EditorJson'
import { T } from '@/lib/i18n'
import { toast } from 'sonner'
import { RefreshCw, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ConfigPage() {
  const { data, isLoading, error, refetch, isFetching } = useFullConfig()
  const reload = useReloadConfig()

  async function doReload() {
    try {
      await reload.mutateAsync()
      toast.success(T.common.reloaded)
    } catch (e) {
      toast.error(`${T.resource.requestFailed}：${(e as Error).message}`)
    }
  }

  return (
    <div>
      <header className="flex items-end justify-between mb-7 gap-6 flex-wrap">
        <div>
          <div className="eyebrow mb-2">/global / config</div>
          <h1 className="text-[28px] leading-none font-semibold tracking-tight">{T.config.title}</h1>
          <p className="text-[12px] font-mono text-[var(--color-muted)] mt-2">GET /api/config</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={doReload} disabled={reload.isPending} title={T.config.reloadTooltip}>
            <RotateCcw size={13} className={cn(reload.isPending && 'animate-spin')} />
            {reload.isPending ? T.common.reloading : T.common.reload}
          </Button>
          <Button onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw size={13} className={cn(isFetching && 'animate-spin')} />
            {isFetching ? T.common.loading : T.common.refresh}
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="h-64 border border-[var(--color-border)] rounded-lg animate-pulse bg-[var(--color-surface)]/40" />
      ) : error ? (
        <div className="border border-[color-mix(in_oklab,var(--color-danger)_35%,transparent)] bg-[var(--color-danger-soft)] text-[var(--color-danger)] rounded-lg p-4">
          <div className="eyebrow mb-1">{T.resource.requestFailed}</div>
          <code className="text-[12px] font-mono">
            {error instanceof Error ? error.message : String(error)}
          </code>
        </div>
      ) : (
        <EditorJson value={JSON.stringify(data, null, 2)} readOnly height="68vh" />
      )}
    </div>
  )
}
