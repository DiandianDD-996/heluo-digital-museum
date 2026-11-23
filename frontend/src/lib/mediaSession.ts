import type { MusicTrack } from './audioScenes'
import { MUSIC_CATALOG } from './musicCatalog'

export interface MediaSessionSyncOptions {
  track: MusicTrack | null
  isPlaying: boolean
  isPaused: boolean
  locale: string
  onPlay: () => void
  onPause: () => void
  onStop: () => void
}

let handlersBound = false
let latestCallbacks = {
  onPlay: () => {},
  onPause: () => {},
  onStop: () => {},
}

function bindMediaSessionHandlers(session: MediaSession): void {
  if (handlersBound || typeof session.setActionHandler !== 'function') return
  handlersBound = true
  const register = (action: MediaSessionAction, handler: () => void) => {
    try {
      session.setActionHandler(action, handler)
    } catch {
      // Unsupported MediaSessionAction on this browser.
    }
  }
  register('play', () => latestCallbacks.onPlay())
  register('pause', () => latestCallbacks.onPause())
  register('stop', () => latestCallbacks.onStop())
}

export function syncMediaSession(options: MediaSessionSyncOptions): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !navigator.mediaSession) return
  const session = navigator.mediaSession
  latestCallbacks = {
    onPlay: options.onPlay,
    onPause: options.onPause,
    onStop: options.onStop,
  }
  bindMediaSessionHandlers(session)

  if (!options.track || (!options.isPlaying && !options.isPaused)) {
    session.playbackState = 'none'
    session.metadata = null
    return
  }

  const meta = MUSIC_CATALOG[options.track]
  const isEn = options.locale === 'en-US'
  if (typeof MediaMetadata === 'function') {
    session.metadata = new MediaMetadata({
      title: isEn ? meta.titleEn : `《${meta.titleZh}》`,
      artist: isEn ? 'Heluo Digital Museum' : '河洛数字博物馆',
      album: isEn ? 'Museum Soundscape R4' : '展馆原声 R4',
      artwork: [
        { src: meta.artwork, sizes: '640x640', type: 'image/webp' },
      ],
    })
  }
  session.playbackState = options.isPlaying ? 'playing' : 'paused'
}

export function resetMediaSessionBindingForTests(): void {
  handlersBound = false
}
