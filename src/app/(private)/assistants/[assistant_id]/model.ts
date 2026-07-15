"use client"

import { AssistantsContext } from "@/contexts/Assistants"
import { yupResolver } from "@hookform/resolvers/yup"
import { useParams } from "next/navigation"
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
} from "react-hook-form"
import { schema } from "./validations"
import { Assistant } from "@/contexts/Assistants/interfaces"
import { useRouter } from "next/navigation"

export interface MenuItem {
  id: string
  label: string
  icon: React.ReactNode
  subItems: { id: string; label: string }[]
}

interface Inputs {
  nome: string
}

export interface IAssistantPageModel {
  assistant: Assistant
  activeMenu: string
  setActiveMenu: Dispatch<SetStateAction<string>>
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
}

const useAssistantPageModel = (): IAssistantPageModel => {
  const { getAssistant, assistant } = useContext(AssistantsContext)
  const { assistant_id }: { assistant_id: string } = useParams()
  const router = useRouter()

  const [activeMenu, setActiveMenu] = useState<string>("profile")

  useEffect(() => {
    if (!assistant_id) return

    getAssistant(assistant_id)
  }, [assistant_id, router])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: yupResolver(schema),
  })

  const onSubmit = async (data: Inputs): Promise<void> => {
    try {
      console.log(data)
    } catch (error) {
      console.log(error)
    } finally {
    }
  }

  return {
    assistant,
    activeMenu,
    setActiveMenu,
    register,
    handleSubmit,
    onSubmit,
    errors,
  }
}

export default useAssistantPageModel
