"use client"

import { useContext, useEffect } from "react"

import { useRouter } from "next/navigation"
import { AuthContext } from "@/contexts/Auth"
import { AssistantsContext } from "@/contexts/Assistants"
import { Assistant } from "@/contexts/Assistants/interfaces"

export interface IAssistantsPageModel {
  isLoading: boolean
  assistants: Assistant[]
  router: ReturnType<typeof useRouter>
  deleteAssistant: (assistant_id: string) => Promise<void>
}

const useAssistantsPageModel = (): IAssistantsPageModel => {
  const { user } = useContext(AuthContext)
  const { isLoading, getAssistants, assistants, deleteAssistant } =
    useContext(AssistantsContext)
  const router = useRouter()

  useEffect(() => {
    if (!user?.company_id) return

    getAssistants()
  }, [user])

  return { isLoading, assistants, router, deleteAssistant }
}

export default useAssistantsPageModel
