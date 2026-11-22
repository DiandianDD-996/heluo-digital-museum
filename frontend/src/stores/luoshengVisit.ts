import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { Router } from 'vue-router'
import { GUIDE_ARTIFACT, type GuideStop } from '../lib/luoshengPreview'

export const unifiedGuidePreview = import.meta.env.DEV && !(
  import.meta.env.VITE_GUIDE_PRESET_ENABLED === 'true'
) && ['http', 'model'].includes(import.meta.env.VITE_GUIDE_UNIFIED_PREVIEW)
export const unifiedGuideTurns = import.meta.env.VITE_GUIDE_SITE_ENABLED === 'true'
  && import.meta.env.VITE_GUIDE_TURNS_ENABLED === 'true'
export const unifiedGuideEnabled = unifiedGuidePreview || unifiedGuideTurns

type PublicObject = {
  path: string
  slug: string
  title: string
  summary: string
  exhibit?: string
}
type PlateTarget = { path: string; stop: GuideStop; compare: boolean }
type PlateAction = 'plate' | 'return'

type JourneyEvent = `${PlateAction}-${'attempted' | 'arrived'}` | 'clarification-single' | 'clarification-repeated'

export function recordGuideJourney(kind: JourneyEvent) {
  if (!unifiedGuideTurns) return
  void fetch('/api/v1/guide/journey', {
    method: 'POST', credentials: 'omit', keepalive: true, referrerPolicy: 'no-referrer',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind }),
  }).catch(() => undefined)
}

export const useLuoshengVisit = defineStore('luosheng-visit', () => {
  const object = shallowRef<PublicObject | null>(null)
  const article = shallowRef<Pick<PublicObject, 'path' | 'title' | 'summary'> | null>(null)
  const lookpoint = ref<GuideStop | null>(null)
  const revision = ref(0)
  const target = shallowRef<PlateTarget | null>(null)
  const arrival = shallowRef<PlateTarget | null>(null)
  const targetFailure = ref<'content' | 'plate' | null>(null)
  const pendingSlots = shallowRef<{ date: string; people: number } | null>(null)
  const resumePoint = shallowRef<PlateTarget | null>(null)
  const opener = shallowRef<HTMLElement | null>(null)
  const openRequest = ref(0)
  let trackedTarget: { plate: PlateTarget; action: PlateAction } | undefined
  let publicVisitId = ''

  function getPublicVisitId() {
    return publicVisitId ||= crypto.randomUUID()
  }

  function startTarget(plate: PlateTarget, action: PlateAction) {
    if (target.value) return false
    targetFailure.value = null
    trackedTarget = { plate, action }
    recordGuideJourney(`${action}-attempted`)
    target.value = plate
    return true
  }

  function confirm(stop: GuideStop | null) {
    lookpoint.value = stop
    arrival.value = null
    revision.value++
  }
  function recordPlateView(plate: PlateTarget) {
    if (object.value?.path === plate.path && lookpoint.value === plate.stop) arrival.value = plate
  }
  function openFrom(element: HTMLElement | null) {
    opener.value = element
    openRequest.value++
  }
  function enterPath(path: string, routeName: string) {
    // Collection is also the public index for the cultural features.
    if (routeName === 'appointment' || routeName === 'explore' || routeName === 'article-detail' || routeName === 'shop') {
      const plate = arrival.value
      if (plate && object.value?.slug === GUIDE_ARTIFACT && object.value.path === plate.path
        && lookpoint.value === plate.stop) resumePoint.value = plate
    } else {
      resumePoint.value = null
    }
    targetFailure.value = null
    if (object.value?.path !== path) object.value = null
    article.value = null
    if (target.value?.path !== path) target.value = null
    arrival.value = null
    opener.value = null
    confirm(null)
  }
  function arrive(plate: PlateTarget, countArrival = true) {
    if (target.value !== plate || object.value?.path !== plate.path) return
    if (!plate.compare || lookpoint.value !== plate.stop) confirm(plate.stop)
    recordPlateView(plate)
    if (countArrival && trackedTarget?.plate === plate) recordGuideJourney(`${trackedTarget.action}-arrived`)
    trackedTarget = undefined
    target.value = null
  }
  function failTarget(plate: PlateTarget, reason: 'content' | 'plate') {
    if (target.value !== plate) return
    trackedTarget = undefined
    target.value = null
    resumePoint.value = null
    confirm(null)
    targetFailure.value = reason
  }
  function end() {
    publicVisitId = ''
    trackedTarget = undefined
    target.value = null
    targetFailure.value = null
    arrival.value = null
    opener.value = null
    resumePoint.value = null
    pendingSlots.value = null
    confirm(null)
  }
  return { object, article, lookpoint, revision, target, targetFailure, arrival, resumePoint, pendingSlots, opener, openRequest, getPublicVisitId, confirm, recordPlateView, openFrom, enterPath, startTarget, arrive, failTarget, end }
})

export async function navigateGuidePlate(
  visit: ReturnType<typeof useLuoshengVisit>,
  router: Router,
  target: PlateTarget,
  action: PlateAction,
  onStart?: () => void,
) {
  if (!visit.startTarget(target, action)) return
  onStart?.()
  if (router.currentRoute.value.path === target.path) return
  try {
    if (await router.push(target.path)) visit.failTarget(target, 'content')
  } catch {
    visit.failTarget(target, 'content')
  }
}
