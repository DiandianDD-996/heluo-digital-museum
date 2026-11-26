import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'

const isVitest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'

function mobileHomePreload(): Plugin {
  return {
    name: 'heluo-mobile-home-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle, chunk: entry }) {
        if (!bundle || !entry) return
        const home = Object.values(bundle).find(chunk => chunk.type === 'chunk'
          && chunk.facadeModuleId?.endsWith('/src/views/HomeView.vue'))
        if (!home || home.type !== 'chunk') return
        const scripts = new Set<string>([entry.fileName])
        const styles = new Set<string>()
        function visit(file: string) {
          if (scripts.has(file)) return
          const chunk = bundle?.[file]
          if (chunk?.type !== 'chunk') return
          scripts.add(file)
          chunk.viteMetadata?.importedCss.forEach(css => styles.add(css))
          chunk.imports.forEach(visit)
        }
        visit(home.fileName)
        scripts.delete(entry.fileName)
        const assets = [...[...scripts].map(file => [file, 'script']), ...[...styles].map(file => [file, 'style'])]
        const marker = '/* mobile-home-assets */ []'
        if (!html.includes(marker)) throw new Error('Mobile homepage preload marker is missing')
        return html.replace(marker, JSON.stringify(assets))
      },
    },
  }
}

export default defineConfig({
  // JSDOM does not need Vite's production asset URL imports. Keeping the
  // transform disabled only in Vitest also lets view-level tests mount pages
  // that use root-relative public assets without asking Node to load them.
  plugins: [vue(isVitest ? { template: { transformAssetUrls: false } } : {}), mobileHomePreload()],
  server: {
    proxy: {
      '/api': process.env.MUSEUM_DEV_API_URL ?? 'http://localhost:8080',
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
})
