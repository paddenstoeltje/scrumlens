export default defineNuxtRouteMiddleware(async (to) => {
  if (to.name === 'auth-verify' || to.name === 'login')
    return

  const { isAuth, restoreAuthState } = useAuth()
  const { userRaw, getUser } = useUser()

  // Try to restore auth from cookies on page load
  if (!userRaw.value) {
    await restoreAuthState()
  }

  // If auth is set but user not loaded, fetch user data
  if (isAuth.value && !userRaw.value) {
    await getUser()
  }
})
