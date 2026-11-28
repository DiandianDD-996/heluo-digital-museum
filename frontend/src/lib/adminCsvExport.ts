export async function downloadAdminCsv(path: string, token: string, fallbackFilename: string): Promise<string> {
  const response = await fetch(`/api/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string } | null
    throw new Error(payload?.message || '导出名单失败，请稍后重试。')
  }

  const disposition = response.headers.get('content-disposition') ?? ''
  const utf8Match = disposition.match(/filename\*=UTF-8''([^;\n]+)/i)
  const plainMatch = disposition.match(/filename="?([^";\n]+)"?/i)
  const rawName = utf8Match?.[1] ? decodeURIComponent(utf8Match[1]) : (plainMatch?.[1] ?? fallbackFilename)
  const filename = rawName.trim() || fallbackFilename

  const csvBytes = await response.arrayBuffer()
  const blob = new Blob([csvBytes], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
  return filename
}
