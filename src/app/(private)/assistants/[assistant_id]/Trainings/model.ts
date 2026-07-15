"use client"

import { AssistantsContext } from "@/contexts/Assistants"
import { useContext, useEffect } from "react"
import { yupResolver } from "@hookform/resolvers/yup"
import { UseFormHandleSubmit, UseFormRegister, useForm } from "react-hook-form"
import { schema } from "./validations"

interface Inputs {
  step_by_step?: string | null
  greetings?: string | null
  behavior_text?: string | null
  avoided_topics?: string | null
}

export interface ITrainingsModel {
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
}

const useTrainingsModel = (): ITrainingsModel => {
  const { assistant, updateAssistant } = useContext(AssistantsContext)

  useEffect(() => {
    setValue("step_by_step", assistant.step_by_step)
    setValue("greetings", assistant.greetings)
    setValue("behavior_text", assistant.behavior_text)
    setValue("avoided_topics", assistant.avoided_topics)
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

  console.log(errors)

  return {
    register,
    handleSubmit,
    onSubmit,
  }
}

export default useTrainingsModel
