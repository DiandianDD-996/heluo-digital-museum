<script setup lang="ts">
/**
 * Heluo Pattern - 河图洛书几何纹样动画
 *
 * Animated SVG pattern based on the ancient Heluo diagram, used as the
 * entrance animation for the homepage. Strokes are drawn through a subtle
 * turbulence + displacement filter so the geometry wobbles like it was
 * actually brushed rather than rendered by a vector engine, and a soft
 * blurred glow sits behind the central taiji circle for the finale beat.
 */
import { ref } from 'vue'

const svg = ref<SVGSVGElement | null>(null)

defineExpose({ svg })
</script>

<template>
  <svg
    ref="svg"
    class="heluo-pattern"
    viewBox="0 0 400 400"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="pattern-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color: var(--color-bronze); stop-opacity: 1" />
        <stop offset="100%" style="stop-color: var(--color-action); stop-opacity: 1" />
      </linearGradient>
      <filter id="ink-wobble" x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="wobble" />
        <feDisplacementMap in="SourceGraphic" in2="wobble" scale="5" xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <filter id="pattern-glow-blur" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="9" />
      </filter>
    </defs>

    <!-- Soft glow behind the taiji circle — faded in for the finale beat -->
    <circle class="pattern-glow" cx="200" cy="200" r="46" fill="url(#pattern-gradient)" opacity="0" filter="url(#pattern-glow-blur)" />

    <g filter="url(#ink-wobble)">
      <!-- Central square (河图中心) -->
      <rect
        class="pattern-element pattern-center"
        x="150"
        y="150"
        width="100"
        height="100"
        fill="none"
        stroke="url(#pattern-gradient)"
        stroke-width="2"
        pathLength="400"
      />

      <!-- Four corner squares (四象) -->
      <rect
        class="pattern-element pattern-corner"
        x="50"
        y="50"
        width="60"
        height="60"
        fill="none"
        stroke="url(#pattern-gradient)"
        stroke-width="1.5"
        pathLength="240"
      />
      <rect
        class="pattern-element pattern-corner"
        x="290"
        y="50"
        width="60"
        height="60"
        fill="none"
        stroke="url(#pattern-gradient)"
        stroke-width="1.5"
        pathLength="240"
      />
      <rect
        class="pattern-element pattern-corner"
        x="50"
        y="290"
        width="60"
        height="60"
        fill="none"
        stroke="url(#pattern-gradient)"
        stroke-width="1.5"
        pathLength="240"
      />
      <rect
        class="pattern-element pattern-corner"
        x="290"
        y="290"
        width="60"
        height="60"
        fill="none"
        stroke="url(#pattern-gradient)"
        stroke-width="1.5"
        pathLength="240"
      />

      <!-- Connecting lines (八卦连线) -->
      <path
        class="pattern-element pattern-line"
        d="M 200 150 L 200 50"
        stroke="url(#pattern-gradient)"
        stroke-width="1"
        fill="none"
        pathLength="100"
      />
      <path
        class="pattern-element pattern-line"
        d="M 250 200 L 350 200"
        stroke="url(#pattern-gradient)"
        stroke-width="1"
        fill="none"
        pathLength="100"
      />
      <path
        class="pattern-element pattern-line"
        d="M 200 250 L 200 350"
        stroke="url(#pattern-gradient)"
        stroke-width="1"
        fill="none"
        pathLength="100"
      />
      <path
        class="pattern-element pattern-line"
        d="M 150 200 L 50 200"
        stroke="url(#pattern-gradient)"
        stroke-width="1"
        fill="none"
        pathLength="100"
      />

      <!-- Diagonal connections -->
      <path
        class="pattern-element pattern-diagonal"
        d="M 150 150 L 110 110"
        stroke="url(#pattern-gradient)"
        stroke-width="1"
        fill="none"
        opacity="0.6"
        pathLength="57"
      />
      <path
        class="pattern-element pattern-diagonal"
        d="M 250 150 L 290 110"
        stroke="url(#pattern-gradient)"
        stroke-width="1"
        fill="none"
        opacity="0.6"
        pathLength="57"
      />
      <path
        class="pattern-element pattern-diagonal"
        d="M 250 250 L 290 290"
        stroke="url(#pattern-gradient)"
        stroke-width="1"
        fill="none"
        opacity="0.6"
        pathLength="57"
      />
      <path
        class="pattern-element pattern-diagonal"
        d="M 150 250 L 110 290"
        stroke="url(#pattern-gradient)"
        stroke-width="1"
        fill="none"
        opacity="0.6"
        pathLength="57"
      />

      <!-- Central circle (太极) -->
      <circle
        class="pattern-element pattern-taiji"
        cx="200"
        cy="200"
        r="30"
        fill="none"
        stroke="url(#pattern-gradient)"
        stroke-width="2"
        pathLength="188"
      />
    </g>
  </svg>
</template>

<style scoped>
.heluo-pattern {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 10;
}

.pattern-element {
  stroke-dasharray: var(--pathLength, 400);
  stroke-dashoffset: var(--pathLength, 400);
}

.pattern-glow {
  mix-blend-mode: plus-lighter;
}
</style>
