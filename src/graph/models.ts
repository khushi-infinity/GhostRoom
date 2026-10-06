export const graphNodeTypes = [
  'idea', 'evidence', 'question', 'disagreement', 'decision', 'task', 'person',
] as const

export type GraphNodeType = (typeof graphNodeTypes)[number]

/** IDs are opaque strings: real CometChat message IDs can be normalized at the adapter. */
export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  summary: string
  sourceMessageIds: string[]
  authorId?: string
  /** ISO 8601 timestamp. */
  timestamp: string
}

export interface GraphEdge {
  id: string
  source: string
  target: string
  relationship: string
}

export interface SourceMessage {
  id: string
  authorId: string
  authorName: string
  timestamp: string
  text: string
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}
