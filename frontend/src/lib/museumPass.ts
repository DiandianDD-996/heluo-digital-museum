export interface MuseumPassPayload {
  appointmentNo: string
  verificationCode?: string | null
  visitDate: string
  startTime: string
  endTime: string
  visitorCount: number
  contactName?: string | null
  status?: string | null
}

export interface KeepsakePlate {
  id: string
  shortZh: string
  shortEn: string
  editionZh: string
  editionEn: string
  titleZh: string
  titleEn: string
  eraZh: string
  eraEn: string
  blessingZh: string
  blessingEn: string
  imageUrl: string
}

export const KEEPSAKE_PLATES: KeepsakePlate[] = [
  {
    id: 'ding',
    shortZh: '甲 · 青铜鼎',
    shortEn: 'I · Ding',
    editionZh: '甲字 · 镇馆礼器',
    editionEn: 'PLATE I · RITUAL BRONZE',
    titleZh: '河洛青铜鼎',
    titleEn: 'Heluo Bronze Ding',
    eraZh: '商代安阳期 · 数字重制',
    eraEn: 'Shang Anyang · Digital Reconstruction',
    blessingZh: '以三足承千载之重，愿你在此慢读半日山河。',
    blessingEn: 'Three legs carry three millennia — may your afternoon unfold unhurried.',
    imageUrl: '/media/editorial/exhibit-ding-moonlight.webp',
  },
  {
    id: 'stone',
    shortZh: '乙 · 图纹石',
    shortEn: 'II · Slate',
    editionZh: '乙字 · 金石刻纹',
    editionEn: 'PLATE II · INCISED SLATE',
    titleZh: '河洛图纹石板',
    titleEn: 'River-Map Pattern Stone',
    eraZh: '河洛水系意象 · 概念馆藏',
    eraEn: 'Heluo River Motif · Concept Collection',
    blessingZh: '一脉河洛刻于青石，移步换光方见天地纵横。',
    blessingEn: 'Rivers carved into slate — shift the light, and a landscape awakens.',
    imageUrl: '/media/editorial/explore-river-map-stone-user-v2.webp',
  },
  {
    id: 'jade',
    shortZh: '丙 · 河图璧',
    shortEn: 'III · Jade Bi',
    editionZh: '丙字 · 温润礼玉',
    editionEn: 'PLATE III · RITUAL JADE',
    titleZh: '河图谷纹玉璧',
    titleEn: 'River-Map Jade Bi',
    eraZh: '天圆地方意象 · 概念馆藏',
    eraEn: 'Celestial Jade Disc · Concept Collection',
    blessingZh: '外圆象天、内孔藏光，留一寸静气予今日观展。',
    blessingEn: 'An outer ring for heaven, a quiet aperture for light — keep a moment of stillness.',
    imageUrl: '/media/editorial/explore-jade-bi-user-v2.webp',
  },
  {
    id: 'jar',
    shortZh: '丁 · 彩陶罐',
    shortEn: 'IV · Pottery',
    editionZh: '丁字 · 河岸彩陶',
    editionEn: 'PLATE IV · PAINTED EARTHENWARE',
    titleZh: '彩陶水纹罐',
    titleEn: 'Painted Pottery Water Jar',
    eraZh: '泥火水韵意象 · 概念馆藏',
    eraEn: 'River Rhythm Vessel · Concept Collection',
    blessingZh: '泥火成器、波纹绕肩，把一条河流的韵律带回日常。',
    blessingEn: 'Earth, fire, and sweeping currents — carry the river’s cadence home.',
    imageUrl: '/media/editorial/explore-painted-pottery-jar-user-v2.webp',
  },
  {
    id: 'bird',
    shortZh: '戊 · 水鸟像',
    shortEn: 'V · Bird',
    editionZh: '戊字 · 水畔青铜',
    editionEn: 'PLATE V · WATER-BIRD BRONZE',
    titleZh: '青铜水鸟立像',
    titleEn: 'Water-Bird Bronze Figure',
    eraZh: '水岸生灵意象 · 概念馆藏',
    eraEn: 'Riverbank Sculpture · Concept Collection',
    blessingZh: '停驻水畔的一瞬静姿，恰如走进展厅时的片刻从容。',
    blessingEn: 'A quiet pause at the water’s edge — the exact poise of stepping into a gallery.',
    imageUrl: '/media/editorial/explore-water-bird-bronze-user-v2.webp',
  },
  {
    id: 'jue',
    shortZh: '己 · 青铜爵',
    shortEn: 'VI · Jue',
    editionZh: '己字 · 酌礼青铜',
    editionEn: 'PLATE VI · RITUAL JUE',
    titleZh: '河洛纹青铜爵',
    titleEn: 'Heluo Bronze Jue',
    eraZh: '上张下稳意象 · 概念馆藏',
    eraEn: 'Ceremonial Vessel · Concept Collection',
    blessingZh: '流尾舒张、三足稳立，礼器之韵正在分寸之间。',
    blessingEn: 'Grace in proportion, poise on three legs — ritual harmony lives in every measure.',
    imageUrl: '/media/editorial/explore-bronze-jue-user-v2.webp',
  },
]

export function defaultKeepsakePlateIndex(seed: string): number {
  const input = seed.trim() || 'HELUO'
  let hash = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash) % KEEPSAKE_PLATES.length
}

/**
 * Deterministic 9x9 decorative verification matrix seeded by verificationCode/appointmentNo.
 * Includes three museum finder corners for visual legibility without claiming QR compliance.
 */
export function buildVerificationMatrix(seed: string): boolean[][] {
  const size = 9
  const grid: boolean[][] = Array.from({ length: size }, () => Array<boolean>(size).fill(false))
  const normalized = (seed || 'HELUO').toUpperCase()
  let hash = 2166136261
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  const paintFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        const edge = r === 0 || r === 2 || c === 0 || c === 2
        grid[r0 + r]![c0 + c] = edge || (r === 1 && c === 1)
      }
    }
  }
  paintFinder(0, 0)
  paintFinder(0, size - 3)
  paintFinder(size - 3, 0)

  let state = hash >>> 0
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const inFinder = (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3)
      if (inFinder) continue
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      grid[r]![c] = ((state >>> 24) & 1) === 1
    }
  }
  return grid
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function formatIcsLocalDateTime(visitDate: string, hhmmss: string): string {
  const datePart = visitDate.replaceAll('-', '')
  const parts = hhmmss.split(':')
  const hh = (parts[0] ?? '09').padStart(2, '0')
  const mm = (parts[1] ?? '00').padStart(2, '0')
  const ss = (parts[2] ?? '00').padStart(2, '0')
  return `${datePart}T${hh}${mm}${ss}`
}

export function buildMuseumPassIcs(pass: MuseumPassPayload, locale: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const dtStart = formatIcsLocalDateTime(pass.visitDate, pass.startTime)
  const dtEnd = formatIcsLocalDateTime(pass.visitDate, pass.endTime)
  const dtStamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const summary = locale === 'en-US'
    ? 'Heluo Digital Museum Visit'
    : '河洛数字博物馆 · 预约参观'
  const location = locale === 'en-US'
    ? 'Heluo Digital Museum, Luolong District, Luoyang'
    : '河洛数字博物馆（河南省洛阳市洛龙区开元大道与学府街交叉口）'
  const code = pass.verificationCode?.trim() || 'PENDING'
  const description = locale === 'en-US'
    ? `Booking No: ${pass.appointmentNo}\\nVerification Code: ${code}\\nVisitors: ${pass.visitorCount}\\nPlease arrive 15 minutes before entry.`
    : `预约编号：${pass.appointmentNo}\\n入馆核验码：${code}\\n参观人数：${pass.visitorCount} 人\\n请提前 15 分钟凭核验码入馆。`

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Heluo Digital Museum//Museum Pass//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${pass.appointmentNo}@heluo-museum.local`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=Asia/Shanghai:${dtStart}`,
    `DTEND;TZID=Asia/Shanghai:${dtEnd}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export function downloadMuseumPassIcs(pass: MuseumPassPayload, locale: 'zh-CN' | 'en-US' = 'zh-CN'): void {
  const ics = buildMuseumPassIcs(pass, locale)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `heluo-museum-pass-${pass.appointmentNo}.ics`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function loadExportImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * Generates a high-resolution (1600x740) physical-print Ex-Libris keepsake PNG:
 * Left 58%: Full-bleed darkroom photogravure plate + vertical calligraphy title slip + carved vermilion seal.
 * Right 42%: Warm Xuan-paper letterpress admission stub + monumental date + 9x9 verification seal.
 */
export async function downloadMuseumPassPng(
  pass: MuseumPassPayload,
  plate: KeepsakePlate,
  locale: 'zh-CN' | 'en-US' = 'zh-CN',
): Promise<boolean> {
  if (typeof document === 'undefined') return false
  const W = 1600
  const H = 740
  const SPLIT_X = 930
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return false

  const en = locale === 'en-US'
  const displayFont = '"Source Han Serif CN", "Noto Serif CJK SC", "Songti SC", "STSong", Georgia, serif'
  const monoFont = 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace'

  // ── Left 58%: Obsidian Darkroom Photogravure Plate ──
  ctx.fillStyle = '#141210'
  ctx.fillRect(0, 0, SPLIT_X, H)

  const img = await loadExportImage(plate.imageUrl)
  if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
    const isWide = img.naturalWidth / img.naturalHeight > 1.8
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, SPLIT_X, H)
    ctx.clip()
    if (isWide) {
      const targetW = SPLIT_X - 96
      const drawH = targetW * (img.naturalHeight / img.naturalWidth)
      ctx.drawImage(img, 48, (H - drawH) * 0.52, targetW, drawH)
    } else {
      const scale = Math.max(SPLIT_X / img.naturalWidth, H / img.naturalHeight)
      const dw = img.naturalWidth * scale
      const dh = img.naturalHeight * scale
      ctx.drawImage(img, (SPLIT_X - dw) / 2, (H - dh) * 0.44, dw, dh)
    }
    ctx.restore()
  }

  // Left & bottom darkroom chiaroscuro veil for luminous calligraphy legibility
  const leftVeil = ctx.createLinearGradient(0, 0, 340, 0)
  leftVeil.addColorStop(0, 'rgba(14, 12, 10, 0.88)')
  leftVeil.addColorStop(0.65, 'rgba(14, 12, 10, 0.34)')
  leftVeil.addColorStop(1, 'rgba(14, 12, 10, 0)')
  ctx.fillStyle = leftVeil
  ctx.fillRect(0, 0, SPLIT_X, H)

  const bottomVeil = ctx.createLinearGradient(0, H - 220, 0, H)
  bottomVeil.addColorStop(0, 'rgba(14, 12, 10, 0)')
  bottomVeil.addColorStop(1, 'rgba(14, 12, 10, 0.90)')
  ctx.fillStyle = bottomVeil
  ctx.fillRect(0, H - 220, SPLIT_X, 220)

  // Inner gold hairline plate frame
  ctx.strokeStyle = 'rgba(204, 174, 122, 0.42)'
  ctx.lineWidth = 1.25
  ctx.strokeRect(24, 24, SPLIT_X - 48, H - 48)

  // Vertical title slip (竖排题签)
  if (!en) {
    ctx.fillStyle = '#F3ECE0'
    ctx.font = `600 34px ${displayFont}`
    const chars = [...plate.titleZh]
    chars.forEach((ch, idx) => {
      ctx.fillText(ch, 62, 102 + idx * 44)
    })
    ctx.fillStyle = 'rgba(208, 178, 126, 0.88)'
    ctx.font = `400 18px ${displayFont}`
    const subChars = [...plate.editionZh.replace(/\s+/g, '')]
    subChars.forEach((ch, idx) => {
      ctx.fillText(ch, 114, 104 + idx * 26)
    })
  } else {
    ctx.fillStyle = 'rgba(208, 178, 126, 0.9)'
    ctx.font = `600 16px ${monoFont}`
    ctx.fillText(plate.editionEn, 56, 84)
    ctx.fillStyle = '#F3ECE0'
    ctx.font = `600 36px ${displayFont}`
    ctx.fillText(plate.titleEn, 56, 130)
  }

  // Carved Vermilion Collector's Chop (河洛)
  const sealX = 56
  const sealY = en ? 156 : 102 + plate.titleZh.length * 44 + 22
  ctx.strokeStyle = '#B83B2A'
  ctx.lineWidth = 2.6
  ctx.strokeRect(sealX, sealY, 44, 44)
  ctx.fillStyle = 'rgba(184, 59, 42, 0.16)'
  ctx.fillRect(sealX, sealY, 44, 44)
  ctx.fillStyle = '#D9533F'
  ctx.font = `700 16px ${displayFont}`
  ctx.fillText('河', sealX + 5, sealY + 20)
  ctx.fillText('洛', sealX + 23, sealY + 20)
  ctx.fillText('珍', sealX + 5, sealY + 38)
  ctx.fillText('藏', sealX + 23, sealY + 38)

  // Bottom poetic colophon
  ctx.fillStyle = 'rgba(243, 236, 224, 0.92)'
  ctx.font = `400 22px ${displayFont}`
  ctx.fillText(en ? `“${plate.blessingEn}”` : `“${plate.blessingZh}”`, 56, H - 56)

  // ── Right 42%: Warm Xuan-Paper Letterpress Admission Stub ──
  const stubGrad = ctx.createLinearGradient(SPLIT_X, 0, W, H)
  stubGrad.addColorStop(0, '#FAF5EA')
  stubGrad.addColorStop(1, '#F0E6D3')
  ctx.fillStyle = stubGrad
  ctx.fillRect(SPLIT_X, 0, W - SPLIT_X, H)

  // Die-cut perforation line & semicircular cutouts
  ctx.save()
  ctx.setLineDash([7, 7])
  ctx.strokeStyle = 'rgba(138, 108, 66, 0.45)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(SPLIT_X, 24)
  ctx.lineTo(SPLIT_X, H - 24)
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = '#0D0C0A'
  ctx.beginPath()
  ctx.arc(SPLIT_X, 0, 18, 0, Math.PI * 2)
  ctx.arc(SPLIT_X, H, 18, 0, Math.PI * 2)
  ctx.fill()

  const sx = SPLIT_X + 58
  const sr = W - 58

  // Nameplate + rotated ink stamp
  ctx.fillStyle = '#1E1A15'
  ctx.font = `600 26px ${displayFont}`
  ctx.fillText(en ? 'HELUO DIGITAL MUSEUM' : '河 洛 数 字 博 物 馆', sx, 94)
  ctx.fillStyle = '#7A6751'
  ctx.font = `500 15px ${monoFont}`
  ctx.fillText(en ? 'LUOYANG · ADMISSION KEEPSAKE' : '河南洛阳 · 龙门大道与开元大道', sx, 124)

  // Ink-stamped status mark
  ctx.save()
  ctx.translate(sr - 62, 86)
  ctx.rotate(-0.06)
  ctx.strokeStyle = '#A83224'
  ctx.lineWidth = 1.6
  ctx.strokeRect(-58, -18, 116, 36)
  ctx.fillStyle = '#A83224'
  ctx.font = `600 16px ${displayFont}`
  ctx.textAlign = 'center'
  ctx.fillText(en ? 'ISSUED' : '敬赠 · 已签发', 0, 6)
  ctx.restore()
  ctx.textAlign = 'left'

  // Hairline rule
  ctx.strokeStyle = 'rgba(138, 108, 66, 0.28)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(sx, 158)
  ctx.lineTo(sr, 158)
  ctx.stroke()

  // Monumental Date Lockup
  const parsedDate = new Date(`${pass.visitDate}T00:00:00Z`)
  const dayNum = Number.isNaN(parsedDate.getTime()) ? pass.visitDate.slice(-2) : String(parsedDate.getUTCDate()).padStart(2, '0')
  const monthText = Number.isNaN(parsedDate.getTime())
    ? pass.visitDate
    : new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long', weekday: 'short', timeZone: 'UTC' }).format(parsedDate)

  ctx.fillStyle = '#1E1A15'
  ctx.font = `300 104px ${displayFont}`
  ctx.fillText(dayNum, sx, 286)

  ctx.fillStyle = '#5C4F40'
  ctx.font = `500 21px ${displayFont}`
  ctx.fillText(monthText, sx + 148, 240)
  ctx.fillStyle = '#1E1A15'
  ctx.font = `600 24px ${monoFont}`
  ctx.fillText(`${pass.startTime.slice(0, 5)} — ${pass.endTime.slice(0, 5)}`, sx + 148, 282)

  // Second hairline rule
  ctx.beginPath()
  ctx.moveTo(sx, 336)
  ctx.lineTo(sr, 336)
  ctx.stroke()

  // Ledger row: Holder & Guests
  ctx.fillStyle = '#8A765D'
  ctx.font = `500 15px ${displayFont}`
  ctx.fillText(en ? 'GUEST OF HONOR' : '持券贵宾', sx, 382)
  ctx.fillText(en ? 'PARTY SIZE' : '同行人数', sx + 280, 382)

  ctx.fillStyle = '#1E1A15'
  ctx.font = `600 24px ${displayFont}`
  ctx.fillText(pass.contactName || (en ? 'Museum Guest' : '河洛贵宾'), sx, 422)
  ctx.fillText(en ? `${pass.visitorCount} Guest${pass.visitorCount > 1 ? 's' : ''}` : `${pass.visitorCount} 位`, sx + 280, 422)

  // Third hairline rule
  ctx.beginPath()
  ctx.moveTo(sx, 470)
  ctx.lineTo(sr, 470)
  ctx.stroke()

  // Unboxed 9x9 verification matrix + vermilion hex code
  const matrix = buildVerificationMatrix(`${pass.appointmentNo}:${pass.verificationCode ?? ''}`)
  const cell = 11.5
  const mX = sx
  const mY = 516
  ctx.strokeStyle = 'rgba(30, 26, 21, 0.25)'
  ctx.strokeRect(mX - 8, mY - 8, cell * 9 + 16, cell * 9 + 16)
  ctx.fillStyle = '#1E1A15'
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (matrix[r]?.[c]) {
        ctx.fillRect(mX + c * cell, mY + r * cell, cell - 2.2, cell - 2.2)
      }
    }
  }

  ctx.fillStyle = '#8A765D'
  ctx.font = `500 15px ${displayFont}`
  ctx.fillText(en ? 'ENTRY VERIFICATION CODE' : '入馆核验码', mX + 144, mY + 26)
  ctx.fillStyle = '#A83224'
  ctx.font = `700 32px ${monoFont}`
  ctx.fillText(pass.verificationCode?.trim() || 'PENDING', mX + 144, mY + 72)
  ctx.fillStyle = '#7A6751'
  ctx.font = `500 14px ${monoFont}`
  ctx.fillText(`NO. ${pass.appointmentNo}`, mX + 144, mY + 104)

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) return false
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `heluo-keepsake-pass-${pass.appointmentNo}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
