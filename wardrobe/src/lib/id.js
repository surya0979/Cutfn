// crypto.randomUUID only exists in secure contexts; testing on a phone over
// http://192.168.x.x is not one, so fall back to a timestamp + random id.
export function makeId() {
  if (globalThis.crypto?.randomUUID) {
    try {
      return crypto.randomUUID()
    } catch {
      /* non-secure context */
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
