import { analysisGraphSchema } from '../../shared/analysis'
import type { ConversationMessage } from '../../shared/analysis'
import type { KnowledgeGraph, SourceMessage } from './models'

export interface AnalysisSnapshot {
  graph: KnowledgeGraph
  sources: SourceMessage[]
  thinking: boolean
  error: string | null
}
export type AnalysisTransport = (messages: ConversationMessage[], graph: KnowledgeGraph, signal: AbortSignal) => Promise<unknown>
export const requestAnalysis: AnalysisTransport = async (messages, existingGraph, signal) => {
  const response = await fetch('/api/analyze-conversation', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, existingGraph }), signal,
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.code === 'AI_NOT_CONFIGURED' ? 'Graph analysis is not configured yet. Chat remains available.' : body.error?.message || 'Graph analysis is unavailable. Chat is still working.')
  return body
}

export class AnalysisSession {
  private messages = new Map<string, ConversationMessage>()
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | undefined
  private controller: AbortController | undefined
  private active = false
  private revision = 0
  private analyzedRevision = 0
  private pending = false
  private snapshot: AnalysisSnapshot = { graph: { nodes: [], edges: [] }, sources: [], thinking: false, error: null }
  private transport: AnalysisTransport
  private debounceMs: number
  constructor(transport: AnalysisTransport = requestAnalysis, debounceMs = 1400) { this.transport = transport; this.debounceMs = debounceMs }
  getSnapshot = () => this.snapshot
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  private update(patch: Partial<AnalysisSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; this.listeners.forEach(listener => listener()) }
  activate() { this.active = true; if (this.revision > this.analyzedRevision) this.schedule() }
  deactivate() { this.active = false; clearTimeout(this.timer); this.controller?.abort(); this.controller = undefined; this.pending = false; this.update({ thinking: false }) }
  reportError(message: string) { this.update({ error: message }) }
  ingest(batch: ConversationMessage[], deletedIds: string[] = []) {
    let changed = false
    for (const id of deletedIds) { if (this.messages.delete(id)) changed = true }
    for (const message of batch) {
      const previous = this.messages.get(message.id)
      if (!previous || JSON.stringify(previous) !== JSON.stringify(message)) { this.messages.set(message.id, message); changed = true }
    }
    if (!changed) return
    this.revision++
    const deleted = new Set(deletedIds)
    const survivingNodes = this.snapshot.graph.nodes.flatMap(node => {
      const sourceMessageIds = node.sourceMessageIds.filter(id => !deleted.has(id))
      return sourceMessageIds.length ? [{ ...node, sourceMessageIds }] : []
    })
    const survivingIds = new Set(survivingNodes.map(node => node.id))
    this.update({
      sources: [...this.messages.values()].map(message => ({ id: message.id, authorId: message.senderId, authorName: message.senderName, text: message.text, timestamp: message.timestamp })),
      graph: { nodes: survivingNodes, edges: this.snapshot.graph.edges.filter(edge => survivingIds.has(edge.source) && survivingIds.has(edge.target)) },
    })
    if (this.controller) { this.pending = true; if (deletedIds.length) this.controller.abort() }
    else this.schedule()
  }
  private schedule() {
    clearTimeout(this.timer)
    if (this.active && this.messages.size) this.timer = setTimeout(() => void this.run(), this.debounceMs)
  }
  retry = () => { if (!this.controller) void this.run() }
  private async run() {
    if (!this.active || this.controller || !this.messages.size) return
    const controller = new AbortController()
    this.controller = controller
    const revision = this.revision
    const messages = [...this.messages.values()].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(-200)
    const previous = this.snapshot.graph
    this.update({ thinking: true, error: null })
    try {
      const raw = await this.transport(messages, previous, AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]))
      const parsed = analysisGraphSchema.parse(raw)
      if (!this.active || controller.signal.aborted || this.controller !== controller) return
      const ids = new Set(parsed.nodes.map(node => node.id))
      const priorNodes = new Map(previous.nodes.map(node => [node.id, node]))
      const knownSources = new Set(previous.nodes.flatMap(node => node.sourceMessageIds))
      if (ids.size !== parsed.nodes.length || parsed.edges.some(edge => !ids.has(edge.source) || !ids.has(edge.target))) throw new Error('The graph response contained invalid connections.')
      if (parsed.nodes.some(node => node.sourceMessageIds.some(id => !this.messages.has(id) && !knownSources.has(id)))) throw new Error('The graph response contained unknown source messages.')
      const nodes = parsed.nodes.map(node => ({
        ...node, authorId: node.authorId ?? undefined,
        timestamp: this.messages.get(node.sourceMessageIds[0])?.timestamp || priorNodes.get(node.id)?.timestamp || messages[0].timestamp,
      }))
      this.analyzedRevision = revision
      this.update({ graph: { nodes, edges: parsed.edges }, error: null })
    } catch (error) {
      if (this.active && !controller.signal.aborted) this.update({ error: error instanceof Error ? error.message : 'Graph analysis is unavailable. Chat remains connected.' })
    } finally {
      if (this.controller === controller) {
        this.controller = undefined
        if (this.active) { this.update({ thinking: false }); if (this.pending) { this.pending = false; this.schedule() } }
      }
    }
  }
}
