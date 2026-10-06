import { test } from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { createApp } from './app.ts'
import { analyzeConversation } from './analyze.ts'
import { mergeGraph, parseModelJson, validateRequest } from './graph.ts'
import type { AnalysisRequest } from '../shared/analysis.ts'

const messages = [
  { id: 'm1', senderId: 'maya', senderName: 'Maya', text: 'Let’s build a feedback inbox.', timestamp: '2026-10-06T10:00:00Z' },
  { id: 'm2', senderId: 'leo', senderName: 'Leo', text: 'Nine founders need a feedback inbox.', timestamp: '2026-10-06T10:01:00Z' },
  { id: 'm3', senderId: 'maya', senderName: 'Maya', text: 'Decision: run a five-team beta.', timestamp: '2026-10-06T10:02:00Z' },
]
const idea = { id: 'idea-1', type: 'idea' as const, label: 'Feedback inbox', summary: 'Build a shared feedback inbox.', sourceMessageIds: ['m1'], authorId: 'maya' }
const input: AnalysisRequest = { messages, existingGraph: { nodes: [], edges: [] } }
const config = { apiKey: 'test-key', baseUrl: 'https://example.test/v1', model: 'test-model' }
const completion = (graph: unknown) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(graph) }, finish_reason: 'stop' }] }), { status: 200 })

test('parses raw and fenced JSON; refuses prose, malformed JSON, and invalid schema', () => {
  assert.deepEqual(parseModelJson('```json\n{"nodes":[],"edges":[]}\n```'), { nodes: [], edges: [] })
  assert.throws(() => parseModelJson('Here is your graph: {"nodes":[],"edges":[]}'))
  assert.throws(() => parseModelJson('{bad}'))
  assert.throws(() => mergeGraph({ nodes: [{ ...idea, type: 'fiction' }], edges: [] }, input))
})

test('rejects fabricated sources, unsupported authors, duplicate IDs and dangling edges', () => {
  assert.throws(() => mergeGraph({ nodes: [{ ...idea, sourceMessageIds: ['invented'] }], edges: [] }, input))
  assert.throws(() => mergeGraph({ nodes: [{ ...idea, authorId: 'invented' }], edges: [] }, input))
  assert.throws(() => mergeGraph({ nodes: [idea, idea], edges: [] }, input))
  assert.throws(() => mergeGraph({ nodes: [idea], edges: [{ id: 'e1', source: 'idea-1', target: 'missing', relationship: 'supports' }] }, input))
  assert.throws(() => validateRequest({ ...input, messages: [messages[0], messages[0]] }))
})

test('preserves omitted existing concepts, merges duplicates, and remaps evidence edges', () => {
  const existing = { ...input, existingGraph: { nodes: [{ ...idea, timestamp: messages[0].timestamp }], edges: [] } }
  const result = mergeGraph({ nodes: [
    { ...idea, id: 'duplicate', label: 'feedback inbox!', summary: 'A customer-feedback inbox with founder demand.', sourceMessageIds: ['m2'], authorId: 'leo' },
    { id: 'proof', type: 'evidence', label: 'Nine founders need this', summary: messages[1].text, sourceMessageIds: ['m2'], authorId: 'leo' },
  ], edges: [{ id: 'e1', source: 'proof', target: 'duplicate', relationship: 'supports' }] }, existing)
  assert.equal(result.nodes.length, 2)
  assert.equal(result.nodes[0].id, idea.id)
  assert.deepEqual(result.nodes[0].sourceMessageIds, ['m1', 'm2'])
  assert.equal(result.edges[0].target, idea.id)
  assert.equal('timestamp' in result.nodes[0], false)
  assert.deepEqual(mergeGraph({ nodes: [], edges: [] }, existing).nodes, [idea])
})

test('same-ID updates evolve concepts without losing provenance; edges remain valid', () => {
  const existing = { ...input, existingGraph: { nodes: [idea], edges: [] } }
  const result = mergeGraph({ nodes: [{ ...idea, label: 'Feedback inbox beta', summary: 'A five-team beta for the feedback inbox.', sourceMessageIds: ['m3'] }], edges: [] }, existing)
  assert.equal(result.nodes[0].id, idea.id)
  assert.deepEqual(result.nodes[0].sourceMessageIds, ['m1', 'm3'])
  assert.equal(result.nodes[0].summary, 'A five-team beta for the feedback inbox.')
})

test('provider compatibility fallback keeps validation and sends secrets only upstream', async () => {
  const requests: Record<string, unknown>[] = []
  const result = await analyzeConversation(input, config, { fetchImpl: (async (url, options) => {
    assert.equal(String(url), 'https://example.test/v1/chat/completions')
    assert.equal((options!.headers as Record<string, string>).Authorization, 'Bearer test-key')
    const body = JSON.parse(String(options!.body)); requests.push(body)
    return requests.length === 1 ? new Response('{"error":"response_format json_schema not supported"}', { status: 400 }) : completion({ nodes: [idea], edges: [] })
  }) as typeof fetch })
  assert.equal(requests.length, 2)
  assert.deepEqual(requests[1].response_format, { type: 'json_object' })
  assert.equal(result.nodes[0].id, idea.id)
  assert.equal(JSON.stringify(result).includes('test-key'), false)
})

test('invalid AI output is retried once, then rejected without fabricated fallback data', async () => {
  let calls = 0
  await assert.rejects(analyzeConversation(input, config, { fetchImpl: (async () => { calls++; return completion({ nodes: [{ ...idea, sourceMessageIds: ['fake'] }], edges: [] }) }) as typeof fetch }))
  assert.equal(calls, 2)
})

test('provider rate limit and missing configuration produce safe errors', async () => {
  await assert.rejects(analyzeConversation(input, { ...config, apiKey: '' }), (error: unknown) => (error as { status: number }).status === 503)
  await assert.rejects(analyzeConversation(input, config, { fetchImpl: (async () => new Response('private upstream details test-key', { status: 429 })) as typeof fetch }), (error: unknown) => {
    assert.equal((error as { status: number }).status, 429)
    assert.equal(String(error).includes('test-key'), false)
    return true
  })
})

test('HTTP endpoint validates requests and returns only graph JSON on success', async () => {
  const server = createApp(config, (async () => completion({ nodes: [idea], edges: [] })) as typeof fetch)
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const address = server.address() as { port: number }
  const base = `http://127.0.0.1:${address.port}`
  try {
    const response = await fetch(`${base}/api/analyze-conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { nodes: [idea], edges: [] })
    const invalid = await fetch(`${base}/api/analyze-conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad}' })
    assert.equal(invalid.status, 400)
    const empty = await fetch(`${base}/api/analyze-conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"messages":[]}' })
    assert.equal(empty.status, 400)
    const wrongMethod = await fetch(`${base}/api/analyze-conversation`)
    assert.equal(wrongMethod.status, 405)
    const oversized = await fetch(`${base}/api/analyze-conversation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(1_000_001) }) })
    assert.equal(oversized.status, 413)
    const health = await fetch(`${base}/api/health`).then(response => response.json())
    assert.deepEqual(health, { ok: true, aiConfigured: true })
  } finally { server.closeAllConnections(); server.close(); await once(server, 'close') }
})


test('compatible provider is called over actual HTTP with configured path and model', async () => {
  const upstream = createServer(async (request, response) => {
    assert.equal(request.url, '/v1/chat/completions')
    assert.equal(request.headers.authorization, 'Bearer test-key')
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    assert.equal(body.model, 'test-model')
    assert.equal(body.max_tokens, 8192)
    assert.equal(body.response_format.type, 'json_schema')
    assert.deepEqual(JSON.parse(body.messages[1].content).messages, messages)
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ nodes: [idea], edges: [] }) }, finish_reason: 'stop' }] }))
  })
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening')
  try {
    const result = await analyzeConversation(input, { ...config, baseUrl: `http://127.0.0.1:${(upstream.address() as { port: number }).port}/v1` })
    assert.deepEqual(result, { nodes: [idea], edges: [] })
  } finally { upstream.closeAllConnections(); upstream.close(); await once(upstream, 'close') }
})

test('aborted provider calls produce a safe timeout error', async () => {
  const controller = new AbortController(); controller.abort()
  await assert.rejects(analyzeConversation(input, config, { signal: controller.signal, fetchImpl: (async () => { throw new Error('aborted') }) as typeof fetch }), (error: unknown) => (error as { status: number }).status === 504)
})
