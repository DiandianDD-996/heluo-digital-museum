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
  tiltY.value = (nx - 0.5) * 3.8
  tiltX.value = (0.5 - ny) * 3.2
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

      <!-- Left 57%: Full-Bleed Obsidian Darkroom Photogravure Plate -->
      <figure class="exlibris-plate" :class="{ 'is-panoramic': isPanoramicPlate }">
        <img
          :src="activePlate.imageUrl"
          :alt="locale === 'en-US' ? activePlate.titleEn : activePlate.titleZh"
          decoding="async"
        />
        <div class="exlibris-plate__frame" aria-hidden="true"></div>

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

        <figcaption class="exlibris-plate__blessing">
          “{{ locale === 'en-US' ? activePlate.blessingEn : activePlate.blessingZh }}”
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
  grid-template-columns: minmax(0, 1.38fr) 16px minmax(268px, 1fr);
  min-height: 368px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--surface-elevated);
  border: 1px solid color-mix(in oklch, var(--accent-bronze) 34%, var(--border-strong));
  box-shadow:
    0 24px 60px -22px oklch(8% 0.01 72 / 0.42),
    0 4px 16px -6px oklch(8% 0.01 72 / 0.18);
  transform: rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg));
  transform-style: preserve-3d;
  transition: transform 240ms var(--ease-curatorial), box-shadow 260ms var(--ease-curatorial);
}

.exlibris-wrap--velvet .exlibris-ticket {
  box-shadow:
    0 36px 90px -20px oklch(4% 0.008 72 / 0.78),
    0 0 0 1px oklch(82% 0.05 78 / 0.16);
}

.exlibris-ticket__foil {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  opacity: 0;
  background: radial-gradient(
    480px circle at var(--foil-x, 50%) var(--foil-y, 35%),
    oklch(86% 0.09 80 / 0.18),
    oklch(76% 0.07 76 / 0.05) 36%,
    transparent 64%
  );
  transition: opacity 280ms var(--ease-curatorial);
}

.exlibris-ticket:hover .exlibris-ticket__foil {
  opacity: 1;
}

/* ── Left 57%: Full-Bleed Darkroom Photogravure Plate ── */
.exlibris-plate {
  position: relative;
  margin: 0;
  min-height: 368px;
  background: oklch(11.5% 0.005 74);
  overflow: hidden;
}

.exlibris-plate img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 42%;
  filter: contrast(1.04) brightness(0.92);
  transition: transform 700ms var(--ease-curatorial);
}

.exlibris-plate.is-panoramic {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.2rem 1.25rem 3.8rem 6.25rem;
  background: oklch(11.5% 0.005 74);
}

.exlibris-plate.is-panoramic img {
  position: relative;
  inset: auto;
  width: 100%;
  height: auto;
  max-height: 210px;
  object-fit: contain;
  -webkit-mask-image:
    linear-gradient(180deg, transparent 0%, oklch(0% 0 0) 20%, oklch(0% 0 0) 80%, transparent 100%),
    linear-gradient(90deg, transparent 0%, oklch(0% 0 0) 6%, oklch(0% 0 0) 94%, transparent 100%);
  -webkit-mask-composite: source-in;
  mask-image:
    linear-gradient(180deg, transparent 0%, oklch(0% 0 0) 20%, oklch(0% 0 0) 80%, transparent 100%),
    linear-gradient(90deg, transparent 0%, oklch(0% 0 0) 6%, oklch(0% 0 0) 94%, transparent 100%);
  mask-composite: intersect;
}

.exlibris-ticket:hover .exlibris-plate img {
  transform: scale(1.03);
}

/* Left & bottom darkroom chiaroscuro veil for luminous typography */
.exlibris-plate::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    linear-gradient(90deg, oklch(10% 0.005 74 / 0.86) 0%, oklch(10% 0.005 74 / 0.36) 36%, transparent 68%),
    linear-gradient(180deg, transparent 54%, oklch(9% 0.005 74 / 0.88) 100%);
  pointer-events: none;
}

/* Hairline inner gold plate frame */
.exlibris-plate__frame {
  position: absolute;
  inset: 14px;
  z-index: 2;
  border: 1px solid oklch(82% 0.065 78 / 0.34);
  pointer-events: none;
}

/* Vertical Calligraphy Title Slip + Vermilion Seal */
.exlibris-plate__colophon {
  position: absolute;
  top: 28px;
  left: 28px;
  z-index: 3;
  display: flex;
  flex-direction: row-reverse;
  align-items: flex-start;
  gap: 0.55rem;
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
  letter-spacing: 0.18em;
  line-height: 1.1;
  color: oklch(96% 0.012 86);
  text-shadow: 0 2px 14px oklch(6% 0.005 74 / 0.72);
}

.exlibris-plate__colophon.is-latin .exlibris-plate__title {
  writing-mode: horizontal-tb;
  letter-spacing: 0.02em;
  font-size: 1.35rem;
}

.exlibris-plate__edition {
  writing-mode: vertical-rl;
  text-orientation: upright;
  font-family: var(--font-display);
  font-size: var(--text-xs);
  letter-spacing: 0.18em;
  color: oklch(82% 0.07 78 / 0.9);
  padding-top: 0.15rem;
}

.exlibris-plate__colophon.is-latin .exlibris-plate__edition {
  writing-mode: horizontal-tb;
  font-family: var(--font-mono);
  letter-spacing: 0.14em;
}

.exlibris-seal {
  align-self: flex-end;
  display: grid;
  grid-template-rows: 1fr 1fr;
  place-items: center;
  width: 30px;
  height: 30px;
  margin-top: 0.25rem;
  border: 1.5px solid oklch(56% 0.17 26);
  background: oklch(50% 0.16 26 / 0.18);
  color: oklch(68% 0.17 26);
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

.exlibris-plate__blessing {
  position: absolute;
  left: 28px;
  right: 28px;
  bottom: 24px;
  z-index: 3;
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-sm);
  line-height: 1.65;
  letter-spacing: 0.04em;
  color: oklch(93% 0.015 84 / 0.92);
  text-shadow: 0 1px 10px oklch(6% 0.005 74 / 0.75);
}

/* ── Center Die-Cut Tear Perforation ── */
.exlibris-perforation {
  position: relative;
  display: flex;
  justify-content: center;
  background: var(--surface-elevated);
}

.exlibris-dash {
  width: 0;
  height: calc(100% - 26px);
  margin: auto 0;
  border-left: 1px dashed color-mix(in oklch, var(--accent-bronze) 45%, var(--border-strong));
}

.exlibris-notch {
  position: absolute;
  left: 50%;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--surface-canvas);
  border: 1px solid color-mix(in oklch, var(--accent-bronze) 28%, var(--border-strong));
  transform: translateX(-50%);
}

.exlibris-wrap--velvet .exlibris-notch {
  background: oklch(10% 0.008 72);
  border-color: oklch(82% 0.05 78 / 0.16);
}

.exlibris-notch--top { top: -10px; }
.exlibris-notch--bottom { bottom: -10px; }

/* ── Right 43%: Letterpress Xuan-Paper Stub (Zero Grey Boxes) ── */
.exlibris-stub {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-4);
  padding: 1.75rem 1.75rem 1.6rem 1.35rem;
  background:
    linear-gradient(160deg, var(--surface-elevated) 0%, color-mix(in oklch, var(--surface-subtle) 65%, var(--surface-elevated)) 100%);
  color: var(--ink-primary);
}

.exlibris-stub__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-hairline);
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
  margin: 0.25rem 0 0;
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

/* Ink-Stamped Status Chop (Not a SaaS Pill) */
.exlibris-stamp {
  flex-shrink: 0;
  padding: 0.18rem 0.48rem;
  border: 1.25px solid var(--accent-seal);
  color: var(--accent-seal);
  font-family: var(--font-display);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.1em;
  line-height: 1.25;
  transform: rotate(-3deg);
}

.exlibris-stamp[data-status="confirmed"],
.exlibris-stamp[data-status="completed"] {
  border-color: var(--accent-jade);
  color: var(--accent-jade);
}

/* Monumental Architectural Date Lockup */
.exlibris-date {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding-bottom: var(--space-3);
  border-bottom: 1px solid var(--border-hairline);
}

.exlibris-date__day {
  font-family: var(--font-display);
  font-size: 3.25rem;
  font-weight: 300;
  line-height: 0.92;
  letter-spacing: -0.02em;
  color: var(--ink-primary);
}

.exlibris-date__meta {
  display: grid;
  gap: 0.22rem;
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
  padding-top: 0.2rem;
}

.exlibris-editions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.2rem 0.65rem;
}

.exlibris-edition-tab,
.exlibris-edition-cycle {
  min-height: 36px;
  padding: 0 0.2rem;
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
  border-radius: 2px;
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
  opacity: 0.9;
}

/* Velvet darkroom modal contrast for the external tray */
.exlibris-wrap--velvet .exlibris-edition-tab {
  color: oklch(78% 0.012 80);
}

.exlibris-wrap--velvet .exlibris-edition-tab:hover {
  color: oklch(96% 0.01 86);
}

.exlibris-wrap--velvet .exlibris-edition-tab.is-active,
.exlibris-wrap--velvet .exlibris-edition-cycle {
  color: oklch(84% 0.075 78);
  border-bottom-color: oklch(84% 0.075 78);
}

.exlibris-wrap--velvet .exlibris-action {
  border-color: oklch(82% 0.03 80 / 0.28);
  color: oklch(94% 0.01 86);
}

.exlibris-wrap--velvet .exlibris-action:hover:not(:disabled) {
  border-color: oklch(84% 0.075 78);
}

.exlibris-wrap--velvet .exlibris-action--primary {
  border-color: oklch(80% 0.075 78);
  background: oklch(80% 0.075 78);
  color: oklch(14% 0.01 72);
}

/* ── Compact mode (Profile drawer) ── */
.exlibris-wrap--compact .exlibris-ticket {
  min-height: 312px;
}

.exlibris-wrap--compact .exlibris-plate {
  min-height: 312px;
}

/* ── Responsive Mobile ── */
@media (max-width: 780px) {
  .exlibris-ticket {
    grid-template-columns: 1fr;
    min-height: 0;
  }

  .exlibris-plate {
    min-height: 280px;
  }

  .exlibris-plate.is-panoramic {
    padding: 4.5rem 1.25rem 4rem;
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

  .exlibris-plate__blessing {
    left: 22px;
    right: 22px;
    bottom: 20px;
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
    border-top: 1px dashed color-mix(in oklch, var(--accent-bronze) 45%, var(--border-strong));
  }

  .exlibris-notch {
    top: 50%;
    transform: translateY(-50%);
  }

  .exlibris-notch--top { left: -10px; }
  .exlibris-notch--bottom { left: auto; right: -10px; bottom: auto; }

  .exlibris-stub {
    padding: 1.4rem 1.35rem 1.45rem;
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

  .exlibris-plate img {
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
