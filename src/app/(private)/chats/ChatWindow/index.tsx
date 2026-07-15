import useChatWindowModel from './model'
import ChatWindowView from './view'

export default function Chat() {
  const chatWindowModel = useChatWindowModel()

  return <ChatWindowView {...chatWindowModel} />
}
