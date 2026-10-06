import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Room, RoomSession } from '../shared/rooms.ts'
import { ChatAPI, ChatAPIError } from './cometchat.ts'
import { AnalysisError } from './graph.ts'
import { Store } from './store.ts'
import type { Identity } from './store.ts'

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export const newRoomCode = () => 'GR-' + Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join('')
export const groupGuid = (code: string) => 'ghostroom-' + createHash('sha256').update(code.trim().toUpperCase()).digest('hex')
const digest = (token: string) => createHash('sha256').update(token).digest('hex')
const COOKIE = 'ghostroom_session'
const YEAR = 365 * 24 * 60 * 60
export class Rooms {
  constructor(readonly chat: ChatAPI, readonly store: Store, private secureCookie = false) {}
  identity(request: IncomingMessage): Identity | null {
    const token = request.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
    const identity = token && /^[a-f0-9]{64}$/.test(token) ? this.store.data.sessions[digest(token)] : null
    return identity && identity.expiresAt > Date.now() ? identity : null
  }
  async ensureIdentity(request: IncomingMessage, response: ServerResponse, displayName: string) {
    let identity = this.identity(request)
    if (!identity) {
      const uid = 'gr-' + randomUUID()
      const user = await this.chat.createUser(uid, displayName)
      const authToken = user.authToken || (await this.chat.token(uid)).authToken
      if (!authToken) throw new AnalysisError(502, 'TOKEN_MISSING', 'Could not authenticate your chat identity.')
      identity = { uid, displayName, authToken, rooms: [], currentRoom: null, expiresAt: Date.now() + YEAR * 1000 }
      const token = randomBytes(32).toString('hex')
      this.store.data.sessions[digest(token)] = identity
      response.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${YEAR}${this.secureCookie ? '; Secure' : ''}`)
      this.store.save()
    } else if (identity.displayName !== displayName) {
      await this.chat.updateUser(identity.uid, displayName)
      identity.displayName = displayName
      this.store.save()
    }
    return identity
  }
  async resolve(code: string, uid?: string): Promise<Room> {
    const group = await this.chat.getGroup(groupGuid(code), uid)
    if (group.type !== 'private' || group.metadata?.ghostroom?.version !== 1) throw new AnalysisError(404, 'ROOM_NOT_FOUND', 'Room not found. Check the invite code.')
    return { code, guid: group.guid, name: group.name }
  }
  async authorize(request: IncomingMessage, code: string) {
    const identity = this.identity(request)
    const guid = groupGuid(code)
    if (!identity || !identity.rooms.includes(guid)) throw new AnalysisError(403, 'ROOM_ACCESS_DENIED', 'Join this room with its invite code first.')
    const group = await this.chat.getGroup(guid, identity.uid)
    if (!group.hasJoined) throw new AnalysisError(403, 'ROOM_ACCESS_DENIED', 'You are no longer a member of this room.')
    return identity
  }
  session(identity: Identity, room: Room | null): RoomSession {
    return { uid: identity.uid, displayName: identity.displayName, authToken: identity.authToken, appId: this.chat.config.appId, region: this.chat.config.region, room }
  }
  async create(request: IncomingMessage, response: ServerResponse, displayName: string, roomName: string) {
    const identity = await this.ensureIdentity(request, response, displayName)
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newRoomCode(); const guid = groupGuid(code)
      try {
        await this.chat.createGroup(guid, roomName, identity.uid)
        const group = await this.chat.getGroup(guid, identity.uid)
        if (!group.hasJoined || group.owner !== identity.uid) throw new AnalysisError(502, 'ROOM_CREATION_FAILED', 'Could not confirm ownership of the room.')
        identity.rooms.push(guid); identity.currentRoom = code; this.store.save()
        return this.session(identity, { code, guid, name: group.name })
      } catch (error) { if (!(error instanceof ChatAPIError) || error.providerCode !== 'ERR_GUID_ALREADY_EXISTS') throw error }
    }
    throw new AnalysisError(503, 'ROOM_CODE_BUSY', 'Could not allocate a room code. Please retry.')
  }
  async join(request: IncomingMessage, response: ServerResponse, displayName: string, code: string) {
    const room = await this.resolve(code)
    const identity = await this.ensureIdentity(request, response, displayName)
    await this.chat.addMember(room.guid, identity.uid)
    const confirmed = await this.chat.getGroup(room.guid, identity.uid)
    if (!confirmed.hasJoined) throw new AnalysisError(502, 'MEMBERSHIP_FAILED', 'Could not confirm your membership. Please retry.')
    if (!identity.rooms.includes(room.guid)) identity.rooms.push(room.guid)
    identity.currentRoom = code; this.store.save()
    return this.session(identity, room)
  }
}
