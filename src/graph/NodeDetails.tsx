import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import type { GraphNode, KnowledgeGraph, SourceMessage } from './models'
import { nodeAppearance } from './appearance'

const formatTime = (timestamp: string) => new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })

export function NodeDetails({ node, graph, sources, onClose, onSelect }: {
  node: GraphNode
  graph: KnowledgeGraph
  sources: SourceMessage[]
  onClose: () => void
  onSelect: (id: string) => void
}) {
  const closeButton = useRef<HTMLButtonElement>(null)
  const appearance = nodeAppearance[node.type]
  const messageById = new Map(sources.map(message => [message.id, message]))
  const authorNames = new Map(sources.map(message => [message.authorId, message.authorName]))
  const authorName = node.authorId ? authorNames.get(node.authorId) || node.authorId : 'Conversation participants'
  const related = graph.edges.filter(edge => edge.source === node.id || edge.target === node.id)
  useEffect(() => {
    closeButton.current?.focus({ preventScroll: true })
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose() } }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])
  return (
    <aside className="node-details" aria-label="Node details" style={{ '--node-color': appearance.color } as CSSProperties}>
      <header className="details-top"><span className="eyebrow">TRACE THE THOUGHT</span><button ref={closeButton} onClick={onClose} aria-label="Close node details">×</button></header>
      <div className="details-body">
        <span className="details-type"><span aria-hidden="true">{appearance.icon}</span> {appearance.title}</span>
        <h3>{node.label}</h3><p className="details-summary">{node.summary}</p>
        <div className="details-author"><span className="author-avatar">{authorName.split(' ').map(part => part[0]).slice(0, 2).join('')}</span><div>{authorName}<small>{formatTime(node.timestamp)} IST · {new Date(node.timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</small></div></div>
        <section className="source-section"><h4>Source messages <span>{node.sourceMessageIds.length}</span></h4><p className="source-explainer">The conversation behind this concept.</p>
          {node.sourceMessageIds.map(id => {
            const message = messageById.get(id)
            return <article className="source-message" key={id}><div className="source-byline"><strong>{message?.authorName || 'Unknown author'}</strong>{message && <time dateTime={message.timestamp}>{formatTime(message.timestamp)}</time>}</div><blockquote>{message?.text || 'This source message is unavailable.'}</blockquote><code>{id}</code></article>
          })}
        </section>
        <section className="related-section"><h4>Connected concepts <span>{related.length}</span></h4>{related.map(edge => {
          const other = graph.nodes.find(candidate => candidate.id === (edge.source === node.id ? edge.target : edge.source))!
          return <button key={edge.id} onClick={() => onSelect(other.id)}><span className="related-relationship">{edge.source === node.id ? '→' : '←'} {edge.relationship}</span><span>{other.label} <span aria-hidden="true">↗</span></span></button>
        })}</section>
        <p className="provenance-note">Extracted from this conversation · source IDs refer to real CometChat messages.</p>
      </div>
    </aside>
  )
}
