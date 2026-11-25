<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useLocale } from '../stores/locale'

const { locale } = useLocale()
const route = useRoute()
const isEnglish = computed(() => locale.value === 'en-US')
const missingPath = computed(() => route?.fullPath || '/unknown')
</script>

<template>
  <section class="not-found-page curatorial-enter" data-testid="not-found-fragment">
    <figure class="not-found-page__media surface-vitrine vitrine-contact-stage">
      <img
        src="/media/editorial/explore-river-map-stone-user-v2.webp"
        :alt="isEnglish ? 'Uncatalogued Heluo stone fragment' : '待考河洛图纹石板残简'"
        width="560"
        height="340"
      />
      <figcaption class="not-found-page__tag font-mono">
        <span>{{ isEnglish ? 'UNCATALOGUED · 404' : '编号未录 · 404' }}</span>
        <i aria-hidden="true">{{ isEnglish ? 'SEALED' : '待考' }}</i>
      </figcaption>
    </figure>

    <div class="not-found-page__copy">
      <p class="eyebrow font-mono">{{ isEnglish ? 'ARCHIVE REGISTRY · 404' : '河洛藏品总目 · 编号未录' }}</p>
      <h1>{{ isEnglish ? 'Uncatalogued Fragment' : '编号未录 · 待考残简' }}</h1>
      <p class="not-found-page__lead">
        {{
          isEnglish
            ? 'This catalogue reference has not been entered into the Heluo Digital Museum archive, or the object has been moved to another gallery hall.'
            : '这条路径尚未编入河洛数字博物馆的公开总目，或原展签已迁至其他展厅。不妨先回到常设馆藏，或步入 3D 暗房近观器物。'
        }}
      </p>

      <dl class="not-found-slip">
        <div>
          <dt>{{ isEnglish ? 'Requested Reference' : '查检路径' }}</dt>
          <dd class="font-mono">{{ missingPath }}</dd>
        </div>
        <div>
          <dt>{{ isEnglish ? 'Archive Status' : '著录状态' }}</dt>
          <dd>{{ isEnglish ? 'Pending archival review (HTTP 404)' : '残简待考 · 馆内暂缺著录' }}</dd>
        </div>
      </dl>

      <nav class="not-found-page__actions" :aria-label="isEnglish ? 'Continue exploring' : '继续探索'">
        <RouterLink class="fluid-button fluid-button--primary" to="/explore">
          {{ isEnglish ? 'Explore collection →' : '返回探索馆藏 →' }}
        </RouterLink>
        <RouterLink class="fluid-button fluid-button--secondary" to="/exhibits">
          {{ isEnglish ? 'Enter 3D Gallery' : '步入 3D 数字展厅' }}
        </RouterLink>
        <RouterLink class="fluid-button fluid-button--ghost" to="/">
          {{ isEnglish ? 'Museum home' : '回到首页' }}
        </RouterLink>
      </nav>
    </div>
  </section>
</template>

<style scoped>
.not-found-page {
  display: grid;
  grid-template-columns: minmax(0, 420px) minmax(0, 1fr);
  align-items: center;
  gap: clamp(2.5rem, 5vw, 4.5rem);
  width: min(calc(100% - 4rem), 1040px);
  margin: clamp(3rem, 8vh, 6rem) auto;
}

.not-found-page__media {
  position: relative;
  aspect-ratio: 4 / 3;
  display: grid;
  place-items: center;
  margin: 0;
  padding: var(--space-8) var(--space-6);
}

.not-found-page__media img {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 18px 24px var(--plinth-contact-shadow));
}

.not-found-page__tag {
  position: absolute;
  left: var(--space-4);
  right: var(--space-4);
  bottom: var(--space-3);
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--text-xs);
  letter-spacing: 0.12em;
  color: var(--ink-on-dark-muted);
}

.not-found-page__tag i {
  font-style: normal;
  padding: 0.14rem 0.5rem;
  border: 1px solid color-mix(in oklch, var(--accent-seal) 62%, transparent);
  border-radius: var(--radius-xs);
  color: var(--accent-seal);
  font-family: var(--font-display);
  font-weight: 600;
}

.not-found-page__copy {
  display: grid;
  gap: var(--space-4);
}

.not-found-page__copy h1 {
  font-size: clamp(1.85rem, 3.2vw, 2.65rem);
  line-height: 1.2;
}

.not-found-page__lead {
  max-width: 48ch;
  font-size: var(--text-md);
  line-height: 1.85;
  color: var(--ink-secondary);
}

.not-found-slip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--border-hairline);
  overflow: hidden;
}

.not-found-slip > div {
  display: grid;
  gap: 0.2rem;
  padding: var(--space-3) var(--space-4);
  background: var(--surface-elevated);
}

.not-found-slip dt {
  font-size: var(--text-xs);
  font-weight: 600;
  color: var(--ink-muted);
}

.not-found-slip dd {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--ink-primary);
  overflow-wrap: anywhere;
}

.not-found-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

@media (max-width: 820px) {
  .not-found-page {
    grid-template-columns: 1fr;
    width: calc(100% - 2rem);
  }

  .not-found-slip {
    grid-template-columns: 1fr;
  }
}
</style>
