import { useEffect } from 'react'

// Keeps the screen on while `active`. The browser drops the lock whenever the
// page is hidden, so it's asked for again each time the page comes back.
export function useScreenWakeLock(active) {
  useEffect(() => {
    if (!active) return undefined
    let lock = null
    let stopped = false

    async function hold() {
      if (document.visibilityState !== 'visible') return
      try {
        const granted = await navigator.wakeLock?.request('screen')
        if (stopped) granted?.release().catch(() => {})
        else lock = granted
      } catch {
        lock = null
      }
    }

    hold()
    document.addEventListener('visibilitychange', hold)
    return () => {
      stopped = true
      document.removeEventListener('visibilitychange', hold)
      lock?.release().catch(() => {})
    }
  }, [active])
}
