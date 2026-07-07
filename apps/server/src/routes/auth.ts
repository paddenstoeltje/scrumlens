import Elysia from 'elysia'
import { nanoid } from 'nanoid'
import { Cookie } from '../../../../shared/types'
import { authDTO } from '@/dto/auth'
import { User } from '@/models/user'
import {
  checkPassword,
  generateAccessTokens,
  generateGuestEmail,
  verifyToken,
} from '@/utils'
import { sendVerifyEmail } from '@/services/email'
import middleware from '@/middleware'

const app = new Elysia({ prefix: '/auth' })

app
  .use(middleware)
  .use(authDTO)
  /**
   * Регистрация
   */
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
  /**
   * Регистрация гостя
   */
  .post(
    '/signup-guest',
    async ({ body, cookie }) => {
      const user = new User(body)

      user.password = nanoid(12)
      user.email = generateGuestEmail()
      user.isGuest = true

      await user.save()

      const { accessToken, refreshToken } = generateAccessTokens(user.id)

      const domain = Bun.env.COOKIE_DOMAIN || 'campusdenayer.be'

      cookie[Cookie.AccessToken].set({
        value: accessToken,
        httpOnly: true,
        path: '/',
        domain: domain,
        sameSite: 'lax',
        secure: false,
      })

      cookie[Cookie.RefreshToken].set({
        value: refreshToken,
        httpOnly: true,
        path: '/',
        domain: domain,
        sameSite: 'lax',
        secure: false,
      })
    },
    {
      body: 'signupGuest',
      detail: {
        tags: ['Auth'],
      },
    },
  )
  /**
   * Авторизация
   */
  .post(
    '/signin',
    async ({ body, set, cookie }) => {
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

      const domain = Bun.env.COOKIE_DOMAIN || 'campusdenayer.be'

      cookie[Cookie.AccessToken].set({
        value: accessToken,
        httpOnly: true,
        path: '/',
        domain: domain,
        sameSite: 'lax',
        secure: false,
      })

      cookie[Cookie.RefreshToken].set({
        value: refreshToken,
        httpOnly: true,
        path: '/',
        domain: domain,
        sameSite: 'lax',
        secure: false,
      })
    },
    {
      body: 'signin',
      detail: {
        tags: ['Auth'],
      },
    },
  )
  /**
   * Выход
   */
  .post(
    '/logout',
    async ({ cookie }) => {
      const domain = Bun.env.COOKIE_DOMAIN || 'campusdenayer.be'

      cookie[Cookie.AccessToken].set({
        value: '',
        httpOnly: true,
        path: '/',
        domain: domain,
        sameSite: 'lax',
        secure: false,
      })
      cookie[Cookie.RefreshToken].set({
        value: '',
        httpOnly: true,
        path: '/',
        domain: domain,
        sameSite: 'lax',
        secure: false,
      })
    },
    {
      detail: {
        tags: ['Auth'],
      },
    },
  )
  /**
   * Обновление токена
   */
  .post(
    '/refresh',
    async ({ cookie, set }) => {
      const domain = Bun.env.COOKIE_DOMAIN || 'campusdenayer.be'

      try {
        const decoded = verifyToken(cookie[Cookie.RefreshToken]?.value || '')
        const { accessToken, refreshToken } = generateAccessTokens(
          decoded.userId,
        )

        cookie[Cookie.AccessToken].set({
          value: accessToken,
          httpOnly: true,
          path: '/',
          domain: domain,
          sameSite: 'lax',
          secure: false,
        })

        cookie[Cookie.RefreshToken].set({
          value: refreshToken,
          httpOnly: true,
          path: '/',
          domain: domain,
          sameSite: 'lax',
          secure: false,
        })
      }
      catch {
        cookie[Cookie.AccessToken].set({
          value: '',
          httpOnly: true,
          path: '/',
          domain: domain,
          sameSite: 'lax',
          secure: false,
        })
        cookie[Cookie.RefreshToken].set({
          value: '',
          httpOnly: true,
          path: '/',
          domain: domain,
          sameSite: 'lax',
          secure: false,
        })

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
  /**
   * Верификация токена
   */
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

      await await sendVerifyEmail({
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
