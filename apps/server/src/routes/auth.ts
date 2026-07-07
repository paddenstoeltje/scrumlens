import Elysia from 'elysia'
import { nanoid } from 'nanoid'
import { Cookie } from '../../../../shared/types'
import { authDTO } from '@/dto/auth'
import { User } from '@/models/user'
import {
  checkPassword,
  generateAccessTokens,
  generateGuestEmail,
  resolveCookieDomain,
  verifyToken,
} from '@/utils'
import { sendVerifyEmail } from '@/services/email'
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
    async ({ body, set }) => {
      body.email = body.email.toLowerCase()

      try {
        const user = new User(body)
        await user.save()

        await sendVerifyEmail({
          email: user.email,
          userId: user.id,
          data: {
            username: user.name,
          },
        })
      }
      catch (err) {
        console.error(err)
        set.status = 400
      }
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
    async ({ body, cookie, request }) => {
      const user = new User(body)

      user.password = nanoid(12)
      user.email = generateGuestEmail()
      user.isGuest = true

      await user.save()

      const { accessToken, refreshToken } = generateAccessTokens(user.id)
      const domain = resolveCookieDomain(request)
      setAuthCookies(cookie, domain, accessToken, refreshToken)
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
    async ({ body, set, cookie, request }) => {
      const user = await User.findOne({
        email: {
          $regex: new RegExp(body.email, 'i'),
        },
      })

      if (!user) {
        set.status = 400
        throw new Error('Invalid login or password')
      }

      const isValidPassword = checkPassword(
        body.password,
        user.password,
        user.salt!,
      )

      if (!isValidPassword) {
        set.status = 400
        throw new Error('Invalid login or password')
      }

      const { accessToken, refreshToken } = generateAccessTokens(user.id)
      const domain = resolveCookieDomain(request)
      setAuthCookies(cookie, domain, accessToken, refreshToken)
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
    async ({ body, set }) => {
      try {
        const decoded = verifyToken(body.token)
        const user = await User.findById(decoded.userId)

        if (!user) {
          set.status = 400
          throw new Error('User not found')
        }

        user.isActive = true
        await user.save()

        return { message: 'Account verified' }
      }
      catch {
        set.status = 400
        return { message: 'Invalid token' }
      }
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
    async ({ store, set }) => {
      const user = await User.findById(store.userId)

      if (!user) {
        set.status = 400
        throw new Error('User not found')
      }

      await sendVerifyEmail({
        email: user.email,
        userId: user.id,
        data: {
          username: user.name,
        },
      })
    },
    {
      requiredAuth: true,
      detail: {
        tags: ['Auth'],
      },
    },
  )

export default app
