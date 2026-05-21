import axios from 'axios'

const baseURL = import.meta.env.VITE_GOST_API_BASE
const username = import.meta.env.VITE_GOST_USER
const password = import.meta.env.VITE_GOST_PASS

export const api = axios.create({
  baseURL,
  auth: username && password ? { username, password } : undefined,
  timeout: 10_000,
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
