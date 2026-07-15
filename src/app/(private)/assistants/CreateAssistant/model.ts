"use client"

import { AssistantsContext } from "@/contexts/Assistants"
import { yupResolver } from "@hookform/resolvers/yup"
import { useContext, useEffect, useState } from "react"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
  UseFormWatch,
} from "react-hook-form"
import { schema } from "./validations"

interface Inputs {
  name: string
  avatar?: string
}

export interface ICreateAssistantModel {
  isLoading: boolean
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  watch: UseFormWatch<Inputs>
}

const useCreateAssistantModel = (): ICreateAssistantModel => {
  const { isLoading, createAssistant } = useContext(AssistantsContext)
  const [isOpen, setIsOpen] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<Inputs>({
    resolver: yupResolver(schema),
    defaultValues: {
      avatar:
        "https://s3.techtopus.dev/myia/avatar_Julia_d1aebcd9-81b5-460e-a45f-eabb608c73c8",
    },
  })

  useEffect(() => {
    if (!isOpen) return

    reset()
  }, [isOpen])

  const onSubmit = async (data: Inputs): Promise<void> => {
    // @ts-expect-error data
    const isSuccess = await createAssistant(data)

    if (!isSuccess) return

    setIsOpen(false)
    reset()
  }

  return {
    isLoading,
    isOpen,
    setIsOpen,
    register,
    handleSubmit,
    onSubmit,
    errors,
    watch,
  }
}

export default useCreateAssistantModel
