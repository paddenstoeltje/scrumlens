import Elysia, { t } from 'elysia'
import { Cookie } from '../../../../shared/types'
import { authDTO } from '@/dto/auth'
import { User } from '@/models/user'
import { checkPassword, generateAccessTokens, resolveCookieDomain } from '@/utils'
import middleware from '@/middleware'

/**
 * Team authentication route for shared team access.
 * Users log in with a team key (stored in User.teamId) and a shared password.
 * Legacy passwords.md entries are still accepted as fallback.
 */

function loadPasswords(): Record<string, string> {
  try {
    const fs = require('node:fs')
    const path = require('node:path')

    const possiblePaths = [
      path.join(process.cwd(), 'passwords.md'),
      path.join(__dirname, '../../../..', 'passwords.md'),
      path.join('/app', 'passwords.md'),
    ]

    let content: string | null = null
    for (const p of possiblePaths) {
      try {
        content = fs.readFileSync(p, 'utf-8')
        break
      }
      catch {
        continue
      }
    }

    if (!content) {
      console.warn('passwords.md not found - fixed auth will use database only')
      return {}
    }

    const passwords: Record<string, string> = {}
    const lines = content.split('\n')

    for (const line of lines) {
      const match = line.match(/^\|\s*(team\d+|admin)\s*\|\s*`([^`]+)`/)
      if (match)
        passwords[match[1]] = match[2]
    }

    return passwords
  }
  catch {
    return {}
  }
}

let PASSWORDS_CACHE: Record<string, string> | null = null

function getPasswords(): Record<string, string> {
  if (PASSWORDS_CACHE === null)
    PASSWORDS_CACHE = loadPasswords()
  return PASSWORDS_CACHE
}

function setAuthCookies(
  cookie: any,
  domain: string,
  accessToken: string,
  refreshToken: string,
) {
  cookie[Cookie.AccessToken].set({
    value: accessToken,
    httpOnly: true,
    path: '/',
    domain,
    sameSite: 'lax',
    secure: false,
    maxAge: 15 * 60,          // 15 minutes, matches JWT expiry
  })

  cookie[Cookie.RefreshToken].set({
    value: refreshToken,
    httpOnly: true,
    path: '/',
    domain,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60, // 7 days, matches JWT expiry
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

const app = new Elysia({ prefix: '/fixed-auth' })

app
  .use(middleware)
  .use(authDTO)
  .post(
    '/login',
    async ({ body, set, cookie, request }) => {
      const { username, password } = body

      if (!username || !password) {
        set.status = 400
        throw new Error('Username and password are required')
      }

      const teamKey = username.trim()

      if (!teamKey || teamKey.length < 2 || teamKey.length > 64) {
        set.status = 400
        throw new Error('Invalid team key')
      }

      let user = await User.findOne({ teamId: teamKey })
      let isValidPassword = false

      if (user)
        isValidPassword = checkPassword(password, user.password, user.salt!)

      if (!isValidPassword) {
        const filePasswords = getPasswords()
        if (filePasswords[teamKey])
          isValidPassword = password === filePasswords[teamKey]
      }

      if (!isValidPassword) {
        set.status = 401
        throw new Error('Invalid login or password')
      }

      if (!user) {
        const email = `${teamKey}@scrumlens.local`
        user = new User({
          name: teamKey === 'admin' ? 'Admin' : teamKey,
          email,
          password: '',
          teamId: teamKey,
          role: teamKey === 'admin' ? 'admin' : 'editor',
          isActive: true,
          isGuest: false,
        })

        ;(user as any).password = password
        await user.save()
      }

      if (user.teamId !== teamKey) {
        set.status = 403
        throw new Error('Access denied')
      }

      user.isActive = true
      await user.save()

      const { accessToken, refreshToken } = generateAccessTokens(user.id)
      const domain = resolveCookieDomain(request)
      setAuthCookies(cookie, domain, accessToken, refreshToken)

      return {
        message: 'Login successful',
        userId: user.id,
        teamId: user.teamId,
      }
    },
    {
      body: t.Object({
        username: t.String(),
        password: t.String(),
      }),
      detail: {
        tags: ['FixedAuth'],
        description: 'Login with fixed team credentials (team1-team24, admin)',
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
        tags: ['FixedAuth'],
      },
    },
  )

export default app
