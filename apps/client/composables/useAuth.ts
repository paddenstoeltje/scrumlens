import { useStorage } from '@vueuse/core'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '~/services/api'
import type { Signin, FixedLogin } from '~/services/api/generated'
import { useToast } from '@/components/ui/shadcn/toast/use-toast'
import { useUser } from './useUser'
import { useAppLoadingIndicator } from '@/composables/useLoadingIndicator'

export const authStore = useStorage('isAuth', false)
export const teamIdStore = useStorage<string | null>('teamId', null)

const { toast } = useToast()
const { userRaw } = useUser()

const isAuth = computed(() => authStore.value === true)

async function login(body: Signin) {
  const { start, finish } = useAppLoadingIndicator()

  try {
    start()
    await api.auth.postAuthSignin(body)
    authStore.value = true
    teamIdStore.value = null
    return true
  }
  catch (err) {
    console.error(err)
    toast({
      title: 'Something went wrong.',
      description: 'Invalid login or password.',
      variant: 'destructive',
    })
    return false
  }
  finally {
    finish()
  }
}

async function fixedLogin(username: string, password: string) {
  const { start, finish } = useAppLoadingIndicator()

  try {
    start()
    const response = await api.fixedAuth.postFixedAuthLogin({ username, password })
    authStore.value = true
    teamIdStore.value = response.data.teamId
    return true
  }
  catch (err) {
    console.error(err)
    toast({
      title: 'Something went wrong.',
      description: 'Invalid login or password.',
      variant: 'destructive',
    })
    return false
  }
  finally {
    finish()
  }
}

async function logout(options: { redirect?: boolean } = {}) {
  const { start, finish } = useAppLoadingIndicator()

  try {
    start()
    await api.auth.postAuthLogout()
    authStore.value = false
    userRaw.value = undefined

    if (options.redirect !== false) {
      await navigateTo('/login')
    }
  }
  catch (err) {
    console.error(err)
  }
  finally {
    finish()
  }
}

async function signupGuest(name: string) {
  const { start, finish } = useAppLoadingIndicator()

  try {
    start()
    await api.auth.postAuthSignupGuest({ name })
    authStore.value = true
    return true
  }
  catch (err) {
    console.error(err)
    toast({
      title: 'Something went wrong.',
      description: 'Please try again later.',
      variant: 'destructive',
    })
    return false
  }
  finally {
    finish()
  }
}

async function restoreAuthState() {
  // On client-side page load, try to restore auth from cookies
  if (!authStore.value) {
    try {
      const response = await api.users.getUsersMe()
      if (response.data) {
        userRaw.value = response.data
        authStore.value = true
      }
    }
    catch (err) {
      // Cookie/token is invalid or expired, stay logged out
      authStore.value = false
    }
  }
}

export function useAuth() {
  return {
    authStore,
    teamIdStore,
    isAuth,
    userRaw,
    login,
    fixedLogin,
    logout,
    signupGuest,
    restoreAuthState,
  }
}
