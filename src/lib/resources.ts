export type ResourceKey =
  | 'services'
  | 'chains'
  | 'hops'
  | 'authers'
  | 'admissions'
  | 'bypasses'
  | 'resolvers'
  | 'hosts'
  | 'ingresses'
  | 'routers'
  | 'observers'
  | 'recorders'
  | 'sds'
  | 'limiters'
  | 'climiters'
  | 'rlimiters'

export type ResourceDef = {
  key: ResourceKey
  label: string
  group: 'Core' | 'Routing' | 'Policy' | 'Resolve' | 'Telemetry' | 'Limit'
}

export const RESOURCES: ResourceDef[] = [
  { key: 'services',   label: 'Services',     group: 'Core' },
  { key: 'chains',     label: 'Chains',       group: 'Core' },
  { key: 'hops',       label: 'Hops',         group: 'Core' },

  { key: 'authers',    label: 'Authers',      group: 'Policy' },
  { key: 'admissions', label: 'Admissions',   group: 'Policy' },
  { key: 'bypasses',   label: 'Bypasses',     group: 'Policy' },
  { key: 'ingresses',  label: 'Ingresses',    group: 'Routing' },
  { key: 'routers',    label: 'Routers',      group: 'Routing' },
  { key: 'sds',        label: 'SDs',          group: 'Routing' },

  { key: 'resolvers',  label: 'Resolvers',    group: 'Resolve' },
  { key: 'hosts',      label: 'Hosts',        group: 'Resolve' },

  { key: 'observers',  label: 'Observers',    group: 'Telemetry' },
  { key: 'recorders',  label: 'Recorders',    group: 'Telemetry' },

  { key: 'limiters',   label: 'Limiters',     group: 'Limit' },
  { key: 'climiters',  label: 'Conn Limiters',group: 'Limit' },
  { key: 'rlimiters',  label: 'Rate Limiters',group: 'Limit' },
]

export const RESOURCE_KEYS = new Set(RESOURCES.map((r) => r.key))

export function isResourceKey(s: string): s is ResourceKey {
  return RESOURCE_KEYS.has(s as ResourceKey)
}
