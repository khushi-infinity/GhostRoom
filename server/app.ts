import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AIConfig } from './analyze.ts'
import { analyzeConversation } from './analyze.ts'
import { AnalysisError, validateRequest } from './graph.ts'
import { createRoomSchema, joinRoomSchema, roomCodeSchema } from '../shared/rooms.ts'
import { Rooms } from './rooms.ts'
import { RoomGraphs } from './roomGraph.ts'

const MAX_BODY = 1_000_000
function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(value))
}
async function readBody(request: IncomingMessage): Promise<unknown> {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new AnalysisError(415, 'JSON_REQUIRED', 'Use Content-Type: application/json.')
  const chunks = await new Promise<Buffer[]>((resolve, reject) => {
    let size = 0
    let rejected = false
    const buffers: Buffer[] = []
    request.on('data', (chunk: Buffer) => {
      if (rejected) return
      size += chunk.length
      if (size > MAX_BODY) { rejected = true; buffers.length = 0; reject(new AnalysisError(413, 'INPUT_TOO_LARGE', 'Conversation input exceeds the size limit.')); return }
      buffers.push(chunk)
    })
    request.on('end', () => { if (!rejected) resolve(buffers) })
    request.on('error', () => reject(new AnalysisError(400, 'INPUT_INTERRUPTED', 'Conversation input was interrupted.')))
    request.on('aborted', () => reject(new AnalysisError(400, 'INPUT_INTERRUPTED', 'Conversation input was interrupted.')))
  })

  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) }
  catch { throw new AnalysisError(400, 'INVALID_JSON', 'Request body must be valid JSON.') }
}

export function createApp(config: AIConfig, fetchImpl?: typeof fetch, rooms?: Rooms, publicOrigin?: string) {
  let inFlight = 0
  const recent: number[] = []
  const graphs = rooms ? new RoomGraphs(rooms.chat, rooms.store, config, fetchImpl) : null
  const roomRequests = new Map<string, number[]>()
  const app = createServer(async (request, response) => {
    // Browser mutations are same-origin. Cookies never authenticate a supplied UID.
    let originAllowed = true
    if (request.headers.origin) {
      try { originAllowed = publicOrigin ? request.headers.origin === publicOrigin : new URL(request.headers.origin).host === request.headers.host }
      catch { originAllowed = false }
    }
    if (request.method === 'POST' && !originAllowed) {
      json(response, 403, { error: { code: 'ORIGIN_DENIED', message: 'Use the GhostRoom app to make this request.' } }); return
    }
    if (request.url === '/api/health' && request.method === 'GET') {
      json(response, 200, { ok: true, aiConfigured: Boolean(config.apiKey && config.baseUrl && config.model) }); return
    }
    if (rooms && graphs && (request.url === '/api/session' || request.url?.startsWith('/api/rooms') || request.url === '/api/analyze-conversation')) {
      try {
        if (request.url === '/api/session' && request.method === 'GET') {
          const identity = rooms.identity(request)
          if (!identity) { json(response, 200, null); return }
          let room = null
          if (identity.currentRoom) {
            await rooms.authorize(request, identity.currentRoom)
            room = await rooms.resolve(identity.currentRoom, identity.uid)
          }
          json(response, 200, rooms.session(identity, room)); return
        }
        if (request.url === '/api/rooms/exit' && request.method === 'POST') {
          const identity = rooms.identity(request)
          if (identity) { identity.currentRoom = null; rooms.store.save() }
          json(response, 200, { ok: true }); return
        }
        if (['/api/rooms/create', '/api/rooms/join'].includes(request.url || '') && request.method === 'POST') {
          const key = request.socket.remoteAddress || 'unknown'
          const now = Date.now()
          const attempts = (roomRequests.get(key) || []).filter(time => time > now - 60000)
          if (attempts.length >= 12) throw new AnalysisError(429, 'ROOM_RATE_LIMIT', 'Too many room attempts. Please wait a minute.')
          attempts.push(now); roomRequests.set(key, attempts)
          const input = await readBody(request)
          if (request.url === '/api/rooms/create') {
            const parsed = createRoomSchema.safeParse(input)
            if (!parsed.success) throw new AnalysisError(400, 'INVALID_ROOM_INPUT', 'Enter a display name and room name (up to 100 characters).')
            json(response, 201, await rooms.create(request, response, parsed.data.displayName, parsed.data.roomName))
          } else {
            const parsed = joinRoomSchema.safeParse(input)
            if (!parsed.success) throw new AnalysisError(400, 'INVALID_ROOM_INPUT', 'Enter your display name and a valid room code.')
            json(response, 200, await rooms.join(request, response, parsed.data.displayName, parsed.data.roomCode))
          }
          return
        }
        const graphRoute = /^\/api\/rooms\/(GR-[A-Z0-9]+)\/graph$/.exec(request.url || '')
        if ((graphRoute && request.method === 'GET') || (request.url === '/api/analyze-conversation' && request.method === 'POST')) {
          const input = graphRoute ? { roomCode: graphRoute[1] } : await readBody(request) as { roomCode?: string }
          const code = roomCodeSchema.safeParse(input?.roomCode)
          if (!code.success) throw new AnalysisError(400, 'ROOM_REQUIRED', 'A valid room code is required for analysis.')
          const identity = await rooms.authorize(request, code.data)
          const room = await rooms.resolve(code.data, identity.uid)
          json(response, 200, await graphs.get(room.guid, identity.uid, !graphRoute)); return
        }
        json(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'This room operation is not supported.' } }); return
      } catch (error) {
        const known = error instanceof AnalysisError ? error : new AnalysisError(500, 'ROOM_ERROR', 'The room operation could not complete. Please retry.')
        if (!response.destroyed) json(response, known.status, { error: { code: known.code, message: known.message } })
        return
      }
    }
    if (request.url !== '/api/analyze-conversation') { json(response, 404, { error: { code: 'NOT_FOUND', message: 'Endpoint not found.' } }); return }
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); json(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST.' } }); return }
    const controller = new AbortController()
    response.on('close', () => { if (!response.writableEnded) controller.abort() })
    let acquired = false
    try {
      const input = validateRequest(await readBody(request))
      const now = Date.now()
      while (recent[0] && recent[0] < now - 60000) recent.shift()
      if (inFlight >= 2 || recent.length >= 20) throw new AnalysisError(429, 'ANALYSIS_BUSY', 'Graph analysis is busy. Retry shortly.')
      recent.push(now); inFlight++; acquired = true
      const graph = await analyzeConversation(input, config, { fetchImpl, signal: controller.signal })
      json(response, 200, graph)
    } catch (error) {
      const known = error instanceof AnalysisError ? error : new AnalysisError(500, 'ANALYSIS_ERROR', 'Graph analysis could not complete. Chat remains available.')
      if (!response.destroyed) json(response, known.status, { error: { code: known.code, message: known.message } })
    } finally { if (acquired) inFlight-- }
  })
  app.on('close', () => graphs?.dispose())
  return app
}
