import type { BoardResponse } from '~/services/api/generated'

export const WebSocketEvent = {
  BoardDelete: 'board:delete',
  BoardUpdate: 'board:update',
  UserConnect: 'user:connect',
  UserSync: 'user:sync',
} as const

export interface WebSocketEventMap {
  [WebSocketEvent.BoardDelete]: string
  [WebSocketEvent.BoardUpdate]: BoardResponse
  [WebSocketEvent.UserConnect]: string
  [WebSocketEvent.UserSync]: string[]
}

export type WebSocketEventData = {
  [K in keyof typeof WebSocketEvent]: {
    type: (typeof WebSocketEvent)[K]
    data: WebSocketEventMap[(typeof WebSocketEvent)[K]]
  };
}[keyof typeof WebSocketEvent]
