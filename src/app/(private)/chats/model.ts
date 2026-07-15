"use client"

import { ChatsContext } from "@/contexts/Chats"
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react"

export interface IchatsModel {
  show_archiveds: boolean
  set_show_archiveds: Dispatch<SetStateAction<boolean>>
}

const usechatsModel = (): IchatsModel => {
  const { getChats } = useContext(ChatsContext)
  const [show_archiveds, set_show_archiveds] = useState(false)

  useEffect(() => {
    getChats(show_archiveds)
  }, [show_archiveds])

  return { show_archiveds, set_show_archiveds }
}

export default usechatsModel
