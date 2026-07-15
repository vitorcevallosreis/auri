"use client"

import { AssistantsContext } from "@/contexts/Assistants"
import { Assistant } from "@/contexts/Assistants/interfaces"
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react"
import { toast } from "sonner"
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
  name: string
  description: string
  behavior?: string | null
  purpose?: string | null
}

export interface IProfileModel {
  assistant: Assistant
  propmts: Prompt[]
  isOpen: boolean
  setIsOpen: Dispatch<SetStateAction<boolean>>
  set_prompt: (text: string) => void
  isLoading: boolean
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  setValue: UseFormSetValue<Inputs>
  errors: FieldErrors<Inputs>
  watch: UseFormWatch<Inputs>
  behaviorsMap: Record<string, string>
  labelsMap: Record<string, string>
}

interface Prompt {
  text: string
}

const useProfileModel = (): IProfileModel => {
  const { isLoading, setIsLoading, assistant, updateAssistant } =
    useContext(AssistantsContext)

  const [isOpen, setIsOpen] = useState(false)

  const propmts: Prompt[] = [
    {
      text: "Somos uma empresa dedicada a impulsionar o crescimento de negócios, ajudando-os a atingir seu potencial máximo por meio de soluções tecnológicas inovadoras.",
    },
    {
      text: "Nossa missão é transformar empresas, acelerando seu desenvolvimento e expansão por meio da aplicação de tecnologias de ponta.",
    },
    {
      text: "Com o uso de tecnologias avançadas, somos especialistas em auxiliar empresas a crescerem e escalarem suas operações de maneira exponencial.",
    },
  ]

  useEffect(() => {
    setValue("name", assistant?.name)
    setValue("description", assistant?.description as string)
    setValue("behavior", assistant?.behavior as string)
    setValue("purpose", assistant?.purpose as string)
  }, [assistant])

  const set_prompt = (text: string) => {
    setIsLoading(true)
    toast.info("Sucesso!", {
      duration: 5000,
      description: "Aplicando Prompt...",
      closeButton: true,
    })

    setTimeout(() => {
      setValue("description", text)

      toast.success("Sucesso!", {
        duration: 5000,
        description: "Prompt aplicado com sucesso!",
        closeButton: true,
      })

      setIsOpen(false)
      setIsLoading(false)
    }, 2000)
  }

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
    await updateAssistant(assistant?.id, data)
  }

  const labelsMap = {
    normal: "NORMAL",
    formal: "FORMAL",
    descontraido: "DESCONTRAIDO",
  }

  const behaviorsMap = {
    normal: "Um comportamento mais... Normal",
    formal: "Um comportamento mais... Formal",
    descontraido: "Um comportamento mais... Descontraido",
  }

  return {
    assistant,
    propmts,
    isOpen,
    setIsOpen,
    set_prompt,
    isLoading,
    register,
    handleSubmit,
    onSubmit,
    setValue,
    errors,
    watch,
    behaviorsMap,
    labelsMap,
  }
}

export default useProfileModel
