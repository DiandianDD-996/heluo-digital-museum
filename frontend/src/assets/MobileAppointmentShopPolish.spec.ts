import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const appointment = readFileSync(resolve(process.cwd(), 'src/views/AppointmentView.vue'), 'utf8')
const shop = readFileSync(resolve(process.cwd(), 'src/views/ShopView.vue'), 'utf8')

describe('mobile appointment and shop polish (Heluo Editorial 2.0)', () => {
  it('uses a clean 4-column calendar grid and responsive step track on mobile booking', () => {
    const mobile = appointment.slice(appointment.lastIndexOf('@media (max-width: 760px)'))
    expect(mobile).toMatch(/\.appointment-dates[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
    expect(appointment).toContain('class="appointment-progress"')
  })

  it('uses an unframed editorial store header with 4 responsive category tabs and clean 1-col mobile products', () => {
    const mobile = shop.slice(shop.lastIndexOf('@media (max-width: 760px)'))
    expect(mobile).toMatch(/\.shop-category-nav\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/)
    expect(mobile).toMatch(/\.product-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/)
    expect(shop).not.toContain('motion-v')
    expect(shop).not.toContain('shop-object-studio-surface')
  })
})
