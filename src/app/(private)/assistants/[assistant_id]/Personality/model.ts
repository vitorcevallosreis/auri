"use client"

import { AssistantsContext } from "@/contexts/Assistants"
import { Assistant } from "@/contexts/Assistants/interfaces"
import { useContext, useEffect } from "react"
import { yupResolver } from "@hookform/resolvers/yup"
import { UseFormHandleSubmit, UseFormRegister, useForm } from "react-hook-form"
import { schema } from "./validations"

// Os quatro campos de persona que nenhuma outra aba salva. `identity` já
// aparecia aqui, mas num Textarea solto — sem onChange, sem form, sem submit:
// o que a clínica escrevesse era descartado ao sair da aba. `roles`,
// `fallbacks` e `goodbye` não tinham tela nenhuma, embora worker/prompt.mts
// monte uma seção do system prompt para cada um deles.
interface Inputs {
  identity?: string | null
  roles?: string | null
  fallbacks?: string | null
  goodbye?: string | null
}

export interface IPersonalityModel {
  assistant: Assistant
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
}

const usePersonalityModel = (): IPersonalityModel => {
  const { assistant, updateAssistant } = useContext(AssistantsContext)

  const { register, handleSubmit, setValue } = useForm<Inputs>({
    resolver: yupResolver(schema),
  })

  useEffect(() => {
    setValue("identity", assistant.identity)
    setValue("roles", assistant.roles)
    setValue("fallbacks", assistant.fallbacks)
    setValue("goodbye", assistant.goodbye)
  }, [assistant])

  const onSubmit = async (data: Inputs): Promise<void> => {
    // @ts-expect-error updateAssistant tipa o corpo completo do assistente
    await updateAssistant(assistant.id, data)
  }

  return { assistant, register, handleSubmit, onSubmit }
}

export default usePersonalityModel
