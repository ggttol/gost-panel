import axios, { type InternalAxiosRequestConfig } from 'axios'
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
