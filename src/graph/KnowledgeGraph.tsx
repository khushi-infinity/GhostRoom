import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, Controls, MarkerType, ReactFlow, useNodesInitialized, useReactFlow } from '@xyflow/react'
import type { Edge, NodeChange } from '@xyflow/react'
import { ConceptNode } from './ConceptNode'
import { nodeAppearance } from './appearance'
import type { ConceptFlowNode } from './ConceptNode'
import { graphNodeTypes } from './models'
import type { KnowledgeGraph as GraphData, SourceMessage } from './models'
import { NodeDetails } from './NodeDetails'
import './graph.css'

const nodeTypes = { concept: ConceptNode }
const columns = { person: 0, evidence: 0, idea: 1, question: 2, disagreement: 0, decision: 1, task: 2 }

function InitialGraphViewport({ count }: { count: number }) {
  const initialized = useNodesInitialized()
  const { fitView } = useReactFlow()
  const fitted = useRef(false)
  useEffect(() => {
    if (!initialized || !count || fitted.current) return
    fitted.current = true
    void fitView({ padding: 0.15, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500 })
  }, [initialized, count, fitView])
  return null
}

export function KnowledgeGraph({ graph, sources, thinking, error, onRetry, connected }: {
  graph: GraphData; sources: SourceMessage[]; thinking: boolean; error: string | null; onRetry: () => void; connected: boolean
}) {
  const [draggedPositions, setDraggedPositions] = useState(new Map<string, { x: number; y: number }>())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const nodes: ConceptFlowNode[] = useMemo(() => {
    const rows = [0, 0, 0]
    return graph.nodes.map((concept, index) => {
      const column = columns[concept.type]
      const position = { x: column * 320, y: rows[column]++ * 170 }
      return { id: concept.id, type: 'concept', position: draggedPositions.get(concept.id) || position,
        data: { concept, delay: Math.min(index * 45, 300) },
        ariaLabel: `${nodeAppearance[concept.type].title}: ${concept.label}. Open source messages.` }
    })
  }, [graph.nodes, draggedPositions])
  const onNodesChange = useCallback((changes: NodeChange<ConceptFlowNode>[]) => {
    // Measurement events must not rebuild the controlled nodes: doing so resets
    // React Flow's measurement pass before newly arrived nodes become visible.
    if (!changes.some(change => change.type === 'position' && change.position)) return
    setDraggedPositions(current => {
      const next = new Map(current)
      changes.forEach(change => { if (change.type === 'position' && change.position) next.set(change.id, change.position) })
      return next
    })
  }, [setDraggedPositions])
  const graphRoot = useRef<HTMLElement>(null)
  const selected = graph.nodes.find(node => node.id === selectedId)
  const closeDetails = useCallback(() => { setSelectedId(null); graphRoot.current?.focus({ preventScroll: true }) }, [setSelectedId])

  const visibleIds = useMemo(() => new Set(nodes.map(node => node.id)), [nodes])
  const connectedIds = useMemo(() => {
    const ids = new Set([selectedId])
    graph.edges.forEach(edge => { if (edge.source === selectedId || edge.target === selectedId) { ids.add(edge.source); ids.add(edge.target) } })
    return ids
  }, [selectedId, graph.edges])
  const displayNodes = nodes.map(node => ({
    ...node, selected: node.id === selectedId,
    data: { ...node.data, dimmed: Boolean(selectedId && !connectedIds.has(node.id)), onOpen: setSelectedId },
  }))
  const edges: Edge[] = useMemo(() => graph.edges.filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target)).map(edge => {
    const highlighted = edge.source === selectedId || edge.target === selectedId
    const source = graph.nodes.find(node => node.id === edge.source)!
    const color = highlighted ? nodeAppearance[source.type].color : '#56516c'
    return {
      ...edge, type: 'smoothstep', label: edge.relationship,
      animated: highlighted || (!selectedId && source.type === 'decision'),
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      style: { stroke: color, strokeWidth: highlighted ? 2 : 1.2, opacity: selectedId && !highlighted ? 0.16 : 0.75 },
      labelStyle: { fill: highlighted ? '#e5dff3' : '#a39bb6', fontSize: 10, fontFamily: 'DM Sans, sans-serif' },
      labelBgStyle: { fill: '#11131d', fillOpacity: 0.95 }, labelBgPadding: [6, 4] as [number, number], labelBgBorderRadius: 5,
    }
  }), [visibleIds, selectedId, graph])


  return (
    <section ref={graphRoot} tabIndex={-1} className="graph-panel knowledge-graph" aria-label="Knowledge graph">
      <div className="panel-heading"><div><span className="eyebrow">02 / KNOWLEDGE GRAPH</span><h2>The bigger picture</h2></div><span className="graph-count" aria-live="polite">{nodes.length} nodes <span>·</span> {edges.length} connections</span></div>
      <div className="graph-demo-bar"><div><span className="demo-badge">LIVE GRAPH</span><span>{thinking ? 'Graph thinking...' : connected ? 'Grounded in this conversation' : 'Open a group to begin'}</span></div><span className={`analysis-status${thinking ? ' is-thinking' : ''}`} role="status"><i />{thinking ? 'Analyzing' : error ? 'Paused' : 'Ready'}</span></div>
      {error && <div className="analysis-error" role="status"><span>{error}</span><button onClick={onRetry} disabled={thinking}>Retry</button></div>}
      <div className="graph-canvas">
        <ReactFlow<ConceptFlowNode> nodes={displayNodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onNodeClick={(_, node) => setSelectedId(node.id)}
          onNodeDoubleClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={closeDetails} fitView fitViewOptions={{ padding: 0.13 }}
          colorMode="dark" minZoom={0.25} maxZoom={1.8} nodesConnectable={false}
          nodesFocusable={false} edgesFocusable={false} deleteKeyCode={null}>
          <InitialGraphViewport count={nodes.length} />
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} color="#303040" />
          <Controls showInteractive={false} fitViewOptions={{ padding: 0.13, duration: 500 }} />
        </ReactFlow>
        {!nodes.length && <div className="graph-empty"><div className="orbital" aria-hidden="true"><div className="orbital-core">✧</div><i className="satellite one" /><i className="satellite two" /></div><span className="eyebrow">CONVERSATION BECOMES KNOWLEDGE</span><h3>A bigger picture is taking shape.</h3><p>{thinking ? 'Looking for ideas, evidence, and decisions…' : 'Start a conversation. Connections will appear here.'}</p></div>}
        {selected && <NodeDetails key={selected.id} node={selected} graph={graph} sources={sources} onClose={closeDetails} onSelect={setSelectedId} />}
      </div>
      <footer className="graph-legend">{graphNodeTypes.map(type => <span key={type}><i className={`node-dot ${type}`} />{type}</span>)}<span className="mock-disclaimer">Drag · zoom · trace</span></footer>
    </section>
  )
}
