<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch, type Component } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import ui from '../assets/guide/ui.zh-CN.json'
import { ApiRequestError, apiGet } from '../lib/api'
import { GUIDE_ARTIFACT, GUIDE_EXHIBIT, guideVisit, type GuideStop } from '../lib/luoshengPreview'
import { unifiedGuideTurns, useLuoshengVisit } from '../stores/luoshengVisit'

interface Entry {
  cardId: string
  revision: number
  text: string
  publicSource: string | null
}

const props = defineProps<{ exhibitSlug: string }>()
const route = useRoute()
const relatedPath = computed(() => route.name === 'artifact-detail' ? `/exhibits/${GUIDE_EXHIBIT}` : `/artifacts/${GUIDE_ARTIFACT}`)
const visit = unifiedGuideTurns ? useLuoshengVisit() : null
const ApprovedFigure = shallowRef<Component>()
const figureFailed = ref(false)
const cards = { ear: 'LS-DING-EARS', feet: 'LS-DING-FEET', motif: 'LS-DING-MOTIF' } as const
const labels = ui.site.pointNames
const selected = ref<GuideStop | null>(null)
const compare = ref(false)
const observation = ref<HTMLElement>()
const selectedCard = computed(() => selected.value && entries.value.find(entry => entry.cardId === cards[selected.value!]))
const points = computed(() => (Object.keys(cards) as GuideStop[]).filter(point => entries.value.some(entry => entry.cardId === cards[point])))
const headingId = useId()
const readingId = useId()
const heading = ref<HTMLElement>()
const reopen = ref<HTMLButtonElement>()
const visible = ref(false)
const mode = ref<'quiet' | 'invite' | 'open'>('quiet')
const entries = ref<Entry[]>([])
const busy = ref(false)
let request: AbortController | undefined
let figureTimeout: ReturnType<typeof setTimeout> | undefined
let readyTarget: NonNullable<NonNullable<typeof visit>['target']> | undefined

async function readEntries() {
  request?.abort()
  const current = new AbortController()
  request = current
  try {
    const response = await apiGet<{ available: boolean; entries: Entry[] }>(
      `/guide/exhibits/${encodeURIComponent(props.exhibitSlug)}?locale=zh-CN`, undefined,
      { signal: current.signal, timeoutMs: 5000 },
    )
    if (!current.signal.aborted) return response.available ? response.entries : []
  } catch (error) {
    if (!current.signal.aborted && error instanceof ApiRequestError && error.code === 'NETWORK_ERROR') return null
    if (!current.signal.aborted) return []
  }
}

onMounted(async () => {
  const available = await readEntries()
  if (!available?.length) {
    if (available && visit?.target?.path === route.path) visit.failTarget(visit.target, 'plate')
    return
  }
  visible.value = true
  if (!visit && guideVisit.claimInvitation()) mode.value = 'invite'
  if (visit?.target) void takeTarget()
})

onBeforeUnmount(() => {
  request?.abort()
  clearTimeout(figureTimeout)
  figureTimeout = undefined
})

watch(selectedCard, card => {
  if (!unifiedGuideTurns || !card || ApprovedFigure.value
    || figureFailed.value || figureTimeout !== undefined) return
  const settle = (component?: Component) => {
    if (figureTimeout === undefined) return
    clearTimeout(figureTimeout)
    figureTimeout = undefined
    if (component) ApprovedFigure.value = component
    else figureFailed.value = true
  }
  figureTimeout = setTimeout(() => settle(), 8000)
  void import('./LuoshengApprovedFigure.vue').then(module => settle(module.default), () => settle())
})

async function open(keepCurrentOnNetworkError = false) {
  mode.value = 'open'
  busy.value = true
  const result = readEntries()
  await nextTick()
  heading.value?.focus()
  const available = await result
  if (available === undefined) return
  // Only a same-plate return can keep what is already on screen. An explicit
  // empty/denied response still clears the previous entries.
  if (available !== null || !keepCurrentOnNetworkError) entries.value = available ?? []
  busy.value = false
}

async function takeTarget() {
  const target = visit?.target
  if (!visit || !target || target.path !== route.path) return
  const currentPlate = mode.value === 'open' && selected.value === target.stop
    && compare.value === target.compare && Boolean(selectedCard.value && observation.value)
  await open(currentPlate)
  if (visit.target !== target || route.path !== target.path) return
  if (!points.value.includes(target.stop)) {
    visit.failTarget(target, 'plate')
    return
  }
  selected.value = target.stop
  compare.value = target.compare
  readyTarget = target
  await nextTick()
  completeTarget()
}

function completeTarget() {
  const target = readyTarget
  const title = observation.value
  if (!visit || !target || !title || visit.target !== target || route.path !== target.path) return
  const content = title.nextElementSibling
  if (!(content instanceof HTMLElement) || content.dataset.lookpoint !== target.stop
    || content.dataset.compare !== String(target.compare) || !content.querySelector('[data-observation-text]')?.textContent?.trim()) return
  readyTarget = undefined
  title.focus({ preventScroll: true })
  title.scrollIntoView({ block: 'center', behavior: 'instant' })
  visit.arrive(target, !figureFailed.value)
}
function onFigureReady() {
  completeTarget()
  if (visit && selected.value && visit.object?.path === route.path) {
    visit.recordPlateView({ path: route.path, stop: selected.value, compare: compare.value })
  }
}
watch(() => visit?.target, () => { if (visible.value) void takeTarget() })
watch(figureFailed, completeTarget, { flush: 'post' })

async function close() {
  request?.abort()
  readyTarget = undefined
  entries.value = []
  busy.value = false
  mode.value = 'quiet'
  visit?.confirm(null)
  await nextTick()
  reopen.value?.focus()
}
</script>

<template>
  <section v-if="visible" class="preset-guide" :aria-labelledby="headingId" @keydown.esc="mode === 'open' && close()">
    <header>
      <span class="preset-mark" aria-hidden="true">{{ ui.preset.mark }}</span>
      <h2 :id="headingId" ref="heading" tabindex="-1">{{ ui.brand.name }}</h2>
      <span class="preset-label">{{ ui.preset.label }}</span>
    </header>
    <p v-if="mode === 'invite'" class="preset-invite">{{ ui.preset.invite }}</p>
    <div v-if="mode !== 'open'" class="preset-actions">
      <button ref="reopen" type="button" :aria-controls="readingId" aria-expanded="false" @click="open()">
        {{ mode === 'invite' ? ui.preset.accept : ui.preset.read }}
      </button>
      <button v-if="mode === 'invite'" type="button" class="preset-quiet" @click="close">{{ ui.entry.selfTour }}</button>
    </div>
    <div v-show="mode === 'open'" :id="readingId" class="preset-reading">
      <p v-if="busy" role="status">{{ ui.preset.loading }}</p>
      <p v-else-if="!entries.length" role="status">{{ ui.preset.unavailable }}</p>
      <ul v-else>
        <li v-for="entry in entries" :key="entry.cardId">
          <p>{{ entry.text }}</p>
          <a v-if="entry.publicSource" :href="entry.publicSource" target="_blank" rel="noopener noreferrer">{{ ui.preset.source }}</a>
        </li>
      </ul>
      <div v-if="visit && points.length" class="preset-actions" role="group" :aria-label="ui.preset.choosePoint">
        <button v-for="point in points" :key="point" type="button" :aria-pressed="selected === point"
          @click="selected = point; compare = false; visit.confirm(point)">{{ labels[point] }}</button>
      </div>
      <div v-if="visit && selected && selectedCard">
        <h3 ref="observation" tabindex="-1">{{ (figureFailed ? ui.preset.observation : ui.site.plate).replace('{point}', labels[selected]) }}</h3>
        <component :is="ApprovedFigure" v-if="ApprovedFigure" v-model:compare="compare" :stop="selected" :caption="selectedCard.text"
          @ready="onFigureReady" />
        <div v-else-if="figureFailed" :data-lookpoint="selected" :data-compare="String(compare)">
          <p role="status">{{ ui.preset.plateUnavailable }}</p>
          <p data-observation-text>{{ selectedCard.text }}</p>
        </div>
        <button type="button" @click="visit.openFrom($event.currentTarget as HTMLElement)">{{ ui.preset.followUp }}</button>
        <RouterLink :to="relatedPath" class="museum-button" @click.exact="visit.target = { path: relatedPath, stop: selected, compare }">
          {{ route.name === 'artifact-detail' ? ui.preset.view3d.replace('{point}', labels[selected]) : ui.preset.returnToArtifact }}
        </RouterLink>
      </div>
      <div class="preset-actions">
        <button type="button" class="preset-quiet" @click="close">{{ ui.preset.end }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.preset-guide {
  max-inline-size: 68rem;
  margin: 1.75rem auto;
  padding: clamp(1.1rem, 3vw, 2rem);
  border: 1px solid var(--theme-border);
  border-radius: 1.25rem;
  background: var(--theme-surface-content);
  color: var(--color-ink);
}
.preset-guide header, .preset-actions { display: flex; align-items: center; flex-wrap: wrap; gap: .75rem; }
.preset-guide header { padding-block-end: .9rem; border-block-end: 1px solid var(--theme-border); }
.preset-guide h2 { margin: 0; font: 1.5rem var(--font-display); }
.preset-mark {
  display: grid;
  place-items: center;
  inline-size: 2.25rem;
  block-size: 2.25rem;
  border: 1px solid var(--color-bronze);
  border-radius: .6rem;
  font-family: var(--font-display);
}
.preset-label { font-size: .875rem; color: var(--theme-text-muted); }
.preset-invite, .preset-reading p { margin: .9rem 0; line-height: 1.75; }
.preset-actions { margin-block-start: .9rem; }
.preset-actions button {
  min-block-size: 44px;
  padding: .5rem 1rem;
  border: 1px solid var(--theme-border-strong);
  border-radius: .7rem;
  background: var(--color-ink);
  color: var(--color-paper);
  font: inherit;
  cursor: pointer;
}
.preset-actions .preset-quiet { background: var(--theme-surface-control); color: var(--color-ink); }
.preset-reading ul { margin: 0; padding: 0; list-style: none; }
.preset-reading li { padding-block: .15rem .85rem; border-block-end: 1px solid var(--theme-border); }
.preset-reading a { text-decoration: underline; text-underline-offset: .2em; }
.preset-guide :is(button, a, h2):focus-visible { outline: 2px solid var(--color-bronze); outline-offset: 3px; }
</style>
