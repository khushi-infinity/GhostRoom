import type { GraphNodeType } from './models'

export const nodeAppearance: Record<GraphNodeType, { color: string; icon: string; title: string }> = {
  idea: { color: '#bd9cf7', icon: '✧', title: 'Idea' },
  evidence: { color: '#79cfb8', icon: '▥', title: 'Evidence' },
  question: { color: '#80b8ff', icon: '?', title: 'Question' },
  disagreement: { color: '#f194a3', icon: '⇄', title: 'Disagreement' },
  decision: { color: '#edc57f', icon: '✓', title: 'Decision' },
  task: { color: '#a9a8ff', icon: '↗', title: 'Task' },
  person: { color: '#a6b9cb', icon: '◉', title: 'Person' },
}

