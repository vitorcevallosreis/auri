"use client"

import { Dispatch, SetStateAction, useContext, useState } from "react"
import { useForm, UseFormRegister, UseFormHandleSubmit } from "react-hook-form"
import { AuthContext } from "@/contexts/Auth"

interface LoginFormValues {
  email: string
  password: string
}

export interface ILoginPageModel {
  handleSubmit: UseFormHandleSubmit<LoginFormValues>
  handleSignIn: (data: LoginFormValues) => Promise<void>
  register: UseFormRegister<LoginFormValues>
  isLoading: boolean
  setShowPassword: Dispatch<SetStateAction<boolean>>
  showPassword: boolean
}

const useLoginPageModel = (): ILoginPageModel => {
  const { isLoading, signIn } = useContext(AuthContext)

  const { register, handleSubmit } = useForm<LoginFormValues>()

  const [showPassword, setShowPassword] = useState(false)

  async function handleSignIn(data: LoginFormValues): Promise<void> {
    await signIn({ email: data.email, password: data.password })
  }

  return {
    handleSubmit,
    register,
    handleSignIn,
    isLoading,
    setShowPassword,
    showPassword,
  }
}

export default useLoginPageModel
