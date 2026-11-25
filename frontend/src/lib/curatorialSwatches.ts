export interface MineralSwatch {
  nameZh: string
  nameEn: string
  oklch: string
}

export interface CraftClue {
  zh: string
  en: string
}

export interface CuratorialMaterialProfile {
  swatches: readonly MineralSwatch[]
  craftClues: readonly CraftClue[]
}

const PROFILES: Record<string, CuratorialMaterialProfile> = {
  'heluo-bronze-ding': {
    swatches: [
      { nameZh: '粉绿铜锈', nameEn: 'Malachite Patina', oklch: 'oklch(62% 0.082 166)' },
      { nameZh: '玄铜古泽', nameEn: 'Smoked Bronze', oklch: 'oklch(34% 0.026 78)' },
      { nameZh: '错金暖光', nameEn: '22K Gold Sheen', oklch: 'oklch(81% 0.095 82)' },
      { nameZh: '范土褐斑', nameEn: 'Loess Clay Crust', oklch: 'oklch(48% 0.056 58)' },
    ],
    craftClues: [
      { zh: '陶范合铸', en: 'Piece-Mold Casting' },
      { zh: '扉棱中轴', en: 'Axial Flange Ridges' },
      { zh: '三足承重', en: 'Tripod Balance' },
      { zh: '云雷衬地', en: 'Leiwen Ground' },
    ],
  },
  'water-bird-bronze': {
    swatches: [
      { nameZh: '石绿铜斑', nameEn: 'Verdigris Bloom', oklch: 'oklch(58% 0.078 162)' },
      { nameZh: '铅锡青灰', nameEn: 'Tin-Bronze Gray', oklch: 'oklch(44% 0.020 148)' },
      { nameZh: '暗铜氧化', nameEn: 'Cuprite Umber', oklch: 'oklch(38% 0.052 44)' },
      { nameZh: '浅金棱光', nameEn: 'Burnished Rim', oklch: 'oklch(75% 0.068 78)' },
    ],
    craftClues: [
      { zh: '分铸焊接', en: 'Separate-Cast Join' },
      { zh: '阴刻羽纹', en: 'Incised Plumage' },
      { zh: '花口承盘', en: 'Scalloped Tray' },
    ],
  },
  'heluo-bronze-jue': {
    swatches: [
      { nameZh: '灰绿铜衣', nameEn: 'Pale Patina', oklch: 'oklch(60% 0.054 156)' },
      { nameZh: '玄铁深胎', nameEn: 'Charcoal Alloy', oklch: 'oklch(30% 0.016 142)' },
      { nameZh: '银灰水银沁', nameEn: 'Mercury Lustre', oklch: 'oklch(70% 0.012 180)' },
      { nameZh: '土锈赭黄', nameEn: 'Ochre Encrustation', oklch: 'oklch(56% 0.062 72)' },
    ],
    craftClues: [
      { zh: '三棱锥足', en: 'Blade-Edged Tripod' },
      { zh: '双菌形柱', en: 'Twin Capped Posts' },
      { zh: '兽首鋬耳', en: 'Zoomorphic Handle' },
    ],
  },
  'river-map-jade-bi': {
    swatches: [
      { nameZh: '青白透玉', nameEn: 'Celadon Nephrite', oklch: 'oklch(66% 0.044 128)' },
      { nameZh: '褐红土沁', nameEn: 'Russet Iron Alteration', oklch: 'oklch(46% 0.068 58)' },
      { nameZh: '墨玉深纹', nameEn: 'Smoked Jade Vein', oklch: 'oklch(29% 0.028 96)' },
      { nameZh: '温脂玉光', nameEn: 'Mutton-Fat Glow', oklch: 'oklch(82% 0.026 112)' },
    ],
    craftClues: [
      { zh: '管钻对穿', en: 'Tubular Core Drilling' },
      { zh: '浅浮谷纹', en: 'Grain-Spiral Relief' },
      { zh: '砣轮抛光', en: 'Rotary Wheel Polish' },
    ],
  },
  'painted-pottery-water-jar': {
    swatches: [
      { nameZh: '赭红陶胎', nameEn: 'Terracotta Clay', oklch: 'oklch(65% 0.088 54)' },
      { nameZh: '锰黑彩绘', nameEn: 'Manganese Slip Black', oklch: 'oklch(24% 0.014 48)' },
      { nameZh: '黄土素底', nameEn: 'Loess Buff', oklch: 'oklch(74% 0.054 74)' },
    ],
    craftClues: [
      { zh: '泥条盘筑', en: 'Coil-Built Body' },
      { zh: '慢轮修整', en: 'Slow-Wheel Trim' },
      { zh: '双漩水纹', en: 'Twin Vortex Slip' },
    ],
  },
  'river-map-pattern-stone': {
    swatches: [
      { nameZh: '青石本色', nameEn: 'Honed Limestone', oklch: 'oklch(52% 0.022 92)' },
      { nameZh: '风化灰白', nameEn: 'Weathered Chalk', oklch: 'oklch(69% 0.018 90)' },
      { nameZh: '凹槽墨影', nameEn: 'Carved Recess', oklch: 'oklch(34% 0.018 86)' },
      { nameZh: '古拓乌金', nameEn: 'Rubbing Ink Black', oklch: 'oklch(20% 0.008 238)' },
    ],
    craftClues: [
      { zh: '减地平雕', en: 'Recessed Planar Relief' },
      { zh: '阴线勾勒', en: 'Incised Contour' },
      { zh: '斜光显影', en: 'Raking-Light Reading' },
    ],
  },
}

const SLUG_ALIASES: Record<string, string> = {
  'heluo-bronze-ding-3d': 'heluo-bronze-ding',
  'river-map-stone-raking': 'river-map-pattern-stone',
}

export function getCuratorialMaterialProfile(slug?: string | null): CuratorialMaterialProfile | null {
  if (!slug) return null
  const normalized = SLUG_ALIASES[slug] ?? slug
  return PROFILES[normalized] ?? null
}
