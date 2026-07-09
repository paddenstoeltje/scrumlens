/**
 * Loading Indicator Composable
 * Provides start/finish methods to control the Nuxt loading indicator
 */

export function useAppLoadingIndicator() {
  let timer: ReturnType<typeof setTimeout> | null = null

  return {
    /** Start the loading indicator */
    start(): void {
      // Use Nuxt's built-in loading indicator if available
      const nuxtApp = useNuxtApp()
      if (nuxtApp && typeof nuxtApp.callHook === 'function') {
        nuxtApp.callHook('app:loading:start')
      }
    },

    /** Finish the loading indicator */
    finish(): void {
      // Delay hiding to prevent flickering
      timer = setTimeout(() => {
        const nuxtApp = useNuxtApp()
        if (nuxtApp && typeof nuxtApp.callHook === 'function') {
          nuxtApp.callHook('app:loading:end')
        }
      }, 200)
    },

    /** Hide the loading indicator immediately */
    hide(): void {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      const nuxtApp = useNuxtApp()
      if (nuxtApp && typeof nuxtApp.callHook === 'function') {
        nuxtApp.callHook('app:loading:end')
      }
    },
  }
}