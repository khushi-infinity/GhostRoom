import { useCallback, useEffect, useRef, useState } from 'react'
import type { ConversationBatch } from '../ConversationBridge'
import { sharedGraphSchema } from '../../shared/rooms'
import { api } from '../rooms'
import type { AnalysisSnapshot } from './AnalysisSession'
const empty = (): AnalysisSnapshot => ({ graph: { nodes: [], edges: [] }, sources: [], thinking: false, error: null })

/** All interpretations come from the same server-owned room snapshot. */
export function useConversationGraph(roomId: string | null, roomCode: string | null) {
  const [state, setState] = useState<{ roomId: string | null; snapshot: AnalysisSnapshot }>({ roomId: null, snapshot: empty() })
  const refresh = useRef<(retry?: boolean) => void>(() => {})
  useEffect(() => {
    if (!roomId || !roomCode) { refresh.current = () => {}; return }
    const controller = new AbortController()
    let busy = false
    async function poll(retry = false) {
      if (busy || controller.signal.aborted) return
      busy = true
      try {
        const raw = await api(retry ? '/api/analyze-conversation' : `/api/rooms/${roomCode}/graph`, retry ? { roomCode } : undefined, controller.signal)
        const shared = sharedGraphSchema.parse(raw)
        if (controller.signal.aborted) return
        const messages = new Map(shared.messages.map(message => [message.id, message]))
        setState({ roomId, snapshot: {
          graph: { nodes: shared.graph.nodes.map(node => ({ ...node, authorId: node.authorId ?? undefined, timestamp: messages.get(node.sourceMessageIds[0])?.timestamp || '1970-01-01T00:00:00Z' })), edges: shared.graph.edges },
          sources: shared.messages.map(message => ({ id: message.id, authorId: message.senderId, authorName: message.senderName, text: message.text, timestamp: message.timestamp })),
          thinking: shared.thinking, error: shared.error,
        } })
      } catch (error) {
        if (!controller.signal.aborted) setState(previous => ({ roomId, snapshot: { ...(previous.roomId === roomId ? previous.snapshot : empty()), thinking: false, error: error instanceof Error ? error.message : 'Graph sync is unavailable. Chat remains connected.' } }))
      } finally { busy = false }
    }
    refresh.current = retry => { void poll(retry) }
    void poll()
    const interval = setInterval(() => void poll(), 2000)
    return () => { controller.abort(); clearInterval(interval); refresh.current = () => {} }
  }, [roomId, roomCode])
  const onMessages = useCallback((batch: ConversationBatch) => {
    // Events only nudge synchronization. Server re-reads canonical CometChat history.
    if (batch.roomId === roomId) refresh.current()
  }, [roomId])
  const retry = useCallback(() => refresh.current(true), [])
  return { ...(state.roomId === roomId ? state.snapshot : empty()), onMessages, retry }
}
