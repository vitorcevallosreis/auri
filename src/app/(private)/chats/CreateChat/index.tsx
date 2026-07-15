import useCreateChatModel from "./model"
import CreateChatView from "./view"

export default function CreateChat() {
  const CreateChatModel = useCreateChatModel()

  return <CreateChatView {...CreateChatModel} />
}
