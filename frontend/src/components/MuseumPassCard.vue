<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  buildVerificationMatrix,
  defaultKeepsakePlateIndex,
  downloadMuseumPassIcs,
  downloadMuseumPassPng,
  KEEPSAKE_PLATES,
  type MuseumPassPayload,
} from '../lib/museumPass'
import { useLocale } from '../stores/locale'

const props = withDefaults(defineProps<{
  pass: MuseumPassPayload
  compact?: boolean
  surface?: 'page' | 'velvet'
}>(), {
  compact: false,
  surface: 'page',
})

const { locale } = useLocale()
const plateIndex = ref(defaultKeepsakePlateIndex(props.pass.appointmentNo))
const exportingPng = ref(false)
const foilX = ref(50)
const foilY = ref(35)
const tiltX = ref(0)
const tiltY = ref(0)

watch(
  () => props.pass.appointmentNo,
  (nextNo) => {
    plateIndex.value = defaultKeepsakePlateIndex(nextNo)
  },
)

const activePlate = computed(() => KEEPSAKE_PLATES[plateIndex.value % KEEPSAKE_PLATES.length] ?? KEEPSAKE_PLATES[0]!)
const isPanoramicPlate = computed(() => activePlate.value.id === 'stone')

const matrixRows = computed(() =>
  buildVerificationMatrix(`${props.pass.appointmentNo}:${props.pass.verificationCode ?? ''}`),
)

const parsedDate = computed(() => {
  const parsed = new Date(`${props.pass.visitDate}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
})

const dayNumber = computed(() => (
  parsedDate.value ? String(parsedDate.value.getUTCDate()).padStart(2, '0') : props.pass.visitDate.slice(-2)
))

const monthWeekday = computed(() => {
  if (!parsedDate.value) return props.pass.visitDate
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'long',
    weekday: 'short',
    timeZone: 'UTC',
  }).format(parsedDate.value)
})

const copy = computed(() => locale.value === 'en-US' ? {
  museum: 'HELUO DIGITAL MUSEUM',
  city: 'Luoyang · Kaiyuan Ave',
  admissionTag: 'ADMISSION · FREE ENTRY',
  sealText: ['HE', 'LUO'],
  guests: 'PARTY',
  peopleUnit: 'Guest',
  holder: 'GUEST',
  verifyCode: 'VERIFICATION CODE',
  verifyPending: 'ISSUING',
  matrixLabel: 'Geometric verification seal',
  editionLabel: 'Plate edition',
  nextPlate: 'Next plate',
  downloadPng: 'Save PNG Keepsake',
  savingPng: 'Rendering…',
  downloadIcs: 'Calendar (.ics)',
  print: 'Print',
  statusMap: {
    PENDING: 'ISSUED',
    CONFIRMED: 'CONFIRMED',
    COMPLETED: 'ADMITTED',
    CANCELLED: 'VOID',
  } as Record<string, string>,
} : {
  museum: '河 洛 数 字 博 物 馆',
  city: '洛阳 · 开元大道与学府街',
  admissionTag: 'ADMISSION · 预约免费入馆',
  sealText: ['河洛', '珍藏'],
  guests: '同行人数',
  peopleUnit: '位',
  holder: '持券贵宾',
  verifyCode: '入馆核验码',
  verifyPending: '核验码生成中',
  matrixLabel: '入馆核验几何印纹',
  editionLabel: '选择赠藏画片',
  nextPlate: '换一帧',
  downloadPng: '保存高清票根',
  savingPng: '绘制中…',
  downloadIcs: '加入日历',
  print: '打印',
  statusMap: {
    PENDING: '已签发',
    CONFIRMED: '已确认',
    COMPLETED: '已入馆',
    CANCELLED: '已作废',
  } as Record<string, string>,
})

const statusStamp = computed(() => {
  const key = (props.pass.status || 'PENDING').toUpperCase()
  return copy.value.statusMap[key] || key
})

const cardStyle = computed(() => ({
  '--foil-x': `${foilX.value.toFixed(1)}%`,
  '--foil-y': `${foilY.value.toFixed(1)}%`,
  '--tilt-x': `${tiltX.value.toFixed(2)}deg`,
  '--tilt-y': `${tiltY.value.toFixed(2)}deg`,
}))

function selectPlate(index: number) {
  plateIndex.value = index
}

function cyclePlate() {
  plateIndex.value = (plateIndex.value + 1) % KEEPSAKE_PLATES.length
}

function onPointerMove(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const nx = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
  const ny = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  foilX.value = nx * 100
  foilY.value = ny * 100
  tiltY.value = (nx - 0.5) * 3.2
  tiltX.value = (0.5 - ny) * 2.8
}

function onPointerLeave() {
  foilX.value = 50
  foilY.value = 35
  tiltX.value = 0
  tiltY.value = 0
}

async function onDownloadPng() {
  if (exportingPng.value) return
  exportingPng.value = true
  try {
    await downloadMuseumPassPng(props.pass, activePlate.value, locale.value)
  } finally {
    exportingPng.value = false
  }
}

function onDownloadIcs() {
  downloadMuseumPassIcs(props.pass, locale.value)
}

function onPrint() {
  if (typeof window !== 'undefined' && typeof window.print === 'function') {
    window.print()
  }
}
</script>

<template>
  <div
    class="exlibris-wrap"
    :class="[
      `exlibris-wrap--${surface}`,
      { 'exlibris-wrap--compact': compact, 'is-cancelled': pass.status === 'CANCELLED' },
    ]"
    data-testid="museum-pass-card"
  >
    <!-- Pure Physical Print Artifact (Zero UI Chrome Inside) -->
    <div
      class="exlibris-ticket"
      :style="cardStyle"
      @pointermove="onPointerMove"
      @pointerleave="onPointerLeave"
    >
      <div class="exlibris-ticket__foil" aria-hidden="true"></div>

      <!-- Left 57%: Cold-Obsidian Photogravure Darkroom Plate -->
      <figure class="exlibris-plate" :class="{ 'is-panoramic': isPanoramicPlate }">
        <div class="exlibris-plate__stage">
          <img
            :key="activePlate.id"
            :src="activePlate.imageUrl"
            :alt="locale === 'en-US' ? activePlate.titleEn : activePlate.titleZh"
            decoding="async"
          />
        </div>
        <div class="exlibris-plate__frame" aria-hidden="true">
          <span class="exlibris-corner exlibris-corner--tl"></span>
          <span class="exlibris-corner exlibris-corner--tr"></span>
          <span class="exlibris-corner exlibris-corner--bl"></span>
          <span class="exlibris-corner exlibris-corner--br"></span>
        </div>

        <!-- Classical Vertical Calligraphy Title Slip + Carved Vermilion Seal -->
        <div class="exlibris-plate__colophon" :class="{ 'is-latin': locale === 'en-US' }">
          <strong class="exlibris-plate__title">
            {{ locale === 'en-US' ? activePlate.titleEn : activePlate.titleZh }}
          </strong>
          <span class="exlibris-plate__edition">
            {{ locale === 'en-US' ? activePlate.editionEn : activePlate.editionZh }}
          </span>
          <span class="exlibris-seal" aria-hidden="true">
            <i>{{ copy.sealText[0] }}</i>
            <i>{{ copy.sealText[1] }}</i>
          </span>
        </div>

        <figcaption class="exlibris-plate__caption">
          <span class="exlibris-plate__era font-mono">
            {{ locale === 'en-US' ? activePlate.eraEn : activePlate.eraZh }}
          </span>
          <p class="exlibris-plate__blessing">
            “{{ locale === 'en-US' ? activePlate.blessingEn : activePlate.blessingZh }}”
          </p>
        </figcaption>
      </figure>

      <!-- Center Die-Cut Tear Perforation -->
      <div class="exlibris-perforation" aria-hidden="true">
        <span class="exlibris-notch exlibris-notch--top"></span>
        <span class="exlibris-dash"></span>
        <span class="exlibris-notch exlibris-notch--bottom"></span>
      </div>

      <!-- Right 43%: Letterpress Xuan-Paper Admission Stub -->
      <section class="exlibris-stub">
        <header class="exlibris-stub__head">
          <div>
            <span class="exlibris-stub__kicker font-mono">{{ copy.admissionTag }}</span>
            <h3>{{ copy.museum }}</h3>
            <p>{{ copy.city }}</p>
          </div>
          <span class="exlibris-stamp" :data-status="(pass.status || 'PENDING').toLowerCase()">
            {{ statusStamp }}
          </span>
        </header>

        <div class="exlibris-date">
          <strong class="exlibris-date__day">{{ dayNumber }}</strong>
          <div class="exlibris-date__meta">
            <span>{{ monthWeekday }}</span>
            <em class="font-mono">{{ pass.startTime.slice(0, 5) }} — {{ pass.endTime.slice(0, 5) }}</em>
          </div>
        </div>

        <dl class="exlibris-ledger">
          <div v-if="pass.contactName">
            <dt>{{ copy.holder }}</dt>
            <dd>{{ pass.contactName }}</dd>
          </div>
          <div>
            <dt>{{ copy.guests }}</dt>
            <dd class="font-mono">{{ pass.visitorCount }} {{ copy.peopleUnit }}</dd>
          </div>
        </dl>

        <footer class="exlibris-verify">
          <div class="exlibris-matrix" :aria-label="copy.matrixLabel" role="img">
            <svg viewBox="0 0 90 90">
              <rect x="1" y="1" width="88" height="88" fill="none" stroke="currentColor" stroke-opacity="0.28" stroke-width="1.4" />
              <template v-for="(row, rIdx) in matrixRows" :key="rIdx">
                <template v-for="(cell, cIdx) in row" :key="`${rIdx}-${cIdx}`">
                  <rect
                    v-if="cell"
                    :x="7 + cIdx * 8.6"
                    :y="7 + rIdx * 8.6"
                    width="6.8"
                    height="6.8"
                    fill="currentColor"
                  />
                </template>
              </template>
            </svg>
          </div>

          <div class="exlibris-verify__codes">
            <small>{{ copy.verifyCode }}</small>
            <strong class="exlibris-verify__hex font-mono" data-testid="pass-verification-code">
              {{ pass.verificationCode || copy.verifyPending }}
            </strong>
            <span class="exlibris-verify__serial font-mono">NO. {{ pass.appointmentNo }}</span>
          </div>
        </footer>
      </section>
    </div>

    <!-- External Quiet Curator's Tray (Strictly Outside the Physical Print) -->
    <div v-if="pass.status !== 'CANCELLED'" class="exlibris-tray">
      <div class="exlibris-editions" role="group" :aria-label="copy.editionLabel">
        <button
          v-for="(plate, idx) in KEEPSAKE_PLATES"
          :key="plate.id"
          type="button"
          class="exlibris-edition-tab"
          :class="{ 'is-active': idx === plateIndex }"
          :aria-pressed="idx === plateIndex"
          @click="selectPlate(idx)"
        >
          {{ locale === 'en-US' ? plate.shortEn : plate.shortZh }}
        </button>
        <button
          type="button"
          class="exlibris-edition-cycle"
          data-testid="pass-switch-plate"
          @click="cyclePlate"
        >
          {{ copy.nextPlate }} ↻
        </button>
      </div>

      <div class="exlibris-actions">
        <button
          type="button"
          class="exlibris-action exlibris-action--primary"
          data-testid="pass-download-png"
          :disabled="exportingPng"
          @click="onDownloadPng"
        >
          {{ exportingPng ? copy.savingPng : copy.downloadPng }}
        </button>
        <button
          type="button"
          class="exlibris-action"
          data-testid="pass-download-ics"
          @click="onDownloadIcs"
        >
          {{ copy.downloadIcs }}
        </button>
        <button
          type="button"
          class="exlibris-action"
          data-testid="pass-print"
          @click="onPrint"
        >
          {{ copy.print }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exlibris-wrap {
  display: grid;
  gap: var(--space-4);
  perspective: 1400px;
}

.exlibris-wrap.is-cancelled .exlibris-ticket {
  opacity: 0.65;
  filter: grayscale(0.45);
}

/* ── Pure Physical Letterpress + Photogravure Ticket ── */
.exlibris-ticket {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.38fr) 16px minmax(276px, 1fr);
  min-height: 384px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--surface-elevated);
  border: 1px solid color-mix(in oklch, var(--accent-bronze) 36%, var(--border-strong));
  box-shadow:
    0 26px 64px -22px oklch(8% 0.008 238 / 0.44),
    0 4px 18px -6px oklch(8% 0.008 238 / 0.20);
  transform: rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
  transform-style: preserve-3d;
  transition: transform 240ms var(--ease-curatorial), box-shadow 260ms var(--ease-curatorial);
}

.exlibris-wrap--velvet .exlibris-ticket {
  box-shadow:
    0 40px 96px -20px oklch(4% 0.006 238 / 0.84),
    0 0 0 1px oklch(82% 0.05 78 / 0.22);
}

.exlibris-ticket__foil {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    480px circle at var(--foil-x, 50%) var(--foil-y, 35%),
    oklch(86% 0.085 78 / 0.16),
    oklch(76% 0.06 76 / 0.04) 38%,
    transparent 66%
  );
  transition: opacity 280ms var(--ease-curatorial);
}

.exlibris-ticket:hover .exlibris-ticket__foil {
  opacity: 1;
}

/* ── Left 57%: Cold-Obsidian Photogravure Darkroom Plate ── */
.exlibris-plate {
  position: relative;
  margin: 0;
  min-height: 384px;
  display: grid;
  background-color: oklch(11.4% 0.006 238);
  background-image:
    radial-gradient(ellipse 68% 64% at 62% 38%, oklch(74% 0.048 78 / 0.16) 0%, oklch(36% 0.014 234 / 0.12) 48%, transparent 76%),
    radial-gradient(circle 160px at 62% 48%, oklch(84% 0.04 78 / 0.05) 0%, transparent 72%);
  overflow: hidden;
}

/* Subtle elliptical museum plinth contact shadow */
.exlibris-plate::before {
  content: '';
  position: absolute;
  left: 61%;
  bottom: 20%;
  width: 44%;
  height: 11%;
  transform: translateX(-50%);
  border-radius: 50%;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse at center,
    oklch(4% 0.006 238 / 0.82) 0%,
    oklch(4% 0.006 238 / 0.34) 52%,
    transparent 78%
  );
}

.exlibris-plate__stage {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 2.35rem 2.25rem 5.1rem 8.5rem;
}

.exlibris-plate.is-panoramic .exlibris-plate__stage {
  padding: 2.5rem 2rem 5.1rem 7.75rem;
}

.exlibris-plate__stage img {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 256px;
  object-fit: contain;
  object-position: center;
  filter: drop-shadow(0 20px 28px oklch(4% 0.006 238 / 0.76)) contrast(1.03);
  transition: transform 680ms var(--ease-curatorial);
}

.exlibris-plate.is-panoramic .exlibris-plate__stage img {
  max-height: 184px;
}

.exlibris-ticket:hover .exlibris-plate__stage img {
  transform: scale(1.035);
}

/* Gentle left & bottom chiaroscuro vignette (Cold Obsidian hue 238) */
.exlibris-plate::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(90deg, oklch(10% 0.006 238 / 0.72) 0%, oklch(10% 0.006 238 / 0.24) 28%, transparent 52%),
    linear-gradient(180deg, transparent 58%, oklch(9% 0.006 238 / 0.90) 100%);
  pointer-events: none;
}

/* Hairline inner gold plate frame with gilded corner ticks */
.exlibris-plate__frame {
  position: absolute;
  inset: 14px;
  z-index: 2;
  border: 1px solid oklch(82% 0.062 78 / 0.30);
  pointer-events: none;
}

.exlibris-corner {
  position: absolute;
  width: 8px;
  height: 8px;
  border-color: oklch(84% 0.072 78 / 0.72);
  border-style: solid;
}

.exlibris-corner--tl { top: -1px; left: -1px; border-width: 1.5px 0 0 1.5px; }
.exlibris-corner--tr { top: -1px; right: -1px; border-width: 1.5px 1.5px 0 0; }
.exlibris-corner--bl { bottom: -1px; left: -1px; border-width: 0 0 1.5px 1.5px; }
.exlibris-corner--br { bottom: -1px; right: -1px; border-width: 0 1.5px 1.5px 0; }

/* Vertical Calligraphy Title Slip + Vermilion Seal */
.exlibris-plate__colophon {
  position: absolute;
  top: 28px;
  left: 28px;
  z-index: 3;
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  gap: 0.65rem;
}

.exlibris-plate__colophon.is-latin {
  flex-direction: column;
  gap: 0.35rem;
}

.exlibris-plate__title {
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-family: var(--font-display);
  font-size: 1.32rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  line-height: 1.1;
  color: oklch(96% 0.008 86);
  text-shadow: 0 2px 14px oklch(6% 0.006 238 / 0.76);
}

.exlibris-plate__colophon.is-latin .exlibris-plate__title {
  writing-mode: horizontal-tb;
  letter-spacing: 0.02em;
  font-size: 1.3rem;
}

.exlibris-plate__edition {
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-family: var(--font-display);
  font-size: var(--text-xs);
  letter-spacing: 0.2em;
  color: oklch(82% 0.068 78 / 0.92);
  padding-top: 0.15rem;
}

.exlibris-plate__colophon.is-latin .exlibris-plate__edition {
  writing-mode: horizontal-tb;
  font-family: var(--font-mono);
  letter-spacing: 0.14em;
}

.exlibris-plate__colophon.is-latin .exlibris-seal {
  align-self: flex-start;
  margin-top: 0.45rem;
}

.exlibris-seal {
  align-self: flex-end;
  display: grid;
  grid-template-rows: 1fr 1fr;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-top: 0.35rem;
  border: 1.5px solid oklch(58% 0.165 26);
  border-radius: 2px;
  background: oklch(50% 0.155 26 / 0.20);
  color: oklch(70% 0.165 26);
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
  transform: rotate(-3deg);
}

.exlibris-seal i {
  font-style: normal;
}

.exlibris-plate__caption {
  position: absolute;
  left: 28px;
  right: 28px;
  bottom: 22px;
  z-index: 3;
  display: grid;
  gap: 0.25rem;
  margin: 0;
}

.exlibris-plate__era {
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: oklch(80% 0.056 78 / 0.88);
}

.exlibris-plate__blessing {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  line-height: 1.58;
  letter-spacing: 0.03em;
  color: oklch(94% 0.008 86 / 0.94);
  text-shadow: 0 1px 10px oklch(6% 0.006 238 / 0.78);
}

/* ── Center Die-Cut Tear Perforation ── */
.exlibris-perforation {
  position: relative;
  display: flex;
  justify-content: center;
  background: color-mix(in oklch, var(--surface-elevated) 92%, var(--surface-subtle));
}

.exlibris-dash {
  width: 0;
  height: calc(100% - 26px);
  margin: auto 0;
  border-left: 1px dashed color-mix(in oklch, var(--accent-bronze) 48%, var(--border-strong));
}

.exlibris-notch {
  position: absolute;
  left: 50%;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--surface-canvas);
  border: 1px solid color-mix(in oklch, var(--accent-bronze) 30%, var(--border-strong));
  transform: translateX(-50%);
}

.exlibris-wrap--velvet .exlibris-notch {
  background: oklch(9.5% 0.006 238);
  border-color: oklch(82% 0.05 78 / 0.22);
}

.exlibris-notch--top { top: -10px; }
.exlibris-notch--bottom { bottom: -10px; }

/* ── Right 43%: Letterpress Xuan-Paper Stub with Debossed Inner Border ── */
.exlibris-stub {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 1.75rem 1.85rem 1.65rem 1.4rem;
  background:
    radial-gradient(ellipse 90% 60% at 100% 0%, color-mix(in oklch, var(--accent-bronze) 6%, transparent) 0%, transparent 65%),
    linear-gradient(165deg, var(--surface-elevated) 0%, color-mix(in oklch, var(--surface-subtle) 82%, var(--surface-elevated)) 100%);
  color: var(--ink-primary);
}

/* Delicate physical letterpress debossed inner frame */
.exlibris-stub::before {
  content: '';
  position: absolute;
  inset: 10px 10px 10px 2px;
  border: 1px solid color-mix(in oklch, var(--accent-bronze) 22%, var(--border-hairline));
  border-left: 0;
  pointer-events: none;
}

.exlibris-stub__head {
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-hairline);
}

.exlibris-stub__kicker {
  display: block;
  margin-bottom: 0.25rem;
  font-size: var(--text-xs);
  letter-spacing: 0.1em;
  color: var(--accent-bronze);
}

.exlibris-stub__head h3 {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--ink-primary);
}

.exlibris-stub__head p {
  margin: 0.22rem 0 0;
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

/* Ink-Stamped Status Chop (Not a SaaS Pill) */
.exlibris-stamp {
  flex-shrink: 0;
  padding: 0.22rem 0.55rem;
  border: 1.4px solid var(--accent-seal);
  border-radius: 2px;
  background: color-mix(in oklch, var(--accent-seal) 7%, transparent);
  color: var(--accent-seal);
  font-family: var(--font-display);
  font-size: var(--text-xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  line-height: 1.25;
  transform: rotate(-3deg);
}

.exlibris-stamp[data-status="confirmed"],
.exlibris-stamp[data-status="completed"] {
  border-color: var(--accent-jade);
  background: color-mix(in oklch, var(--accent-jade) 8%, transparent);
  color: var(--accent-jade);
}

/* Monumental Architectural Date Lockup */
.exlibris-date {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-hairline);
}

.exlibris-date__day {
  font-family: var(--font-display);
  font-size: 3.35rem;
  font-weight: 300;
  line-height: 0.92;
  letter-spacing: -0.02em;
  color: var(--ink-primary);
}

.exlibris-date__meta {
  display: grid;
  gap: 0.24rem;
}

.exlibris-date__meta span {
  font-size: var(--text-xs);
  color: var(--ink-secondary);
  letter-spacing: 0.04em;
}

.exlibris-date__meta em {
  font-style: normal;
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-primary);
}

/* Clean Hairline Ledger */
.exlibris-ledger {
  position: relative;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-hairline);
}

.exlibris-ledger dt {
  font-size: var(--text-xs);
  color: var(--ink-muted);
  margin-bottom: 0.2rem;
}

.exlibris-ledger dd {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--ink-primary);
}

/* Unboxed Verification Seal & Hex Code */
.exlibris-verify {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.exlibris-matrix {
  flex-shrink: 0;
  width: 58px;
  height: 58px;
  color: var(--ink-primary);
}

.exlibris-matrix svg {
  width: 100%;
  height: 100%;
  display: block;
}

.exlibris-verify__codes {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.exlibris-verify__codes small {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.exlibris-verify__hex {
  font-size: var(--text-md);
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--accent-seal);
}

.exlibris-verify__serial {
  font-size: var(--text-xs);
  color: var(--ink-muted);
  word-break: break-all;
}

/* ── External Curator's Tray (Outside the Ticket) ── */
.exlibris-tray {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-top: 0.25rem;
}

.exlibris-editions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.65rem;
}

.exlibris-edition-tab,
.exlibris-edition-cycle {
  min-height: 38px;
  padding: 0 0.25rem;
  border: 0;
  border-bottom: 1.5px solid transparent;
  background: transparent;
  color: var(--ink-muted);
  font-family: var(--font-display);
  font-size: var(--text-xs);
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: color 180ms var(--ease-curatorial), border-color 180ms var(--ease-curatorial);
}

.exlibris-edition-tab:hover,
.exlibris-edition-cycle:hover {
  color: var(--ink-primary);
}

.exlibris-edition-tab.is-active {
  color: var(--accent-bronze);
  border-bottom-color: var(--accent-bronze);
  font-weight: 600;
}

.exlibris-edition-cycle {
  margin-left: 0.25rem;
  color: var(--accent-bronze);
}

.exlibris-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}

.exlibris-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 1.05rem;
  border: 1px solid var(--border-strong);
  border-radius: 3px;
  background: transparent;
  color: var(--ink-primary);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  cursor: pointer;
  transition: border-color 180ms var(--ease-curatorial), background-color 180ms var(--ease-curatorial), opacity 180ms var(--ease-curatorial);
}

.exlibris-action:hover:not(:disabled) {
  border-color: var(--accent-bronze);
}

.exlibris-action--primary {
  border-color: var(--accent-bronze);
  background: var(--accent-bronze);
  color: var(--accent-jade-ink);
}

.exlibris-action--primary:hover:not(:disabled) {
  opacity: 0.92;
}

/* Velvet darkroom modal contrast for the external tray */
.exlibris-wrap--velvet .exlibris-edition-tab {
  color: oklch(84% 0.008 228);
}

.exlibris-wrap--velvet .exlibris-edition-tab:hover {
  color: oklch(97% 0.006 86);
}

.exlibris-wrap--velvet .exlibris-edition-tab.is-active,
.exlibris-wrap--velvet .exlibris-edition-cycle {
  color: oklch(85% 0.072 78);
  border-bottom-color: oklch(85% 0.072 78);
}

.exlibris-wrap--velvet .exlibris-action {
  border-color: oklch(90% 0.01 232 / 0.28);
  color: oklch(95% 0.006 86);
}

.exlibris-wrap--velvet .exlibris-action:hover:not(:disabled) {
  border-color: oklch(85% 0.072 78);
  background: oklch(90% 0.01 232 / 0.06);
}

.exlibris-wrap--velvet .exlibris-action--primary {
  border-color: oklch(82% 0.056 78);
  background: oklch(82% 0.056 78);
  color: oklch(13% 0.006 238);
}

/* ── Compact mode (Profile drawer) ── */
.exlibris-wrap--compact .exlibris-ticket {
  min-height: 326px;
}

.exlibris-wrap--compact .exlibris-plate {
  min-height: 326px;
}

.exlibris-wrap--compact .exlibris-plate__stage {
  padding: 2rem 1.75rem 4.6rem 7.5rem;
}

.exlibris-wrap--compact .exlibris-plate__stage img {
  max-height: 210px;
}

/* ── Responsive Mobile ── */
@media (max-width: 780px) {
  .exlibris-ticket {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .exlibris-plate {
    min-height: 304px;
  }

  .exlibris-plate::before {
    left: 50%;
    bottom: 24%;
    width: 56%;
  }

  .exlibris-plate__stage,
  .exlibris-plate.is-panoramic .exlibris-plate__stage {
    padding: 4.5rem 1.75rem 5.2rem;
  }

  .exlibris-plate__stage img {
    max-height: 184px;
  }

  .exlibris-plate.is-panoramic .exlibris-plate__stage img {
    max-height: 140px;
  }

  .exlibris-plate__colophon {
    top: 22px;
    left: 22px;
    right: 22px;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .exlibris-plate__title {
    writing-mode: horizontal-tb;
    font-size: 1.15rem;
    letter-spacing: 0.08em;
  }

  .exlibris-plate__edition {
    display: none;
  }

  .exlibris-seal {
    align-self: center;
    margin-top: 0;
  }

  .exlibris-plate__caption {
    left: 22px;
    right: 22px;
    bottom: 20px;
  }

  .exlibris-plate__blessing {
    font-size: var(--text-xs);
  }

  .exlibris-perforation {
    height: 16px;
    align-items: center;
  }

  .exlibris-dash {
    width: calc(100% - 26px);
    height: 0;
    border-left: 0;
    border-top: 1px dashed color-mix(in oklch, var(--accent-bronze) 48%, var(--border-strong));
  }

  .exlibris-notch {
    top: 50%;
    transform: translateY(-50%);
  }

  .exlibris-notch--top { left: -10px; }
  .exlibris-notch--bottom { left: auto; right: -10px; bottom: auto; }

  .exlibris-stub {
    padding: 1.45rem 1.4rem 1.5rem;
  }

  .exlibris-stub::before {
    inset: 8px;
    border-left: 1px solid color-mix(in oklch, var(--accent-bronze) 22%, var(--border-hairline));
  }

  .exlibris-actions {
    width: 100%;
  }

  .exlibris-action {
    flex: 1 1 auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .exlibris-ticket {
    transform: none !important;
    transition: none;
  }

  .exlibris-ticket__foil {
    display: none;
  }

  .exlibris-plate__stage img {
    transition: none;
  }
}

@media print {
  .exlibris-ticket {
    transform: none !important;
    box-shadow: none !important;
    border: 1.5px solid var(--ink-primary);
    break-inside: avoid;
  }

  .exlibris-ticket__foil,
  .exlibris-tray {
    display: none !important;
  }
}
</style>
