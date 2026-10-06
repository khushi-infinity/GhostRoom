import { useEffect, useState } from 'react'
import { CometChat } from '@cometchat/chat-sdk-javascript'
import { CometChatErrorBoundary, CometChatMessageComposer, CometChatMessageHeader, CometChatMessageList, CometChatProvider, CometChatThreadHeader } from '@cometchat/chat-uikit-react'
import { ConversationBridge } from './ConversationBridge'
import type { ConversationBatch } from './ConversationBridge'

export interface Participant { uid: string; name: string; online: boolean }
type Props = { group: CometChat.Group; onParticipants: (members: Participant[]) => void; onMessages: (batch: ConversationBatch) => void }
export function ChatPanel({ group, onParticipants, onMessages }: Props) {
  const [thread, setThread] = useState<CometChat.BaseMessage | null>(null)
  useEffect(() => {
    let active = true; let loading = false
    const listener = `ghostroom-members-${group.getGuid()}`
    let refreshId: ReturnType<typeof setTimeout> | undefined
    async function refresh() {
      if (loading) return
      loading = true
      try {
        const request = new CometChat.GroupMembersRequestBuilder(group.getGuid()).setLimit(100).build()
        const members: CometChat.GroupMember[] = []; let page: CometChat.GroupMember[]
        do { page = await request.fetchNext(); members.push(...page) } while (active && page.length === 100)
        if (active) onParticipants(members.map(member => ({ uid: member.getUid(), name: member.getName(), online: member.getStatus() === CometChat.USER_STATUS.ONLINE })))
      } catch { /* Keep the last confirmed roster while presence reconnects. */ }
      finally { loading = false }
    }
    const schedule = () => { clearTimeout(refreshId); refreshId = setTimeout(() => void refresh(), 250) }
    CometChat.addUserListener(listener, new CometChat.UserListener({ onUserOnline: schedule, onUserOffline: schedule }))
    CometChat.addGroupListener(listener, new CometChat.GroupListener({ onMemberAddedToGroup: schedule, onGroupMemberJoined: schedule }))
    void refresh()
    const interval = setInterval(() => void refresh(), 5000)
    return () => { active = false; clearTimeout(refreshId); clearInterval(interval); CometChat.removeUserListener(listener); CometChat.removeGroupListener(listener) }
  }, [group, onParticipants])
  return <div className="chat-surface"><CometChatProvider theme="dark"><ConversationBridge key={group.getGuid()} roomId={group.getGuid()} onMessages={onMessages} /><CometChatErrorBoundary><div className="message-pane" key={group.getGuid()}>{thread ? <CometChatThreadHeader parentMessage={thread} onClose={() => setThread(null)} onParentDeleted={() => setThread(null)} /> : <CometChatMessageHeader group={group} hideBackButton showSearchOption={false} trailingView={<span className="panel-tag">PRIVATE ROOM</span>} />}
    <div className="message-list"><CometChatMessageList group={group} parentMessage={thread || undefined} onThreadRepliesClick={setThread} hideMessagePrivatelyOption /></div><CometChatMessageComposer group={group} parentMessageId={thread?.getId()} placeholder="Put an idea into the room…" /></div></CometChatErrorBoundary></CometChatProvider></div>
}
