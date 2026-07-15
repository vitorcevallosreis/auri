import { Message } from "@/contexts/Chats/interfaces"
import useLocationMessageModel from "./model"
import LocationMessageView from "./view"

interface LocationMessageProps {
  w_full: boolean
  message: Message
}

export default function LocationMessage({
  w_full,
  message,
}: LocationMessageProps) {
  const LocationMessageModel = useLocationMessageModel(w_full, message)

  return <LocationMessageView {...LocationMessageModel} />
}
