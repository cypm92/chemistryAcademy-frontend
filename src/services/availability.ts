// Reject incomplete responses: an unparseable occupied interval must never appear free.
export function validAvailability(data: unknown): boolean {
  return Array.isArray(data) && data.every((event) => {
    if (!event || typeof event.starts_at !== 'string' || typeof event.ends_at !== 'string' || typeof event.status !== 'string' || !event.status) return false
    const start = Date.parse(event.starts_at)
    const end = Date.parse(event.ends_at)
    return Number.isFinite(start) && Number.isFinite(end) && end > start
  })
}
