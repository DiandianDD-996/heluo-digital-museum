<script setup lang="ts">
defineProps<{ name: 'next' | 'calendar' | 'exhibit' }>()

// Keep the homepage's three marks independent of the shared route icon bundle.
const paths = {
  next: 'm9 5 7 7-7 7',
  calendar: 'M4 5.5h16v15H4zm0 5h16M8 3.5v4m8-4v4M8 14h1m3 0h1m3 0h1M8 17h1m3 0h1',
  exhibit: 'M3 4h18M5 4v13h14V4M12 17v2m0 0-4 2m4-2 4 2',
}
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="paths[name]" />
  </svg>
</template>
