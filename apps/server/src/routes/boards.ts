import Elysia from 'elysia'
import type { WebSocketEventData } from '../../../../shared/types'
import { WebSocketEvent } from '../../../../shared/types'
import { boardsDTO } from '@/dto/boards'
import { Board } from '@/models/board'
import { Note } from '@/models/note'
import { Comment } from '@/models/comment'
import { User } from '@/models/user'
import middleware from '@/middleware'
import { getExtendedBoardData } from '@/helpers/boards'
import { verifyToken } from '@/utils'
import { sendInviteEmail } from '@/services/email'

const app = new Elysia({ prefix: '/boards' })

const connections = new Set<{
  userId: string
  boardId: string
  wsId: string
}>()

async function withOwnerName(boards: any[]) {
  const ownerIds = [...new Set(boards.map(board => board.userId.toString()))]
  const owners = await User.find({ _id: { $in: ownerIds } }).select('_id name').lean()

  const ownerMap = new Map(owners.map((owner: any) => [owner._id.toString(), owner.name]))

  return boards.map(board => ({
    ...board,
    ownerName: ownerMap.get(board.userId.toString()) ?? 'Unknown',
  }))
}

function userSyncData(boardId: string) {
  return {
    type: 'user:sync',
    data: Array.from(connections)
      .filter(i => i.boardId === boardId)
      .map(i => i.userId),
  } as WebSocketEventData
}

app
  .use(middleware)
  .use(boardsDTO)
  .ws('/:id', {
    open(ws) {
      ws.subscribe(ws.data.params.id)
    },
    message(ws, message) {
      const m = message as WebSocketEventData

      if (m.type === 'user:connect') {
        connections.add({
          userId: m.data,
          boardId: ws.data.params.id,
          wsId: ws.id,
        })

        const payload = userSyncData(ws.data.params.id)

        ws.send(JSON.stringify(payload))
        ws.publish(ws.data.params.id, JSON.stringify(payload))
      }

      if (m.type === 'user:sync') {
        const payload = userSyncData(ws.data.params.id)

        ws.send(JSON.stringify(payload))
      }
    },
    close(ws) {
      connections.forEach((i) => {
        if (i.wsId === ws.id) {
          connections.delete(i)
        }
      })
    },
  })
  /**
   * Создание доски
   */
  .post(
    '/',
    async ({ body, store, set }) => {
      const user = await User.findById(store.userId)
      const boards = await Board.find({ userId: store.userId }).lean()

      if (!user) {
        set.status = 400
        throw new Error('User not found')
      }

      if ((user.isGuest || !user.isActive) && boards.length >= 1) {
        set.status = 403
        throw new Error('You are not allowed to create more boards')
      }

      const board = await Board.create({
        ...body,
        userId: user._id,
        participants: [
          {
            userId: user._id,
            role: 'admin',
          },
        ],
      })

      return {
        message: 'Board created',
        data: board._id,
      }
    },
    {
      body: 'boardAdd',
      requiredAuth: true,
      detail: {
        tags: ['Boards'],
      },
    },
  )
  /**
   * Отправка инвайт ссылки для доски пользователю
   */
  .post(
    '/:id/invite',
    async ({ params, body, set, store }) => {
      const emailList = body.email.split(',').map(i => i.trim())

      const board = await Board.findById(params.id)

      if (!board) {
        set.status = 400
        throw new Error('Board not found')
      }

      const user = await User.findById(store.userId)

      if (!user) {
        set.status = 400
        throw new Error('User not found')
      }

      const isAdmin = user.teamId === 'admin'

      if (!board.userId.equals(user._id) && !isAdmin) {
        set.status = 403
        throw new Error('You are not allowed to invite users to this board')
      }

      const users = await User.find({ email: { $in: emailList } })

      if (users.length === 0) {
        set.status = 400
        throw new Error('User not found')
      }

      const usersNotInBoard = users.filter(
        i => !board.participants.some(j => j.userId?.equals(i._id)),
      )

      await Promise.all(
        usersNotInBoard.map((user) => {
          return sendInviteEmail({
            email: user.email,
            userId: user.id,
            boardId: params.id,
            data: {
              username: user.name,
              boardName: board.title,
            },
          })
        }),
      )
    },
    {
      requiredAuth: true,
      body: 'boardSendInvite',
      detail: {
        tags: ['Boards'],
      },
    },
  )
  .post(
    '/invite-verify',
    async ({ body, set }) => {
      try {
        const decoded = verifyToken(body.token)

        const user = await User.findById(decoded.userId)
        const board = await Board.findById(decoded.boardId)

        if (!user) {
          set.status = 400
          throw new Error('User not found')
        }

        if (!board) {
          set.status = 400
          throw new Error('Board not found')
        }

        const isUserParticipant = board.participants.some(i =>
          i.userId?.equals(decoded.userId),
        )

        if (!isUserParticipant) {
          board.participants.push({
            userId: user._id,
            role: 'member',
          })
          await board.save()
        }
      }
      catch {
        set.status = 400
        throw new Error('Invalid token')
      }
    },
    {
      body: 'boardInviteVerify',
      detail: {
        tags: ['Boards'],
      },
    },
  )
  /**
   * Получение списка досок
   */
  .get(
    '/',
    async ({ query, store }) => {
      const limit = Number(query.limit) || 20
      const page = Number(query.page) || 1
      const sort = query.sort || 'createdAt'
      const order = query.order === 'ASC' ? 1 : -1

      // Check if user is admin
      const user = await User.findById(store.userId)
      const isAdmin = user?.teamId === 'admin'

      let boards
      let ownCount = 0

      if (isAdmin) {
        // Admin sees all boards
        boards = await Board.find({
          title: new RegExp(query.search ?? '', 'gi'),
        })
          .limit(limit)
          .skip(limit * (page - 1))
          .sort({ [sort]: order })
          .lean()

        ownCount = await Board.countDocuments({ userId: store.userId })
      } else {
        // Regular users see only their own boards
        boards = await Board.find({
          userId: store.userId,
          title: new RegExp(query.search ?? '', 'gi'),
        })
          .limit(limit)
          .skip(limit * (page - 1))
          .sort({ [sort]: order })
          .lean()

        ownCount = await Board.countDocuments({ userId: store.userId })
      }

      const boardsWithOwner = await withOwnerName(boards as any[])

      return {
        count: boardsWithOwner.length,
        own: ownCount,
        items: JSON.parse(JSON.stringify(boardsWithOwner)),
      } as any
    },
    {
      query: 'boardsQuery',
      response: 'boardsResponse',
      detail: {
        tags: ['Boards'],
      },
      requiredAuth: true,
    },
  )

  /**
   * Admin only: Get all boards from all teams
   */
  .get(
    '/all',
    async ({ query, store }) => {
      const limit = Number(query.limit) || 100
      const page = Number(query.page) || 1
      const sort = query.sort || 'createdAt'
      const order = query.order === 'ASC' ? 1 : -1

      // Check if user is admin
      const user = await User.findById(store.userId)

      if (!user || user.teamId !== 'admin') {
        return {
          count: 0,
          own: 0,
          items: [],
        } as any
      }

      const boards = await Board.find({})
        .limit(limit)
        .skip(limit * (page - 1))
        .sort({ [sort]: order })
        .lean()

      const boardsWithOwner = await withOwnerName(boards as any[])

      return {
        count: boardsWithOwner.length,
        own: 0,
        items: JSON.parse(JSON.stringify(boardsWithOwner)),
      } as any
    },
    {
      query: 'boardsQuery',
      response: 'boardsResponse',
      detail: {
        tags: ['Boards'],
        description: 'Admin only - returns all boards from all teams',
      },
      requiredAuth: true,
    },
  )
  /**
   * Получение доски по id
   */
  .get(
    '/:id',
    async ({ params, store, server, set }) => {
      const board = await Board.findById(params.id)

      if (!board) {
        set.status = 404
        throw new Error('Board not found')
      }

      // Check if user is admin (admin can access all boards)
      const user = await User.findById(store.userId)
      const isAdmin = user?.teamId === 'admin'

      const isUserParticipant = board.participants.some(i =>
        i.userId?.equals(store.userId),
      )

      if (board.accessPolicy === 'private' && !isUserParticipant && !isAdmin) {
        set.status = 403
        throw new Error('You are not allowed to access this board')
      }

      if (board.accessPolicy === 'public' && !isUserParticipant) {
        const user = await User.findById(store.userId)

        if (!user) {
          set.status = 400
          throw new Error('User not found')
        }

        board.participants.push({
          userId: user._id,
          role: 'member',
        })
        await board.save()

        const data = await getExtendedBoardData(board)

        const payload = {
          type: WebSocketEvent.BoardUpdate,
          data,
        }

        server?.publish(params.id, JSON.stringify(payload))
      }

      const data = await getExtendedBoardData(board)

      return JSON.parse(JSON.stringify(data))
    },
    {
      response: 'boardResponse',
      requiredAuth: true,
      detail: {
        tags: ['Boards'],
      },
    },
  )
  /**
   * Обновление доски
   */
  .patch(
    '/:id',
    async ({ params, body, set, server, store }) => {
      const user = await User.findById(store.userId)

      if (!user) {
        set.status = 400
        throw new Error('User not found')
      }

      const board = await Board.findById(params.id)

      if (!board) {
        set.status = 400
        throw new Error('Board not found')
      }

      const isAdmin = user.teamId === 'admin'

      if (!board.userId.equals(user._id) && !isAdmin) {
        set.status = 403
        throw new Error('You are not allowed to update this board')
      }

      await Board.findByIdAndUpdate(params.id, body)

      const updatedBoard = await Board.findById(params.id)
      const data = await getExtendedBoardData(updatedBoard!)

      const payload = {
        type: WebSocketEvent.BoardUpdate,
        data,
      }

      server?.publish(params.id, JSON.stringify(payload))
    },
    {
      body: 'boardUpdate',
      requiredAuth: true,
      detail: {
        tags: ['Boards'],
      },
    },
  )
  /**
   * Удаление доски
   */
  .delete(
    '/:id',
    async ({ params, store, set, server }) => {
      const user = await User.findById(store.userId)

      if (!user) {
        set.status = 400
        throw new Error('User not found')
      }

      const board = await Board.findById(params.id)

      if (!board) {
        set.status = 400
        throw new Error('Board not found')
      }

      const isAdmin = user.teamId === 'admin'

      if (!board.userId.equals(user._id) && !isAdmin) {
        set.status = 403
        throw new Error('You are not allowed to delete this board')
      }

      await board.deleteOne()
      await Note.deleteMany({ boardId: params.id })
      await Comment.deleteMany({ boardId: params.id })

      const payload = {
        type: WebSocketEvent.BoardDelete,
        data: params.id,
      }

      server?.publish(params.id, JSON.stringify(payload))
    },
    {
      requiredAuth: true,
      detail: {
        tags: ['Boards'],
      },
    },
  )

export default app
