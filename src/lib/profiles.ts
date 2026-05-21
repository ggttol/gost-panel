import { useEffect, useSyncExternalStore } from 'react'

export type HostProfile = {
  id: string
  /** 用户可读的别名，例：家里 / 公司 / 测试 */
  name: string
  /** gost API 完整 URL，例：http://192.168.1.10:18080/api */
  apiBase: string
  username?: string
  password?: string
  /** gost-logfeed SSE 入口，例：http://192.168.1.10:19090 */
  logfeedUrl?: string
  logfeedToken?: string
  /** gost Prometheus 端点完整 URL；缺省尝试从 apiBase 推导 :9000/metrics */
  metricsUrl?: string
  createdAt: number
}

const STORAGE = 'gost-panel:profiles'
const ACTIVE = 'gost-panel:active'

type State = { profiles: HostProfile[]; activeId: string | null }

const listeners = new Set<() => void>()
let state: State = read()

function read(): State {
  try {
    const profiles = JSON.parse(localStorage.getItem(STORAGE) ?? '[]') as HostProfile[]
    const activeId = localStorage.getItem(ACTIVE)
    return { profiles, activeId: activeId || null }
  } catch {
    return { profiles: [], activeId: null }
  }
}

function persist() {
  localStorage.setItem(STORAGE, JSON.stringify(state.profiles))
  if (state.activeId) localStorage.setItem(ACTIVE, state.activeId)
  else localStorage.removeItem(ACTIVE)
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

function snapshot() {
  return state
}

export function useProfilesState(): State {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}

export function getActiveProfile(): HostProfile | null {
  if (!state.activeId) return null
  return state.profiles.find((p) => p.id === state.activeId) ?? null
}

export function setActiveProfile(id: string | null) {
  state = { ...state, activeId: id }
  persist()
}

export function upsertProfile(p: HostProfile) {
  const idx = state.profiles.findIndex((x) => x.id === p.id)
  const next = state.profiles.slice()
  if (idx >= 0) next[idx] = p
  else next.push(p)
  state = { ...state, profiles: next, activeId: state.activeId ?? p.id }
  persist()
}

export function deleteProfile(id: string) {
  const next = state.profiles.filter((p) => p.id !== id)
  const activeId =
    state.activeId === id ? (next[0]?.id ?? null) : state.activeId
  state = { profiles: next, activeId }
  persist()
}

export function newProfileId(): string {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID()
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * If localStorage has no profile yet but the build has env defaults
 * (legacy single-host setup), seed a profile from env so existing users
 * don't have to re-enter anything.
 */
export function bootstrapFromEnv() {
  if (state.profiles.length > 0) return
  const apiBase = import.meta.env.VITE_GOST_API_BASE as string | undefined
  if (!apiBase) return
  const profile: HostProfile = {
    id: newProfileId(),
    name: '默认',
    apiBase,
    username: (import.meta.env.VITE_GOST_USER as string | undefined) ?? undefined,
    password: (import.meta.env.VITE_GOST_PASS as string | undefined) ?? undefined,
    logfeedToken:
      (import.meta.env.VITE_GOST_LOGFEED_TOKEN as string | undefined) ?? undefined,
    logfeedUrl: import.meta.env.DEV ? '/proxy-logs' : undefined,
    metricsUrl: import.meta.env.DEV ? '/proxy-metrics' : undefined,
    createdAt: Date.now(),
  }
  upsertProfile(profile)
}

/** Optional helper used by the host switcher to ensure a useful default. */
export function useBootstrap() {
  useEffect(() => {
    bootstrapFromEnv()
  }, [])
}
