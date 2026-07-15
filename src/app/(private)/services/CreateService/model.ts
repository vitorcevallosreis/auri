"use client"
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react"
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
import { ServicesContext } from "@/contexts/Services"
import { BodyCreateService, ConvenioValor } from "@/contexts/Services/interfaces"

interface Inputs {
  name: string
  price: number
  description: string
  tempo_medio: string
  available: boolean
  aceita_convenio: boolean
  valores_convenios: ConvenioValor[] | null
}

export interface ICreateServiceModel {
  is_open: boolean
  set_is_open: Dispatch<SetStateAction<boolean>>
  onSubmit: (data: Inputs) => Promise<void>
  handleSubmit: UseFormHandleSubmit<Inputs>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  watch: UseFormWatch<Inputs>
  setValue: UseFormSetValue<Inputs>
}

const defaultValues: Inputs = {
  name: "",
  price: 0,
  description: "",
  tempo_medio: "60",
  available: true,
  aceita_convenio: false,
  valores_convenios: null,
}

const useCreateServiceModel = (): ICreateServiceModel => {
  const { createService } = useContext(ServicesContext)
  const [is_open, set_is_open] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<Inputs>({
    resolver: yupResolver(schema),
    defaultValues,
  })

  useEffect(() => {
    if (is_open) return

    reset()
  }, [is_open])

  const onSubmit = async (data: Inputs): Promise<void> => {
    // Converte o tipo ConvenioValor[] | null para ConvenioValor[] | undefined
    // para compatibilidade com BodyCreateService
    const formattedData: BodyCreateService = {
      ...data,
      valores_convenios: data.valores_convenios || undefined,
    };
    
    await createService(formattedData);

    reset();
    set_is_open(false);
  }

  return {
    is_open,
    set_is_open,
    onSubmit,
    handleSubmit,
    register,
    errors,
    watch,
    setValue,
  }
}

export default useCreateServiceModel
