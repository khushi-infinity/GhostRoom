import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './app.ts'
import { ChatAPI } from './cometchat.ts'
import { Rooms, groupGuid, newRoomCode } from './rooms.ts'
import { Store } from './store.ts'
import { RoomGraphs } from './roomGraph.ts'
import type { ConversationMessage } from '../shared/analysis.ts'
const config = { appId: 'test-app', region: 'in', restKey: 'server-only-rest-key' }
const ai = { apiKey: 'server-only-ai-key', baseUrl: 'https://example.test/v1', model: 'test' }
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
class FakeChat extends ChatAPI {
  users = new Map<string, { name: string; authToken: string }>()
  groups = new Map<string, { guid: string; name: string; type: string; metadata: { ghostroom: { version: number } }; owner: string; members: Set<string> }>()
  history: ConversationMessage[] = []
  deletedIds: string[] = []
  failMembership = false
  constructor() { super(config) }
  override async createUser(uid: string, name: string) { const user = { name, authToken: 'token-' + uid }; this.users.set(uid, user); return user }
  override async updateUser(uid: string, name: string) { this.users.get(uid)!.name = name }
  override async createGroup(guid: string, name: string, uid: string) {
    const group = { guid, name, type: 'private', metadata: { ghostroom: { version: 1 } }, owner: uid, members: new Set([uid]) }
    this.groups.set(guid, group); return { ...group, hasJoined: true }
  }
  override async getGroup(guid: string, uid?: string) {
    const group = this.groups.get(guid)
    if (!group) throw new Error('Missing group')
    return { ...group, hasJoined: Boolean(uid && group.members.has(uid)) }
  }
  override async addMember(guid: string, uid: string) { if (!this.failMembership) this.groups.get(guid)!.members.add(uid) }
  override async messages() { return { messages: this.history, deletedIds: this.deletedIds } }
}

test('room codes are readable and normalize to a deterministic GUID', () => {
  const codes = Array.from({ length: 1000 }, newRoomCode)
  assert.equal(new Set(codes).size, codes.length)
  for (const code of codes) assert.match(code, /^GR-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/)
  assert.equal(groupGuid(' gr-x7k9m2qp '), groupGuid('GR-X7K9M2QP'))
  assert.notEqual(groupGuid(codes[0]), groupGuid(codes[1]))
})

test('HTTP rooms have distinct persistent identities, real private membership, and authorization', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'ghostroom-'))
  const path = join(directory, 'state.json')
  const chat = new FakeChat(); const store = new Store(path)
  const app = createApp(ai, undefined, new Rooms(chat, store))
  app.listen(0, '127.0.0.1'); await once(app, 'listening')
  const base = 'http://127.0.0.1:' + (app.address() as { port: number }).port
  async function call(route: string, body?: unknown, cookie = '') {
    return fetch(base + route, { headers: { 'Content-Type': 'application/json', Cookie: cookie }, ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) })
  }
  try {
    const created = await call('/api/rooms/create', { displayName: 'Khushi', roomName: 'Product Strategy' })
    assert.equal(created.status, 201)
    const a = await created.json(); const cookieA = created.headers.get('set-cookie')!.split(';')[0]
    assert.match(created.headers.get('set-cookie')!, /HttpOnly; SameSite=Lax/)
    assert.equal(a.room.guid, groupGuid(a.room.code))
    assert.equal(chat.groups.get(a.room.guid)!.owner, a.uid)
    assert.equal(chat.groups.get(a.room.guid)!.type, 'private')
    assert.equal((await call('/api/rooms/' + a.room.code + '/graph')).status, 403)
    assert.equal((await call('/api/analyze-conversation', { roomCode: a.room.code })).status, 403)
    assert.equal((await call('/api/rooms/join', { displayName: 'Alex', roomCode: a.room.code, uid: a.uid })).status, 400)
    const joined = await call('/api/rooms/join', { displayName: 'Alex', roomCode: a.room.code.toLowerCase() })
    const b = await joined.json(); const cookieB = joined.headers.get('set-cookie')!.split(';')[0]
    assert.equal(joined.status, 200); assert.notEqual(a.uid, b.uid); assert.notEqual(a.authToken, b.authToken)
    assert.deepEqual(a.room, b.room)
    assert.deepEqual([...chat.groups.get(a.room.guid)!.members], [a.uid, b.uid])
    assert.equal((await (await call('/api/session', undefined, cookieA)).json()).uid, a.uid)
    assert.equal((await (await call('/api/session', undefined, cookieB)).json()).displayName, 'Alex')
    const restored = new Store(path)
    assert.equal(Object.values(restored.data.sessions).find(s => s.uid === a.uid)!.currentRoom, a.room.code)
    await call('/api/rooms/exit', {}, cookieA)
    assert.equal((await (await call('/api/session', undefined, cookieA)).json()).room, null)
    const rejoined = await (await call('/api/rooms/join', { displayName: 'Khushi', roomCode: a.room.code }, cookieA)).json()
    assert.equal(rejoined.uid, a.uid); assert.equal(chat.users.size, 2)
    assert.ok(!JSON.stringify(a).includes(config.restKey))
    chat.failMembership = true
    const failure = await call('/api/rooms/join', { displayName: 'Third user', roomCode: a.room.code })
    assert.equal(failure.status, 502)
  } finally { app.closeAllConnections(); app.close(); await once(app, 'close'); rmSync(directory, { recursive: true, force: true }) }
})

test('shared graph runs once for two users, survives restart, and retains graph on AI failure', async () => {
  const chat = new FakeChat(); const store = new Store()
  chat.history = [{ id: '1', senderId: 'khushi', senderName: 'Khushi', text: 'We should launch a landing page.', timestamp: '2026-10-06T12:00:00Z' }]
  let calls = 0; let fail = false
  const provider = (async () => {
    calls++; await wait(10)
    return fail ? new Response('{}', { status: 500 }) : new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ nodes: [{ id: 'idea-1', type: 'idea', label: 'Landing page', summary: 'Launch a landing page.', sourceMessageIds: ['1'], authorId: 'khushi' }], edges: [] }) } }] }))
  }) as typeof fetch
  const graphs = new RoomGraphs(chat, store, ai, provider, 5)
  try {
    await Promise.all([graphs.get('room', 'khushi'), graphs.get('room', 'alex')]); await wait(60)
    const a = await graphs.get('room', 'khushi'); const b = await graphs.get('room', 'alex')
    assert.deepEqual(a.graph, b.graph); assert.equal(calls, 1); assert.equal(a.version, 1)
    const restored = new RoomGraphs(chat, store, ai, provider, 5)
    try { assert.deepEqual((await restored.get('room', 'alex')).graph, a.graph); await wait(20); assert.equal(calls, 1) } finally { restored.dispose() }
    fail = true; chat.history[0] = { ...chat.history[0], text: 'We should launch a landing page after interviews.' }
    await graphs.get('room', 'alex', true); await wait(60)
    const failed = await graphs.get('room', 'khushi')
    assert.deepEqual(failed.graph, a.graph); assert.ok(failed.error); assert.equal(calls, 2)
  } finally { graphs.dispose() }
})
