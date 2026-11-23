import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/00-layers.css'
import './styles/01-tokens.css'
import './styles/02-reset-base.css'
import './styles/03-surfaces.css'
import './styles/04-components.css'
import './styles/05-shell.css'
import './styles/06-motion.css'
import App from './App.vue'
import router from './router'
import { pointerSurface } from './directives/pointerSurface'
import { artifactAwaken } from './directives/artifactAwaken'
import { applyDevicePerformanceTier } from './lib/devicePerformance'

const performanceTier = applyDevicePerformanceTier()
const mountApplication = () => {
  createApp(App)
    .use(createPinia())
    .use(router)
    .directive('pointer-surface', pointerSurface)
    .directive('artifact-awaken', artifactAwaken)
    .mount('#app')
}

if (performanceTier === 'constrained') {
  window.setTimeout(mountApplication, 0)
} else {
  mountApplication()
}
