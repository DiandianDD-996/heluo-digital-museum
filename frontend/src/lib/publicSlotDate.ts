export function shanghaiDay(offset = 0, now = new Date()) {
  const shanghai = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
  const base = new Date(`${shanghai}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + offset)
  return base.toISOString().slice(0, 10)
}

export function isPublicSlotDate(date: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const timestamp = Date.parse(`${date}T00:00:00Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date
    && date >= shanghaiDay(0, now) && date <= shanghaiDay(364, now)
}
