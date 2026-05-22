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
const IngressForm    = lazy(() => import('./IngressForm'))
const RouterForm     = lazy(() => import('./RouterForm'))
const ObserverForm   = lazy(() => import('./ObserverForm'))
const RecorderForm   = lazy(() => import('./RecorderForm'))
const SDForm         = lazy(() => import('./SDForm'))
const LimiterForm    = lazy(() => import('./LimiterForm'))
const CLimiterForm   = lazy(() => import('./CLimiterForm'))
const RLimiterForm   = lazy(() => import('./RLimiterForm'))

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
  ingresses:  IngressForm,
  routers:    RouterForm,
  observers:  ObserverForm,
  recorders:  RecorderForm,
  sds:        SDForm,
  limiters:   LimiterForm,
  climiters:  CLimiterForm,
  rlimiters:  RLimiterForm,
}

export function hasForm(key: ResourceKey): boolean {
  return key in REGISTRY
}
