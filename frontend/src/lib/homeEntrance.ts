const KEY = 'heluo.home-intro-seen'
let seen = false

/** One full entrance per tab session, including reloads; storage may be blocked. */
export function claimHomeEntrance(): boolean {
  if (seen) return false
  seen = true
  try {
    if (sessionStorage.getItem(KEY) === 'true') return false
    sessionStorage.setItem(KEY, 'true')
  } catch { /* In-memory fallback still avoids replay on route returns. */ }
  return true
}
