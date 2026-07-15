"use client"

import { yupResolver } from "@hookform/resolvers/yup"
import {
  FieldErrors,
  UseFormHandleSubmit,
  UseFormRegister,
  useForm,
} from "react-hook-form"
import { schema } from "./validations"
import { toast } from "sonner"

interface Inputs {
  email: string
}

export interface IResetPasswordModel {
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
}

const useResetPasswordModel = (): IResetPasswordModel => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>({
    resolver: yupResolver(schema),
  })

  const onSubmit = async (data: Inputs): Promise<void> => {
    toast.success(
      `Email de recuperação enviado com sucesso para ${data.email}!`
    )

    toast.warning("Verifique sua Caixa de Emails.")
  }

  return { register, handleSubmit, onSubmit, errors }
}

export default useResetPasswordModel
