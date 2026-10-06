import { memo } from 'react'
import type { CSSProperties } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import type { GraphNode } from './models'
import { nodeAppearance } from './appearance'


export type ConceptFlowNode = Node<{
  concept: GraphNode
  delay: number
  dimmed?: boolean
  onOpen?: (id: string) => void
}, 'concept'>

export const ConceptNode = memo(function ConceptNode({ data, selected }: NodeProps<ConceptFlowNode>) {
  const { concept, delay, dimmed } = data
  const appearance = nodeAppearance[concept.type]
  const style = { '--node-color': appearance.color, '--entry-delay': `${delay}ms` } as CSSProperties
  return (
    <div className={`concept-shell${dimmed ? ' is-dimmed' : ''}`}>
      <article className={`concept-card type-${concept.type}${concept.id === 'relay' ? ' central-concept' : ''}${selected ? ' is-selected' : ''}`} style={style} role="button" tabIndex={0} aria-label={`Open ${concept.label}`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); data.onOpen?.(concept.id) } }}>
        <Handle type="target" position={Position.Left} isConnectable={false} />
        <div className="concept-meta"><span className="concept-symbol" aria-hidden="true">{appearance.icon}</span><span>{appearance.title}</span><span className="concept-sequence">{concept.sourceMessageIds.length.toString().padStart(2, '0')} MSG</span></div>
        <h3>{concept.label}</h3>
        {concept.type !== 'person' && <p>{concept.summary}</p>}
        {concept.type === 'person' && <p>{concept.summary.split('.')[0]}</p>}
        <Handle type="source" position={Position.Right} isConnectable={false} />
      </article>
    </div>
  )
})
