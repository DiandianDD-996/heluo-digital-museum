import { writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const base = args.find(arg => !arg.startsWith('--')) ?? 'http://127.0.0.1:5197'
const poster = args.includes('--poster')
const relief = args.includes('--relief')
if (poster && relief) throw new Error('Choose one render mode')
const browser = await chromium.launch({
  executablePath: process.env.LUOSHENG_CHROME || undefined,
  args: ['--enable-unsafe-swiftshader'],
})

try {
  const page = await browser.newPage()
  await page.route('**/luosheng-plate-studio', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Model plate studio</title>' }))
  await page.goto(new URL('/luosheng-plate-studio', base).href)
  const plates = await page.evaluate(async ({ poster, relief }) => {
    const prefix = '/node_modules/.vite/deps/'
    const [three, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
      import(prefix + 'three.js'),
      import(prefix + 'three_examples_jsm_loaders_GLTFLoader__js.js'),
      import(prefix + 'three_examples_jsm_libs_meshopt_decoder__module__js.js'),
      import(prefix + 'three_examples_jsm_environments_RoomEnvironment__js.js'),
    ])
    const renderer = new three.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(poster ? 980 : relief ? 1100 : 480, poster ? 1180 : relief ? 620 : 480)
    const scene = new three.Scene()
    const pmrem = new three.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const environment = pmrem.fromScene(room, .04)
    scene.environment = environment.texture
    scene.environmentIntensity = .72
    const { scene: model } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/media/models/heluo-bronze-ding-v5.5.glb')
    const box = new three.Box3().setFromObject(model)
    const center = box.getCenter(new three.Vector3())
    const size = box.getSize(new three.Vector3())
    const scale = 2.55 / Math.max(size.x, size.y, size.z)
    model.scale.setScalar(scale)
    model.position.copy(center.multiplyScalar(-scale))
    scene.add(model, new three.HemisphereLight(0xf1faf7, 0x736d5f, 1.15))
    const camera = new three.OrthographicCamera(-1.63, 1.63, 1.63, -1.63, .1, 50)
    const key = new three.DirectionalLight(0xffedd8, 2.1)
    const fill = new three.DirectionalLight(0xe0f1ff, .85)
    scene.add(key, fill)
    if (relief) {
      // Crop within the front belly using the same direction as the guide's front preset.
      camera.position.set(0, .5, 9.7)
      camera.lookAt(0, 0, 0)
      camera.left = -.69
      camera.right = .69
      camera.top = .55
      camera.bottom = camera.top - 1.38 * 620 / 1100
      camera.updateProjectionMatrix()
      renderer.toneMapping = three.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.15
      key.position.set(-4, 4.8, 3.5)
      key.intensity = 3.1
      fill.position.set(4, 1, 6)
      renderer.render(scene, camera)
      const data = renderer.domElement.toDataURL('image/webp', .9)
      if (!data.startsWith('data:image/webp;base64,')) throw new Error('WebP encoding unavailable')
      return { relief: data.split(',')[1] }
    }
    if (poster) {
      renderer.toneMapping = three.ACESFilmicToneMapping
      renderer.toneMappingExposure = 1.22
      scene.environmentIntensity = .9
      const aspect = 980 / 1180
      camera.left = -1.64 * aspect
      camera.right = 1.64 * aspect
      camera.top = 1.64
      camera.bottom = -1.64
      camera.updateProjectionMatrix()
      camera.position.set(3.05, 2.47, 9)
      camera.lookAt(0, .12, 0)
      key.position.set(-4, 5, 5)
      key.intensity = 3.2
      fill.position.set(4, 1, 4)
      fill.intensity = 1.45
      const rim = new three.DirectionalLight(0xe7f5e8, 2.4)
      rim.position.set(2, 4, -5)
      scene.add(rim)
      renderer.render(scene, camera)
      return Object.fromEntries([980, 960, 640, 320].map(width => {
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = Math.round(width * 1180 / 980)
        const context = canvas.getContext('2d')
        context.imageSmoothingQuality = 'high'
        context.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height)
        const data = canvas.toDataURL('image/webp', .87)
        if (!data.startsWith('data:image/webp;base64,')) throw new Error('WebP encoding unavailable')
        return [width, data.split(',')[1]]
      }))
    }
    const plates = {}
    for (const [name, direction] of Object.entries({
      top: [0, 9.45, .8],
      side: [-9.7, .25, 0],
      back: [0, .5, -9.7],
    })) {
      const [x, y, z] = direction
      camera.position.set(x, y, z)
      camera.lookAt(0, 0, 0)
      key.position.set(x - 3, y + 4.5, z + 2.7)
      fill.position.set(x + 4, y + 1.4, z - 2)
      renderer.render(scene, camera)
      const data = renderer.domElement.toDataURL('image/webp', .94)
      if (!data.startsWith('data:image/webp;base64,')) throw new Error('WebP encoding unavailable')
      plates[name] = data.split(',')[1]
    }
    environment.dispose()
    room.dispose()
    pmrem.dispose()
    renderer.dispose()
    return plates
  }, { poster, relief })
  for (const [view, data] of Object.entries(plates)) {
    const bytes = Buffer.from(data, 'base64')
    const target = !poster
      ? `../src/assets/luosheng-ding-${view}.webp`
      : view === '980'
        ? '../public/media/exhibits/heluo-bronze-ding-v5.4-cover.webp'
        : `../public/media/responsive/heluo-bronze-ding-v5.4-cover-${view}w.webp`
    await writeFile(new URL(target, import.meta.url), bytes)
    console.log(`${view}: ${bytes.length} bytes`)
  }
} finally {
  await browser.close()
}
