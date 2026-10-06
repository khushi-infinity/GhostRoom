import { createHash } from 'node:crypto'
import type { SharedGraph } from '../shared/rooms.ts'
import type { AIConfig } from './analyze.ts'
import { analyzeConversation } from './analyze.ts'
import { ChatAPI } from './cometchat.ts'
import { AnalysisError, validateRequest } from './graph.ts'
import { Store } from './store.ts'
import type { StoredGraph } from './store.ts'
interface State {
  stored: StoredGraph; thinking: boolean; error: string | null; attemptedHash: string;
  refresh?: Promise<void>; fetchedAt: number; timer?: ReturnType<typeof setTimeout>; uid: string;
}
export class RoomGraphs {
  private states = new Map<string, State>()
  private inFlight = 0
  constructor(private chat: ChatAPI, private store: Store, private config: AIConfig, private fetchImpl?: typeof fetch, private debounceMs = 1400) {}
  private state(guid: string, uid: string) {
    let state = this.states.get(guid)
    if (!state) {
      state = { stored: this.store.data.graphs[guid] || { graph: { nodes: [], edges: [] }, messages: [], version: 0, analyzedHash: '' }, thinking: false, error: null, attemptedHash: '', fetchedAt: 0, uid }
      this.states.set(guid, state)
    }
    state.uid = uid
    return state
  }
  async get(guid: string, uid: string, retry = false): Promise<SharedGraph> {
    const state = this.state(guid, uid)
    if (retry) state.attemptedHash = ''
    if (!state.refresh && (retry || Date.now() - state.fetchedAt > 1500)) {
      state.refresh = this.refresh(guid, state).finally(() => { state.refresh = undefined; state.fetchedAt = Date.now() })
    }
    if (state.refresh) await state.refresh
    return { graph: state.stored.graph, messages: state.stored.messages, version: state.stored.version, thinking: state.thinking, error: state.error }
  }
  private hash(state: State) { return createHash('sha256').update(JSON.stringify(state.stored.messages)).digest('hex') }
  private persist(guid: string, state: State) { this.store.data.graphs[guid] = state.stored; this.store.save() }
  private async refresh(guid: string, state: State) {
    try {
      const { messages, deletedIds } = await this.chat.messages(guid, state.uid)
      const known = new Map(state.stored.messages.map(message => [message.id, message]))
      // Keep historical sources cited by older concepts even outside the recent analysis window.
      for (const id of deletedIds) known.delete(id)
      for (const message of messages) known.set(message.id, message)
      const cited = new Set(state.stored.graph.nodes.flatMap(node => node.sourceMessageIds))
      const recentIds = new Set(messages.map(message => message.id))
      state.stored.messages = [...known.values()].filter(message => recentIds.has(message.id) || cited.has(message.id)).sort((a, b) => a.timestamp.localeCompare(b.timestamp) || a.id.localeCompare(b.id))
      if (deletedIds.length) {
        const deleted = new Set(deletedIds)
        const nodes = state.stored.graph.nodes.flatMap(node => {
          const sources = node.sourceMessageIds.filter(id => !deleted.has(id))
          return sources.length ? [{ ...node, sourceMessageIds: sources }] : []
        })
        const ids = new Set(nodes.map(node => node.id))
        state.stored.graph = { nodes, edges: state.stored.graph.edges.filter(edge => ids.has(edge.source) && ids.has(edge.target)) }
      }
      this.persist(guid, state)
      this.schedule(guid, state)
    } catch (error) { state.error = error instanceof AnalysisError ? error.message : 'Graph context is temporarily unavailable. Chat remains connected.' }
  }
  private schedule(guid: string, state: State) {
    const hash = this.hash(state)
    if (!state.stored.messages.length) {
      state.stored.analyzedHash = hash; state.error = null; this.persist(guid, state); return
    }
    if (state.thinking || state.timer || hash === state.stored.analyzedHash || hash === state.attemptedHash) return
    state.timer = setTimeout(() => { state.timer = undefined; void this.run(guid, state) }, this.debounceMs)
  }
  private async run(guid: string, state: State) {
    if (this.inFlight >= 2) { this.schedule(guid, state); return }
    const hash = this.hash(state)
    if (hash === state.stored.analyzedHash || hash === state.attemptedHash) return
    state.thinking = true; state.error = null; state.attemptedHash = hash; this.inFlight++
    try {
      const input = validateRequest({ messages: state.stored.messages.slice(-200), existingGraph: state.stored.graph })
      const graph = await analyzeConversation(input, this.config, { fetchImpl: this.fetchImpl })
      // An edit/delete during analysis invalidates the earlier interpretation.
      if (hash === this.hash(state)) {
        state.stored = { ...state.stored, graph, analyzedHash: hash, version: state.stored.version + 1 }
        this.persist(guid, state)
      }
    } catch (error) { state.error = error instanceof AnalysisError ? error.message : 'Graph analysis is unavailable. Your conversation is unaffected.' }
    finally { state.thinking = false; this.inFlight--; this.schedule(guid, state) }
  }
  dispose() { for (const state of this.states.values()) clearTimeout(state.timer) }
}
