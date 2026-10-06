import { useState } from 'react'
import type { FormEvent } from 'react'
import type { RoomSession } from '../shared/rooms'
import { copyRoomCode, enterRoom } from './rooms'
import { describeError } from './cometchat'
export function RoomLanding({ displayName, onEnter, initialError }: { displayName: string; onEnter: (session: RoomSession) => Promise<void>; initialError: string }) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [name, setName] = useState(displayName)
  const [value, setValue] = useState('')
  const [created, setCreated] = useState<RoomSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [copied, setCopied] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!mode) return
    setBusy(true); setError('')
    try {
      const session = await enterRoom(mode, name, value)
      if (mode === 'create') setCreated(session)
      else await onEnter(session)
    } catch (error) { setError(describeError(error)) }
    finally { setBusy(false) }
  }
  async function enterCreated() {
    if (!created) return
    setBusy(true); setError('')
    try { await onEnter(created) } catch (error) { setError(describeError(error)) }
    finally { setBusy(false) }
  }
  return <main className="room-landing"><div className="landing-glow" aria-hidden="true" /><div className="room-card">
    <span className="eyebrow">A PLACE FOR COLLECTIVE INTELLIGENCE</span>
    {created?.room ? <><div className="room-success-icon" aria-hidden="true">✓</div><h1>Room created</h1><p>{created.room.name}</p><label>Room code</label><strong className="invite-code">{created.room.code}</strong><p className="landing-caption">Share this code to bring your people into the room.</p><div className="landing-actions"><button onClick={() => { void copyRoomCode(created.room!.code).then(() => setCopied(true)).catch(() => setError('Copy unavailable. Select and copy the room code above.')) }}>{copied ? 'Copied' : 'Copy Code'}</button><button className="primary" disabled={busy} onClick={() => void enterCreated()}>{busy ? 'Connecting…' : 'Enter Room →'}</button></div></> : <>
      <h1>{mode === 'create' ? 'Make room for ideas.' : mode === 'join' ? 'Step into the conversation.' : 'Think together.\nSee the connections.'}</h1>
      <p>{mode ? 'Your name. Your people. A shared perspective.' : 'A private conversation. A living map of what matters.'}</p>
      {!mode ? <div className="landing-actions"><button className="primary" onClick={() => { setMode('create'); setValue(''); setError('') }}>Create a Room →</button><button onClick={() => { setMode('join'); setValue(''); setError('') }}>Join a Room</button></div> : <form onSubmit={submit}>
        <label htmlFor="display-name">Display Name</label><input id="display-name" autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} required maxLength={80} disabled={busy} placeholder="Your name" />
        <label htmlFor="room-value">{mode === 'create' ? 'Room Name' : 'Room Code'}</label><input id="room-value" autoComplete="off" value={value} onChange={e => setValue(mode === 'join' ? e.target.value.toUpperCase() : e.target.value)} required maxLength={mode === 'create' ? 100 : 11} disabled={busy} placeholder={mode === 'create' ? 'Product Strategy' : 'GR-X7K9M2QP'} />
        <div className="landing-actions"><button type="button" disabled={busy} onClick={() => { setMode(null); setError('') }}>Back</button><button className="primary" disabled={busy}>{busy ? 'Connecting…' : mode === 'create' ? 'Create Room →' : 'Join Room →'}</button></div>
      </form>}
    </>}
    {error && <p className="error-message" role="alert">{error}</p>}<span className="secure-note">Private rooms · Real people · Connected knowledge</span>
  </div></main>
}
