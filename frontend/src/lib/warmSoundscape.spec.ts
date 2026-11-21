import { expect, it } from 'vitest'
import { soundscapeFor } from './audioScenes'
import { MUSIC_SCENES, createGeneratorState, planPhrase } from './musicGenerator'

it('keeps reading musical without a continuous pitched ambience or shimmer', () => {
  expect(soundscapeFor('artifact-detail')).toEqual({ ambience: null, music: 'story' })
  const profile = MUSIC_SCENES.story
  const state = createGeneratorState(27, profile)
  const events = Array.from({ length: 60 }, (_, i) => planPhrase(state, profile, 5, i * 5)).flat()
  expect(events.some(event => event.voice === 'pluck')).toBe(true)
  expect(events.some(event => event.voice === 'shimmer')).toBe(false)
})
