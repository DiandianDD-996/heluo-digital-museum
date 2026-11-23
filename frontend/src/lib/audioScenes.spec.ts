import { describe, expect, it } from 'vitest'
import { FALLBACK_SOUNDSCAPE, MUSIC_RECORDINGS, SOUNDSCAPE_ROUTE_NAMES, soundscapeFor } from './audioScenes'

/**
 * Every named route in `router/index.ts`. Kept as a literal list rather
 * than imported from the router because the point of the test is to notice
 * when the router gains a route and this table does not, and importing the
 * table would make them move together and hide exactly that.
 */
const ROUTE_NAMES = [
  'home',
  'explore',
  'artifact-detail',
  'article-detail',
  'exhibits',
  'exhibit-detail',
  'appointment',
  'shop',
  'login',
  'reset-password',
  'profile',
  'admin',
  'admin-operations',
  'not-found',
]

describe('route soundscapes', () => {
  it('covers every route in the router', () => {
    const missing = ROUTE_NAMES.filter(name => !SOUNDSCAPE_ROUTE_NAMES.includes(name))
    expect(missing, `routes with no soundscape: ${missing.join(', ')}`).toEqual([])
  })

  it('names only real music scenes', () => {
    // A typo here would not throw — it would silently resolve to nothing at
    // scheduling time and the page would just be quiet.
    const unknown = ROUTE_NAMES
      .map(name => soundscapeFor(name).music)
      .filter(scene => !(scene in MUSIC_RECORDINGS))
    expect(unknown).toEqual([])
  })

  it('keeps sustained legacy ambience out of the approved complete R3 mix', () => {
    expect(ROUTE_NAMES.every(name => soundscapeFor(name).ambience === null)).toBe(true)
    expect(soundscapeFor('exhibit-detail', 'heluo-bronze-ding-3d').ambience).toBeNull()
  })

  it('falls back rather than throwing on an unknown route', () => {
    // The router can legitimately hand over a symbol-named route, and a
    // page added before this table is updated must not break the audio
    // layer on its way to rendering.
    expect(soundscapeFor('a-route-that-does-not-exist')).toEqual(FALLBACK_SOUNDSCAPE)
    expect(soundscapeFor(undefined)).toEqual(FALLBACK_SOUNDSCAPE)
    expect(soundscapeFor(null)).toEqual(FALLBACK_SOUNDSCAPE)
    expect(soundscapeFor(Symbol('route'))).toEqual(FALLBACK_SOUNDSCAPE)
  })

  it('keeps the admin console and auth forms quieter than the public gallery', () => {
    // Stated as an invariant because it is a design decision, not an
    // accident: staff sit in the admin console for hours, and login/reset
    // should not distract visitors entering credentials.
    expect(soundscapeFor('admin').music).toBe('quiet')
    expect(soundscapeFor('admin-operations').music).toBe('quiet')
    expect(soundscapeFor('login').music).toBe('quiet')
    expect(soundscapeFor('reset-password').music).toBe('quiet')
    expect(soundscapeFor('admin').ambience).toBeNull()
    expect(soundscapeFor('home').music).not.toBe('quiet')
  })

  it('gives the gallery and approved bronze ding the bronze recording', () => {
    expect(MUSIC_RECORDINGS[soundscapeFor('exhibits').music]?.track).toBe('bronze')
    expect(MUSIC_RECORDINGS[soundscapeFor('exhibit-detail', 'heluo-bronze-ding-3d').music]?.track).toBe('bronze')
  })

  it('assigns only approved content explicitly and uses reading for unknown details', () => {
    expect(soundscapeFor('artifact-detail', 'water-bird-bronze').music).toBe('story')
    expect(soundscapeFor('artifact-detail', 'river-map-jade-bi').music).toBe('jade')
    expect(soundscapeFor('artifact-detail', 'painted-pottery-water-jar').music).toBe('jade')
    expect(soundscapeFor('artifact-detail', 'river-map-pattern-stone').music).toBe('jade')
    expect(soundscapeFor('exhibit-detail', 'heluo-bronze-ding-3d').music).toBe('exhibit')
    expect(soundscapeFor('exhibit-detail', 'unknown-bronze')).toEqual({ ambience: null, music: 'story' })
    expect(soundscapeFor('artifact-detail', 'unknown-material').music).toBe('story')
  })

  it('keeps the four approved scene levels through the existing music bus', () => {
    for (const scene of ['home', 'story', 'exhibit', 'jade'] as const) {
      expect(MUSIC_RECORDINGS[scene]!.gain * 0.62).toBeCloseTo(1)
    }
    expect(MUSIC_RECORDINGS.jade!.track).toBe('jade')
    expect(MUSIC_RECORDINGS.jade!.src).toBe('/media/audio/music-r4/jade-r4.m4a')
    expect(MUSIC_RECORDINGS.collection!.track).toBe('home')
    expect(MUSIC_RECORDINGS.collection!.gain).toBeLessThan(MUSIC_RECORDINGS.home!.gain)
    expect(MUSIC_RECORDINGS.booking!.track).toBe('reading')
    expect(MUSIC_RECORDINGS.booking!.gain).toBeCloseTo(0.48 / 0.62)
    expect(MUSIC_RECORDINGS.booking!.gain).toBeLessThan(MUSIC_RECORDINGS.story!.gain)
    expect(MUSIC_RECORDINGS.quiet).toBeNull()
  })
})
