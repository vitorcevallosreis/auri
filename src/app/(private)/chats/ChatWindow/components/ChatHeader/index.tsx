import useChatHeaderModel from "./model";
import ChatHeaderView from "./view";

export default function ChatHeader() {
  const chatHeaderModel = useChatHeaderModel();

  return <ChatHeaderView {...chatHeaderModel} />;
}
