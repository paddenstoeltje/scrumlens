import Elysia, { t } from 'elysia'
import { Cookie } from '../../../../shared/types'
import { authDTO } from '@/dto/auth'
import { User } from '@/models/user'
import { checkPassword, generateAccessTokens } from '@/utils'
import middleware from '@/middleware'

/**
 * Fixed authentication route for team-based access.
 * Users log in with username (team1-team24, admin) and a shared password.
 * The email is derived as: username@scrumlens.local
 */

// Load passwords from the passwords.md file at runtime
function loadPasswords(): Record<string, string> {
  try {
    const fs = require('node:fs')
    const path = require('node:path')
    
    // Try multiple possible locations for the passwords file
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
      } catch {
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
      // Match password table rows: | team1 | `password` | Team X |
      const match = line.match(/^\|\s*(team\d+|admin)\s*\|\s*`([^`]+)`/)
      if (match) {
        passwords[match[1]] = match[2]
      }
    }
    
    return passwords
  } catch {
    return {}
  }
}

// Passwords cache (loaded once at startup)
let PASSWORDS_CACHE: Record<string, string> | null = null

function getPasswords(): Record<string, string> {
  if (PASSWORDS_CACHE === null) {
    PASSWORDS_CACHE = loadPasswords()
  }
  return PASSWORDS_CACHE
}

const app = new Elysia({ prefix: '/fixed-auth' })

app
  .use(middleware)
  .use(authDTO)
  /**
   * Fixed login for team users (team1-team24, admin)
   * Body: { username: 'team1', password: '...' }
   */
  .post(
    '/login',
    async ({ body, set, cookie }) => {
      const { username, password } = body

      if (!username || !password) {
        set.status = 400
        throw new Error('Username and password are required')
      }

      // Validate username format
      if (username !== 'admin' && !/^team\d+$/.test(username)) {
        set.status = 400
        throw new Error('Invalid username')
      }

      // Get passwords from file or database
      const filePasswords = getPasswords()
      
      // Check password from file first, then fall back to database
      let isValidPassword = false
      
      if (filePasswords[username]) {
        isValidPassword = password === filePasswords[username]
      }

      // If not in file passwords, check database
      if (!isValidPassword) {
        const user = await User.findOne({
          teamId: username,
        })

        if (user) {
          isValidPassword = checkPassword(password, user.password, user.salt!)
        }
      }

      if (!isValidPassword) {
        set.status = 401
        throw new Error('Invalid login or password')
      }

      // Find or create user with this teamId
      let user = await User.findOne({ teamId: username })

      if (!user) {
        // Auto-create user if they don't exist
        const email = `${username}@scrumlens.local`
        user = new User({
          name: username === 'admin' ? 'Admin' : `Team ${username.replace('team', '')}`,
          email,
          password: '', // Will be set by the pre-save hook if needed
          teamId: username,
          isActive: true,
          isGuest: false,
        })
        
        // Set the plain password so the hash gets generated
        ;(user as any).password = password
        await user.save()
      }

      // Ensure user has correct teamId and is active
      if (user.teamId !== username) {
        set.status = 403
        throw new Error('Access denied')
      }

      user.isActive = true
      await user.save()

      const { accessToken, refreshToken } = generateAccessTokens(user.id)

      // For proxy scenarios, domain is set but secure is false
      // The proxy handles HTTPS → HTTP translation
      const cookieDomain = Bun.env.COOKIE_DOMAIN || 'campusdenayer.be'

      cookie[Cookie.AccessToken].set({
        value: accessToken,
        httpOnly: true,
        path: '/',
        domain: cookieDomain,
        sameSite: 'lax',
        secure: false,
      })

      cookie[Cookie.RefreshToken].set({
        value: refreshToken,
        httpOnly: true,
        path: '/',
        domain: cookieDomain,
        sameSite: 'lax',
        secure: false,
      })

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
  /**
   * Logout for fixed auth
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
        tags: ['FixedAuth'],
      },
    },
  )

export default app