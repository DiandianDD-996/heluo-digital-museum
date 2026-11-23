<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useLocale } from '../stores/locale'
const { locale } = useLocale()
</script>

<template>
  <section class="not-found-page">
    <div class="not-found-page__media surface-plinth">
      <img src="/media/exhibits/jade-bi-cover.webp" :alt="locale === 'en-US' ? 'Jade bi concept object' : '玉璧概念展品'" width="480" height="480" />
    </div>
    <div class="not-found-page__copy">
      <p class="eyebrow font-mono">404 · ARCHIVE NOT FOUND</p>
      <h1>{{ locale === 'en-US' ? 'This page could not be found' : '这页内容暂未找到' }}</h1>
      <p>{{ locale === 'en-US' ? 'The address may have changed. Continue with the collection or return to the museum.' : '地址可能已变更。可以继续探索馆藏，或返回博物馆首页。' }}</p>
      <nav class="not-found-page__actions" :aria-label="locale === 'en-US' ? 'Continue exploring' : '继续探索'">
        <RouterLink class="fluid-button fluid-button--primary" to="/explore">{{ locale === 'en-US' ? 'Explore collection' : '探索馆藏' }}</RouterLink>
        <RouterLink class="fluid-button fluid-button--secondary" to="/">{{ locale === 'en-US' ? 'Museum home' : '返回首页' }}</RouterLink>
      </nav>
    </div>
  </section>
</template>

<style scoped>
.not-found-page {
  display: grid;
  grid-template-columns: minmax(0, 360px) minmax(0, 1fr);
  align-items: center;
  gap: clamp(2rem, 5vw, 4rem);
  width: min(calc(100% - 4rem), 960px);
  margin: clamp(3rem, 8vh, 6rem) auto;
}

.not-found-page__media {
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  padding: var(--space-6);
}

.not-found-page__media img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.not-found-page__copy {
  display: grid;
  gap: var(--space-4);
}

.not-found-page__copy h1 {
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  line-height: 1.25;
}

.not-found-page__copy p:not(.eyebrow) {
  max-width: 44ch;
  font-size: var(--text-md);
  color: var(--ink-muted);
}

.not-found-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  padding-top: var(--space-2);
}

@media (max-width: 760px) {
  .not-found-page {
    grid-template-columns: 1fr;
    width: calc(100% - 2rem);
  }
}
</style>
