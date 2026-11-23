<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLocale } from '../stores/locale'
import { useLightPreset, type LightPresetId } from '../stores/lightPreset'

const { locale } = useLocale()
const { preset, presets, setPreset } = useLightPreset()
const collapsed = ref(true)

const activeMeta = computed(() => presets.find((item) => item.id === preset.value) ?? presets[0]!)
const isZh = computed(() => locale.value === 'zh-CN')

function choose(id: LightPresetId) {
  setPreset(id)
}
</script>

<template>
  <aside
    class="light-preset-dock"
    :class="{ 'is-collapsed': collapsed }"
    :aria-label="isZh ? '交互光效方案预览切换' : 'Interactive lighting preset switcher'"
  >
    <button
      v-if="collapsed"
      type="button"
      class="light-preset-dock__expand"
      @click="collapsed = false"
    >
      <span class="light-preset-dock__spark" aria-hidden="true"></span>
      <span>{{ isZh ? `光效方案 · ${activeMeta.zhName}` : `Light · ${activeMeta.enName}` }}</span>
    </button>

    <div v-else class="light-preset-dock__panel">
      <div class="light-preset-dock__head">
        <span class="light-preset-dock__eyebrow">
          <span class="light-preset-dock__spark" aria-hidden="true"></span>
          {{ isZh ? '光效方案对比（实时切换）' : 'Light Craft Preview' }}
        </span>
        <button
          type="button"
          class="light-preset-dock__collapse"
          :aria-label="isZh ? '收起光效切换条' : 'Collapse switcher'"
          @click="collapsed = true"
        >
          {{ isZh ? '收起' : 'Hide' }}
        </button>
      </div>

      <div class="light-preset-dock__tabs" role="radiogroup" :aria-label="isZh ? '选择光效版本' : 'Choose lighting variant'">
        <button
          v-for="item in presets"
          :key="item.id"
          type="button"
          role="radio"
          class="light-preset-dock__tab"
          :class="{ 'is-active': preset === item.id }"
          :aria-checked="preset === item.id"
          @click="choose(item.id)"
        >
          <span class="light-preset-dock__idx font-mono">{{ item.index }}</span>
          <span>{{ isZh ? item.zhName : item.enName }}</span>
        </button>
      </div>

      <p class="light-preset-dock__desc">
        {{ isZh ? activeMeta.zhTagline : activeMeta.enTagline }}
      </p>
    </div>
  </aside>
</template>

<style scoped>
.light-preset-dock {
  position: fixed;
  left: 24px;
  bottom: 68px;
  z-index: 90;
  max-width: min(calc(100vw - 120px), 488px);
}

.light-preset-dock__panel,
.light-preset-dock__expand {
  border: 1px solid var(--border-strong);
  background: color-mix(in oklch, var(--surface-elevated) 86%, transparent);
  color: var(--ink-primary);
  backdrop-filter: blur(18px) saturate(150%);
  -webkit-backdrop-filter: blur(18px) saturate(150%);
  box-shadow: 0 14px 36px -14px oklch(12% 0.01 80 / 0.28);
}

.light-preset-dock__panel {
  border-radius: 16px;
  padding: 10px 12px 9px;
  display: grid;
  gap: 8px;
}

.light-preset-dock__expand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  cursor: pointer;
}

.light-preset-dock__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.light-preset-dock__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--ink-secondary);
}

.light-preset-dock__spark {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-bronze);
  box-shadow: 0 0 8px color-mix(in oklch, var(--accent-bronze) 78%, transparent);
}

.light-preset-dock__collapse {
  border: 0;
  background: transparent;
  color: var(--ink-secondary);
  font-size: var(--text-xs, 0.75rem);
  min-height: 36px;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.light-preset-dock__collapse:hover {
  color: var(--ink-primary);
}

.light-preset-dock__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.light-preset-dock__tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 12px;
  border: 1px solid var(--border-hairline);
  border-radius: 999px;
  background: color-mix(in oklch, var(--surface-subtle) 78%, transparent);
  color: var(--ink-secondary);
  font-size: var(--text-xs, 0.75rem);
  font-weight: 600;
  cursor: pointer;
  transition: border-color 180ms var(--ease-curatorial),
              background-color 180ms var(--ease-curatorial),
              color 180ms var(--ease-curatorial);
}

.light-preset-dock__tab:hover {
  border-color: var(--accent-bronze);
  color: var(--ink-primary);
}

.light-preset-dock__tab.is-active {
  border-color: var(--accent-bronze);
  background: color-mix(in oklch, var(--accent-bronze) 18%, var(--surface-elevated));
  color: var(--ink-primary);
}

.light-preset-dock__idx {
  font-size: var(--text-xs, 0.75rem);
  color: var(--accent-bronze);
}

.light-preset-dock__desc {
  margin: 0;
  font-size: var(--text-xs, 0.75rem);
  line-height: 1.5;
  color: var(--ink-secondary);
}

@media (max-width: 760px), (pointer: coarse), (hover: none), (prefers-reduced-motion: reduce) {
  .light-preset-dock {
    display: none;
  }
}
</style>
