import { useQuery } from '@tanstack/react-query'
import { getActiveProfile } from './profiles'

export type MetricSample = {
  name: string
  labels: Record<string, string>
  value: number
}

export function parsePromText(text: string): MetricSample[] {
  const out: MetricSample[] = []
  const lines = text.split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{([^}]*)\})?\s+(\S+)/)
    if (!m) continue
    const [, name, , labelStr, valStr] = m
    const value = Number(valStr)
    if (!Number.isFinite(value)) continue
    const labels: Record<string, string> = {}
    if (labelStr) {
      const re = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"/g
      let lm: RegExpExecArray | null
      while ((lm = re.exec(labelStr))) {
        labels[lm[1]] = lm[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      }
    }
    out.push({ name, labels, value })
  }
  return out
}

export function sumBy(samples: MetricSample[], name: string): number {
  return samples
    .filter((s) => s.name === name)
    .reduce((acc, s) => acc + s.value, 0)
}

export function groupSumByLabel(
  samples: MetricSample[],
  name: string,
  label: string,
): Array<{ key: string; value: number }> {
  const m = new Map<string, number>()
  for (const s of samples) {
    if (s.name !== name) continue
    const k = s.labels[label] ?? '(unlabeled)'
    m.set(k, (m.get(k) ?? 0) + s.value)
  }
  return Array.from(m, ([key, value]) => ({ key, value })).sort(
    (a, b) => b.value - a.value,
  )
}

export function deriveMetricsUrl(): string {
  const profile = getActiveProfile()
  if (!profile) return ''
  if (profile.metricsUrl) return profile.metricsUrl
  // Fall back: swap port 18080 for 9000 in apiBase. Works for the common case.
  try {
    const u = new URL(profile.apiBase)
    u.pathname = '/metrics'
    if (u.port === '18080' || u.port === '') u.port = '9000'
    u.search = ''
    return u.toString()
  } catch {
    return ''
  }
}

export function useMetrics(intervalMs: number, enabled: boolean) {
  const url = deriveMetricsUrl()
  const profileId = getActiveProfile()?.id ?? 'none'
  return useQuery({
    queryKey: ['metrics', profileId, url],
    enabled: !!url && enabled,
    refetchInterval: enabled ? intervalMs : false,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const res = await fetch(url, { mode: 'cors' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      return parsePromText(text)
    },
  })
}
