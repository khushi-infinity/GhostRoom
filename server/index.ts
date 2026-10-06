import { config as loadEnv } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { createApp } from './app.ts'
import { ChatAPI } from './cometchat.ts'
import { Rooms } from './rooms.ts'
import { Store } from './store.ts'

// Server-only file; never VITE_-prefixed or imported by browser code.
loadEnv({ path: fileURLToPath(new URL('./.env', import.meta.url)), quiet: true })
const rooms = new Rooms(new ChatAPI({ appId: process.env.COMETCHAT_APP_ID || '', region: process.env.COMETCHAT_REGION || '', restKey: process.env.COMETCHAT_REST_API_KEY || '' }),
  new Store(process.env.DATA_PATH || fileURLToPath(new URL('./data/ghostroom.json', import.meta.url))), process.env.COOKIE_SECURE === 'true')
const app = createApp({ apiKey: process.env.AI_API_KEY || '', baseUrl: process.env.AI_BASE_URL || '', model: process.env.AI_MODEL || '' }, undefined, rooms, process.env.PUBLIC_ORIGIN)
const port = Number(process.env.PORT || process.env.API_PORT || 3001)
const host = process.env.HOST || '0.0.0.0'
app.listen(port, host, () => console.log(`GhostRoom listening on http://${host}:${port}`))
const stop = () => app.close(() => process.exit(0))
process.on('SIGTERM', stop)
process.on('SIGINT', stop)
