import { roomSessionSchema } from '../shared/rooms'
import type { RoomSession } from '../shared/rooms'
export async function api(path: string, body?: unknown, signal?: AbortSignal) {
  const response = await fetch(path, { credentials: 'same-origin', signal,
    ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
  const value = await response.json()
  if (!response.ok) throw new Error(value.error?.message || 'Could not complete the request. Please retry.')
  return value
}
export async function loadSession(signal?: AbortSignal): Promise<RoomSession | null> {
  const data = await api('/api/session', undefined, signal)
  return data ? roomSessionSchema.parse(data) : null
}
export async function enterRoom(mode: 'create' | 'join', displayName: string, value: string): Promise<RoomSession> {
  return roomSessionSchema.parse(await api(`/api/rooms/${mode}`, { displayName, ...(mode === 'create' ? { roomName: value } : { roomCode: value }) }))
}
export async function copyRoomCode(code: string) { await navigator.clipboard.writeText(code) }
