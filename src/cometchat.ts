import { CometChat } from '@cometchat/chat-sdk-javascript'
import { CometChatUIKit } from '@cometchat/chat-uikit-react'
import type { RoomSession } from '../shared/rooms'

let initPromise: Promise<unknown> | null = null
let loginPromise: Promise<unknown> | null = null
export async function connectChat(session: RoomSession) {
  if (!initPromise) {
    // Auth key is intentionally empty: production login uses a server-minted token.
    initPromise = CometChatUIKit.initFromSettings({
      appId: session.appId, region: session.region, credentials: { authKey: '' },
      chatSDK: { presenceSubscription: { type: 'ALL_USERS' } },
    }).catch(error => { initPromise = null; throw error })
  }
  await initPromise
  if (!loginPromise) {
    loginPromise = (async () => {
      const existing = CometChatUIKit.getLoggedInUser()
      if (existing?.getUid() === session.uid) return existing
      if (existing) await CometChatUIKit.logout()
      return CometChatUIKit.loginWithAuthToken(session.authToken)
    })().finally(() => { loginPromise = null })
  }
  await loginPromise
  if (CometChatUIKit.getLoggedInUser()?.getUid() !== session.uid) throw new Error('Could not restore your room identity. Please retry.')
}
export async function openChatRoom(session: RoomSession) {
  await connectChat(session)
  if (!session.room) throw new Error('Choose a room first.')
  return CometChat.getGroup(session.room.guid)
}
export function describeError(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String(error.message)
  return 'Could not connect to the room. Please retry.'
}
