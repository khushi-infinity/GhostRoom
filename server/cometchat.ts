import { AnalysisError } from './graph.ts'
import { conversationMessageSchema } from '../shared/analysis.ts'
import type { ConversationMessage } from '../shared/analysis.ts'
export interface ChatConfig { appId: string; region: string; restKey: string }
export class ChatAPIError extends AnalysisError {
  constructor(public providerCode: string, status: number) {
    super(status === 404 ? 404 : 502, providerCode, status === 404 ? 'Room not found. Check the invite code.' : 'CometChat could not complete the request. Please retry.')
  }
}
interface GroupData { guid: string; name: string; type: string; metadata?: { ghostroom?: { version?: number } }; hasJoined?: boolean; owner?: string }
export class ChatAPI {
  constructor(readonly config: ChatConfig, private fetchImpl: typeof fetch = fetch) {}
  async call(path: string, method = 'GET', body?: unknown, onBehalfOf?: string): Promise<any> {
    if (!this.config.appId || !this.config.restKey || !['us', 'eu', 'in'].includes(this.config.region)) throw new AnalysisError(503, 'CHAT_NOT_CONFIGURED', 'Room service is not configured on the server.')
    let response: Response
    try {
      response = await this.fetchImpl(`https://${this.config.appId}.api-${this.config.region}.cometchat.io/v3${path}`, {
        method, headers: { apikey: this.config.restKey, 'Content-Type': 'application/json', ...(onBehalfOf ? { onBehalfOf } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(15000),
      })
    } catch { throw new AnalysisError(502, 'CHAT_UNAVAILABLE', 'CometChat is temporarily unavailable. Please retry.') }
    let envelope: any
    try { envelope = await response.json() } catch { throw new AnalysisError(502, 'CHAT_INVALID_RESPONSE', 'CometChat returned an incomplete response.') }
    if (!response.ok || envelope.error) throw new ChatAPIError(envelope.error?.code || 'CHAT_PROVIDER_ERROR', response.status)
    return envelope.data
  }
  createUser(uid: string, name: string) { return this.call('/users', 'POST', { uid, name, withAuthToken: true }) }
  updateUser(uid: string, name: string) { return this.call(`/users/${uid}`, 'PUT', { name }) }
  token(uid: string) { return this.call(`/users/${uid}/auth_tokens`, 'POST', {}) }
  getGroup(guid: string, uid?: string): Promise<GroupData> { return this.call(`/groups/${guid}`, 'GET', undefined, uid) }
  createGroup(guid: string, name: string, uid: string): Promise<GroupData> {
    return this.call('/groups', 'POST', { guid, name, type: 'private', metadata: { ghostroom: { version: 1 } } }, uid)
  }
  async addMember(guid: string, uid: string) {
    const result = await this.call(`/groups/${guid}/members`, 'POST', { participants: [uid] })
    const member = result?.participants?.[uid]
    if (!member?.success && member?.error?.code !== 'ERR_ALREADY_JOINED') throw new AnalysisError(502, 'MEMBERSHIP_FAILED', 'Could not add you to this private room. Please retry.')
  }
  async messages(guid: string, uid: string): Promise<{ messages: ConversationMessage[]; deletedIds: string[] }> {
    const raw = await this.call(`/groups/${guid}/messages?limit=200&category=message&type=text`, 'GET', undefined, uid)
    if (!Array.isArray(raw)) throw new AnalysisError(502, 'CHAT_INVALID_HISTORY', 'Could not load room graph context.')
    const messages: ConversationMessage[] = []; const deletedIds: string[] = []
    for (const message of raw) {
      if (message.receiver !== guid || message.receiverType !== 'group' || message.type !== 'text') continue
      if (message.deletedAt) { deletedIds.push(String(message.id)); continue }
      const parsed = conversationMessageSchema.safeParse({ id: String(message.id), senderId: message.sender,
        senderName: message.data?.entities?.sender?.entity?.name || message.sender,
        text: message.data?.text, timestamp: new Date(Number(message.sentAt) * 1000).toISOString() })
      if (parsed.success) messages.push(parsed.data)
    }
    return { messages: messages.sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id)), deletedIds }
  }
}
