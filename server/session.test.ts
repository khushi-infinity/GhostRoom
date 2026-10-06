import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AnalysisSession } from '../src/graph/AnalysisSession.ts'
import type { AnalysisTransport } from '../src/graph/AnalysisSession.ts'

const message = { id: 'm1', senderId: 'maya', senderName: 'Maya', text: 'Launch a beta.', timestamp: '2026-10-06T10:00:00Z' }
const graph = { nodes: [{ id: 'beta', type: 'decision', label: 'Beta launch', summary: 'Launch a beta.', sourceMessageIds: ['m1'], authorId: 'maya' }], edges: [] }
const tick = () => new Promise(resolve => setTimeout(resolve, 15))

test('frontend retains its last graph on provider failure and retries queued messages serially', async () => {
  let calls = 0
  const transport: AnalysisTransport = async () => { calls++; if (calls === 1) return graph; throw new Error('Provider offline') }
  const session = new AnalysisSession(transport, 1)
  session.activate(); session.ingest([message]); await tick()
  assert.equal(session.getSnapshot().graph.nodes.length, 1)
  session.ingest([{ ...message, id: 'm2', text: 'I will build onboarding.' }]); await tick()
  assert.equal(session.getSnapshot().graph.nodes.length, 1)
  assert.equal(session.getSnapshot().error, 'Provider offline')
  assert.equal(session.getSnapshot().thinking, false)
  session.deactivate()
})

test('no duplicate analysis for repeated messages; new in-flight messages get a second pass', async () => {
  let finish: (graph: unknown) => void = () => {}
  let calls = 0
  const session = new AnalysisSession(async () => { calls++; if (calls === 1) return new Promise(resolve => { finish = resolve }); return graph }, 1)
  session.activate(); session.ingest([message]); await tick()
  session.ingest([message]); session.ingest([{ ...message, id: 'm2', text: 'Include CSV import.' }])
  assert.equal(calls, 1)
  finish(graph); await tick(); await tick()
  assert.equal(calls, 2)
  session.deactivate()
})

test('room deactivation discards stale responses even if transport ignores cancellation', async () => {
  let finish: (graph: unknown) => void = () => {}
  const session = new AnalysisSession(async () => new Promise(resolve => { finish = resolve }), 1)
  session.activate(); session.ingest([message]); await tick()
  session.deactivate(); finish(graph); await tick()
  assert.equal(session.getSnapshot().graph.nodes.length, 0)
  assert.equal(session.getSnapshot().thinking, false)
})

test('deleted messages remove orphaned concepts and invalidate in-flight analysis', async () => {
  const session = new AnalysisSession(async () => graph, 1)
  session.activate(); session.ingest([message]); await tick()
  session.ingest([], ['m1'])
  assert.equal(session.getSnapshot().graph.nodes.length, 0)
  assert.equal(session.getSnapshot().sources.length, 0)
  session.deactivate()
})
