import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { AnalysisGraph, ConversationMessage } from '../shared/analysis.ts'

export interface Identity { uid: string; displayName: string; authToken: string; rooms: string[]; currentRoom: string | null; expiresAt: number }
export interface StoredGraph { graph: AnalysisGraph; messages: ConversationMessage[]; analyzedHash: string; version: number }
interface Data { sessions: Record<string, Identity>; graphs: Record<string, StoredGraph> }
/** One backend process + persistent volume. Atomic replace protects restarts; no room mapping database. */
export class Store {
  data: Data = { sessions: {}, graphs: {} }
  constructor(private path?: string) {
    if (path) {
      try { this.data = JSON.parse(readFileSync(path, 'utf8')) }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
    }
  }
  save() {
    if (!this.path) return
    mkdirSync(dirname(this.path), { recursive: true, mode: 0o700 })
    writeFileSync(`${this.path}.tmp`, JSON.stringify(this.data), { mode: 0o600 })
    renameSync(`${this.path}.tmp`, this.path)
  }
}
