import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin, type PluginOption } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

function serveOnly(plugin: PluginOption): PluginOption {
  if (Array.isArray(plugin)) {
    return plugin.map(serveOnly)
  }

  if (plugin && typeof plugin === 'object' && 'name' in plugin) {
    return { ...(plugin as Plugin), apply: 'serve' }
  }

  return plugin
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), serveOnly(vueDevTools())],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
