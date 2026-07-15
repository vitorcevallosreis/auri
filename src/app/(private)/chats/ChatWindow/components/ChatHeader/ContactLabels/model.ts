import { ChatsContext } from "@/contexts/Chats"
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react"

export interface IContactLabelsModel {
  is_open: boolean
  set_is_open: Dispatch<SetStateAction<boolean>>
  labels: string[]
  handleAddLabel: () => void
  handleChangeLabel: (index: number, value: string) => void
  handleRemoveLabel: (index: number) => void
  handleSave: () => Promise<void>
}

const useContactLabelsModel = (
  is_open: boolean,
  set_is_open: Dispatch<SetStateAction<boolean>>
): IContactLabelsModel => {
  const { chat, updateChatLabels } = useContext(ChatsContext)

  const [labels, setLabels] = useState<string[]>(chat.labels || [])

  useEffect(() => {
    setLabels(chat.labels)
  }, [chat])

  const handleAddLabel = () => setLabels([...labels, ""])

  const handleChangeLabel = (index: number, value: string) => {
    const updatedLabels = [...labels]
    updatedLabels[index] = value

    setLabels(updatedLabels)
  }

  const handleRemoveLabel = (index: number) => {
    const updatedLabels = labels.filter((_, i) => i !== index)
    setLabels(updatedLabels)
  }

  const handleSave = async () => await updateChatLabels(chat.id, labels)

  return {
    is_open,
    set_is_open,
    labels,
    handleAddLabel,
    handleChangeLabel,
    handleRemoveLabel,
    handleSave,
  }
}

export default useContactLabelsModel
