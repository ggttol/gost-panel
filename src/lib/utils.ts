import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Recursively drop:
 *  - `undefined`
 *  - empty strings
 *  - objects that contain no kept keys after recursion
 *  - arrays whose entries are all dropped
 *
 * `null`, `false`, and `0` are preserved — gost treats these as meaningful.
 * Returns `undefined` for the "nothing to keep" case so callers can short-circuit.
 *
 * The function never mutates its input.
 */
export function pruneEmpty<T>(input: T): T | undefined {
  if (input === undefined) return undefined
  if (typeof input === 'string') return (input === '' ? undefined : input) as T

  if (Array.isArray(input)) {
    const arr = (input as unknown[])
      .map((v) => pruneEmpty(v))
      .filter((v) => v !== undefined)
    return (arr.length > 0 ? (arr as unknown as T) : undefined)
  }

  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const next = pruneEmpty(v)
      if (next !== undefined) out[k] = next
    }
    return (Object.keys(out).length > 0 ? (out as unknown as T) : undefined)
  }

  return input
}
