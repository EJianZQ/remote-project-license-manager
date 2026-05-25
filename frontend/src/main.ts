import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'

import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from './api/http'
import { useAuthStore } from './stores/auth'
import { i18n } from './i18n'
import './styles/base.css'
import './styles/theme.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(i18n)
app.use(naive)

setUnauthorizedHandler(() => {
  const auth = useAuthStore(pinia)
  const current = router.currentRoute.value
  auth.clear()

  if (current.name !== 'login') {
    void router.push({
      name: 'login',
      query: current.fullPath && current.fullPath !== '/' ? { redirect: current.fullPath } : undefined,
    })
  }
})

app.use(router)

app.mount('#app')
