import type { AmbienceScene } from './audioSystem'

export type MusicScene = 'home' | 'collection' | 'exhibit' | 'story' | 'jade' | 'booking' | 'store' | 'account' | 'quiet'
export type MusicTrack = 'home' | 'reading' | 'bronze' | 'jade'

export interface MusicRecording {
  track: MusicTrack
  src: string
  gain: number
}

// These files already contain the approved R4 scene levels (.8 / .58 / .72 / .67).
// Compensate for the shared .62 music bus once, rather than also applying
// the retired synthesizer's instrument gain and making the recordings dim.
const SCENE_LEVEL = 1 / 0.62
const recording = (track: MusicTrack, level = 1): MusicRecording => ({
  track,
  src: `/media/audio/music-r4/${track}-r4.m4a`,
  gain: SCENE_LEVEL * level,
})

export const SCENE_BY_TRACK: Readonly<Record<MusicTrack, MusicScene>> = {
  home: 'home',
  reading: 'story',
  bronze: 'exhibit',
  jade: 'jade',
}

export const MUSIC_RECORDINGS: Readonly<Record<MusicScene, MusicRecording | null>> = {
  home: recording('home'),
  collection: recording('home', 0.82),
  store: recording('home', 0.72),
  story: recording('reading'),
  jade: recording('jade'),
  booking: recording('reading', 0.48),
  account: recording('reading', 0.64),
  exhibit: recording('bronze'),
  quiet: null,
}

export interface RouteSoundscape {
  ambience: AmbienceScene | null
  music: MusicScene
}

const SOUNDSCAPES: Record<string, RouteSoundscape> = {
  // R3 is a complete approved mix. The legacy synthetic hall/bronze
  // drones have unrelated pitches and must not be layered underneath it.
  home: { ambience: null, music: 'home' },
  explore: { ambience: null, music: 'collection' },
  'artifact-detail': { ambience: null, music: 'story' },
  'article-detail': { ambience: null, music: 'story' },
  exhibits: { ambience: null, music: 'exhibit' },
  // Unscored content uses the approved general reading piece. A new
  // exhibit must not be assigned a material-specific score by guessing.
  'exhibit-detail': { ambience: null, music: 'story' },
  appointment: { ambience: null, music: 'booking' },
  shop: { ambience: null, music: 'store' },
  login: { ambience: null, music: 'quiet' },
  'reset-password': { ambience: null, music: 'quiet' },
  profile: { ambience: null, music: 'account' },
  admin: { ambience: null, music: 'quiet' },
  'admin-operations': { ambience: null, music: 'quiet' },
  'not-found': { ambience: null, music: 'quiet' },
}

// Only these content assignments have been auditioned and approved for R4.
const CONTENT_SOUNDSCAPES: Record<string, RouteSoundscape> = {
  'artifact-detail:water-bird-bronze': { ambience: null, music: 'story' },
  'artifact-detail:river-map-jade-bi': { ambience: null, music: 'jade' },
  'artifact-detail:painted-pottery-water-jar': { ambience: null, music: 'jade' },
  'artifact-detail:river-map-pattern-stone': { ambience: null, music: 'jade' },
  'exhibit-detail:heluo-bronze-ding-3d': { ambience: null, music: 'exhibit' },
}

export const FALLBACK_SOUNDSCAPE: RouteSoundscape = { ambience: null, music: 'quiet' }

export function soundscapeFor(routeName: unknown, slug?: unknown): RouteSoundscape {
  if (typeof routeName !== 'string') return FALLBACK_SOUNDSCAPE
  const content = typeof slug === 'string' ? CONTENT_SOUNDSCAPES[`${routeName}:${slug}`] : undefined
  return content ?? SOUNDSCAPES[routeName] ?? FALLBACK_SOUNDSCAPE
}

export const SOUNDSCAPE_ROUTE_NAMES = Object.keys(SOUNDSCAPES)
