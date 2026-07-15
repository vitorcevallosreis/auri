"use client"

import { yupResolver } from "@hookform/resolvers/yup"
import { Dispatch, SetStateAction, useContext, useState } from "react"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
} from "react-hook-form"
import { schema } from "./validations"
import { AuthContext } from "@/contexts/Auth"

export interface Inputs {
  email: string
  password: string
  name: string
  company_name: string
  domain_server: string
}

export interface IRegisterPageModel {
  isLoading: boolean
  showPassword: boolean
  setShowPassword: Dispatch<SetStateAction<boolean>>

  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
}

const useRegisterPageModel = (): IRegisterPageModel => {
  const { isLoading, signUp, checkAvailableDomain } = useContext(AuthContext)

  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<Inputs>({
    resolver: yupResolver(schema),
  })

  const onSubmit = async (data: Inputs): Promise<void> => {
    const isAvailable: boolean = await checkAvailableDomain(data.domain_server)

    if (!isAvailable) {
      setError("domain_server", {
        type: "custom",
        message: "Este domínio já está sendo usado, por favor escolha outro!",
      })

      return
    }

    await signUp(data)
  }

  return {
    isLoading,
    showPassword,
    setShowPassword,
    register,
    handleSubmit,
    onSubmit,
    errors,
  }
}

export default useRegisterPageModel
