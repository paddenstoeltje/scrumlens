export type BoardTemplate =
  | 'start-stop-continue'
  | 'glad-sad-mad'
  | 'wind-anchors-actions'
  | '3ws'

export const Colors = {
  Red: '#fca5a5',
  Orange: '#fed7aa',
  Yellow: '#fef08a',
  Green: '#86efac',
  Cyan: '#67e8f9',
  Blue: '#93c5fd',
  Purple: '#d8b4fe',
} as const

export const RoutePath = {
  Dashboard: '/dashboard',
  Profile: '/profile',
  AdminUsers: '/admin-users',
} as const

export const Cookie = {
  AccessToken: 'scrumlens_access_token',
  RefreshToken: 'scrumlens_refresh_token',
} as const
