"use client"

import { AssistantsContext } from "@/contexts/Assistants"
import { Assistant, Llm } from "@/contexts/Assistants/interfaces"
import { useContext, useEffect } from "react"
import { yupResolver } from "@hookform/resolvers/yup"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
  UseFormWatch,
  UseFormSetValue,
} from "react-hook-form"
import { schema } from "./validations"

interface Inputs {
  llm: string
  objective?: string | null
  strategy?: string | null
  tel_fallback?: string | null
}

export interface ISettingModel {
  assistant: Assistant
  llms: Llm[]
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  setValue: UseFormSetValue<Inputs>
  errors: FieldErrors<Inputs>
  watch: UseFormWatch<Inputs>
}

const useSettingModel = (): ISettingModel => {
  const { assistant, getEnabledLlms, llms, updateAssistant } =
    useContext(AssistantsContext)

  useEffect(() => {
    getEnabledLlms()
  }, [])

  useEffect(() => {
    setValue("llm", assistant.llm as string)
    setValue("objective", assistant.objective as string)
    setValue("strategy", assistant.strategy as string)
    setValue("tel_fallback", assistant.tel_fallback as string)
  }, [assistant])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<Inputs>({
    resolver: yupResolver(schema),
  })

  const onSubmit = async (data: Inputs): Promise<void> => {
    // @ts-expect-error
    await updateAssistant(assistant.id, data)
  }

  return {
    assistant,
    llms,
    register,
    handleSubmit,
    onSubmit,
    setValue,
    errors,
    watch,
  }
}

export default useSettingModel
