import type { MusicTrack } from './audioScenes'

export interface MusicTrackMeta {
  id: MusicTrack
  titleZh: string
  titleEn: string
  sceneZh: string
  sceneEn: string
  durationLabel: string
  artwork: string
}

export const MUSIC_TRACK_ORDER: readonly MusicTrack[] = ['home', 'reading', 'bronze', 'jade']

export const MUSIC_CATALOG: Readonly<Record<MusicTrack, MusicTrackMeta>> = {
  home: {
    id: 'home',
    titleZh: '入馆·河洛晨光',
    titleEn: 'Morning Light at Heluo',
    sceneZh: '首页 · 馆藏漫步',
    sceneEn: 'Home · Gallery Walk',
    durationLabel: '1:38',
    artwork: '/media/editorial/hero-bronze-ding-home-640w-v1.webp',
  },
  reading: {
    id: 'reading',
    titleZh: '水岸·静读',
    titleEn: 'Quiet Reading by the River',
    sceneZh: '器物故事 · 文化专题',
    sceneEn: 'Stories · Curatorial Notes',
    durationLabel: '1:43',
    artwork: '/media/editorial/explore-water-bird-bronze-user-v2.webp',
  },
  bronze: {
    id: 'bronze',
    titleZh: '观器·温金',
    titleEn: 'Warm Bronze Inspection',
    sceneZh: '3D 数字展厅 · 青铜鼎',
    sceneEn: '3D Gallery · Bronze Ding',
    durationLabel: '1:48',
    artwork: '/media/editorial/explore-bronze-ding-user-v2.webp',
  },
  jade: {
    id: 'jade',
    titleZh: '温润·玉石',
    titleEn: 'Luminous Jade & Stone',
    sceneZh: '玉石 · 彩陶 · 河图石',
    sceneEn: 'Jade · Pottery · River Stone',
    durationLabel: '1:39',
    artwork: '/media/editorial/explore-jade-bi-user-v2.webp',
  },
}

export function trackTitle(track: MusicTrack, locale: string): string {
  const meta = MUSIC_CATALOG[track]
  return locale === 'en-US' ? meta.titleEn : meta.titleZh
}
