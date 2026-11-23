import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const exhibit = readFileSync(resolve(process.cwd(), 'src/views/ExhibitDetailView.vue'), 'utf8')

describe('desktop 3D entry action contract (Heluo Editorial 2.0)', () => {
  it('provides a stable mouse and keyboard target on constrained desktops', () => {
    expect(exhibit).toMatch(/\.viewer-poster-actions\s*\{[^}]*width:\s*min\(100%, 260px\)/s)
    expect(exhibit).toMatch(/\.viewer-poster-actions button\s*\{[^}]*width:\s*100%[^}]*min-height:\s*48px/s)
    expect(exhibit).toMatch(/\.viewer-poster-actions button\s*\{[^}]*cursor:\s*pointer[^}]*pointer-events:\s*auto/s)
  })

  it('keeps non-interactive poster artwork outside the button hit test', () => {
    expect(exhibit).toMatch(/\.three-fallback--activation > img\s*\{[^}]*pointer-events:\s*none/s)
  })
})
