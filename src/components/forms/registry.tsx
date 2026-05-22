import { Suspense } from 'react'
import type { ResourceKey } from '@/lib/resources'
import type { ResourceFormProps } from './types'
import { REGISTRY } from './registry.helpers'

export function ResourceForm({
  resourceKey,
  ...rest
}: { resourceKey: ResourceKey } & ResourceFormProps) {
  const Comp = REGISTRY[resourceKey]
  if (!Comp) return null
  return (
    <Suspense fallback={<div className="text-xs text-[var(--color-muted)] py-6 text-center">加载表单…</div>}>
      <Comp {...rest} />
    </Suspense>
  )
}
