import type { BookmarkKind, CuratorialBookmark } from '../stores/curatorialBookmarks'

const ZH_NUMERALS = ['壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖', '拾']

export function plateNumeral(index: number, locale: 'zh-CN' | 'en-US'): string {
  if (locale === 'en-US') return String(index + 1).padStart(2, '0')
  return ZH_NUMERALS[index] ?? String(index + 1).padStart(2, '0')
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const chars = [...text.trim()]
  if (!chars.length) return []
  const lines: string[] = []
  let current = ''
  for (const ch of chars) {
    const candidate = current + ch
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current)
      current = ch
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

const KIND_LABELS: Record<'zh-CN' | 'en-US', Record<BookmarkKind, string>> = {
  'zh-CN': { artifact: '馆藏器物', exhibit: '数字展项', article: '文化专题', product: '河洛文创' },
  'en-US': { artifact: 'Collection', exhibit: 'Exhibit', article: 'Essay', product: 'Store' },
}

/**
 * Renders the visitor's collected plates & personal viewing notes into a vertical
 * museum-monograph keepsake PNG (1080px wide, Xuan-paper ground + vermilion seal).
 */
export async function downloadCuratorialNotebookPng(
  items: CuratorialBookmark[],
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
): Promise<boolean> {
  if (typeof document === 'undefined' || items.length === 0) return false
  const en = locale === 'en-US'
  const plates = items.slice(0, 8)
  const loaded = await Promise.all(plates.map((item) => (item.imageUrl ? loadImage(item.imageUrl) : Promise.resolve(null))))

  const W = 1080
  const PAD = 84
  const INNER_W = W - PAD * 2
  const HEADER_H = 264
  const FOOTER_H = 148
  const PLATE_IMG_H = 380
  const PLATE_BLOCK_H = 580
  const H = HEADER_H + plates.length * PLATE_BLOCK_H + FOOTER_H

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const displayFont = '"Source Han Serif CN", "Noto Serif CJK SC", "Songti SC", "STSong", Georgia, serif'
  const monoFont = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'

  // Warm Xuan paper ground
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#FBF7EE')
  bg.addColorStop(1, '#F2E9D8')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Left thread-bound stitch spine accents
  ctx.strokeStyle = 'rgba(138, 108, 66, 0.28)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(34, 36)
  ctx.lineTo(34, H - 36)
  ctx.stroke()

  // Outer fine rule
  ctx.strokeStyle = 'rgba(138, 108, 66, 0.34)'
  ctx.strokeRect(48, 36, W - 84, H - 72)

  // Header
  const today = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date())
  ctx.fillStyle = '#8C6C42'
  ctx.font = `500 18px ${monoFont}`
  ctx.fillText(en ? `HELUO CURATORIAL FOLIO · ${today}` : `河洛数字博物馆 · 私人观展手账 · ${today}`, PAD, 110)

  ctx.fillStyle = '#1D1914'
  ctx.font = `600 48px ${displayFont}`
  ctx.fillText(en ? 'Selected Exhibition Plates' : '河洛观展手账', PAD, 174)

  ctx.fillStyle = '#6E5E4B'
  ctx.font = `400 20px ${displayFont}`
  ctx.fillText(
    en
      ? `${plates.length} collected works & personal notes`
      : `共录藏目 ${plates.length} 帧 · 一器一念，留存此行所见`,
    PAD,
    218,
  )

  // Vermilion seal in upper right
  const sx = W - PAD - 56
  const sy = 96
  ctx.strokeStyle = '#B03425'
  ctx.lineWidth = 2.6
  ctx.strokeRect(sx, sy, 56, 56)
  ctx.fillStyle = 'rgba(176, 52, 37, 0.08)'
  ctx.fillRect(sx, sy, 56, 56)
  ctx.fillStyle = '#B03425'
  ctx.font = `700 20px ${displayFont}`
  ctx.fillText('河', sx + 7, sy + 25)
  ctx.fillText('洛', sx + 30, sy + 25)
  ctx.fillText('私', sx + 7, sy + 48)
  ctx.fillText('藏', sx + 30, sy + 48)

  // Divider
  ctx.strokeStyle = 'rgba(138, 108, 66, 0.32)'
  ctx.beginPath()
  ctx.moveTo(PAD, HEADER_H - 12)
  ctx.lineTo(W - PAD, HEADER_H - 12)
  ctx.stroke()

  // Plates
  plates.forEach((item, idx) => {
    const y0 = HEADER_H + idx * PLATE_BLOCK_H
    const title = en ? (item.titleEn?.trim() || item.title) : item.title
    const subtitle = en ? (item.subtitleEn?.trim() || item.subtitle || '') : (item.subtitle || '')
    const kindLabel = KIND_LABELS[locale][item.kind] || item.kind

    ctx.fillStyle = '#8C6C42'
    ctx.font = `500 17px ${displayFont}`
    ctx.fillText(
      en ? `PLATE ${plateNumeral(idx, 'en-US')} · ${kindLabel.toUpperCase()}` : `图版 ${plateNumeral(idx, 'zh-CN')} · ${kindLabel}`,
      PAD,
      y0 + 34,
    )

    // Darkroom gallery frame
    const imgY = y0 + 52
    ctx.fillStyle = '#181614'
    ctx.fillRect(PAD, imgY, INNER_W, PLATE_IMG_H)

    const img = loaded[idx]
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      const ratio = img.naturalWidth / img.naturalHeight
      ctx.save()
      ctx.beginPath()
      ctx.rect(PAD, imgY, INNER_W, PLATE_IMG_H)
      ctx.clip()
      if (ratio > 1.85) {
        const dw = INNER_W - 48
        const dh = dw / ratio
        ctx.drawImage(img, PAD + 24, imgY + (PLATE_IMG_H - dh) / 2, dw, dh)
      } else {
        const scale = Math.max(INNER_W / img.naturalWidth, PLATE_IMG_H / img.naturalHeight)
        const dw = img.naturalWidth * scale
        const dh = img.naturalHeight * scale
        ctx.drawImage(img, PAD + (INNER_W - dw) / 2, imgY + (PLATE_IMG_H - dh) / 2, dw, dh)
      }
      ctx.restore()
    }
    ctx.strokeStyle = 'rgba(138, 108, 66, 0.42)'
    ctx.strokeRect(PAD, imgY, INNER_W, PLATE_IMG_H)

    // Title + subtitle
    ctx.fillStyle = '#1D1914'
    ctx.font = `600 28px ${displayFont}`
    ctx.fillText(title, PAD, imgY + PLATE_IMG_H + 44)

    if (subtitle) {
      ctx.fillStyle = '#6E5E4B'
      ctx.font = `400 18px ${displayFont}`
      ctx.fillText(subtitle.slice(0, 56), PAD, imgY + PLATE_IMG_H + 74)
    }

    // Personal reflection note
    if (item.note?.trim()) {
      const noteY = imgY + PLATE_IMG_H + 106
      ctx.fillStyle = '#B03425'
      ctx.fillRect(PAD, noteY - 16, 3, 24)
      ctx.fillStyle = '#3C3227'
      ctx.font = `400 20px ${displayFont}`
      const lines = wrapLines(ctx, `“${item.note.trim()}”`, INNER_W - 24)
      lines.slice(0, 2).forEach((line, lIdx) => {
        ctx.fillText(line, PAD + 16, noteY + lIdx * 28)
      })
    }

    // Plate separator rule
    if (idx < plates.length - 1) {
      ctx.strokeStyle = 'rgba(138, 108, 66, 0.22)'
      ctx.beginPath()
      ctx.moveTo(PAD, y0 + PLATE_BLOCK_H - 14)
      ctx.lineTo(W - PAD, y0 + PLATE_BLOCK_H - 14)
      ctx.stroke()
    }
  })

  // Colophon Footer
  const footY = H - 72
  ctx.fillStyle = '#8C6C42'
  ctx.font = `400 18px ${displayFont}`
  ctx.fillText(
    en
      ? 'HELUO DIGITAL MUSEUM · LUOYANG — KEEP A QUIET MOMENT WITH HISTORY'
      : '河洛数字博物馆 · 洛阳 — 愿器物与文字，陪你慢读半日山河',
    PAD,
    footY,
  )

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  link.href = url
  link.download = `heluo-curatorial-folio-${stamp}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
