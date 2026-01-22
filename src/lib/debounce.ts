export type DebouncedFn<TArgs extends unknown[]> = ((...args: TArgs) => void) & {
  cancel: () => void
  flush: () => void
}

/**
 * Tiny debounce helper (no dependencies).
 * - `cancel()` clears any pending call
 * - `flush()` runs the pending call immediately (if any)
 */
export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  waitMs: number
): DebouncedFn<TArgs> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  let lastArgs: TArgs | undefined

  const debounced = ((...args: TArgs) => {
    lastArgs = args
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      timeout = undefined
      if (lastArgs) fn(...lastArgs)
      lastArgs = undefined
    }, waitMs)
  }) as DebouncedFn<TArgs>

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout)
    timeout = undefined
    lastArgs = undefined
  }

  debounced.flush = () => {
    if (!timeout || !lastArgs) return
    clearTimeout(timeout)
    timeout = undefined
    const args = lastArgs
    lastArgs = undefined
    fn(...args)
  }

  return debounced
}
