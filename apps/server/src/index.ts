import { styleText } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { Elysia, t } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import mongoose from 'mongoose'
import { logger } from '@bogeychan/elysia-logger'
import { version } from '../package.json'
import auth from './routes/auth'
import fixedAuth from './routes/fixedAuth'
import users from './routes/users'
import adminUsers from './routes/admin-users'
import boards from './routes/boards'
import notes from './routes/notes'
import media from './routes/media'
import polls from './routes/polls'
import comments from './routes/comments'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

mongoose.connect(Bun.env.MONGO_URL || 'mongodb://localhost:27017/scrumlens')

// Find the client static files directory
const STATIC_PATH = path.join(__dirname, '../../../apps/client/.output/public')

const app = new Elysia()
app
  .use(
    cors({
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }),
  )
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Scrumlens API',
          version,
        },
        tags: [
          { name: 'Auth', description: 'Authentication' },
          { name: 'Admin Users', description: 'Admin user management' },
        ],
      },
    }),
  )
  .use(
    logger({
      level: 'error',
    }),
  )

// Mount all API routes under /api prefix
const apiRoutes = new Elysia({ prefix: '/api' })
  .use(fixedAuth)
  .use(auth)
  .use(users)
  .use(adminUsers)
  .use(boards)
  .use(notes)
  .use(media)
  .use(polls)
  .use(comments)

app.use(apiRoutes)

// Static file serving - manual implementation (bypasses @elysiajs/static issues)
if (fs.existsSync(STATIC_PATH)) {
  // Read index.html once at startup
  const indexPath = path.join(STATIC_PATH, 'index.html')
  const indexHtml = fs.readFileSync(indexPath, 'utf-8')

  // Serve root and SPA routes with index.html
  app.get('/', ({ set }) => {
    set.headers['content-type'] = 'text/html; charset=utf-8'
    return indexHtml
  })

  // SPA fallback for all other non-API routes
  app.get('*', ({ request, set }) => {
    const url = new URL(request.url)

    // Skip API routes and swagger
    if (url.pathname.startsWith('/api/') || url.pathname === '/swagger') {
      return 'NOT_FOUND'
    }

    // Serve index.html for SPA routing
    set.headers['content-type'] = 'text/html; charset=utf-8'
    return indexHtml
  })

  // Serve static assets from _nuxt directory
  const NUXT_PATH = path.join(STATIC_PATH, '_nuxt')
  if (fs.existsSync(NUXT_PATH) && fs.statSync(NUXT_PATH).isDirectory()) {
    // List all files in _nuxt recursively
    const staticFiles: Map<string, Buffer> = new Map()

    function scanStaticDir(dir: string, base: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        const relativePath = path.join(base, entry.name).replace(/\\/g, '/')
        if (entry.isDirectory()) {
          scanStaticDir(fullPath, relativePath)
        } else {
          staticFiles.set(relativePath, fs.readFileSync(fullPath))
        }
      }
    }

    scanStaticDir(NUXT_PATH, '/_nuxt')

    // Serve cached static files
    app.get('/_nuxt/*', ({ request, set }) => {
      const url = new URL(request.url)
      const fileContent = staticFiles.get(url.pathname)

      if (fileContent) {
        // Set appropriate content types based on file extension
        const ext = url.pathname.split('.').pop()?.toLowerCase() || ''
        const contentTypes: Record<string, string> = {
          js: 'application/javascript; charset=utf-8',
          css: 'text/css; charset=utf-8',
          mjs: 'application/javascript; charset=utf-8',
          json: 'application/json; charset=utf-8',
          svg: 'image/svg+xml; charset=utf-8',
          png: 'image/png',
          jpg: 'image/jpeg',
          webp: 'image/webp',
          wasm: 'application/wasm',
        }
        set.headers['content-type'] = contentTypes[ext] || 'application/octet-stream'
        return fileContent
      }

      return 'NOT_FOUND'
    })
  }

  // Serve favicon if it exists
  const faviconPath = path.join(STATIC_PATH, 'favicon.ico')
  if (fs.existsSync(faviconPath)) {
    const faviconBuffer = fs.readFileSync(faviconPath)
    app.get('/favicon.ico', ({ set }) => {
      set.headers['content-type'] = 'image/x-icon'
      return faviconBuffer
    })
  }
}

app.listen(Bun.env.API_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    styleText('green', `\nServer is running\n`),
    styleText('green', 'API: '),
    styleText('cyan', `http://localhost:${Bun.env.API_PORT}\n`),
    styleText('green', 'Docs:'),
    styleText('cyan', `http://localhost:${Bun.env.API_PORT}/swagger\n`),
  )
})