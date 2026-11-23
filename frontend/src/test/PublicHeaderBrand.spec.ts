/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const app = readFileSync(resolve(process.cwd(), 'src/App.vue'), 'utf8')
const shellCss = readFileSync(resolve(process.cwd(), 'src/styles/05-shell.css'), 'utf8')
const tokensCss = readFileSync(resolve(process.cwd(), 'src/styles/01-tokens.css'), 'utf8')

describe('public header bilingual brand and structured museum footer (Heluo Editorial 2.0)', () => {
  it('uses complementary subtitles instead of repeating the English museum name', () => {
    expect(app).toContain("museum: '河洛数字博物馆'")
    expect(app).toContain("brandSubtitle: 'HELUO DIGITAL MUSEUM'")
    expect(app).toContain("museum: 'Heluo Digital Museum'")
    expect(app).toContain("brandSubtitle: '河洛数字博物馆'")
    expect(app).toContain('<small>{{ shellCopy.brandSubtitle }}</small>')
  })

  it('enforces >= 12px legible typography on the brand subtitle and scroll-shrinking header', () => {
    expect(tokensCss).toContain('--text-xs: 0.75rem;')
    expect(shellCss).toContain('.site-header.is-scrolled')
    expect(shellCss).toMatch(/\.site-header \.brand-copy small\s*\{[^}]*font-size:\s*var\(--text-xs\)/s)
    expect(shellCss).not.toContain('0.43rem')
  })

  it('renders a structured 3-column curatorial museum footer and 44px mobile utility buttons', () => {
    expect(app).toContain('class="site-footer__inner"')
    expect(app).toContain('footerAddress')
    expect(app).toContain('footerHours')
    expect(shellCss).toMatch(/\.site-footer__inner\s*\{[^}]*grid-template-columns:/s)
    expect(shellCss).toMatch(/\.site-header :is\(\.theme-toggle, \.locale-toggle, \.login-link, \.audio-toggle\)\s*\{[^}]*width:\s*44px;[^}]*min-height:\s*44px;/s)
  })
})
