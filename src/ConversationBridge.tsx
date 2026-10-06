import { useEffect, useRef } from 'react'
import { CometChat } from '@cometchat/chat-sdk-javascript'
import { useCometChatEvents } from '@cometchat/chat-uikit-react'
import type { ConversationMessage } from '../shared/analysis'

export type ConversationBatch = { roomId: string; messages: ConversationMessage[]; deletedIds?: string[]; error?: string }

function normalizeMessage(message: CometChat.BaseMessage, roomId: string): ConversationMessage | null {
  if (!(message instanceof CometChat.TextMessage) || message.getReceiverType() !== 'group' || message.getReceiverId() !== roomId || message.getDeletedAt()) return null
  const sender = message.getSender()
  const text = message.getText()?.trim()
  const sentAt = message.getSentAt()
  if (!message.getId() || !sender?.getUid() || !text || !sentAt) return null
  return { id: String(message.getId()), senderId: sender.getUid(), senderName: sender.getName() || sender.getUid(), text, timestamp: new Date(sentAt * 1000).toISOString() }
}

/** Separate subscriber: never intercepts or replaces the UI Kit send pipeline. */
export function ConversationBridge({ roomId, onMessages }: { roomId: string; onMessages: (batch: ConversationBatch) => void }) {
  const liveIds = useRef(new Set<string>())
  useEffect(() => {
    let active = true
    const request = new CometChat.MessagesRequestBuilder().setGUID(roomId).setLimit(50).build()
    request.fetchPrevious().then(history => {
      if (active) onMessages({ roomId, messages: history.filter(message => !liveIds.current.has(String(message.getId()))).map(message => normalizeMessage(message, roomId)).filter((message): message is ConversationMessage => Boolean(message)) })
    }).catch(() => { if (active) onMessages({ roomId, messages: [], error: 'Could not load graph context. New messages will still be analyzed.' }) })
    return () => { active = false }
  }, [roomId, onMessages])

  useCometChatEvents(event => {
    if (event.type === 'message/deleted' || event.type === 'ui:message/deleted') {
      if (event.message.getReceiverId() === roomId && event.message.getReceiverType() === 'group') { liveIds.current.add(String(event.message.getId())); onMessages({ roomId, messages: [], deletedIds: [String(event.message.getId())] }) }
      return
    }
    if (event.type === 'message/text-received' || event.type === 'message/edited' || (event.type === 'ui:message/sent' && event.status === 'success')) {
      const message = normalizeMessage(event.message, roomId)
      if (message) { liveIds.current.add(message.id); onMessages({ roomId, messages: [message] }) }
    }
  }, [roomId, onMessages])
  return null
}
