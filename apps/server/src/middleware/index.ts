import Elysia from 'elysia'
import { Cookie } from '../../../../shared/types'
import { verifyToken } from '@/utils'

const app = new Elysia({ name: 'auth-middleware' })
  .state('userId', '')
  .onBeforeHandle(({ cookie, store }) => {
    try {
      const token = cookie[Cookie.AccessToken]?.value
      if (token) {
        const decoded = verifyToken(token)
        store.userId = decoded.userId
      }
    }
    catch (err) {
      console.error('verifyToken failed:', err instanceof Error ? err.message : err)
      store.userId = ''
    }
  })
  .macro(({ onBeforeHandle }) => ({
    requiredAuth(bool: boolean) {
      onBeforeHandle(({ set, store }) => {
        if (!bool)
          return

        if (!store.userId) {
          set.status = 401
          return { message: 'Unauthorized' }
        }
      })
    },
  }))
  .as('global')

export default app