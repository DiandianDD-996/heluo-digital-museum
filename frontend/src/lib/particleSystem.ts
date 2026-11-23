/**
 * Particle System for Artifact Card Hover Effects
 * 文物卡片悬停粒子系统
 *
 * Emits drifting particles from an artifact image on hover. Motion follows
 * a gentle curl (a sine offset keyed to each particle's age and a random
 * phase) rather than straight-line drift, so the plume reads as curling
 * incense smoke instead of a fountain. A small fraction of particles are
 * larger "sparkles" that twinkle — a nod to light catching a polished
 * bronze or jade surface under gallery lighting.
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  age: number
  size: number
  opacity: number
  hue: number
  phase: number
  curlAmount: number
  curlFrequency: number
  sparkle: boolean
}

export interface ParticleSystemOptions {
  particleCount?: number
  particleSize?: { min: number; max: number }
  particleLife?: { min: number; max: number }
  emissionRadius?: number
  gravity?: number
  colorHue?: { min: number; max: number }
  saturation?: number
  lightness?: number
  curlAmount?: { min: number; max: number }
  sparkleChance?: number
}

/** Material-tuned presets shared with the `v-artifact-awaken` directive so
 *  bronze, jade and ink cards each get a visually distinct "awakening". */
export const MATERIAL_PARTICLE_PRESETS: Record<'bronze' | 'jade' | 'ink', ParticleSystemOptions> = {
  bronze: { colorHue: { min: 35, max: 43 }, saturation: 52, lightness: 68, particleSize: { min: 1.8, max: 4.0 }, sparkleChance: 0.34, curlAmount: { min: 4, max: 9 } },
  jade: { colorHue: { min: 40, max: 52 }, saturation: 34, lightness: 78, particleSize: { min: 1.5, max: 3.4 }, sparkleChance: 0.42, curlAmount: { min: 3, max: 7 } },
  ink: { colorHue: { min: 32, max: 44 }, saturation: 28, lightness: 66, particleSize: { min: 1.8, max: 3.8 }, sparkleChance: 0.18, curlAmount: { min: 5, max: 11 } },
}

export class ParticleSystem {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private particles: Particle[] = []
  private animationFrame: number | null = null
  private isActive: boolean = false

  private options: Required<ParticleSystemOptions>

  constructor(canvas: HTMLCanvasElement, options: ParticleSystemOptions = {}) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get 2D context')
    this.ctx = ctx

    this.options = {
      particleCount: options.particleCount ?? 12,
      particleSize: options.particleSize ?? { min: 2, max: 4 },
      particleLife: options.particleLife ?? { min: 1000, max: 2000 },
      emissionRadius: options.emissionRadius ?? 60,
      gravity: options.gravity ?? -0.02,
      colorHue: options.colorHue ?? { min: 160, max: 170 }, // jade green range
      saturation: options.saturation ?? 55,
      lightness: options.lightness ?? 60,
      curlAmount: options.curlAmount ?? { min: 3, max: 8 },
      sparkleChance: options.sparkleChance ?? 0.2,
    }

    this.resizeCanvas()
  }

  private resizeCanvas(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.ctx.scale(dpr, dpr)
  }

  private random(min: number, max: number): number {
    return Math.random() * (max - min) + min
  }

  private createParticle(originX?: number, originY?: number): Particle {
    const rect = this.canvas.getBoundingClientRect()
    const centerX = originX ?? rect.width / 2
    const centerY = originY ?? rect.height / 2

    // Random position within emission radius (circular distribution)
    const angle = Math.random() * Math.PI * 2
    const radius = Math.random() * this.options.emissionRadius
    const x = centerX + Math.cos(angle) * radius
    const y = centerY + Math.sin(angle) * radius

    // Upward velocity with slight horizontal variance
    const vx = this.random(-0.25, 0.25)
    const vy = this.random(-1.4, -0.75)

    const life = this.random(this.options.particleLife.min, this.options.particleLife.max)
    const sparkle = Math.random() < this.options.sparkleChance

    return {
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      age: 0,
      size: sparkle ? this.random(this.options.particleSize.max, this.options.particleSize.max * 1.8) : this.random(this.options.particleSize.min, this.options.particleSize.max),
      opacity: 1,
      hue: this.random(this.options.colorHue.min, this.options.colorHue.max),
      phase: Math.random() * Math.PI * 2,
      curlAmount: this.random(this.options.curlAmount.min, this.options.curlAmount.max),
      curlFrequency: this.random(0.0012, 0.0022),
      sparkle,
    }
  }

  emit(count?: number, originX?: number, originY?: number): void {
    const particleCount = count ?? this.options.particleCount

    for (let i = 0; i < particleCount; i++) {
      this.particles.push(this.createParticle(originX, originY))
    }

    if (!this.isActive) {
      this.start()
    }
  }

  private updateParticles(deltaTime: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]

      // Update physics — a curling drift layered on top of the base rise,
      // like incense smoke rather than a straight fountain.
      p.age += deltaTime
      p.vy += this.options.gravity
      p.x += p.vx + Math.sin(p.age * p.curlFrequency + p.phase) * (p.curlAmount * 0.02)
      p.y += p.vy

      // Update life
      p.life -= deltaTime

      // Fade out based on remaining life
      p.opacity = Math.max(0, p.life / p.maxLife)

      // Remove dead particles
      if (p.life <= 0) {
        this.particles.splice(i, 1)
      }
    }
  }

  private render(): void {
    const rect = this.canvas.getBoundingClientRect()
    this.ctx.clearRect(0, 0, rect.width, rect.height)

    for (const p of this.particles) {
      const twinkle = p.sparkle ? 0.55 + 0.45 * Math.sin(p.age * 0.012 + p.phase * 3) : 1
      const opacity = p.opacity * twinkle
      const sat = this.options.saturation
      const light = this.options.lightness

      const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2)
      gradient.addColorStop(0, `hsla(${p.hue}, ${sat}%, ${light}%, ${opacity * (p.sparkle ? 0.95 : 0.8)})`)
      gradient.addColorStop(0.5, `hsla(${p.hue}, ${sat}%, ${light}%, ${opacity * 0.4})`)
      gradient.addColorStop(1, `hsla(${p.hue}, ${sat}%, ${light}%, 0)`)

      this.ctx.fillStyle = gradient
      this.ctx.beginPath()
      this.ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2)
      this.ctx.fill()
    }
  }

  private lastFrameTime: number = 0

  private animate = (timestamp: number): void => {
    if (!this.isActive) return

    const deltaTime = timestamp - this.lastFrameTime || 16
    this.lastFrameTime = timestamp

    this.updateParticles(deltaTime)
    this.render()

    if (this.particles.length > 0) {
      this.animationFrame = requestAnimationFrame(this.animate)
    } else {
      this.stop()
    }
  }

  start(): void {
    if (this.isActive) return

    this.isActive = true
    this.lastFrameTime = performance.now()
    this.animationFrame = requestAnimationFrame(this.animate)
  }

  stop(): void {
    this.isActive = false
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame)
      this.animationFrame = null
    }
  }

  clear(): void {
    this.particles = []
    const rect = this.canvas.getBoundingClientRect()
    this.ctx.clearRect(0, 0, rect.width, rect.height)
  }

  destroy(): void {
    this.stop()
    this.clear()
  }
}

/**
 * Factory function for creating particle systems
 */
export function createParticleSystem(
  canvas: HTMLCanvasElement,
  options?: ParticleSystemOptions
): ParticleSystem {
  return new ParticleSystem(canvas, options)
}
