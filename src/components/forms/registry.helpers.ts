import { lazy, type ComponentType } from 'react'
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

// 这里只放数据/工具函数；React 组件留在 registry.tsx 里，
// 避免 react-refresh 触发 only-export-components 警告。
export const REGISTRY: Partial<Record<ResourceKey, ComponentType<ResourceFormProps>>> = {
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
