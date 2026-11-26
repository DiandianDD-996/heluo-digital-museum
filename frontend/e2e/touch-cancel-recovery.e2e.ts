import { expect, test } from '@playwright/test'

test('图纹石板罗盘取消触控后忽略残留移动并恢复下一次手势', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/exhibits/river-map-stone-raking')

  const stage = page.getByTestId('raking-light-viewer')
  await expect(stage.locator('canvas')).toBeVisible()
  const compass = stage.getByTestId('raking-compass')
  const azimuth = stage.locator('.raking-telemetry__row strong').first()
  const readAzimuth = () => azimuth.textContent()

  const dispatch = async (type: string, x: number, y: number) => compass.evaluate((element, event) => {
    const pointerId = 41
    element.setPointerCapture = () => undefined
    element.releasePointerCapture = () => undefined
    element.dispatchEvent(new PointerEvent(event.type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: 'touch',
      clientX: event.x,
      clientY: event.y,
    }))
  }, { type, x, y })

  await dispatch('pointerdown', 80, 80)
  await dispatch('pointermove', 150, 95)
  const beforeCancel = await readAzimuth()
  await dispatch('pointercancel', 150, 95)
  await dispatch('pointermove', 270, 120)
  await expect(azimuth).toHaveText(beforeCancel ?? '')

  await dispatch('pointerdown', 90, 180)
  await dispatch('pointermove', 230, 120)
  await expect.poll(readAzimuth).not.toBe(beforeCancel)
  await dispatch('pointerup', 230, 120)
})
