// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: false },
  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/color-mode',
    'nuxt-svgo',
    'shadcn-nuxt',
  ],
  tailwindcss: {
    config: {
      safelist: ['dark'],
    },
  },
  colorMode: {
    classSuffix: '',
  },
  shadcn: {
    componentDir: './components/ui/shadcn',
  },
  runtimeConfig: {
    proxyUrl: 'http://localhost:3030',
    public: {
      websocketUrl: 'http://localhost:3030',
    },
  },
  ssr: false,
  nitro: {
    // Build as static SPA so index.html is generated in .output/public/
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
  },
  vite: (() => {
    const devtoolsDisabled = process.env.NODE_ENV === 'production' || !process.env.NUXT_DEV;
    return {
      resolve: {
        alias: {
          // When devtools are disabled in production, point the package to
          // a local no-op shim that prevents any devtools code from loading.
          '@vue/devtools-api': devtoolsDisabled
            ? '/@fs/' + __dirname + '/devtools-shim.mjs'
            : '@vue/devtools-api/lib/esm/index.js'
        }
      },
      ssr: {
        noExternal: ['@vue/devtools-api']
      },
      optimizeDeps: {
        exclude: ['@vue/devtools-api']
      }
    };
  })()
})