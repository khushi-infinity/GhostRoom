import { useEffect, useState } from 'react'
import type { RoomSession } from '../shared/rooms'
import { KnowledgeGraph } from './graph/KnowledgeGraph'
import { useConversationGraph } from './graph/useConversationGraph'
import { ChatPanel } from './ChatPanel'
import type { Participant } from './ChatPanel'
import { RoomLanding } from './RoomLanding'
import { api, copyRoomCode, loadSession } from './rooms'
import { describeError, openChatRoom } from './cometchat'
import './App.css'

export default function App() {
  const [session, setSession] = useState<RoomSession | null>(null)
  const [group, setGroup] = useState<Awaited<ReturnType<typeof openChatRoom>> | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState('chat')
  const analysis = useConversationGraph(group?.getGuid() || null, group ? session?.room?.code || null : null)
  useEffect(() => {
    document.title = 'GhostRoom — Think together'
    const controller = new AbortController()
    loadSession(controller.signal).then(async next => {
      if (controller.signal.aborted) return
      if (next?.room) {
        const restored = await openChatRoom(next)
        if (controller.signal.aborted) return
        setGroup(restored)
      }
      setSession(next)
    }).catch(error => { if (!controller.signal.aborted) setError(describeError(error)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])
  async function enter(next: RoomSession) {
    const nextGroup = await openChatRoom(next)
    setSession(next); setGroup(nextGroup); setParticipants([]); setError(''); setCopied(false)
  }
  async function exit() {
    try { await api('/api/rooms/exit', {}); setGroup(null); setParticipants([]); setSession(current => current ? { ...current, room: null } : null) }
    catch (error) { setError(describeError(error)) }
  }
  const room = group ? session?.room : null
  return <div className={`app-shell${room ? '' : ' landing-shell'}`}>
    <header className="app-header">
      <a className="brand" href="/" aria-label="GhostRoom home"><span className="ghost-mark" aria-hidden="true">◉</span> GhostRoom<span className="version">LAB</span></a>
      {room ? <><div className="room-heading"><span className="room-hash">#</span><span>{room.name}<small>Room: {room.code} <button className="invite-copy" onClick={() => { void copyRoomCode(room.code).then(() => setCopied(true)).catch(() => setError(`Copy unavailable. Your invite code is ${room.code}.`)) }}>{copied ? 'Copied' : 'Copy Invite'}</button></small></span></div><div className="header-actions"><div className="participant-roster" aria-label="Room participants">{participants.map(member => <span key={member.uid} title={member.online ? 'Online' : 'Offline'}>{member.name}<i className={member.online ? 'online' : ''} /></span>)}{!participants.length && <span>Loading members…</span>}</div><button className="exit-room" onClick={() => void exit()}>Rooms</button></div></> : <span className="landing-header-note">Conversation → connected knowledge</span>}
    </header>
    {loading ? <main className="room-landing"><p role="status">Restoring your room…</p></main> : !room || !group ? <RoomLanding displayName={session?.displayName || ''} onEnter={enter} initialError={error} /> : <>
      <div className="workspace-intro"><span><i className="live-dot" /> THINK TOGETHER. SEE THE CONNECTIONS.</span><span className="intro-note">Every conversation has a bigger picture.</span>{error && <span role="alert" className="error-message">{error}</span>}</div>
      <nav className="mobile-tabs" aria-label="Workspace panel"><button aria-pressed={view === 'chat'} onClick={() => setView('chat')}>Conversation</button><button aria-pressed={view === 'graph'} onClick={() => setView('graph')}>Knowledge graph</button></nav>
      <main className={`workspace mobile-${view}`}><section className="chat-panel" aria-label="Group conversation"><div className="panel-heading"><div><span className="eyebrow">01 / CONVERSATION</span><h1>Where ideas begin</h1></div><span className="panel-tag">COMETCHAT</span></div><ChatPanel key={group.getGuid()} group={group} onParticipants={setParticipants} onMessages={analysis.onMessages} /></section><KnowledgeGraph key={group.getGuid()} graph={analysis.graph} sources={analysis.sources} thinking={analysis.thinking} error={analysis.error} onRetry={analysis.retry} connected /></main>
    </>}
    <footer className="app-footer"><span>GHOSTROOM <span className="footer-separator">/</span> A place for collective intelligence</span><span>Conversation → connected knowledge <i /></span></footer>
  </div>
}
