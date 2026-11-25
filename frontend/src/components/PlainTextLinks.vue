<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { useLocale } from '../stores/locale'

interface ArtifactRefCard {
  slug: string
  terms: string[]
  titleZh: string
  titleEn: string
  metaZh: string
  metaEn: string
  image: string
}

const ARTIFACT_REFS: readonly ArtifactRefCard[] = [
  {
    slug: 'heluo-bronze-ding',
    terms: ['河洛青铜鼎', 'Heluo Bronze Ding'],
    titleZh: '河洛青铜鼎',
    titleEn: 'Heluo Bronze Ding',
    metaZh: '商周礼器 · 三足圆鼎（3D）',
    metaEn: 'Shang–Zhou Ritual Bronze · 3D',
    image: '/media/editorial/explore-bronze-ding-user-v2.webp',
  },
  {
    slug: 'water-bird-bronze',
    terms: ['河洛水鸟纹铜器', '水鸟纹铜器', 'Water-bird Motif Bronze'],
    titleZh: '河洛水鸟纹铜器',
    titleEn: 'Water-bird Motif Bronze',
    metaZh: '青铜承盘 · 洛水生灵意象',
    metaEn: 'Bronze Stand · Riverine Bird Motif',
    image: '/media/editorial/explore-water-bird-bronze-user-v2.webp',
  },
  {
    slug: 'heluo-bronze-jue',
    terms: ['三足青铜爵', '青铜爵', 'Tripod Bronze Jue'],
    titleZh: '三足青铜爵',
    titleEn: 'Tripod Bronze Jue',
    metaZh: '商周酒礼器 · 双柱三足',
    metaEn: 'Ritual Wine Vessel · Tripod',
    image: '/media/editorial/explore-bronze-jue-user-v2.webp',
  },
  {
    slug: 'river-map-jade-bi',
    terms: ['河图玉璧', 'River Map Jade Bi'],
    titleZh: '河图玉璧',
    titleEn: 'River Map Jade Bi',
    metaZh: '青白玉器 · 浅浮谷纹',
    metaEn: 'Nephrite Bi Disc · Grain Relief',
    image: '/media/editorial/explore-jade-bi-user-v2.webp',
  },
  {
    slug: 'painted-pottery-water-jar',
    terms: ['彩陶水纹壶', 'Painted Pottery Water Jar'],
    titleZh: '彩陶水纹壶',
    titleEn: 'Painted Pottery Water Jar',
    metaZh: '新石器彩陶 · 双漩流纹',
    metaEn: 'Neolithic Pottery · Twin Vortex',
    image: '/media/editorial/explore-painted-pottery-jar-user-v2.webp',
  },
  {
    slug: 'river-map-pattern-stone',
    terms: ['河洛图纹石板', 'River Map Pattern Stone'],
    titleZh: '河洛图纹石板',
    titleEn: 'River Map Pattern Stone',
    metaZh: '减地平雕青石 · 掠射光展项',
    metaEn: 'Carved Limestone · Raking-Light Exhibit',
    image: '/media/editorial/explore-river-map-stone-user-v2.webp',
  },
]

const props = withDefaults(defineProps<{
  text: string
  enableArtifactPreview?: boolean
  excludeSlug?: string | null
}>(), {
  enableArtifactPreview: false,
  excludeSlug: null,
})

const { locale } = useLocale()
const isEnglish = computed(() => locale.value === 'en-US')

type Segment = { text: string; href?: string; artifact?: ArtifactRefCard }

function splitArtifactMentions(raw: string): Segment[] {
  if (!props.enableArtifactPreview || !raw) return [{ text: raw }]
  const activeRefs = ARTIFACT_REFS.filter((item) => item.slug !== props.excludeSlug)
  const termMap = new Map<string, ArtifactRefCard>()
  const escaped: string[] = []
  for (const refItem of activeRefs) {
    for (const term of refItem.terms) {
      termMap.set(term, refItem)
      escaped.push(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    }
  }
  if (!escaped.length) return [{ text: raw }]
  escaped.sort((a, b) => b.length - a.length)
  const regex = new RegExp(`(${escaped.join('|')})`, 'g')
  const segments: Segment[] = []
  let cursor = 0
  for (const match of raw.matchAll(regex)) {
    const start = match.index ?? 0
    const token = match[0]
    const matched = termMap.get(token)
    if (!matched) continue
    if (start > cursor) segments.push({ text: raw.slice(cursor, start) })
    segments.push({ text: token, artifact: matched })
    cursor = start + token.length
  }
  if (cursor < raw.length) segments.push({ text: raw.slice(cursor) })
  return segments
}

const parts = computed<Segment[]>(() => {
  const result: Segment[] = []
  const expression = /https?:\/\/[^\s<>"'，。；！？、【】]+/giu
  let cursor = 0
  for (const match of props.text.matchAll(expression)) {
    const start = match.index
    const candidate = match[0].replace(/[.,;!?)\]）]+$/u, '')
    if (!candidate) continue
    try {
      const url = new URL(candidate)
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) continue
      if (start > cursor) result.push(...splitArtifactMentions(props.text.slice(cursor, start)))
      result.push({ text: candidate, href: url.href })
      cursor = start + candidate.length
    } catch { /* Invalid URLs remain plain, escaped Vue text. */ }
  }
  if (cursor < props.text.length) result.push(...splitArtifactMentions(props.text.slice(cursor)))
  return result
})
</script>

<template>
  <span>
    <template v-for="(part, index) in parts" :key="index">
      <a
        v-if="part.href"
        :href="part.href"
        target="_blank"
        rel="noopener noreferrer"
        class="plain-text-source-link"
      >{{ part.text }}</a>
      <span v-else-if="part.artifact" class="inline-artifact-ref">
        <RouterLink class="inline-artifact-ref__link" :to="`/artifacts/${part.artifact.slug}`">{{ part.text }}</RouterLink>
        <span class="inline-artifact-preview" role="tooltip">
          <img :src="part.artifact.image" alt="" loading="lazy" decoding="async" />
          <span class="inline-artifact-preview__copy">
            <strong>{{ isEnglish ? part.artifact.titleEn : part.artifact.titleZh }}</strong>
            <small>{{ isEnglish ? part.artifact.metaEn : part.artifact.metaZh }}</small>
          </span>
        </span>
      </span>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<style scoped>
.plain-text-source-link {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 0.18em;
  overflow-wrap: anywhere;
}
.plain-text-source-link:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 3px;
}
</style>
