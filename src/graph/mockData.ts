import type { GraphNode, KnowledgeGraph, SourceMessage } from './models'

// This fixture is deliberately independent of the live CometChat room.
// A future backend adapter replaces the fixture and resolves sourceMessageIds.
export const mockMessages: SourceMessage[] = [
  { id: 'demo-msg-01', authorId: 'demo-maya', authorName: 'Maya Chen', timestamp: '2026-10-06T10:00:00+05:30', text: 'What if we launch Relay: a lightweight customer-feedback inbox for small SaaS teams? Bring interviews, support tickets, and feature requests into one place, so founders know what to build next.' },
  { id: 'demo-msg-02', authorId: 'demo-leo', authorName: 'Leo Patel', timestamp: '2026-10-06T10:02:00+05:30', text: 'I interviewed 12 founders last week. Nine track feedback across spreadsheets and Slack, and seven said they miss recurring requests. There is a real pain here, but we still need to validate willingness to pay.' },
  { id: 'demo-msg-03', authorId: 'demo-noor', authorName: 'Noor Williams', timestamp: '2026-10-06T10:04:00+05:30', text: 'Would teams pay $29 a month for this, or do we need a free tier to get adoption? Let’s ask people to pay before we commit to a price.' },
  { id: 'demo-msg-04', authorId: 'demo-leo', authorName: 'Leo Patel', timestamp: '2026-10-06T10:06:00+05:30', text: 'We could launch on Product Hunt next Friday. A public launch would give us a fast signal and help build a waitlist.' },
  { id: 'demo-msg-05', authorId: 'demo-maya', authorName: 'Maya Chen', timestamp: '2026-10-06T10:08:00+05:30', text: 'I disagree with a public launch yet. We have no onboarding flow and only one integration. A failed first experience could tell us more about bugs than demand. I’d rather work closely with five pilot teams.' },
  { id: 'demo-msg-06', authorId: 'demo-noor', authorName: 'Noor Williams', timestamp: '2026-10-06T10:10:00+05:30', text: 'Three of the founders already offered to pilot Relay with their teams. Two said they would pay if we can import their existing feedback. I’ve saved their interview notes for us to review.' },
  { id: 'demo-msg-07', authorId: 'demo-maya', authorName: 'Maya Chen', timestamp: '2026-10-06T10:12:00+05:30', text: 'Decision: start with a private beta for five SaaS teams in two weeks. Ship the feedback inbox and CSV import first. We’ll consider a public launch after three teams use Relay every week.' },
  { id: 'demo-msg-08', authorId: 'demo-leo', authorName: 'Leo Patel', timestamp: '2026-10-06T10:14:00+05:30', text: 'I’ll own the product build. By Friday I’ll have the feedback inbox, CSV import, and a simple onboarding flow ready for an internal walkthrough.' },
  { id: 'demo-msg-09', authorId: 'demo-noor', authorName: 'Noor Williams', timestamp: '2026-10-06T10:16:00+05:30', text: 'I’ll recruit the five beta teams and run pricing interviews this week. I’ll test the $29 price with a real paid-pilot offer and report how many teams accept.' },
  { id: 'demo-msg-10', authorId: 'demo-maya', authorName: 'Maya Chen', timestamp: '2026-10-06T10:18:00+05:30', text: 'I’ll lead the launch and coordinate the beta. Leo owns engineering, Noor owns customer research. Our success metric is three teams returning weekly, not a big launch-day signup count.' },
]

function concept(id: string, type: GraphNode['type'], label: string, summary: string, messageIds: string[]): GraphNode {
  const source = mockMessages.find(message => message.id === messageIds[0])!
  return { id, type, label, summary, sourceMessageIds: messageIds, authorId: source.authorId, timestamp: source.timestamp }
}

export const mockGraph: KnowledgeGraph = {
  nodes: [
    concept('relay', 'idea', 'Relay · feedback, connected', 'One feedback inbox for small SaaS teams. Bring scattered customer signals together and help founders prioritize what to build.', ['demo-msg-01']),
    concept('research', 'evidence', '9 of 12 founders feel the pain', 'Nine founders spread feedback across spreadsheets and Slack; seven miss recurring requests. Strong problem signal, not yet proof of demand.', ['demo-msg-02']),
    concept('pricing', 'question', 'Will teams pay $29 / month?', 'Validate willingness to pay with actual paid-pilot offers. Free versus paid remains an open question.', ['demo-msg-03', 'demo-msg-09']),
    concept('public-launch', 'idea', 'Go public on Product Hunt', 'A proposed public launch next Friday could bring signups and a fast market signal. The team has not adopted this proposal.', ['demo-msg-04']),
    concept('launch-risk', 'disagreement', 'Launch fast or learn first?', 'Maya challenges the public launch: incomplete onboarding may confuse product-quality problems with lack of demand.', ['demo-msg-04', 'demo-msg-05']),
    concept('pilot-signal', 'evidence', '3 teams already want a pilot', 'Three founders offered to pilot Relay. Two expressed conditional willingness to pay if historical feedback can be imported.', ['demo-msg-06']),
    concept('beta', 'decision', 'Private beta · five teams', 'Launch a private beta in two weeks. Focus on the inbox and CSV import. Revisit a public launch after three teams return weekly.', ['demo-msg-07', 'demo-msg-10']),
    concept('build', 'task', 'Build inbox + CSV import', 'Leo will ship the feedback inbox, CSV import, and basic onboarding for an internal walkthrough by Friday.', ['demo-msg-08']),
    concept('recruit', 'task', 'Recruit beta teams + test price', 'Noor will recruit five teams and test $29/month with a paid-pilot offer this week, then report acceptance.', ['demo-msg-09']),
    concept('maya', 'person', 'Maya Chen', 'Co-founder · launch lead. Coordinates the beta and keeps the team focused on repeat usage.', ['demo-msg-01', 'demo-msg-10']),
    concept('leo', 'person', 'Leo Patel', 'Co-founder · engineering. Conducted founder interviews and owns the first product build.', ['demo-msg-02', 'demo-msg-08']),
    concept('noor', 'person', 'Noor Williams', 'Co-founder · customer research. Owns beta recruitment and willingness-to-pay validation.', ['demo-msg-03', 'demo-msg-09']),
  ],
  edges: [
    { id: 'edge-01', source: 'research', target: 'relay', relationship: 'supports' },
    { id: 'edge-02', source: 'relay', target: 'pricing', relationship: 'raises' },
    { id: 'edge-03', source: 'relay', target: 'public-launch', relationship: 'inspires' },
    { id: 'edge-04', source: 'public-launch', target: 'launch-risk', relationship: 'challenged by' },
    { id: 'edge-05', source: 'launch-risk', target: 'beta', relationship: 'resolved by' },
    { id: 'edge-06', source: 'relay', target: 'beta', relationship: 'validated through' },
    { id: 'edge-07', source: 'pilot-signal', target: 'beta', relationship: 'supports' },
    { id: 'edge-08', source: 'beta', target: 'build', relationship: 'requires' },
    { id: 'edge-09', source: 'beta', target: 'recruit', relationship: 'requires' },
    { id: 'edge-10', source: 'pricing', target: 'recruit', relationship: 'tested by' },
    { id: 'edge-11', source: 'maya', target: 'relay', relationship: 'proposes' },
    { id: 'edge-12', source: 'leo', target: 'build', relationship: 'owns' },
    { id: 'edge-13', source: 'noor', target: 'recruit', relationship: 'owns' },
  ],
}

// Layout is presentation data; the domain models remain independent of React Flow.
export const mockPositions: Record<string, { x: number; y: number }> = {
  maya: { x: 310, y: 0 }, research: { x: 0, y: 0 }, pricing: { x: 630, y: 0 },
  'public-launch': { x: 0, y: 155 }, relay: { x: 300, y: 130 },
  'pilot-signal': { x: 630, y: 155 }, 'launch-risk': { x: 0, y: 310 },
  beta: { x: 310, y: 320 }, build: { x: 630, y: 310 },
  leo: { x: 0, y: 465 }, noor: { x: 310, y: 485 }, recruit: { x: 630, y: 465 },
}

export const messageById = new Map(mockMessages.map(message => [message.id, message]))
export const authorNames = new Map(mockMessages.map(message => [message.authorId, message.authorName]))
