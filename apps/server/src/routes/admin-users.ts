import Elysia, { t } from 'elysia'
import { WebSocketEvent } from '../../../../shared/types'
import { User } from '@/models/user'
import { Board } from '@/models/board'
import { Note } from '@/models/note'
import { Comment } from '@/models/comment'
import { Poll } from '@/models/poll'
import middleware from '@/middleware'
import { generateSalt, hashPassword } from '@/utils'

/**
 * Admin-only user management routes.
 * Requires authenticated admin user (role === 'admin').
 */

const app = new Elysia({ prefix: '/admin/users' })

app.use(middleware)

function normalizeTeamId(teamId?: string) {
  return teamId?.trim().toLowerCase()
}

function teamEmail(teamId: string) {
  return `${teamId}@scrumlens.local`
}

/**
 * Get all users (admin only)
 * Query params: limit, page, search, role, teamId
 */
app.get(
  '/',
  async ({ query, store, set }) => {
    const userId = store.userId as string
    
    // Check if user is admin
    const currentUser = await User.findById(userId)
    if (!currentUser || currentUser.role !== 'admin') {
      set.status = 403
      throw new Error('Admin access required')
    }
    
    const limit = parseInt(query.limit || '20')
    const page = parseInt(query.page || '1')
    const search = query.search || ''
    const role = query.role || ''
    const teamId = query.teamId || ''
    
    const skip = (page - 1) * limit
    
    // Build filter object
    const filter: any = {}
    if (role) filter.role = role
    if (teamId) filter.teamId = teamId
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ]
    }
    
    const total = await User.countDocuments(filter)
    const users = await User.find(filter)
      .skip(skip)
      .limit(limit)
      .select('-password -salt')
    
    return {
      users: JSON.parse(JSON.stringify(users)),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    }
  },
  {
    query: t.Object({
      limit: t.Optional(t.String()),
      page: t.Optional(t.String()),
      search: t.Optional(t.String()),
      role: t.Optional(t.String()),
      teamId: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Admin Users'],
      description: 'Get all users (admin only)',
    },
  },
)

/**
 * Get a single user by ID (admin only)
 */
app.get(
  '/:id',
  async ({ params, store, set }) => {
    const userId = store.userId as string
    
    // Check if user is admin
    const currentUser = await User.findById(userId)
    if (!currentUser || currentUser.role !== 'admin') {
      set.status = 403
      throw new Error('Admin access required')
    }
    
    const user = await User.findById(params.id).select('-password -salt')
    
    if (!user) {
      set.status = 404
      throw new Error('User not found')
    }
    
    return JSON.parse(JSON.stringify(user))
  },
  {
    detail: {
      tags: ['Admin Users'],
      description: 'Get user by ID (admin only)',
    },
  },
)

/**
 * Create a new user (admin only)
 */
app.post(
  '/',
  async ({ body, store, set }) => {
    const userId = store.userId as string
    
    // Check if user is admin
    const currentUser = await User.findById(userId)
    if (!currentUser || currentUser.role !== 'admin') {
      set.status = 403
      throw new Error('Admin access required')
    }
    
    const normalizedTeamId = normalizeTeamId(body.teamId)

    if (!normalizedTeamId) {
      set.status = 400
      throw new Error('teamId is required')
    }

    const existingTeam = await User.findOne({ teamId: normalizedTeamId })
    if (existingTeam) {
      set.status = 400
      throw new Error('teamId already exists')
    }

    const technicalEmail = teamEmail(normalizedTeamId)

    // Check if generated technical email already exists
    const existingUser = await User.findOne({ email: technicalEmail })
    if (existingUser) {
      set.status = 400
      throw new Error('Technical email already exists for this teamId')
    }
    
    // Validate role
    const validRoles = ['admin', 'viewer', 'editor']
    if (!validRoles.includes(body.role)) {
      set.status = 400
      throw new Error('Invalid role. Must be: admin, viewer, or editor')
    }
    
    const user = new User({
      name: body.name || normalizedTeamId,
      email: technicalEmail,
      password: body.password || 'changeme123',
      teamId: normalizedTeamId,
      role: body.role || 'editor',
      isActive: true,
      isGuest: false,
    })
    
    // Set plain password so pre-save hook hashes it
    ;(user as any).password = body.password || 'changeme123'
    await user.save()
    
    const createdUser = await User.findById(user.id).select('-password -salt')
    
    return {
      message: 'User created successfully',
      userId: user.id,
      ...JSON.parse(JSON.stringify(createdUser)),
    }
  },
  {
    body: t.Object({
      name: t.String(),
      teamId: t.String(),
      password: t.Optional(t.String()),
      role: t.Optional(t.String()),
    }),
    detail: {
      tags: ['Admin Users'],
      description: 'Create a new user (admin only)',
    },
  },
)

/**
 * Update an existing user (admin only)
 */
app.put(
  '/:id',
  async ({ params, body, store, set }) => {
    const userId = store.userId as string
    
    // Check if user is admin
    const currentUser = await User.findById(userId)
    if (!currentUser || currentUser.role !== 'admin') {
      set.status = 403
      throw new Error('Admin access required')
    }
    
    const user = await User.findById(params.id)
    
    if (!user) {
      set.status = 404
      throw new Error('User not found')
    }
    
    // Prevent admin from deleting themselves
    if (user.id === userId && body.role === undefined) {
      set.status = 400
      throw new Error('Cannot delete yourself')
    }
    
    if (body.name !== undefined) {
      user.name = body.name
    }
    
    if (body.password !== undefined) {
      ;(user as any).password = body.password
    }
    
    if (body.teamId !== undefined) {
      const normalizedTeamId = normalizeTeamId(body.teamId)

      if (!normalizedTeamId) {
        set.status = 400
        throw new Error('teamId is required')
      }

      const existingTeam = await User.findOne({
        teamId: normalizedTeamId,
        _id: { $ne: user.id },
      })

      if (existingTeam) {
        set.status = 400
        throw new Error('teamId already exists')
      }

      user.teamId = normalizedTeamId
      user.email = teamEmail(normalizedTeamId)
    }
    
    if (body.role !== undefined) {
      const validRoles = ['admin', 'viewer', 'editor']
      if (!validRoles.includes(body.role)) {
        set.status = 400
        throw new Error('Invalid role. Must be: admin, viewer, or editor')
      }
      user.role = body.role
    }
    
    if (body.isActive !== undefined) {
      user.isActive = body.isActive
    }
    
    await user.save()
    
    const updatedUser = await User.findById(user.id).select('-password -salt')
    
    return {
      message: 'User updated successfully',
      ...JSON.parse(JSON.stringify(updatedUser)),
    }
  },
  {
    body: t.Object({
      name: t.Optional(t.String()),
      password: t.Optional(t.String()),
      teamId: t.Optional(t.String()),
      role: t.Optional(t.String()),
      isActive: t.Optional(t.Boolean()),
    }),
    detail: {
      tags: ['Admin Users'],
      description: 'Update an existing user (admin only)',
    },
  },
)

/**
 * Delete a user (admin only)
 */
app.delete(
  '/:id',
  async ({ params, store, set }) => {
    const userId = store.userId as string
    
    // Check if user is admin
    const currentUser = await User.findById(userId)
    if (!currentUser || currentUser.role !== 'admin') {
      set.status = 403
      throw new Error('Admin access required')
    }
    
    // Prevent admin from deleting themselves
    if (params.id === userId) {
      set.status = 400
      throw new Error('Cannot delete yourself')
    }
    
    const user = await User.findById(params.id)
    
    if (!user) {
      set.status = 404
      throw new Error('User not found')
    }

    const boards = await Board.find({ userId: user._id }).select('_id').lean()
    const boardIds = boards.map(board => board._id)

    if (boardIds.length > 0) {
      await Board.deleteMany({ _id: { $in: boardIds } })
      await Note.deleteMany({ boardId: { $in: boardIds } })
      await Comment.deleteMany({ boardId: { $in: boardIds } })
      await Poll.deleteMany({ boardId: { $in: boardIds } })
    }
    
    await User.findByIdAndDelete(params.id)
    
    return { message: 'User deleted successfully' }
  },
  {
    detail: {
      tags: ['Admin Users'],
      description: 'Delete a user (admin only)',
    },
  },
)

/**
 * Reset a user's password (admin only)
 */
app.post(
  '/:id/reset-password',
  async ({ params, body, store, set }) => {
    const userId = store.userId as string
    
    // Check if user is admin
    const currentUser = await User.findById(userId)
    if (!currentUser || currentUser.role !== 'admin') {
      set.status = 403
      throw new Error('Admin access required')
    }
    
    const user = await User.findById(params.id)
    
    if (!user) {
      set.status = 404
      throw new Error('User not found')
    }
    
    // Set new password
    ;(user as any).password = body.newPassword
    await user.save()
    
    return { message: 'Password reset successfully' }
  },
  {
    body: t.Object({
      newPassword: t.String(),
    }),
    detail: {
      tags: ['Admin Users'],
      description: 'Reset a user password (admin only)',
    },
  },
)

export default app