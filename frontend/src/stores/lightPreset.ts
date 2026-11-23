import { ref } from 'vue'

export type LightPresetId = 'celestial' | 'luoshui' | 'spotlight' | 'kintsugi'

export interface LightPresetMeta {
  id: LightPresetId
  index: string
  zhName: string
  enName: string
  zhTagline: string
  enTagline: string
}

export const LIGHT_PRESETS: readonly LightPresetMeta[] = [
  {
    id: 'celestial',
    index: '01',
    zhName: '河洛星纬',
    enName: 'Celestial Lattice',
    zhTagline: '磁感鎏金星阵 · 聚光星轨微连线 · 点击金环波纹',
    enTagline: 'Magnetic bronze star-lattice, delicate gold filaments & click pulse',
  },
  {
    id: 'luoshui',
    index: '02',
    zhName: '洛水浮光',
    enName: 'Luo Silk Caustics',
    zhTagline: '汝窑雾天青 × 香槟鎏金 · 贝塞尔丝绸光带 · 椭圆柔光涟漪',
    enTagline: 'Song Ru-celadon & champagne silk splines, soft bokeh & water ripples',
  },
  {
    id: 'spotlight',
    index: '03',
    zhName: '展柜聚光',
    enName: 'Gallery Spotlight',
    zhTagline: '博物馆轨道体积光束 · 河洛暗金经纬显影 · 丁达尔浮尘',
    enTagline: 'Volumetric gallery beam revealing hidden Heluo compass filigree',
  },
  {
    id: 'kintsugi',
    index: '04',
    zhName: '流金箔尘',
    enName: 'Kintsugi Flow',
    zhTagline: '有机涡旋金箔流场 · 拂袖金粉尾流 · 金缮流光描边',
    enTagline: 'Curl-noise gold-leaf vortex wake & luminous kintsugi borders',
  },
] as const

export const LIGHT_PRESET_EVENT = 'heluo:light-preset-change'
const STORAGE_KEY = 'heluo.lightPreset'
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

function parsePreset(raw: string | null): LightPresetId {
  if (raw === 'celestial' || raw === 'luoshui' || raw === 'spotlight' || raw === 'kintsugi') return raw
  return 'celestial'
}

const current = ref<LightPresetId>(isBrowser ? parsePreset(window.localStorage.getItem(STORAGE_KEY)) : 'celestial')

function syncDocument(preset: LightPresetId) {
  if (!isBrowser) return
  document.documentElement.dataset.lightPreset = preset
}

syncDocument(current.value)

export function useLightPreset() {
  function setPreset(preset: LightPresetId) {
    if (current.value === preset) {
      syncDocument(preset)
      return
    }
    current.value = preset
    if (isBrowser) {
      try { window.localStorage.setItem(STORAGE_KEY, preset) } catch { /* ignore storage quota */ }
    }
    syncDocument(preset)
    if (isBrowser) {
      window.dispatchEvent(new CustomEvent<LightPresetId>(LIGHT_PRESET_EVENT, { detail: preset }))
    }
  }

  return {
    preset: current,
    presets: LIGHT_PRESETS,
    setPreset,
  }
}
