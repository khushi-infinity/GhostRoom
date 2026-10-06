import { analysisGraphSchema, requestSchema } from '../shared/analysis.ts'
import type { AnalysisGraph, AnalysisRequest } from '../shared/analysis.ts'

export class AnalysisError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function parseModelJson(content: string): unknown {
  const text = content.trim().replace(/^\uFEFF/, '')
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(text)
  try { return JSON.parse(fenced ? fenced[1] : text) }
  catch { throw new AnalysisError(502, 'INVALID_AI_JSON', 'The model returned invalid JSON.') }
}

export function validateRequest(value: unknown): AnalysisRequest {
  const parsed = requestSchema.safeParse(value)
  if (!parsed.success) throw new AnalysisError(400, 'INVALID_INPUT', 'Invalid conversation input or graph schema.')
  const input = parsed.data
  const messages = new Map(input.messages.map(message => [message.id, message]))
  if (messages.size !== input.messages.length) throw new AnalysisError(400, 'DUPLICATE_MESSAGE_ID', 'Message IDs must be unique.')
  validateGraphReferences(input.existingGraph, input, true)
  return input
}

function validateGraphReferences(graph: AnalysisGraph, input: AnalysisRequest, isInput = false) {
  const fail = (message: string): never => { throw new AnalysisError(isInput ? 400 : 502, isInput ? 'INVALID_EXISTING_GRAPH' : 'INVALID_AI_GRAPH', message) }
  const messages = new Map(input.messages.map(message => [message.id, message]))
  const existing = new Map(input.existingGraph.nodes.map(node => [node.id, node]))
  const knownSources = new Set(input.existingGraph.nodes.flatMap(node => node.sourceMessageIds))
  const nodeIds = new Set<string>()
  for (const node of graph.nodes) {
    if (nodeIds.has(node.id)) fail('Duplicate graph node IDs.')
    nodeIds.add(node.id)
    if (new Set(node.sourceMessageIds).size !== node.sourceMessageIds.length) fail('Duplicate source message references.')
    for (const source of node.sourceMessageIds) {
      // Incremental requests may reference historical provenance already in existingGraph.
      if (!messages.has(source) && (!knownSources.has(source) || !existing.has(node.id))) fail('A node references a message outside the conversation.')
    }
    if (node.authorId) {
      const citedAuthors = node.sourceMessageIds.map(id => messages.get(id)?.senderId).filter(Boolean)
      if (!citedAuthors.includes(node.authorId) && existing.get(node.id)?.authorId !== node.authorId) fail('A node author does not match its cited messages.')
    }
    if (!isInput && existing.has(node.id) && existing.get(node.id)!.type !== node.type) fail('An existing node ID cannot change its type.')
  }
  const edgeIds = new Set<string>()
  const allowedIds = isInput ? nodeIds : new Set([...nodeIds, ...existing.keys()])
  for (const edge of graph.edges) {
    if (edgeIds.has(edge.id)) fail('Duplicate graph edge IDs.')
    edgeIds.add(edge.id)
    if (!allowedIds.has(edge.source) || !allowedIds.has(edge.target)) fail('An edge references a missing node.')
    if (edge.source === edge.target) fail('Self-referencing graph edges are not allowed.')
  }
}

export function mergeGraph(value: unknown, input: AnalysisRequest): AnalysisGraph {
  const parsed = analysisGraphSchema.safeParse(value)
  if (!parsed.success) throw new AnalysisError(502, 'INVALID_AI_SCHEMA', 'The model response does not match the graph schema.')
  validateGraphReferences(parsed.data, input)
  const nodes: AnalysisGraph['nodes'] = []
  const byId = new Map<string, number>()
  const byConcept = new Map<string, number>()
  const aliases = new Map<string, string>()
  for (const raw of [...input.existingGraph.nodes, ...parsed.data.nodes]) {
    // Timestamp belongs to frontend provenance, not the endpoint response schema.
    const node = analysisGraphSchema.shape.nodes.element.parse({ id: raw.id, type: raw.type, label: raw.label, summary: raw.summary, sourceMessageIds: raw.sourceMessageIds, authorId: raw.authorId })
    const key = `${node.type}:${normalize(node.label)}`
    const index = byId.get(node.id) ?? byConcept.get(key)
    if (index !== undefined) {
      const previous = nodes[index]
      const merged = { ...previous, ...node, id: previous.id, authorId: node.authorId ?? previous.authorId,
        sourceMessageIds: [...new Set([...previous.sourceMessageIds, ...node.sourceMessageIds])] }
      nodes[index] = merged
      aliases.set(node.id, previous.id)
      byId.set(node.id, index)
      byConcept.set(key, index)
    } else {
      byId.set(node.id, nodes.length); byConcept.set(key, nodes.length)
      aliases.set(node.id, node.id); nodes.push({ ...node, authorId: node.authorId ?? undefined })
    }
  }
  const edgeMap = new Map<string, AnalysisGraph['edges'][number]>()
  for (const edge of [...input.existingGraph.edges, ...parsed.data.edges]) edgeMap.set(edge.id, edge)
  const keys = new Set<string>()
  const edges = [...edgeMap.values()].flatMap(edge => {
    const source = aliases.get(edge.source) || edge.source
    const target = aliases.get(edge.target) || edge.target
    const key = `${source}:${target}:${normalize(edge.relationship)}`
    if (source === target || keys.has(key)) return []
    keys.add(key); return [{ ...edge, source, target }]
  })
  const result = analysisGraphSchema.safeParse({ nodes, edges })
  if (!result.success) throw new AnalysisError(422, 'GRAPH_LIMIT', 'The graph reached its analysis size limit.')
  validateGraphReferences(result.data, input)
  return result.data
}
