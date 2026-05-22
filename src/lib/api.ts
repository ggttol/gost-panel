import axios, { isAxiosError, type InternalAxiosRequestConfig } from 'axios'
import { getActiveProfile } from './profiles'

/**
 * Single axios instance. Per-request interceptor pulls the currently-active
 * host profile so users can swap profiles at runtime without rebuilding the
 * client.
 */
export const api = axios.create({
  timeout: 10_000,
})

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const profile = getActiveProfile()
  if (!profile) {
    // We could throw here, but letting axios fail with ECONNABORTED keeps the
    // surface area for "no profile selected" handled in the UI guard layer.
    return config
  }
  config.baseURL = profile.apiBase
  if (profile.username || profile.password) {
    config.auth = { username: profile.username ?? '', password: profile.password ?? '' }
  } else {
    delete config.auth
  }
  return config
})

export type ListResponse<T> = {
  code?: number
  msg?: string
  data: { count: number; list: T[] }
}

export type Envelope<T> = {
  code?: number
  msg?: string
  data: T
}

/**
 * 把 axios 错误剥成一句内层提示。gost 错误体习惯用 `msg`，少数走 `message`，
 * 都没的话就退回 axios 自带 `message`。调用方按需自行拼前缀（例如 i18n 的「请求失败：」）。
 */
export function gostError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { msg?: string; message?: string } | undefined
    return data?.msg ?? data?.message ?? e.message
  }
  return (e as Error)?.message ?? String(e)
}
