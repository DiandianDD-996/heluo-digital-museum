<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useLocale } from '../stores/locale'
import type { PointCloudQuality } from '../lib/pointCloudQuality'
import type { GuidePartName } from '../lib/guideTypes'

type ViewName = 'front' | 'left' | 'right' | 'back' | 'top'
type ViewerRuntimeState =
  | 'poster'
  | 'activating'
  | 'loading-runtime'
  | 'loading-model'
  | 'compiling-first-frame'
  | 'ready'
  | 'error'

const props = withDefaults(defineProps<{
  imageUrl: string
  alt: string
  initialMode?: 'solid' | 'points'
}>(), {
  initialMode: 'solid',
})

const emit = defineEmits<{
  'mode-change': [mode: 'solid' | 'points']
  'view-change': [view: ViewName]
  'part-focus': [part: GuidePartName]
  'user-interact': []
  'quality-change': [quality: PointCloudQuality]
  'state-change': [state: ViewerRuntimeState]
  'point-cloud-state': [state: 'idle' | 'loading' | 'ready' | 'error']
}>()

const { locale } = useLocale()
const stageRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const compassRef = ref<HTMLElement | null>(null)

const webglReady = ref(false)
const mode = ref<'solid' | 'points'>(props.initialMode)
const loupeOpen = ref(false)
const azimuthDeg = ref(34)
const elevationDeg = ref(14)
const zoomLevel = ref(1)
const reliefDepth = ref(1.25)

// Real-time 1:1 cursor coordinates (normalized 0..1) for zero-latency spotlight & loupe
const pointerNorm = { x: 0.5, y: 0.48, active: false }

const copy = computed(() => locale.value === 'en-US' ? {
  azimuth: 'AZIMUTH',
  elevation: 'ANGLE',
  grazingTag: 'RAKING RELIEF',
  overheadTag: 'DIFFUSE TOP',
  rubbingTag: 'GOLD & INK RUBBING',
  loupeBtn: '2.4× Loupe',
  compassAria: 'Drag to adjust raking-light direction and elevation',
  stageHint: 'Move cursor to sweep museum spotlight · Drag to angle raking shadows · 2.4× instant optical loupe',
  fallbackNote: 'CSS directional light preview active',
} : {
  azimuth: '光向',
  elevation: '掠射角',
  grazingTag: '微浮雕掠光',
  overheadTag: '正顶漫射',
  rubbingTag: '鎏金乌金拓',
  loupeBtn: '2.4× 放大镜',
  compassAria: '拖拽调节斜射光源方位角与仰角',
  stageHint: '移动鼠标牵引暗房聚光与刻痕阴影 · 拖拽调整掠射光角 · 开启 2.4× 零延迟放大镜',
  fallbackNote: '当前为光学渐变降级预览模式',
})

const formattedAzimuth = computed(() => `${String(Math.round(((azimuthDeg.value % 360) + 360) % 360)).padStart(3, '0')}°`)
const formattedElevation = computed(() => `${String(Math.round(elevationDeg.value)).padStart(2, '0')}°`)
const regimeLabel = computed(() => {
  if (mode.value === 'points') return copy.value.rubbingTag
  return elevationDeg.value <= 26 ? copy.value.grazingTag : copy.value.overheadTag
})

const compassSunStyle = computed(() => {
  const rad = (azimuthDeg.value * Math.PI) / 180
  const radiusNorm = Math.max(0.16, Math.min(0.86, 1 - (elevationDeg.value - 8) / 68))
  const rPx = radiusNorm * 18
  const x = Math.cos(rad) * rPx
  const y = -Math.sin(rad) * rPx
  return {
    transform: `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px))`,
  }
})

const fallbackLightStyle = computed(() => {
  const rad = (azimuthDeg.value * Math.PI) / 180
  const lx = 50 + Math.cos(rad) * 36
  const ly = 50 - Math.sin(rad) * 36
  const shadowStrength = Math.max(0.22, 0.72 - (elevationDeg.value / 95))
  return {
    '--raking-lx': `${lx.toFixed(1)}%`,
    '--raking-ly': `${ly.toFixed(1)}%`,
    '--raking-shadow': shadowStrength.toFixed(2),
    '--raking-zoom': zoomLevel.value.toFixed(2),
  } as Record<string, string>
})

const VIEW_LIGHT_PRESETS: Record<ViewName, { az: number; el: number; sx: number; sy: number }> = {
  front: { az: 34, el: 14, sx: 0.5, sy: 0.48 },
  left: { az: 172, el: 15, sx: 0.28, sy: 0.48 },
  right: { az: 8, el: 13, sx: 0.72, sy: 0.48 },
  back: { az: 266, el: 12, sx: 0.5, sy: 0.36 },
  top: { az: 90, el: 62, sx: 0.5, sy: 0.5 },
}

const PART_LIGHT_PRESETS: Record<GuidePartName, { az: number; el: number; lx: number; ly: number }> = {
  ear: { az: 48, el: 13, lx: 0.5, ly: 0.36 },
  motif: { az: 26, el: 11, lx: 0.5, ly: 0.5 },
  feet: { az: 318, el: 14, lx: 0.62, ly: 0.56 },
}

// Smooth state for camera/light angles & mode transitions.
// NOTE: Loupe position (pointerNorm.x/y) is intentionally NOT spring-damped — it locks 1:1 to cursor with zero latency!
const current = {
  az: 34,
  el: 14,
  zoom: 1,
  rubbing: props.initialMode === 'points' ? 1 : 0,
  loupe: 0,
  spotX: 0.5,
  spotY: 0.48,
  tiltX: 0,
  tiltY: 0,
}
const target = { ...current }

let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let quadBuffer: WebGLBuffer | null = null
let diffuseTex: WebGLTexture | null = null
let resizeObserver: ResizeObserver | null = null
let rafId = 0
let lastFrameAt = 0
let shaderClock = 0
let disposed = false
let draggingStage = false
let draggingCompass = false
let lastPointerX = 0
let lastPointerY = 0
let texWidth = 1280
let texHeight = 720
let imageAspect = 16 / 9

interface UniformLocations {
  uDiffuseTex: WebGLUniformLocation | null
  uResolution: WebGLUniformLocation | null
  uTexSize: WebGLUniformLocation | null
  uImageAspect: WebGLUniformLocation | null
  uLightDir: WebGLUniformLocation | null
  uSpotCenter: WebGLUniformLocation | null
  uTilt: WebGLUniformLocation | null
  uZoom: WebGLUniformLocation | null
  uRubbingMix: WebGLUniformLocation | null
  uLoupeMix: WebGLUniformLocation | null
  uLoupeCenter: WebGLUniformLocation | null
  uTime: WebGLUniformLocation | null
  uReliefDepth: WebGLUniformLocation | null
}
let uniforms: UniformLocations | null = null

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const VERTEX_SHADER = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

/**
 * Museum Photometric Raking-Light & Gold-Ink Rubbing Fragment Shader:
 * 1) Derives true multi-scale heightfield & Sobel surface normals directly from the real museum stone carving photograph;
 * 2) Runs an 8-tap directional micro-shadow march along the grazing light ray so every real carved line, dragon scroll,
 *    water wave, and weathered edge casts crisp directional shadows;
 * 3) Renders a focused 3200K tungsten museum spotlight with volumetric cone falloff, subtle 2.5D tablet tilt parallax,
 *    basalt darkroom vitrine reflection, and drifting golden dust motes;
 * 4) Mode 2 ('points'): Luminous Gold-Leaf Topography & Xuan-Paper Obsidian Ink Rubbing (鎏金乌金拓) with sweeping
 *    spectral reveal wave;
 * 5) Zero-latency 1:1 2.4x optical loupe with engraved brass vernier bezel, reticle ticks, and subtle optical glass refraction.
 */
const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;

uniform sampler2D uDiffuseTex;
uniform vec2 uResolution;
uniform vec2 uTexSize;
uniform float uImageAspect;
uniform vec3 uLightDir;
uniform vec2 uSpotCenter;
uniform vec2 uTilt;
uniform float uZoom;
uniform float uRubbingMix;
uniform float uLoupeMix;
uniform vec2 uLoupeCenter;
uniform float uTime;
uniform float uReliefDepth;

vec3 acesFilm(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

// Compute tablet UV with subtle 2.5D perspective foreshortening so the stone slab has real physical weight
vec2 tabletUv(vec2 screenUv, float zoom) {
  float viewAspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 centered = (screenUv - vec2(0.5, 0.48)) / (zoom * 0.92);
  float persp = 1.0 + centered.x * uTilt.x * 0.055 + centered.y * uTilt.y * 0.055;
  centered /= max(0.88, persp);
  centered += uTilt * 0.010;
  if (viewAspect > uImageAspect) {
    centered.x *= viewAspect / uImageAspect;
  } else {
    centered.y *= uImageAspect / viewAspect;
  }
  return centered + 0.5;
}

float sampleLum(vec2 uv) {
  vec3 col = texture2D(uDiffuseTex, clamp(uv, 0.002, 0.998)).rgb;
  return dot(col, vec3(0.30, 0.59, 0.11));
}

// Soft isolation mask honoring true WebP alpha channel with fallback chroma guard for non-alpha plates
float computeSlabMask(vec2 uv, vec4 tex) {
  vec2 b = abs(uv - 0.5);
  float outerBounds = smoothstep(0.496, 0.478, b.x) * smoothstep(0.496, 0.478, b.y);
  // Honor embedded alpha channel when the plate is alpha-matted (eliminates broken-corner notch artifacts)
  if (tex.a < 0.995) {
    return outerBounds * smoothstep(0.06, 0.92, tex.a);
  }
  vec3 col = tex.rgb;
  float warmth = col.r - col.b;
  float sat = max(col.r, max(col.g, col.b)) - min(col.r, min(col.g, col.b));
  float stoneChroma = smoothstep(0.018, 0.068, warmth) * smoothstep(0.025, 0.075, sat);
  float coreBand = smoothstep(0.455, 0.415, b.x) * smoothstep(0.355, 0.275, b.y);
  return outerBounds * max(stoneChroma, coreBand);
}

// Noise-gated multi-scale Sobel relief + Difference-of-Gaussians (DoG) local valley detector
void sampleStoneOptics(
  vec2 uv,
  float strength,
  out vec3 normalOut,
  out float lumOut,
  out float edgeOut,
  out float valleyOut
) {
  vec2 px = 1.0 / max(uTexSize, vec2(640.0));
  vec2 px2 = px * 2.2;
  vec2 px5 = px * 5.0;

  float c  = sampleLum(uv);
  float l1 = sampleLum(uv + vec2(-px.x, 0.0));
  float r1 = sampleLum(uv + vec2( px.x, 0.0));
  float t1 = sampleLum(uv + vec2(0.0, -px.y));
  float b1 = sampleLum(uv + vec2(0.0,  px.y));

  float l2 = sampleLum(uv + vec2(-px2.x, 0.0));
  float r2 = sampleLum(uv + vec2( px2.x, 0.0));
  float t2 = sampleLum(uv + vec2(0.0, -px2.y));
  float b2 = sampleLum(uv + vec2(0.0,  px2.y));

  // Soft-knee noise gate eliminates 8-bit WebP compression block noise on flat areas
  float gxRaw = (r1 - l1) * 0.55 + (r2 - l2) * 0.85;
  float gyRaw = (b1 - t1) * 0.55 + (b2 - t2) * 0.85;
  float rawMag = length(vec2(gxRaw, gyRaw));
  float gate = smoothstep(0.024, 0.14, rawMag);
  float gx = gxRaw * gate;
  float gy = gyRaw * gate;

  normalOut = normalize(vec3(-gx * strength, -gy * strength, 1.0));
  lumOut = c;
  edgeOut = clamp(rawMag * gate * 2.6, 0.0, 1.0);

  // Local neighborhood average (5px ring) for true Difference-of-Gaussians incised groove detection
  float ringAvg = (
    sampleLum(uv + vec2(-px5.x, -px5.y)) + sampleLum(uv + vec2(px5.x, -px5.y)) +
    sampleLum(uv + vec2(-px5.x,  px5.y)) + sampleLum(uv + vec2(px5.x,  px5.y)) +
    l2 + r2 + t2 + b2
  ) * 0.125;
  // Positive only where current pixel is genuinely recessed darker than its local stone neighborhood
  valleyOut = clamp((ringAvg - c - 0.018) * 6.2, 0.0, 1.0);
}

vec3 shadeStone(vec2 uv, vec2 screenUv, float detailBoost, out float slabMaskOut) {
  vec4 tex = texture2D(uDiffuseTex, clamp(uv, 0.002, 0.998));
  vec3 photo = tex.rgb;
  slabMaskOut = computeSlabMask(uv, tex);
  if (slabMaskOut <= 0.002) {
    return vec3(0.0);
  }

  vec3 normal;
  float lum;
  float edgeMag;
  float valley;
  sampleStoneOptics(uv, 3.2 * uReliefDepth * detailBoost, normal, lum, edgeMag, valley);

  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 spotDelta = uSpotCenter - screenUv;
  vec2 spotMetric = vec2(spotDelta.x * aspect, spotDelta.y);
  float spotDist = length(spotMetric);

  // Direction blends global grazing rig with subtle local spotlight angle
  vec3 localDir = normalize(vec3(spotMetric.x * 1.4, -spotMetric.y * 1.4, 0.42 + uLightDir.z * 0.38));
  vec3 lightDir = normalize(mix(uLightDir, localDir, 0.42));

  // 6-tap tight directional micro-shadow along the grazing ray
  vec2 rayStep = normalize(lightDir.xy + vec2(1e-5)) * vec2(1.0, -1.0);
  float tanEl = max(0.18, lightDir.z / max(length(lightDir.xy), 0.14));
  float occ = 0.0;
  for (int i = 1; i <= 6; i++) {
    float frac = float(i) / 6.0;
    float d = frac * 0.0085;
    float sh = sampleLum(uv + rayStep * d);
    float diff = (sh - lum) - d * tanEl * 3.8;
    occ = max(occ, clamp((diff - 0.018) * 6.5, 0.0, 1.0) * (1.0 - frac * 0.45));
  }
  float shadow = 1.0 - clamp(occ, 0.0, 0.72);

  // Museum darkroom halogen cone: moody falloff around edges, crisp luminous pool under spotlight
  float spotPool = exp(-spotDist * spotDist * 2.8);
  float wideFill = exp(-spotDist * spotDist * 0.55);

  float ndotl = clamp(dot(normal, lightDir), 0.0, 1.0);
  vec3 halfVec = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float ndoth = clamp(dot(normal, halfVec), 0.0, 1.0);

  // Subtle mineral specular glint strictly on real carved relief edges
  float microGlint = pow(ndoth, 52.0) * edgeMag * shadow * (0.28 + 0.52 * spotPool);

  // Mode 1: 原石斜射 (Museum darkroom chiaroscuro lighting, rich sculptural relief, zero clipping)
  vec3 warmGallery = vec3(1.06, 0.94, 0.77);
  vec3 coolShadow = vec3(0.20, 0.20, 0.22);
  // Deepen recessed carved valleys for tactile sculptural depth while keeping authentic sandstone hue
  vec3 sculptedAlbedo = photo * (1.0 - 0.34 * valley);
  float directionalKey = 0.44 + 1.02 * ndotl * shadow;
  float beamProfile = 0.42 + 0.72 * spotPool + 0.26 * wideFill;
  vec3 rakingLit = sculptedAlbedo * (coolShadow + warmGallery * directionalKey * beamProfile)
    + vec3(0.96, 0.80, 0.50) * microGlint * 0.62;

  // Mode 2: 乌金墨拓 (Authentic Palace Museum Pine-Soot Obsidian Ink Rubbing)
  // Deep matte velvety pine-soot black on raised flat stone; crisp antique Xuan ivory + subtle gold leaf in carved grooves
  float sweepPos = fract(uTime * 0.08);
  float sweepDelta = abs((uv.x * 0.88 + uv.y * 0.12) - sweepPos);
  float sweepSheen = exp(-sweepDelta * sweepDelta * 110.0) * 0.40;

  // Crisp incised line mask from local DoG valley + carved relief rim
  float incisedLine = clamp(valley * 0.96 + edgeMag * 0.26, 0.0, 1.0);
  incisedLine = smoothstep(0.14, 0.74, incisedLine);

  vec3 obsidianInk = vec3(0.052, 0.050, 0.048) + vec3(0.026, 0.023, 0.019) * (ndotl * shadow + 0.40 * spotPool);
  vec3 antiqueIvory = vec3(0.86, 0.80, 0.68);
  vec3 mutedGoldLeaf = vec3(0.84, 0.67, 0.36);

  vec3 inkRubbing = mix(obsidianInk, antiqueIvory, incisedLine * (0.64 + 0.30 * spotPool));
  inkRubbing += mutedGoldLeaf * edgeMag * (0.28 * spotPool + sweepSheen * 0.70) * shadow;
  inkRubbing += mutedGoldLeaf * microGlint * 0.48;

  return mix(rakingLit, inkRubbing, clamp(uRubbingMix, 0.0, 1.0));
}

void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 stoneUv = tabletUv(uv, uZoom);

  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 bgMetric = vec2((uv.x - uSpotCenter.x) * aspect, uv.y - uSpotCenter.y);
  float bgPool = exp(-dot(bgMetric, bgMetric) * 2.2);

  // Cold Obsidian darkroom backdrop (Heluo Editorial 3.0 — harmonized with navbar & EXHIBIT 01)
  float vignette = 1.0 - smoothstep(0.18, 0.96, length(vUv - 0.5));
  vec3 stageBg = vec3(0.032, 0.038, 0.045) * (0.76 + 0.24 * vignette)
    + vec3(0.036, 0.042, 0.050) * bgPool
    + vec3(0.022, 0.017, 0.010) * bgPool * 0.55;

  // Subtle floating dust motes strictly inside the darkroom spotlight cone
  vec2 dustGrid = vec2(uv.x * aspect, uv.y) * 26.0 + vec2(uTime * 0.08, -uTime * 0.11);
  vec2 dustCell = floor(dustGrid);
  vec2 dustFrac = fract(dustGrid) - 0.5;
  float dustSeed = fract(sin(dot(dustCell, vec2(127.1, 311.7))) * 43758.5453);
  vec2 dustOffset = vec2(sin(dustSeed * 19.3 + uTime * 0.6), cos(dustSeed * 27.1 - uTime * 0.5)) * 0.28;
  float dustSpark = smoothstep(0.075, 0.012, length(dustFrac - dustOffset)) * step(0.84, dustSeed) * bgPool;
  stageBg += vec3(0.82, 0.68, 0.42) * dustSpark * 0.14;

  // Soft contact plinth shadow directly beneath the floating carved stone slab
  vec2 shadowUv = tabletUv(uv - vec2(0.0, 0.028), uZoom);
  float underSlab = smoothstep(0.45, 0.34, abs(shadowUv.x - 0.5)) * smoothstep(0.32, 0.16, abs(shadowUv.y - 0.52));
  stageBg *= 1.0 - 0.42 * underSlab;

  float slabMask = 0.0;
  vec3 stoneCol = shadeStone(stoneUv, uv, 1.0, slabMask);
  vec3 color = mix(stageBg, stoneCol, slabMask);

  // Zero-latency 1:1 2.4x Optical Brass Loupe (clamped strictly to [0, 1] so radius never overflows)
  float loupeMix = clamp(uLoupeMix, 0.0, 1.0);
  if (loupeMix > 0.005) {
    vec2 delta = uv - uLoupeCenter;
    vec2 metric = vec2(delta.x * aspect, delta.y);
    float dist = length(metric);
    float radius = 0.165 * loupeMix;

    if (dist < radius) {
      float normR = dist / max(radius, 0.001);
      float lensCurve = 1.0 - 0.10 * normR * normR;
      vec2 baseOffset = delta * (lensCurve / 2.4);
      vec2 chromaShift = delta * (0.0024 * normR * normR);

      float mR = 0.0;
      float mG = 0.0;
      float mB = 0.0;
      vec3 cR = shadeStone(tabletUv(uLoupeCenter + baseOffset + chromaShift, uZoom), uLoupeCenter, 1.28, mR);
      vec3 cG = shadeStone(tabletUv(uLoupeCenter + baseOffset, uZoom), uLoupeCenter, 1.28, mG);
      vec3 cB = shadeStone(tabletUv(uLoupeCenter + baseOffset - chromaShift, uZoom), uLoupeCenter, 1.28, mB);
      vec3 magnified = mix(stageBg * 1.15, vec3(cR.r, cG.g, cB.b), mG);

      // Precision brass optical vernier crosshair & calibration ticks
      float angle = atan(metric.y, metric.x);
      float innerRing = smoothstep(0.0022, 0.0, abs(normR - 0.88));
      float tickMask = step(0.988, abs(cos(angle * 12.0))) * step(0.85, normR) * step(normR, 0.92);
      float crossHair = (
        (smoothstep(0.0014, 0.0, abs(metric.x)) * step(0.018, abs(metric.y)) * step(abs(metric.y), 0.044))
        + (smoothstep(0.0014, 0.0, abs(metric.y)) * step(0.018, abs(metric.x)) * step(abs(metric.x), 0.044))
      );
      vec3 reticleGold = vec3(0.88, 0.74, 0.46);
      magnified = mix(magnified, reticleGold, clamp(innerRing * 0.30 + tickMask * 0.55 + crossHair * 0.45, 0.0, 0.68));

      // Subtle convex lens sheen
      float glassSheen = smoothstep(0.72, 0.98, normR) * 0.09
        + exp(-dot(metric - vec2(-radius * 0.32, -radius * 0.34), metric - vec2(-radius * 0.32, -radius * 0.34)) * 320.0) * 0.12;
      color = magnified + vec3(0.94, 0.86, 0.72) * glassSheen;

      // Burnished beveled brass bezel
      float bezel = smoothstep(radius - 0.0085, radius - 0.003, dist);
      float bezelLight = 0.5 + 0.5 * dot(normalize(metric + 1e-4), normalize(vec2(-0.65, -0.75)));
      vec3 brass = mix(vec3(0.32, 0.24, 0.13), vec3(0.90, 0.75, 0.46), bezelLight);
      color = mix(color, brass, bezel);
    } else if (dist < radius + 0.024) {
      float drop = 1.0 - smoothstep(radius, radius + 0.024, dist);
      color *= 1.0 - 0.64 * drop * drop;
    }
  }

  gl_FragColor = vec4(acesFilm(color * 1.15), 1.0);
}
`

function compileShader(ctx: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = ctx.createShader(type)
  if (!shader) return null
  ctx.shaderSource(shader, source)
  ctx.compileShader(shader)
  if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
    ctx.deleteShader(shader)
    return null
  }
  return shader
}

function createTexture(ctx: WebGLRenderingContext): WebGLTexture | null {
  const tex = ctx.createTexture()
  if (!tex) return null
  ctx.bindTexture(ctx.TEXTURE_2D, tex)
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE)
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE)
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR)
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.LINEAR)
  return tex
}

function syncCanvasSize() {
  const canvas = canvasRef.value
  const stage = stageRef.value
  if (!canvas || !stage || !gl) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(stage.clientWidth * dpr))
  const h = Math.max(1, Math.round(stage.clientHeight * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  gl.viewport(0, 0, canvas.width, canvas.height)
}

function renderFrame() {
  if (!gl || !program || !uniforms || !canvasRef.value) return
  syncCanvasSize()
  gl.useProgram(program)

  const azRad = (current.az * Math.PI) / 180
  const elRad = (current.el * Math.PI) / 180
  const cosEl = Math.cos(elRad)
  const lx = Math.cos(azRad) * cosEl
  const ly = Math.sin(azRad) * cosEl
  const lz = Math.sin(elRad)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, diffuseTex)
  gl.uniform1i(uniforms.uDiffuseTex, 0)

  gl.uniform2f(uniforms.uResolution, canvasRef.value.width, canvasRef.value.height)
  gl.uniform2f(uniforms.uTexSize, texWidth, texHeight)
  gl.uniform1f(uniforms.uImageAspect, imageAspect)
  gl.uniform3f(uniforms.uLightDir, lx, ly, lz)
  gl.uniform2f(uniforms.uSpotCenter, current.spotX, current.spotY)
  gl.uniform2f(uniforms.uTilt, current.tiltX, current.tiltY)
  gl.uniform1f(uniforms.uZoom, current.zoom)
  gl.uniform1f(uniforms.uRubbingMix, current.rubbing)
  gl.uniform1f(uniforms.uLoupeMix, current.loupe)
  // Direct 1:1 cursor coordinates — zero spring lag!
  gl.uniform2f(uniforms.uLoupeCenter, pointerNorm.x, pointerNorm.y)
  gl.uniform1f(uniforms.uTime, shaderClock)
  gl.uniform1f(uniforms.uReliefDepth, reliefDepth.value)

  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

function stepSmooth(key: keyof typeof current, dt: number, speed: number): boolean {
  let delta = target[key] - current[key]
  if (key === 'az') {
    delta = ((((delta + 180) % 360) + 360) % 360) - 180
  }
  if (Math.abs(delta) < 0.0008) {
    current[key] = key === 'az' ? (((target.az % 360) + 360) % 360) : target[key]
    return false
  }
  // Exact analytical exponential smoothing: unconditionally stable at any frame dt
  const alpha = 1 - Math.exp(-speed * dt)
  current[key] += delta * alpha
  if (key === 'az') {
    current.az = ((current.az % 360) + 360) % 360
  } else if (key === 'loupe' || key === 'rubbing') {
    current[key] = Math.max(0, Math.min(1, current[key]))
  }
  return true
}

function scheduleAnimation() {
  if (disposed) return
  if (prefersReducedMotion()) {
    current.az = ((target.az % 360) + 360) % 360
    current.el = target.el
    current.zoom = target.zoom
    current.rubbing = target.rubbing
    current.loupe = target.loupe
    current.spotX = target.spotX
    current.spotY = target.spotY
    current.tiltX = target.tiltX
    current.tiltY = target.tiltY
    azimuthDeg.value = current.az
    elevationDeg.value = current.el
    zoomLevel.value = current.zoom
    renderFrame()
    return
  }
  if (rafId !== 0) return
  lastFrameAt = performance.now()
  const tick = (now: number) => {
    if (disposed) {
      rafId = 0
      return
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameAt) / 1000))
    lastFrameAt = now
    shaderClock += dt

    // Evaluate every channel independently without short-circuiting so loupe, spotlight, and rubbing all progress together
    const mAz = stepSmooth('az', dt, 10)
    const mEl = stepSmooth('el', dt, 10)
    const mZoom = stepSmooth('zoom', dt, 12)
    const mRubbing = stepSmooth('rubbing', dt, 8)
    const mLoupe = stepSmooth('loupe', dt, 18)
    const mSpotX = stepSmooth('spotX', dt, 16)
    const mSpotY = stepSmooth('spotY', dt, 16)
    const mTiltX = stepSmooth('tiltX', dt, 9)
    const mTiltY = stepSmooth('tiltY', dt, 9)
    const moving = mAz || mEl || mZoom || mRubbing || mLoupe || mSpotX || mSpotY || mTiltX || mTiltY

    azimuthDeg.value = current.az
    elevationDeg.value = current.el
    zoomLevel.value = current.zoom
    renderFrame()

    if (moving || pointerNorm.active || current.rubbing > 0.05) {
      rafId = requestAnimationFrame(tick)
    } else {
      rafId = 0
    }
  }
  rafId = requestAnimationFrame(tick)
}

function toggleLoupe() {
  emit('user-interact')
  loupeOpen.value = !loupeOpen.value
  target.loupe = loupeOpen.value ? 1 : 0
  if (loupeOpen.value) {
    // Snap loupe open immediately for crisp zero-lag feel while smoothing the final pop
    current.loupe = Math.max(current.loupe, 0.55)
    renderFrame()
  }
  scheduleAnimation()
}

function updatePointerCoords(clientX: number, clientY: number) {
  const stage = stageRef.value
  if (!stage) return
  const rect = stage.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return
  const nx = Math.max(0.02, Math.min(0.98, (clientX - rect.left) / rect.width))
  const ny = Math.max(0.02, Math.min(0.98, (clientY - rect.top) / rect.height))
  // 1:1 immediate loupe lock — zero latency!
  pointerNorm.x = nx
  pointerNorm.y = ny
  pointerNorm.active = true
  // Spotlight tracks quickly, subtle 2.5D tablet parallax follows gaze
  target.spotX = nx
  target.spotY = ny
  target.tiltX = (nx - 0.5) * 1.1
  target.tiltY = (ny - 0.5) * 1.1
  if (loupeOpen.value) {
    // Also sync spotlight immediately when loupe is active so the inspected region is always brightly lit
    current.spotX = nx
    current.spotY = ny
    renderFrame()
  }
}

function onStagePointerDown(event: PointerEvent) {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  emit('user-interact')
  draggingStage = true
  lastPointerX = event.clientX
  lastPointerY = event.clientY
  updatePointerCoords(event.clientX, event.clientY)
  ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  scheduleAnimation()
}

function onStagePointerMove(event: PointerEvent) {
  updatePointerCoords(event.clientX, event.clientY)
  if (draggingStage) {
    const dx = event.clientX - lastPointerX
    const dy = event.clientY - lastPointerY
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    target.az = (((target.az + dx * 0.45) % 360) + 360) % 360
    target.el = Math.max(8, Math.min(68, target.el - dy * 0.2))
  }
  scheduleAnimation()
}

function onStagePointerUp(event: PointerEvent) {
  if (!draggingStage) return
  draggingStage = false
  ;(event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId)
}

function onStagePointerLeave() {
  pointerNorm.active = false
  target.tiltX = 0
  target.tiltY = 0
  scheduleAnimation()
}

function onStageWheel(event: WheelEvent) {
  event.preventDefault()
  emit('user-interact')
  const step = event.deltaY < 0 ? 0.14 : -0.14
  target.zoom = Math.max(1, Math.min(1.9, target.zoom + step))
  scheduleAnimation()
}

function applyCompassPointer(event: PointerEvent) {
  const el = compassRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = event.clientX - cx
  const dy = cy - event.clientY
  const distNorm = Math.min(1, Math.hypot(dx, dy) / Math.max(1, rect.width * 0.42))
  target.az = (((Math.atan2(dy, dx) * 180) / Math.PI) + 360) % 360
  target.el = Math.round(Math.max(8, Math.min(68, 66 - distNorm * 56)))
  scheduleAnimation()
}

function onCompassPointerDown(event: PointerEvent) {
  event.stopPropagation()
  emit('user-interact')
  draggingCompass = true
  ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  applyCompassPointer(event)
}

function onCompassPointerMove(event: PointerEvent) {
  if (!draggingCompass) return
  event.stopPropagation()
  applyCompassPointer(event)
}

function onCompassPointerUp(event: PointerEvent) {
  if (!draggingCompass) return
  draggingCompass = false
  ;(event.currentTarget as HTMLElement | null)?.releasePointerCapture?.(event.pointerId)
}

// Exposed ViewerController methods matching ThreeExhibitViewer contract
function rotate() {
  target.az = (target.az + 45) % 360
  scheduleAnimation()
}

function zoomIn() {
  target.zoom = Math.min(1.9, Number((target.zoom + 0.28).toFixed(2)))
  scheduleAnimation()
}

function zoomOut() {
  target.zoom = Math.max(1, Number((target.zoom - 0.28).toFixed(2)))
  scheduleAnimation()
}

function resetView() {
  target.az = 34
  target.el = 14
  target.zoom = 1
  target.spotX = 0.5
  target.spotY = 0.48
  target.tiltX = 0
  target.tiltY = 0
  loupeOpen.value = false
  target.loupe = 0
  emit('view-change', 'front')
  scheduleAnimation()
}

function setView(view: ViewName, options?: { animated?: boolean }) {
  const preset = VIEW_LIGHT_PRESETS[view] ?? VIEW_LIGHT_PRESETS.front
  target.az = preset.az
  target.el = preset.el
  target.spotX = preset.sx
  target.spotY = preset.sy
  if (options?.animated === false) {
    current.az = preset.az
    current.el = preset.el
    current.spotX = preset.sx
    current.spotY = preset.sy
  }
  emit('view-change', view)
  scheduleAnimation()
}

function focusPart(part: GuidePartName) {
  const preset = PART_LIGHT_PRESETS[part] ?? PART_LIGHT_PRESETS.motif
  target.az = preset.az
  target.el = preset.el
  pointerNorm.x = preset.lx
  pointerNorm.y = preset.ly
  target.spotX = preset.lx
  target.spotY = preset.ly
  loupeOpen.value = true
  target.loupe = 1
  emit('part-focus', part)
  scheduleAnimation()
}

function setMode(nextMode: 'solid' | 'points') {
  mode.value = nextMode
  target.rubbing = nextMode === 'points' ? 1 : 0
  emit('point-cloud-state', 'ready')
  emit('mode-change', nextMode)
  scheduleAnimation()
}

defineExpose({
  rotate,
  zoomIn,
  zoomOut,
  resetView,
  setView,
  focusPart,
  setMode,
})

function loadStoneImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load stone plate texture'))
    img.src = src
  })
}

async function initWebglStage() {
  emit('state-change', 'loading-runtime')
  const canvas = canvasRef.value
  let ctx: WebGLRenderingContext | null = null
  try {
    ctx = (canvas?.getContext('webgl', { antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' })
      || canvas?.getContext('experimental-webgl')) as WebGLRenderingContext | null
  } catch {
    ctx = null
  }

  if (!ctx || !canvas) {
    webglReady.value = false
    emit('quality-change', 'fallback')
    emit('point-cloud-state', 'ready')
    emit('state-change', 'ready')
    return
  }

  const vs = compileShader(ctx, ctx.VERTEX_SHADER, VERTEX_SHADER)
  const fs = compileShader(ctx, ctx.FRAGMENT_SHADER, FRAGMENT_SHADER)
  const prog = ctx.createProgram()
  if (!vs || !fs || !prog) {
    webglReady.value = false
    emit('quality-change', 'fallback')
    emit('state-change', 'ready')
    return
  }

  ctx.attachShader(prog, vs)
  ctx.attachShader(prog, fs)
  ctx.linkProgram(prog)
  ctx.deleteShader(vs)
  ctx.deleteShader(fs)

  if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) {
    ctx.deleteProgram(prog)
    webglReady.value = false
    emit('quality-change', 'fallback')
    emit('state-change', 'ready')
    return
  }

  gl = ctx
  program = prog

  quadBuffer = ctx.createBuffer()
  ctx.bindBuffer(ctx.ARRAY_BUFFER, quadBuffer)
  ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
    -1, -1, 1, -1, -1, 1,
    -1, 1, 1, -1, 1, 1,
  ]), ctx.STATIC_DRAW)

  const aPos = ctx.getAttribLocation(prog, 'aPos')
  ctx.enableVertexAttribArray(aPos)
  ctx.vertexAttribPointer(aPos, 2, ctx.FLOAT, false, 0, 0)

  uniforms = {
    uDiffuseTex: ctx.getUniformLocation(prog, 'uDiffuseTex'),
    uResolution: ctx.getUniformLocation(prog, 'uResolution'),
    uTexSize: ctx.getUniformLocation(prog, 'uTexSize'),
    uImageAspect: ctx.getUniformLocation(prog, 'uImageAspect'),
    uLightDir: ctx.getUniformLocation(prog, 'uLightDir'),
    uSpotCenter: ctx.getUniformLocation(prog, 'uSpotCenter'),
    uTilt: ctx.getUniformLocation(prog, 'uTilt'),
    uZoom: ctx.getUniformLocation(prog, 'uZoom'),
    uRubbingMix: ctx.getUniformLocation(prog, 'uRubbingMix'),
    uLoupeMix: ctx.getUniformLocation(prog, 'uLoupeMix'),
    uLoupeCenter: ctx.getUniformLocation(prog, 'uLoupeCenter'),
    uTime: ctx.getUniformLocation(prog, 'uTime'),
    uReliefDepth: ctx.getUniformLocation(prog, 'uReliefDepth'),
  }

  diffuseTex = createTexture(ctx)
  ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, 1, 1, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, new Uint8Array([92, 86, 78, 255]))

  emit('state-change', 'loading-model')
  try {
    const img = await loadStoneImage(props.imageUrl)
    if (disposed || !gl || !diffuseTex) return
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      texWidth = img.naturalWidth
      texHeight = img.naturalHeight
      imageAspect = img.naturalWidth / img.naturalHeight
    }
    gl.bindTexture(gl.TEXTURE_2D, diffuseTex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
  } catch {
    // Keep warm slate placeholder if offline
  }

  if (disposed) return
  webglReady.value = true
  emit('quality-change', 'high')
  emit('point-cloud-state', 'ready')

  if (typeof ResizeObserver !== 'undefined' && stageRef.value) {
    resizeObserver = new ResizeObserver(() => renderFrame())
    resizeObserver.observe(stageRef.value)
  }

  renderFrame()
  emit('state-change', 'ready')
}

watch(() => props.initialMode, (next) => {
  if (next && next !== mode.value) setMode(next)
})

onMounted(() => {
  void initWebglStage()
})

onBeforeUnmount(() => {
  disposed = true
  if (rafId !== 0) {
    cancelAnimationFrame(rafId)
    rafId = 0
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  if (gl) {
    if (diffuseTex) gl.deleteTexture(diffuseTex)
    if (quadBuffer) gl.deleteBuffer(quadBuffer)
    if (program) gl.deleteProgram(program)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    gl = null
  }
})
</script>

<template>
  <div
    ref="stageRef"
    class="raking-stage"
    :class="{ 'is-loupe': loupeOpen, 'is-rubbing': mode === 'points' }"
    data-testid="raking-light-viewer"
    @pointerdown="onStagePointerDown"
    @pointermove="onStagePointerMove"
    @pointerup="onStagePointerUp"
    @pointercancel="onStagePointerUp"
    @pointerleave="onStagePointerLeave"
    @wheel="onStageWheel"
  >
    <canvas
      ref="canvasRef"
      class="raking-stage__canvas"
      :class="{ 'is-hidden': !webglReady }"
      :aria-label="alt"
    ></canvas>

    <!-- Graceful Non-WebGL CSS Grazing-Light Fallback -->
    <div v-if="!webglReady" class="raking-fallback" :style="fallbackLightStyle">
      <div class="raking-fallback__plate">
        <img :src="imageUrl" :alt="alt" decoding="async" />
        <div class="raking-fallback__shade" aria-hidden="true"></div>
      </div>
      <span class="raking-fallback__badge font-mono">{{ copy.fallbackNote }}</span>
    </div>

    <!-- Compact Optical Instrument HUD -->
    <div class="raking-hud" data-glass="dark" @pointerdown.stop>
      <button
        ref="compassRef"
        type="button"
        class="raking-compass"
        data-testid="raking-compass"
        :aria-label="copy.compassAria"
        @pointerdown="onCompassPointerDown"
        @pointermove="onCompassPointerMove"
        @pointerup="onCompassPointerUp"
        @pointercancel="onCompassPointerUp"
      >
        <span class="raking-compass__ring" aria-hidden="true"></span>
        <span class="raking-compass__cross" aria-hidden="true"></span>
        <span class="raking-compass__sun" :style="compassSunStyle" aria-hidden="true"></span>
      </button>

      <div class="raking-telemetry">
        <div class="raking-telemetry__row font-mono">
          <span>{{ copy.azimuth }} <strong>{{ formattedAzimuth }}</strong></span>
          <i aria-hidden="true">·</i>
          <span>{{ copy.elevation }} <strong>{{ formattedElevation }}</strong></span>
          <i aria-hidden="true">·</i>
          <em class="raking-telemetry__tag">{{ regimeLabel }}</em>
        </div>
        <p class="raking-telemetry__hint">{{ copy.stageHint }}</p>
      </div>

      <button
        type="button"
        class="raking-loupe-btn"
        :class="{ 'is-active': loupeOpen }"
        data-testid="raking-loupe-toggle"
        :aria-pressed="loupeOpen"
        @click="toggleLoupe"
      >
        <span aria-hidden="true">⊕</span>
        <span>{{ copy.loupeBtn }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.raking-stage {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  touch-action: none;
  user-select: none;
  cursor: grab;
  background: oklch(11.6% 0.006 238);
}

.raking-stage:active {
  cursor: grabbing;
}

.raking-stage.is-loupe {
  cursor: none;
}

.raking-stage__canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.raking-stage__canvas.is-hidden {
  display: none;
}

.raking-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 5.5rem 2rem 8rem;
}

.raking-fallback__plate {
  position: relative;
  max-width: min(86vw, 840px);
  max-height: 64dvh;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  transform: scale(var(--raking-zoom, 1));
  transition: transform 240ms var(--ease-curatorial);
}

.raking-fallback__plate img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.raking-stage.is-rubbing .raking-fallback__plate img {
  filter: grayscale(1) contrast(1.45) invert(0.88);
}

.raking-fallback__shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    circle at var(--raking-lx, 65%) var(--raking-ly, 35%),
    oklch(86% 0.075 78 / 0.24) 0%,
    transparent 48%,
    oklch(10% 0.006 238 / var(--raking-shadow, 0.55)) 100%
  );
}

.raking-fallback__badge {
  position: absolute;
  top: 82px;
  left: 50%;
  transform: translateX(-50%);
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--glass-dark-border);
  background: oklch(14% 0.006 238 / 0.82);
  color: var(--ink-on-dark-muted);
  font-size: var(--text-xs);
}

.raking-hud {
  position: absolute;
  left: 50%;
  bottom: 118px;
  transform: translateX(-50%);
  z-index: 16;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: min(calc(100% - 2rem), 660px);
  padding: 0.45rem 0.75rem 0.45rem 0.55rem;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-lg);
  color: var(--ink-on-dark);
}

.raking-compass {
  position: relative;
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid oklch(78% 0.068 76 / 0.52);
  border-radius: 50%;
  background: radial-gradient(circle at 50% 50%, oklch(20% 0.008 238) 0%, oklch(12% 0.006 238) 100%);
  cursor: pointer;
  touch-action: none;
}

.raking-compass__ring {
  position: absolute;
  inset: 8px;
  border: 1px dashed oklch(78% 0.048 76 / 0.34);
  border-radius: 50%;
}

.raking-compass__cross::before,
.raking-compass__cross::after {
  content: '';
  position: absolute;
  background: oklch(78% 0.042 76 / 0.24);
}

.raking-compass__cross::before {
  left: 50%;
  top: 5px;
  bottom: 5px;
  width: 1px;
  transform: translateX(-50%);
}

.raking-compass__cross::after {
  top: 50%;
  left: 5px;
  right: 5px;
  height: 1px;
  transform: translateY(-50%);
}

.raking-compass__sun {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: oklch(84% 0.095 78);
  box-shadow: 0 0 10px oklch(84% 0.095 78 / 0.85);
}

.raking-telemetry {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}

.raking-telemetry__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  font-size: var(--text-xs);
  color: var(--ink-on-dark-muted);
}

.raking-telemetry__row strong {
  color: var(--ink-on-dark);
  font-weight: 600;
}

.raking-telemetry__row i {
  font-style: normal;
  opacity: 0.45;
}

.raking-telemetry__tag {
  font-style: normal;
  color: oklch(82% 0.072 78);
  font-weight: 600;
}

.raking-telemetry__hint {
  margin: 0;
  font-size: var(--text-xs);
  color: var(--ink-on-dark-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.raking-loupe-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0 0.9rem;
  border: 1px solid var(--glass-dark-border);
  border-radius: var(--radius-pill);
  background: oklch(16% 0.007 238 / 0.82);
  color: var(--ink-on-dark);
  font-size: var(--text-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
  transition: border-color var(--duration-fast) var(--ease-curatorial),
              background-color var(--duration-fast) var(--ease-curatorial),
              color var(--duration-fast) var(--ease-curatorial);
}

.raking-loupe-btn:hover {
  border-color: oklch(78% 0.068 76 / 0.7);
}

.raking-loupe-btn.is-active {
  border-color: oklch(81% 0.048 78);
  background: oklch(81% 0.048 78);
  color: oklch(14% 0.006 238);
}

@media (max-width: 760px) {
  .raking-hud {
    left: var(--space-3);
    right: var(--space-3);
    bottom: 196px;
    transform: none;
    max-width: none;
    padding: 0.35rem 0.55rem 0.35rem 0.45rem;
    justify-content: space-between;
  }

  .raking-compass {
    width: 38px;
    height: 38px;
  }

  .raking-loupe-btn {
    min-height: 38px;
    padding: 0 0.72rem;
  }

  .raking-telemetry__hint {
    display: none;
  }
}
</style>
