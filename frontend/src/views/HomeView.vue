<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Calendar, DataBoard } from '@element-plus/icons-vue'
import { useLocale } from '../stores/locale'
import { useTheme } from '../stores/theme'
import { audioSystem } from '../lib/audioSystem'
import { claimHomeEntrance } from '../lib/homeEntrance'
import PointerDotField from '../components/PointerDotField.vue'
import HeluoPattern from '../components/HeluoPattern.vue'
import AcousticRuler from '../components/AcousticRuler.vue'

const { locale } = useLocale()
const { isDark } = useTheme()
const root = ref<HTMLElement | null>(null)
const heluoPattern = ref<InstanceType<typeof HeluoPattern> | null>(null)
const showPattern = ref(false)
const activeObservation = ref(0)
let gsapContext: { revert: () => void } | undefined
let unmounted = false

const copy = computed(() => locale.value === 'zh-CN'
  ? {
      coverTag: 'NO.01 · LUOYANG',
      eyebrow: '从一件器物，走进河洛文明',
      title: '河洛数字\n博物馆',
      intro: '不用急着背诵年代。先在线近看一件青铜、一块温玉，读几段河洛旧事，兴致来了再约一天到馆里坐坐。',
      explore: '探索馆藏',
      gallery: '进入 3D 数字展厅',
      visit: '预约参观',
      visitCta: '预约线下参观',
      openStatus: '今日开放 09:00–17:00',
      scrollHint: '向下浏览策展',
      curation: '策展手记',
      note: '沿着河流阅读文明',
      location: '洛阳 · 河洛文明主题展厅',
      closeLabel: '走近器物',
      closeTitle: '一鼎之间，\n细看青铜。',
      closeText: '站在一件青铜鼎前，视线通常会先落在器腹繁复的兽面纹上，再慢慢移向双耳与三足。我们参照克利夫兰艺术博物馆公开馆藏重制了这件数字青铜鼎——不妨先点开下面三处细节，再去 3D 展柜里亲手转一转。',
      closeNote: '克利夫兰艺术博物馆公开馆藏参考',
      closePlaqueType: '商周青铜礼器 · 三足方鼎',
      closePlaqueMaterial: '数字馆藏重制',
      closeAction: '阅读青铜鼎故事',
      close3dAction: '进入 3D 近观',
      observations: [
        { label: '双耳', detail: '口沿上一对微微外撇的立耳，当年用来穿木杠抬举，远远看着也把整件鼎的气势撑了起来。' },
        { label: '器腹饕餮纹', detail: '器腹正中一道扉棱把兽面纹对称分开，侧光打上去，深浅浮雕就像会呼吸一样立体。' },
        { label: '三足支撑', detail: '三根圆实柱足稳稳托住器身，进 3D 展柜转到下方仰看，还能留意到合范铸造留下的线条。' },
      ],
      themesIntro: '从礼器、温玉到河水边的生活，慢慢翻看河洛的另一面。',
      visitEyebrow: '线下参观',
      visitTitle: '来展厅里，亲眼看看这些器物。',
      visitText: '挑一个不赶时间的上午或午后，把线上的好奇带到展厅里。周二至周日 09:00–17:00 开放预约。',
    }
  : {
      coverTag: 'NO.01 · LUOYANG',
      eyebrow: 'One object, a living story',
      title: 'Heluo Digital\nMuseum',
      intro: 'Explore collections and digital exhibits before planning your visit.',
      explore: 'Explore collection',
      gallery: 'Enter 3D Gallery',
      visit: 'Book a visit',
      visitCta: 'Book an offline visit',
      openStatus: 'Open Today 09:00–17:00',
      scrollHint: 'Scroll to explore',
      curation: 'Today\'s curation',
      note: 'Ritual vessels · source of civilization',
      location: 'Luoyang · Heluo Civilization Gallery',
      closeLabel: 'A closer look',
      closeTitle: 'A vessel.\nA new perspective.',
      closeText: 'How do the handles, body and three legs shape a ding? Start from the front, then change your viewpoint to examine its supports and patterns. This digital reworking uses an open model from the Cleveland Museum of Art. Read three observation prompts before entering the interactive exhibit, with the original object and this digital presentation clearly distinguished.',
      closeNote: 'Bronze ding imagery · Editorial illustration',
      closePlaqueType: 'Ritual Tripod · Ding',
      closePlaqueMaterial: 'Aged-bronze PBR reconstruction',
      closeAction: 'Read the ding story',
      close3dAction: 'Inspect in 3D',
      observations: [
        { label: 'Upright Handles', detail: 'Twin handles lift the silhouette and balance the vessel for ritual carrying.' },
        { label: 'Taotie Relief', detail: 'Symmetric zoomorphic bands wrap the belly, catching gallery sidelight.' },
        { label: 'Tripod Legs', detail: 'Three cylindrical legs anchor the mass and reveal subtle casting seams.' },
      ],
      themesIntro: 'Discover Heluo through ritual vessels, jade and the river.',
      visitEyebrow: 'PLAN YOUR VISIT',
      visitTitle: 'Take your curiosity further.',
      visitText: 'Find dates, visiting times and practical information for your visit. Open Tue–Sun 09:00–17:00.',
    })

const titleLines = computed(() => copy.value.title.split('\n'))

const heroMedia = computed(() => isDark.value
  ? {
      src: '/media/editorial/home-corridor-dark-user-v2.webp',
      srcset: '/media/editorial/home-corridor-dark-user-v2-640w.webp 640w, /media/editorial/home-corridor-dark-user-v2-1280w.webp 1280w, /media/editorial/home-corridor-dark-user-v2.webp 1672w',
      mobileSrcset: '/media/editorial/home-corridor-dark-user-v2-portrait.webp 483w',
    }
  : {
      src: '/media/editorial/home-corridor-light-user-v2.webp',
      srcset: '/media/editorial/home-corridor-light-user-v2-640w.webp 640w, /media/editorial/home-corridor-light-user-v2-1280w.webp 1280w, /media/editorial/home-corridor-light-user-v2.webp 1672w',
      mobileSrcset: '/media/editorial/home-corridor-light-user-v2-portrait.webp 483w',
    })

const featureCards = computed(() => locale.value === 'zh-CN'
  ? [
      { index: '01', category: 'BRONZE', material: 'bronze' as const, title: '青铜礼器', text: '礼乐承载，制度与信仰', image: '/media/editorial/explore-bronze-jue-user-v2.webp', srcset: '/media/responsive/explore-bronze-jue-user-v2-320w.webp 320w, /media/responsive/explore-bronze-jue-user-v2-640w.webp 640w, /media/responsive/explore-bronze-jue-user-v2-960w.webp 960w', to: '/explore' },
      { index: '02', category: 'JADE', material: 'jade' as const, title: '玉石意象', text: '温润致远，观念与美学', image: '/media/editorial/explore-jade-bi-user-v2.webp', srcset: '/media/responsive/explore-jade-bi-user-v2-320w.webp 320w, /media/responsive/explore-jade-bi-user-v2-640w.webp 640w, /media/responsive/explore-jade-bi-user-v2-960w.webp 960w', to: '/explore' },
      { index: '03', category: 'RIVER', material: 'ink' as const, title: '河洛故事', text: '从地理到文脉，河洛的千年流转', image: '/media/editorial/heluo-river-map-home-384w-v1.webp', srcset: '/media/editorial/heluo-river-map-home-192w-v1.webp 192w, /media/editorial/heluo-river-map-home-384w-v1.webp 384w, /media/editorial/heluo-river-map-home-640w-v1.webp 640w', to: '/explore' },
    ]
  : [
      { index: '01', category: 'BRONZE', material: 'bronze' as const, title: 'Bronze rituals', text: 'Ritual order and belief', image: '/media/editorial/explore-bronze-jue-user-v2.webp', srcset: '/media/responsive/explore-bronze-jue-user-v2-320w.webp 320w, /media/responsive/explore-bronze-jue-user-v2-640w.webp 640w, /media/responsive/explore-bronze-jue-user-v2-960w.webp 960w', to: '/explore' },
      { index: '02', category: 'JADE', material: 'jade' as const, title: 'Jade imagery', text: 'Ideas and aesthetics', image: '/media/editorial/explore-jade-bi-user-v2.webp', srcset: '/media/responsive/explore-jade-bi-user-v2-320w.webp 320w, /media/responsive/explore-jade-bi-user-v2-640w.webp 640w, /media/responsive/explore-jade-bi-user-v2-960w.webp 960w', to: '/explore' },
      { index: '03', category: 'RIVER', material: 'ink' as const, title: 'Heluo stories', text: 'A river of cultural memory', image: '/media/editorial/heluo-river-map-home-384w-v1.webp', srcset: '/media/editorial/heluo-river-map-home-192w-v1.webp 192w, /media/editorial/heluo-river-map-home-384w-v1.webp 384w, /media/editorial/heluo-river-map-home-640w-v1.webp 640w', to: '/explore' },
    ])

function shouldLoadHomeGsap() {
  if (typeof document === 'undefined' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return document.documentElement.dataset.performanceTier === 'full'
    && document.documentElement.dataset.motionTier === 'full'
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

async function revealHome() {
  const scope = root.value
  if (!scope || !shouldLoadHomeGsap()) return
  const gsapModule = await import('gsap').catch(() => undefined)
  if (!gsapModule) return
  const { gsap } = gsapModule
  if (unmounted || root.value !== scope || !shouldLoadHomeGsap()) return

  if (!claimHomeEntrance()) return

  showPattern.value = true
  await nextTick()
  if (unmounted || root.value !== scope) return

  gsapContext?.revert()
  gsapContext = gsap.context(() => {
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    const patternSvg = heluoPattern.value?.svg

    if (patternSvg) {
      const patternElements = patternSvg.querySelectorAll('.pattern-element')
      patternElements.forEach((el) => {
        const pathLength = el.getAttribute('pathLength') || '400'
        gsap.set(el, { strokeDasharray: pathLength, strokeDashoffset: pathLength })
      })

      const corners = patternSvg.querySelectorAll('.heluo-pattern .pattern-corner')
      const cornerRates = [0.84, 0.94, 1.06, 1.19]

      timeline.to('.heluo-pattern .pattern-center', {
        strokeDashoffset: 0,
        duration: 0.42,
        ease: 'power2.inOut',
        onStart: () => void audioSystem.playInteraction('click', { rate: 0.72, volume: 0.42, pan: 0 }),
      }, 0)

      corners.forEach((corner, i) => {
        timeline.to(corner, {
          strokeDashoffset: 0,
          duration: 0.26,
          ease: 'power2.inOut',
          onStart: () => void audioSystem.playInteraction('click', {
            rate: cornerRates[i],
            volume: 0.3,
            pan: [-0.5, 0.5, -0.3, 0.3][i],
          }),
        }, 0.16 + i * 0.09)
      })

      timeline
        .to('.heluo-pattern .pattern-line', { strokeDashoffset: 0, duration: 0.25, stagger: 0.06, ease: 'power1.inOut' }, 0.4)
        .to('.heluo-pattern .pattern-diagonal', { strokeDashoffset: 0, duration: 0.2, stagger: 0.05, ease: 'power1.inOut' }, 0.55)
        .to('.heluo-pattern .pattern-taiji', { strokeDashoffset: 0, duration: 0.3, ease: 'power2.inOut' }, 0.65)
        .to('.heluo-pattern .pattern-glow', {
          opacity: 0.25,
          scale: 1.4,
          duration: 0.5,
          transformOrigin: 'center',
          ease: 'power2.out',
          onStart: () => void audioSystem.playInteraction('success', { volume: 0.32 }),
        }, 0.78)
        .to('.heluo-pattern .pattern-glow', { opacity: 0, duration: 0.5, ease: 'power1.in' }, 1.05)
    }

    timeline
      .to('.heluo-pattern', {
        scale: 1.5,
        opacity: 0,
        duration: 0.6,
        ease: 'power2.in',
        onStart: () => void audioSystem.playTransition('reveal', { volume: 0.3 }),
        onComplete: () => { showPattern.value = false },
      }, 0.8)
      .from('.corridor-home__hero-media', { scale: 1.02, duration: 0.65, ease: 'power2.out' }, 0)
      .from('[data-motion="intro-eyebrow"]', {
        autoAlpha: 0,
        y: 10,
        duration: 0.28,
        onStart: () => void audioSystem.playInteraction('awaken-jade', { volume: 0.24 }),
      }, 0)
      .from('[data-motion="intro-title"]', { autoAlpha: 0, duration: 0.14 }, 0.02)
      .from('[data-motion="intro-title-line"]', {
        yPercent: 104,
        duration: 0.42,
        stagger: 0.06,
        clearProps: 'transform',
        ease: 'power3.out',
      }, 0.04)
      .from('[data-motion="intro-copy"]', { autoAlpha: 0, y: 8, duration: 0.28 }, 0.12)
    timeline.timeScale(1.45)
  }, scope)
}

function trackAmbientSurface(event: PointerEvent) {
  if (event.pointerType && event.pointerType !== 'mouse') return
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const rect = target.getBoundingClientRect()
  const x = rect.width > 0 ? ((event.clientX - rect.left) / rect.width) * 100 : 50
  const y = rect.height > 0 ? ((event.clientY - rect.top) / rect.height) * 100 : 50
  target.style.setProperty('--surface-mx', `${x.toFixed(1)}%`)
  target.style.setProperty('--surface-my', `${y.toFixed(1)}%`)
  target.dataset.ambientLit = 'true'
}

function clearAmbientSurface(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement | null
  target?.removeAttribute('data-ambient-lit')
}

onMounted(async () => {
  await nextTick()
  void revealHome()
})

onBeforeUnmount(() => {
  unmounted = true
  gsapContext?.revert()
})
</script>

<template>
  <section ref="root" class="corridor-home museum-home" data-motion-page="home" aria-labelledby="home-title">
    <!-- Section 1: Full-Bleed Curatorial Cover -->
    <section class="home-cover">
      <picture>
        <source media="(max-width: 760px)" :srcset="heroMedia.mobileSrcset" sizes="100vw" />
        <img
          class="corridor-home__hero-media"
          :src="heroMedia.src"
          :srcset="heroMedia.srcset"
          sizes="100vw"
          width="1672"
          height="941"
          alt=""
          fetchpriority="high"
          decoding="async"
        />
      </picture>
      <div class="home-cover__veil" data-motion="hero-veil" aria-hidden="true"></div>
      <HeluoPattern v-if="showPattern" ref="heluoPattern" />
      <PointerDotField variant="image" />

      <div class="home-cover__inner">
        <div class="home-cover__copy">
          <p class="home-eyebrow" data-motion="intro-eyebrow">{{ copy.eyebrow }}</p>
          <h1 id="home-title" data-motion="intro-title" :class="{ 'is-english': locale === 'en-US' }">
            <span v-for="line in titleLines" :key="line" class="home-title-line">
              <span data-motion="intro-title-line">{{ line }}</span>
            </span>
          </h1>
          <p class="home-cover__intro" data-motion="intro-copy">{{ copy.intro }}</p>
          <div class="home-cover__actions" data-motion="intro-cta">
            <RouterLink class="home-primary" to="/explore">
              <span>{{ copy.explore }}</span>
              <ArrowRight aria-hidden="true" />
            </RouterLink>
            <RouterLink class="home-ghost" to="/exhibits">
              <span>{{ copy.gallery }}</span>
              <ArrowRight aria-hidden="true" />
            </RouterLink>
          </div>
        </div>
      </div>

      <div class="home-cover__foot" data-motion="location">
        <div class="home-cover__venue">
          <span>{{ copy.location }}</span>
          <span class="home-cover__dot" aria-hidden="true"></span>
          <span class="home-cover__hours">{{ copy.openStatus }}</span>
        </div>
        <div class="home-cover__scroll" aria-hidden="true">
          <span class="home-cover__scroll-line"></span>
          <span>{{ copy.scrollHint }}</span>
        </div>
        <RouterLink class="home-foot-link" to="/appointment">
          <Calendar aria-hidden="true" />
          <span>{{ copy.visit }}</span>
          <ArrowRight aria-hidden="true" />
        </RouterLink>
      </div>

      <div class="home-cover__ruler">
        <AcousticRuler variant="hero" default-track="home" />
      </div>
    </section>

    <!-- Section 2: 5:7 Asymmetric Object Close-up -->
    <section class="home-closeup home-content" aria-labelledby="closeup-title">
      <figure
        class="home-closeup__figure surface-plinth"
        @pointermove="trackAmbientSurface"
        @pointerleave="clearAmbientSurface"
      >
        <div class="home-closeup__stage">
          <img
            src="/media/editorial/hero-bronze-ding-home-640w-v1.webp"
            srcset="/media/editorial/hero-bronze-ding-home-384w-v1.webp 384w, /media/editorial/hero-bronze-ding-home-640w-v1.webp 640w"
            sizes="(max-width: 760px) calc(100vw - 40px), 480px"
            width="640"
            height="640"
            :alt="copy.closeNote"
            loading="lazy"
            decoding="async"
          />
        </div>
        <figcaption class="home-closeup__plaque">
          <span class="home-closeup__plaque-type">{{ copy.closePlaqueType }}</span>
          <span class="home-closeup__plaque-meta">{{ copy.closePlaqueMaterial }} · {{ copy.closeNote }}</span>
        </figcaption>
      </figure>

      <div class="home-closeup__copy">
        <h2 id="closeup-title">{{ copy.closeTitle }}</h2>
        <p class="home-closeup__text">{{ copy.closeText }}</p>

        <div class="home-closeup__prompts" role="tablist" :aria-label="copy.closeLabel">
          <button
            v-for="(item, idx) in copy.observations"
            :key="item.label"
            type="button"
            role="tab"
            :aria-selected="activeObservation === idx"
            class="home-closeup__chip"
            :class="{ 'is-active': activeObservation === idx }"
            @click="activeObservation = idx"
          >
            <span>{{ item.label }}</span>
          </button>
        </div>
        <p class="home-closeup__prompt-detail" role="tabpanel">
          {{ copy.observations[activeObservation]?.detail }}
        </p>

        <div class="home-closeup__actions">
          <RouterLink class="home-inline-primary" to="/artifacts/heluo-bronze-ding">
            <DataBoard aria-hidden="true" />
            <span>{{ copy.closeAction }}</span>
            <ArrowRight aria-hidden="true" />
          </RouterLink>
          <RouterLink class="home-inline-link" to="/exhibits/heluo-bronze-ding-3d">
            <span>{{ copy.close3dAction }}</span>
            <ArrowRight aria-hidden="true" />
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- Section 3: 1.35fr : 1fr : 1fr Golden Three-Column Theme Gallery -->
    <section
      class="home-themes home-content"
      aria-labelledby="curation-title"
    >
      <header class="home-section-heading">
        <h2 id="curation-title">{{ copy.note }}</h2>
        <p>{{ copy.themesIntro }}</p>
      </header>

      <div class="home-themes__grid">
        <RouterLink
          v-for="card in featureCards"
          :key="card.index"
          v-artifact-awaken="{ material: card.material }"
          :to="{ path: card.to, query: { category: card.category } }"
          class="home-theme"
        >
          <div
            class="home-theme__media surface-plinth"
            :class="{ 'home-theme__media--panoramic': card.category === 'RIVER' }"
          >
            <img
              :src="card.image"
              :srcset="card.srcset"
              sizes="(max-width: 760px) 112px, (max-width: 1100px) 30vw, 380px"
              width="384"
              height="384"
              alt=""
              loading="lazy"
              decoding="async"
            />
          </div>
          <div class="home-theme__copy">
            <h3>{{ card.title }}</h3>
            <p>{{ card.text }}</p>
          </div>
          <ArrowRight class="home-theme__arrow" aria-hidden="true" />
        </RouterLink>
      </div>
    </section>

    <!-- Section 4: Curatorial Visit Invitation Band -->
    <section class="home-visit-wrap home-content">
      <div class="home-visit">
        <div class="home-visit__copy">
          <h2>{{ copy.visitTitle }}</h2>
          <p>{{ copy.visitText }}</p>
        </div>
        <RouterLink class="home-visit__cta" to="/appointment">
          <Calendar aria-hidden="true" />
          <span>{{ copy.visitCta }}</span>
          <ArrowRight aria-hidden="true" />
        </RouterLink>
      </div>
    </section>
  </section>
</template>

<style scoped>
.museum-home {
  background: transparent;
  color: var(--ink-secondary);
  overflow-x: clip;
}

.museum-home svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.home-content {
  width: min(calc(100% - 4rem), var(--container-max));
  margin-inline: auto;
}

/* ── Section 1: Hero Cover ── */
.home-cover {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: clamp(640px, calc(100svh - var(--header-height)), 900px);
  overflow: hidden;
  background: var(--surface-subtle);
}

.corridor-home__hero-media {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

/* Natural dual-layer editorial vignette — preserves corridor clarity while guaranteeing text contrast */
.home-cover__veil {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(ellipse 62% 76% at 18% 44%, color-mix(in oklch, var(--surface-canvas) 90%, transparent) 0%, color-mix(in oklch, var(--surface-canvas) 54%, transparent) 56%, transparent 84%),
    linear-gradient(180deg, transparent 68%, color-mix(in oklch, var(--surface-canvas) 94%, transparent) 100%);
}

.home-cover :deep(.pointer-dot-field) {
  z-index: 1;
  mask-image: linear-gradient(to bottom, oklch(0% 0 0) 76%, transparent 100%);
}

.home-cover__inner {
  position: relative;
  z-index: 2;
  width: min(calc(100% - 4rem), var(--container-max));
  margin: auto auto 0;
  padding-top: clamp(3.5rem, 8vh, 6rem);
  padding-bottom: clamp(2.5rem, 5vh, 4rem);
}

.home-cover__copy {
  max-width: 500px;
}

.home-cover__kicker {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.625rem;
  margin-bottom: var(--space-5);
}

.home-cover__rule {
  width: 24px;
  height: 1px;
  background: var(--accent-bronze);
}

.home-cover__tag {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.14em;
  color: var(--accent-bronze);
}

.home-eyebrow {
  margin-bottom: var(--space-4);
  font-size: var(--text-sm);
  font-weight: 500;
  letter-spacing: 0.08em;
  color: var(--ink-secondary);
}

.home-cover h1 {
  font-family: var(--font-display);
  font-size: clamp(3.25rem, 5.2vw, 4.75rem);
  font-weight: 600;
  line-height: 1.12;
  letter-spacing: -0.015em;
  color: var(--ink-primary);
}

.home-cover h1.is-english {
  font-size: clamp(2.75rem, 4.6vw, 4rem);
}

.home-title-line {
  display: block;
  overflow: hidden;
}

.home-title-line > span {
  display: block;
}

.home-cover__intro {
  max-width: 36ch;
  margin: var(--space-5) 0 var(--space-8);
  font-size: var(--text-md);
  line-height: 1.8;
  color: var(--ink-primary);
}

.home-cover__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.home-primary,
.home-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  min-height: 48px;
  padding: 0 1.5rem;
  border-radius: var(--radius-sm);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.03em;
  transition: background-color var(--duration-ui) var(--ease-curatorial),
              border-color var(--duration-ui) var(--ease-curatorial),
              transform var(--duration-fast) var(--ease-curatorial);
}

.home-primary {
  background: var(--accent-jade);
  border: 1px solid var(--accent-jade);
  color: var(--accent-jade-ink);
  box-shadow: var(--button-tactile-sheen);
}

.home-primary:hover {
  background: var(--accent-jade-hover);
  border-color: var(--accent-jade-hover);
  transform: translateY(-1px);
}

.home-ghost {
  background: var(--glass-light-bg);
  border: 1px solid var(--border-strong);
  color: var(--ink-primary);
  box-shadow: var(--card-frame-sheen), var(--shadow-xs);
  backdrop-filter: var(--glass-blur-compact);
  -webkit-backdrop-filter: var(--glass-blur-compact);
}

.home-ghost:hover {
  background: var(--surface-elevated);
  border-color: var(--ink-primary);
  transform: translateY(-1px);
}

.home-cover__foot {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-4);
  width: min(calc(100% - 4rem), var(--container-max));
  margin: auto auto 4.75rem;
  padding: var(--space-4) 0 var(--space-3);
  border-top: 1px solid var(--border-hairline);
  font-size: var(--text-xs);
  color: var(--ink-secondary);
}

.home-cover__ruler {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 14px;
  z-index: 3;
  width: min(calc(100% - 4rem), var(--container-max));
  padding-right: 7.5rem;
}

.home-cover__venue {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  font-weight: 500;
  color: var(--ink-primary);
}

.home-cover__dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent-bronze);
}

.home-cover__hours {
  color: var(--ink-secondary);
}

.home-cover__scroll {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ink-secondary);
  letter-spacing: 0.08em;
}

.home-cover__scroll-line {
  width: 24px;
  height: 1px;
  background: var(--border-strong);
}

.home-foot-link {
  justify-self: end;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: var(--control-min);
  padding-right: 7rem;
  color: var(--ink-primary);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: color var(--duration-fast) var(--ease-curatorial);
}

.home-foot-link:hover {
  color: var(--accent-jade);
}

/* ── Section 2: 5:7 Asymmetric Object Close-up ── */
.home-closeup {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: clamp(2.5rem, 6vw, 5.5rem);
  align-items: center;
  padding-block: clamp(4rem, 8vw, 6.5rem);
}

.home-closeup__figure {
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.home-closeup__stage {
  position: relative;
  isolation: isolate;
  display: grid;
  place-items: center;
  aspect-ratio: 5 / 5;
  padding: clamp(1.75rem, 3.2vw, 2.75rem);
  background-color: var(--surface-vitrine);
  background-image: var(--surface-vitrine-spotlight);
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.home-closeup__stage::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.08), inset 0 -18px 36px oklch(8% 0.002 75 / 0.34);
}

.home-closeup__stage img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  max-width: 100%;
  max-height: 420px;
  object-fit: contain;
  filter: drop-shadow(0 24px 32px oklch(6% 0.004 75 / 0.56));
}

.home-closeup__plaque {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5) var(--space-3) calc(var(--space-5) + 2px);
  border-top: 1px solid var(--border-hairline);
  background-color: var(--surface-elevated);
  box-shadow: var(--card-frame-sheen);
}

.home-closeup__plaque::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: var(--accent-seal);
}

.home-closeup__plaque-type {
  font-family: var(--font-display);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--ink-primary);
}

.home-closeup__plaque-meta {
  font-size: var(--text-xs);
  color: var(--ink-muted);
}

.home-closeup__copy h2 {
  margin: var(--space-3) 0 var(--space-5);
  font-size: clamp(2.125rem, 3.6vw, 3rem);
  line-height: 1.2;
  white-space: pre-line;
}

.home-closeup__text {
  max-width: 54ch;
  margin-bottom: var(--space-6);
  font-size: var(--text-md);
  line-height: 1.85;
  color: var(--ink-secondary);
}

.home-closeup__prompts {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-hairline);
}

.home-closeup__chip {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.125rem;
  border: 0;
  background: transparent;
  color: var(--ink-muted);
  font-size: var(--text-sm);
  font-weight: 500;
  cursor: pointer;
  transition: color var(--duration-ui) var(--ease-curatorial);
}

.home-closeup__chip::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--accent-seal);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform var(--duration-ui) var(--ease-curatorial);
}

.home-closeup__chip:hover {
  color: var(--ink-primary);
}

.home-closeup__chip.is-active {
  color: var(--ink-primary);
  font-weight: 600;
}

.home-closeup__chip.is-active::after {
  transform: scaleX(1);
}

.home-closeup__prompt-detail {
  min-height: 3.4em;
  max-width: 52ch;
  margin-bottom: var(--space-7);
  padding: 0;
  border: 0;
  background: transparent;
  font-size: var(--text-sm);
  line-height: 1.8;
  color: var(--ink-secondary);
}

.home-closeup__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
}

.home-inline-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: var(--control-min);
  padding: 0 1.25rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--surface-elevated);
  color: var(--ink-primary);
  font-size: var(--text-sm);
  font-weight: 600;
  box-shadow: var(--card-frame-sheen), var(--shadow-xs);
  transition: border-color var(--duration-ui) var(--ease-curatorial),
              background-color var(--duration-ui) var(--ease-curatorial),
              box-shadow var(--duration-ui) var(--ease-curatorial),
              transform var(--duration-ui) var(--ease-curatorial);
}

.home-inline-primary:hover {
  border-color: var(--accent-jade);
  background: var(--surface-elevated);
  box-shadow: var(--card-frame-sheen), var(--shadow-sm);
  transform: translateY(-1px);
}

.home-inline-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: var(--control-min);
  color: var(--accent-jade);
  font-size: var(--text-sm);
  font-weight: 600;
}

.home-inline-link:hover {
  text-decoration: underline;
  text-underline-offset: 5px;
}

/* ── Section 3: Open Architectural Three-Column Theme Gallery (Full-bleed Limestone Band) ── */
.home-themes {
  position: relative;
  isolation: isolate;
  margin-bottom: clamp(3.5rem, 6vw, 5.5rem);
  padding-block: clamp(3.5rem, 6vw, 5.25rem);
}

.home-themes::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 100vw;
  transform: translateX(-50%);
  z-index: -1;
  background:
    linear-gradient(180deg, color-mix(in oklch, var(--surface-stone-band) 86%, transparent) 0%, color-mix(in oklch, var(--surface-stone-band) 52%, transparent) 100%);
  border-top: 1px solid var(--border-hairline);
  border-bottom: 1px solid var(--border-hairline);
  pointer-events: none;
}

.home-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--space-8);
  margin-bottom: var(--space-8);
}

.home-section-heading h2 {
  font-size: clamp(1.875rem, 3vw, 2.5rem);
  line-height: 1.22;
}

.home-section-heading > p {
  max-width: 30ch;
  font-size: var(--text-sm);
  line-height: 1.75;
  color: var(--ink-secondary);
}

.home-themes__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-6);
}

.home-theme {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  align-content: start;
  gap: var(--space-4);
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--ink-secondary);
  transition: transform var(--duration-ui) var(--ease-curatorial);
}

.home-theme:hover {
  transform: translateY(-2px);
}

.home-theme__media {
  position: relative;
  grid-column: 1 / -1;
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-strong);
  background-color: var(--surface-vitrine);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  transition: border-color var(--duration-ui) var(--ease-curatorial),
              box-shadow var(--duration-ui) var(--ease-curatorial);
}

.home-theme__media--panoramic {
  background: linear-gradient(
    180deg,
    oklch(34% 0.003 75) 0%,
    oklch(50% 0.003 75) 50%,
    oklch(68% 0.003 75) 100%
  );
  padding: 0 var(--space-3);
}

.home-theme__media::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -1px 0 oklch(12% 0.01 72 / 0.14);
}

.home-theme:hover .home-theme__media {
  border-color: color-mix(in oklch, var(--accent-bronze) 56%, var(--border-strong));
  box-shadow: var(--shadow-md);
}

.home-theme__media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: transform 420ms var(--ease-curatorial);
}

.home-theme__copy {
  display: grid;
  gap: 0.25rem;
}

.home-theme__index {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--accent-bronze);
  letter-spacing: 0.08em;
}

.home-theme__copy h3 {
  margin-bottom: 0.25rem;
  font-family: var(--font-display);
  font-size: var(--text-xl);
  font-weight: 600;
  line-height: 1.3;
  color: var(--ink-primary);
}

.home-theme__copy p {
  font-size: var(--text-sm);
  line-height: 1.65;
  color: var(--ink-muted);
}

.home-theme__arrow {
  margin-top: 0.35rem;
  color: var(--accent-jade);
  transition: transform var(--duration-ui) var(--ease-curatorial);
}

@media (hover: hover) and (pointer: fine) {
  .home-theme:hover .home-theme__media img {
    transform: scale(1.03);
  }

  .home-theme:hover .home-theme__arrow {
    transform: translateX(4px);
  }
}

/* ── Section 4: Open Architectural Visit Invitation Band ── */
.home-visit-wrap {
  padding-bottom: clamp(4rem, 6.5vw, 5.5rem);
}

.home-visit {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding: clamp(2rem, 3.8vw, 3rem) 0;
  background: transparent;
}

.home-visit__copy {
  max-width: 58ch;
}

.home-visit__copy h2 {
  margin: var(--space-2) 0 var(--space-2);
  font-size: clamp(1.625rem, 2.6vw, 2.125rem);
  line-height: 1.28;
  text-wrap: balance;
}

.home-visit__copy p:last-child {
  font-size: var(--text-sm);
  line-height: 1.75;
  color: var(--ink-secondary);
}

.home-visit__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  flex-shrink: 0;
  min-height: 48px;
  padding: 0 1.6rem;
  border-radius: var(--radius-sm);
  background: var(--accent-jade);
  color: var(--accent-jade-ink);
  font-size: var(--text-sm);
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--button-tactile-sheen);
  transition: background-color var(--duration-ui) var(--ease-curatorial),
              transform var(--duration-fast) var(--ease-curatorial);
}

.home-visit__cta:hover {
  background: var(--accent-jade-hover);
  transform: translateY(-1px);
}

/* ── Responsive ── */
@media (max-width: 1100px) {
  .home-content,
  .home-cover__inner,
  .home-cover__foot {
    width: calc(100% - 3rem);
  }

  .home-closeup {
    gap: var(--space-10);
  }

  .home-themes__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 820px) {
  .home-cover__foot {
    grid-template-columns: 1fr auto;
  }

  .home-cover__scroll {
    display: none;
  }

  .home-foot-link {
    padding-right: 0;
  }
}

@media (max-width: 760px) {
  .home-content,
  .home-cover__inner,
  .home-cover__foot {
    width: calc(100% - 2rem);
  }

  .home-cover {
    min-height: 0;
  }

  .corridor-home__hero-media {
    object-position: center 46%;
  }

  .home-cover__veil {
    background: linear-gradient(
      180deg,
      color-mix(in oklch, var(--surface-canvas) 94%, transparent) 0%,
      color-mix(in oklch, var(--surface-canvas) 82%, transparent) 30%,
      transparent 58%,
      color-mix(in oklch, var(--surface-canvas) 95%, transparent) 96%
    );
  }

  .home-cover__inner {
    padding-top: var(--space-8);
    padding-bottom: var(--space-4);
  }

  .home-cover h1,
  .home-cover h1.is-english {
    font-size: 2.35rem;
    line-height: 1.15;
  }

  .home-cover__intro {
    margin: var(--space-4) 0;
    font-size: var(--text-base);
  }

  .home-cover__actions {
    padding-top: 184px;
    padding-bottom: var(--space-4);
  }

  .home-primary,
  .home-ghost {
    padding: 0 1.125rem;
    font-size: var(--text-sm);
  }

  .home-cover__foot {
    grid-template-columns: 1fr;
    gap: var(--space-2);
    margin-bottom: 3.6rem;
    padding-block: var(--space-3);
  }

  .home-cover__ruler {
    width: calc(100% - 2rem);
    bottom: 10px;
    padding-right: 0;
  }

  .home-closeup__prompts {
    gap: var(--space-2) var(--space-4);
  }

  .home-closeup__chip {
    min-width: 44px;
    padding: 0 0.625rem;
    justify-content: center;
  }

  .home-foot-link {
    justify-self: start;
  }

  .home-closeup {
    grid-template-columns: 1fr;
    gap: var(--space-8);
    padding-block: var(--space-10);
  }

  .home-closeup__stage {
    aspect-ratio: 4 / 3;
  }

  .home-section-heading {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
  }

  .home-themes__grid {
    grid-template-columns: 1fr;
    gap: var(--space-5);
  }

  .home-theme {
    grid-template-columns: 112px minmax(0, 1fr) 20px;
    align-items: center;
    gap: var(--space-4);
    padding-bottom: var(--space-5);
    border-bottom: 1px solid var(--border-hairline);
  }

  .home-theme:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .home-theme__media {
    grid-column: auto;
    aspect-ratio: 1;
    padding: var(--space-2);
  }

  .home-theme__copy {
    flex-direction: column;
    gap: 0.2rem;
  }

  .home-theme__copy h3 {
    font-size: var(--text-lg);
  }

  .home-theme__arrow {
    margin-top: 0;
  }

  .home-visit {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-5);
    padding: var(--space-6);
  }

  .home-visit__cta {
    width: 100%;
  }
}

@media (max-width: 360px) {
  .home-theme {
    grid-template-columns: 88px minmax(0, 1fr) 18px;
    gap: var(--space-3);
  }
}

@media (forced-colors: active) {
  .home-cover__veil {
    background: Canvas;
  }

  .home-primary,
  .home-visit__cta {
    background: Highlight;
    color: HighlightText;
    border-color: Highlight;
  }
}

/* Cursor-reactive "犹抱琵琶半遮面" smooth radial brocade reveal on close-up plinth, theme gallery & invitation pass */
.home-closeup__figure,
.home-themes,
.home-visit {
  --surface-mx: 50%;
  --surface-my: 50%;
}

.home-closeup__figure::after,
.home-themes::after,
.home-visit::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  background-image:
    var(--pattern-brocade-lit),
    radial-gradient(
      360px circle at var(--surface-mx) var(--surface-my),
      oklch(99% 0.020 88 / 0.44) 0%,
      oklch(88% 0.058 82 / 0.14) 46%,
      transparent 76%
    );
  background-size: 48px 48px, 100% 100%;
  background-repeat: repeat, no-repeat;
  -webkit-mask-image: radial-gradient(
    340px circle at var(--surface-mx) var(--surface-my),
    oklch(0% 0 0 / 1) 0%,
    oklch(0% 0 0 / 0.66) 46%,
    oklch(0% 0 0 / 0.16) 74%,
    transparent 100%
  );
  mask-image: radial-gradient(
    340px circle at var(--surface-mx) var(--surface-my),
    oklch(0% 0 0 / 1) 0%,
    oklch(0% 0 0 / 0.66) 46%,
    oklch(0% 0 0 / 0.16) 74%,
    transparent 100%
  );
  transition: opacity 280ms var(--ease-curatorial);
}

.home-themes > *,
.home-visit > * {
  position: relative;
  z-index: 1;
}

.home-closeup__figure[data-ambient-lit="true"]::after,
.home-themes[data-ambient-lit="true"]::after,
.home-visit[data-ambient-lit="true"]::after {
  opacity: 1;
}
</style>

<style>
html[data-theme="dark"] .museum-home .home-cover__veil {
  background:
    radial-gradient(ellipse 56% 72% at 18% 46%, oklch(11% 0.005 74 / 0.80) 0%, oklch(11% 0.005 74 / 0.36) 56%, transparent 84%),
    linear-gradient(180deg, transparent 72%, var(--surface-canvas) 100%);
}

@media (max-width: 760px) {
  html[data-theme="dark"] .museum-home .home-cover__veil {
    background: linear-gradient(
      180deg,
      oklch(11% 0.005 74 / 0.90) 0%,
      oklch(11% 0.005 74 / 0.72) 32%,
      transparent 58%,
      var(--surface-canvas) 96%
    );
  }
}
</style>
