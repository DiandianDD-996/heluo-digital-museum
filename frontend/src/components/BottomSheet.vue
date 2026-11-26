<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AnimatePresence, motion, useDragControls } from 'motion-v'
import { Close } from '@element-plus/icons-vue'
import type { SheetSnapPoint } from '../lib/motion'
import { useLocale } from '../stores/locale'

const { locale } = useLocale()

const props = withDefaults(defineProps<{
  open: boolean
  title: string
  snapPoint?: Exclude<SheetSnapPoint, 'closed'>
  panelClass?: string
}>(), { snapPoint: 'medium' })

const emit = defineEmits<{ (event: 'close'): void; (event: 'update:snapPoint', value: Exclude<SheetSnapPoint, 'closed'>): void }>()
const dialog = ref<HTMLDialogElement | null>(null)
const closeButton = ref<HTMLButtonElement | null>(null)
const dragControls = useDragControls()

function openDialog() {
  if (!props.open || !dialog.value) return
  if (!dialog.value.open) dialog.value.showModal()
  closeButton.value?.focus({ preventScroll: true })
}
function closeAfterExit() {
  if (!props.open && dialog.value?.open) dialog.value.close()
}
function requestClose() {
  if (props.open) emit('close')
}
function containTab(event: KeyboardEvent) {
  const currentDialog = dialog.value
  if (event.key !== 'Tab' || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || !currentDialog) return
  const focusable = [...currentDialog.querySelectorAll<HTMLElement>('a[href], button, input, textarea, select, [tabindex]')]
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[inert]')
      && element.getClientRects().length > 0 && getComputedStyle(element).visibility === 'visible')
  event.preventDefault()
  if (!focusable.length) return
  // Some WebKit keyboard settings skip links on Tab; keep all sheet actions reachable.
  const activeIndex = focusable.findIndex(element => element === document.activeElement)
  const direction = event.shiftKey ? -1 : 1
  const next = activeIndex < 0 ? (event.shiftKey ? focusable.length - 1 : 0)
    : (activeIndex + direction + focusable.length) % focusable.length
  focusable[next]?.focus()
}
function finishDrag(_: PointerEvent, info: { offset: { y: number }; velocity: { y: number } }) {
  if (info.velocity.y > 650 || info.offset.y > 150) requestClose()
  else if (info.velocity.y < -500 || info.offset.y < -110) emit('update:snapPoint', 'full')
  else emit('update:snapPoint', props.snapPoint)
}
function startDrag(event: PointerEvent) { dragControls.start(event) }
function toggleSnapPoint() { emit('update:snapPoint', props.snapPoint === 'full' ? 'medium' : 'full') }

watch(() => props.open, openDialog, { flush: 'post' })
onMounted(openDialog)
onBeforeUnmount(() => {
  if (dialog.value?.open) dialog.value.close()
})
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="bottom-sheet-root" :aria-label="title" @cancel.prevent="requestClose" @keydown="containTab">
      <AnimatePresence :on-exit-complete="closeAfterExit">
        <div v-if="open" key="sheet" class="bottom-sheet-layer">
          <motion.div class="bottom-sheet-scrim" aria-hidden="true" :initial="{ opacity: 0 }" :animate="{ opacity: 1 }" :exit="{ opacity: 0 }" @click="requestClose" />
          <motion.section class="bottom-sheet" :class="panelClass" data-glass="light" data-glass-controls :data-snap-point="snapPoint" drag="y" :drag-controls="dragControls" :drag-listener="false" drag-direction-lock :drag-constraints="{ top: 0, bottom: 280 }" :drag-elastic="0.14" :initial="{ y: '100%' }" :animate="{ y: 0 }" :exit="{ y: '100%' }" :transition="{ type: 'spring', stiffness: 420, damping: 38, mass: 0.9 }" @drag-end="finishDrag">
            <button class="bottom-sheet-handle" type="button" :aria-label="locale === 'en-US' ? (snapPoint === 'full' ? 'Collapse panel' : 'Expand panel') : (snapPoint === 'full' ? '收起面板' : '展开面板')" @pointerdown="startDrag" @click="toggleSnapPoint"><i aria-hidden="true" /></button>
            <header class="bottom-sheet-header"><h2>{{ title }}</h2><button ref="closeButton" class="bottom-sheet-close" type="button" :aria-label="locale === 'en-US' ? 'Close panel' : '关闭面板'" @click="requestClose"><Close /></button></header>
            <div class="bottom-sheet-content"><slot /></div>
          </motion.section>
        </div>
      </AnimatePresence>
    </dialog>
  </Teleport>
</template>
