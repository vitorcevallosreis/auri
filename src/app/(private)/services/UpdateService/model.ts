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
import { BodyUpdateService, ConvenioValor, Service } from "@/contexts/Services/interfaces"

interface Inputs {
  name: string
  price: number
  description: string
  available: boolean
  tempo_medio: string
  aceita_convenio: boolean
  valores_convenios: ConvenioValor[] | null
}

export interface IUpdateServiceModel {
  is_open: boolean
  set_is_open: Dispatch<SetStateAction<boolean>>
  onSubmit: (data: Inputs) => Promise<void>
  handleSubmit: UseFormHandleSubmit<Inputs>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  watch: UseFormWatch<Inputs>
  setValue: UseFormSetValue<Inputs>
}

const useUpdateServiceModel = (service: Service): IUpdateServiceModel => {
  const { updateService } = useContext(ServicesContext)
  const [is_open, set_is_open] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<Inputs>({ resolver: yupResolver(schema) })

  useEffect(() => {
    if (is_open) return

    reset()
  }, [is_open])

  useEffect(() => {
    if (!is_open) return

    setValue("name", service.name)
    setValue("price", service.price)
    setValue("description", service.description)
    setValue("available", service.available)
    setValue("tempo_medio", service.tempo_medio)
    setValue("aceita_convenio", service.aceita_convenio)
    setValue("valores_convenios", service.valores_convenios)
  }, [is_open, service])

  const onSubmit = async (data: Inputs): Promise<void> => {
    // Converte o tipo ConvenioValor[] | null para ConvenioValor[] | undefined
    // para compatibilidade com BodyUpdateService
    const formattedData: BodyUpdateService = {
      ...data,
      valores_convenios: data.valores_convenios || undefined,
    };
    
    await updateService(service.id, formattedData);

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

export default useUpdateServiceModel
