import { lazy, Suspense, type ComponentType } from 'react'
import type { ResourceKey } from '@/lib/resources'
import type { ResourceFormProps } from './types'

const ServiceForm    = lazy(() => import('./ServiceForm'))
const AutherForm     = lazy(() => import('./AutherForm'))
const BypassForm     = lazy(() => import('./BypassForm'))
const AdmissionForm  = lazy(() => import('./AdmissionForm'))
const HostsForm      = lazy(() => import('./HostsForm'))
const ResolverForm   = lazy(() => import('./ResolverForm'))
const HopForm        = lazy(() => import('./HopForm'))
const ChainForm      = lazy(() => import('./ChainForm'))

const REGISTRY: Partial<Record<ResourceKey, ComponentType<ResourceFormProps>>> = {
  services:   ServiceForm,
  authers:    AutherForm,
  bypasses:   BypassForm,
  admissions: AdmissionForm,
  hosts:      HostsForm,
  resolvers:  ResolverForm,
  hops:       HopForm,
  chains:     ChainForm,
}

export function hasForm(key: ResourceKey): boolean {
  return key in REGISTRY
}

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
