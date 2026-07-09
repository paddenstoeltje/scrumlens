import Elysia from 'elysia'
import { Cookie } from '../../../../shared/types'
import { authDTO } from '@/dto/auth'
import { User } from '@/models/user'
import {
  generateAccessTokens,
  resolveCookieDomain,
  verifyToken,
} from '@/utils'
import middleware from '@/middleware'

const app = new Elysia({ prefix: '/auth' })

function setAuthCookies(
  cookie: any,
  domain: string,
  accessToken: string,
  refreshToken: string,
) {
  const expiredCookie = {
    value: '',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    expires: new Date(0),
  } as const

  cookie[Cookie.AccessToken].set(expiredCookie)
  cookie[Cookie.AccessToken].set({
    value: accessToken,
    httpOnly: true,
    path: '/',
    domain,
    sameSite: 'lax',
    secure: false,
  })

  cookie[Cookie.RefreshToken].set(expiredCookie)
  cookie[Cookie.RefreshToken].set({
    value: refreshToken,
    httpOnly: true,
    path: '/',
    domain,
    sameSite: 'lax',
    secure: false,
  })
}

function clearAuthCookies(cookie: any, domain: string) {
  const expiredCookie = {
    value: '',
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    expires: new Date(0),
  } as const

  cookie[Cookie.AccessToken].set(expiredCookie)
  cookie[Cookie.AccessToken].set({ ...expiredCookie, domain })
  cookie[Cookie.RefreshToken].set(expiredCookie)
  cookie[Cookie.RefreshToken].set({ ...expiredCookie, domain })
}

app
  .use(middleware)
  .use(authDTO)
  .post(
    '/signup',
    async ({ set }) => {
      set.status = 410
      throw new Error('Personal signup is disabled. Use team login.')
    },
    {
      body: 'signup',
      detail: {
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/signup-guest',
    async ({ set }) => {
      set.status = 410
      throw new Error('Guest signup is disabled. Use team login.')
    },
    {
      body: 'signupGuest',
      detail: {
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/signin',
    async ({ set }) => {
      set.status = 410
      throw new Error('Personal signin is disabled. Use team login.')
    },
    {
      body: 'signin',
      detail: {
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/logout',
    async ({ cookie, request }) => {
      clearAuthCookies(cookie, resolveCookieDomain(request))
    },
    {
      detail: {
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/refresh',
    async ({ cookie, set, request }) => {
      const domain = resolveCookieDomain(request)

      try {
        const decoded = verifyToken(cookie[Cookie.RefreshToken]?.value || '')
        const { accessToken, refreshToken } = generateAccessTokens(decoded.userId)
        setAuthCookies(cookie, domain, accessToken, refreshToken)
      }
      catch {
        clearAuthCookies(cookie, domain)

        set.status = 400
        return { message: 'Invalid token' }
      }
    },
    {
      detail: {
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/verify',
    async ({ set }) => {
      set.status = 410
      throw new Error('Account verification is disabled. Use team login.')
    },
    {
      body: 'verifyToken',
      detail: {
        tags: ['Auth'],
      },
    },
  )
  .post(
    '/verify-resend',
    async ({ set }) => {
      set.status = 410
      throw new Error('Verification resend is disabled. Use team login.')
    },
    {
      requiredAuth: true,
      detail: {
        tags: ['Auth'],
      },
    },
  )

export default app
