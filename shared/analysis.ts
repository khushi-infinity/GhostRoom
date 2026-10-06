import { z } from 'zod'

export const nodeTypes = ['idea', 'evidence', 'question', 'disagreement', 'decision', 'task', 'person'] as const
const id = z.string().trim().min(1).max(160)
export const analysisNodeSchema = z.object({
  id, type: z.enum(nodeTypes), label: z.string().trim().min(1).max(160),
  summary: z.string().trim().min(1).max(3000),
  sourceMessageIds: z.array(id).min(1).max(200), authorId: id.nullish(),
}).strict()
export const edgeSchema = z.object({ id, source: id, target: id, relationship: z.string().trim().min(1).max(160) }).strict()
export const analysisGraphSchema = z.object({ nodes: z.array(analysisNodeSchema).max(200), edges: z.array(edgeSchema).max(500) }).strict()
export const conversationMessageSchema = z.object({
  id, senderId: id, senderName: z.string().trim().min(1).max(160),
  text: z.string().trim().min(1).max(12000),
  timestamp: z.iso.datetime({ offset: true }),
}).strict()
export const requestSchema = z.object({
  messages: z.array(conversationMessageSchema).min(1).max(200),
  existingGraph: z.object({
    nodes: z.array(analysisNodeSchema.extend({ timestamp: z.iso.datetime({ offset: true }).optional() })).max(200),
    edges: z.array(edgeSchema).max(500),
  }).strict().default({ nodes: [], edges: [] }),
}).strict()
export type ConversationMessage = z.infer<typeof conversationMessageSchema>
export type AnalysisGraph = z.infer<typeof analysisGraphSchema>
export type AnalysisRequest = z.infer<typeof requestSchema>

// Strict-provider schemas require every property, so optional authorId is nullable on the wire.
export const responseJsonSchema = {
  type: 'object', additionalProperties: false, required: ['nodes', 'edges'],
  properties: {
    nodes: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['id', 'type', 'label', 'summary', 'sourceMessageIds', 'authorId'],
      properties: {
        id: { type: 'string' }, type: { type: 'string', enum: nodeTypes },
        label: { type: 'string' }, summary: { type: 'string' },
        sourceMessageIds: { type: 'array', items: { type: 'string' } },
        authorId: { type: ['string', 'null'] },
      },
    } },
    edges: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['id', 'source', 'target', 'relationship'],
      properties: { id: { type: 'string' }, source: { type: 'string' }, target: { type: 'string' }, relationship: { type: 'string' } },
    } },
  },
}
