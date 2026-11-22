<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ui from '../assets/guide/ui.zh-CN.json'
import top from '../assets/luosheng-ding-top.webp?inline'
import side from '../assets/luosheng-ding-side.webp?inline'
import back from '../assets/luosheng-ding-back.webp?inline'
import relief from '../assets/luosheng-ding-relief.webp?inline'
import type { GuideStop } from '../lib/luoshengPreview'

const props = defineProps<{ stop: GuideStop; caption: string }>()
const emit = defineEmits<{ ready: [] }>()
const alternate = defineModel<boolean>('compare', { required: true })
const failed = ref(false)
const image = computed(() => props.stop === 'ear' ? top : props.stop === 'motif' ? relief : alternate.value ? back : side)
const view = computed(() => props.stop === 'ear' ? ui.figure.earTop : props.stop === 'motif' ? ui.figure.motifDetail
  : alternate.value ? ui.figure.feetBack : ui.figure.feetSide)
const caption = computed(() => ui.figure.caption.replace('{view}', view.value).replace('{text}', () => props.caption))
watch(image, () => { failed.value = false })
function reportReady() {
  emit('ready')
}
onMounted(reportReady)
watch([() => props.stop, alternate], reportReady, { flush: 'post' })
</script>

<template>
  <figure class="approved-figure" :data-lookpoint="stop" :data-compare="String(alternate)">
    <img v-if="!failed" :src="image" :alt="ui.figure.imageAlt.replace('{view}', view)" decoding="async" loading="lazy" @error="failed = true" />
    <p v-else>{{ ui.figure.unavailable }}</p>
    <figcaption data-observation-text>{{ caption }}</figcaption>
    <button v-if="stop === 'feet'" type="button" @click="alternate = !alternate">{{ alternate ? ui.figure.showSide : ui.plateViewLabels.feet }}</button>
  </figure>
</template>

<style scoped>
.approved-figure { margin: 0; }
.approved-figure img { display: block; max-inline-size: min(100%, 30rem); block-size: auto; }
.approved-figure figcaption { line-height: 1.65; }
.approved-figure button { min-block-size: 44px; min-inline-size: 44px; }
</style>
