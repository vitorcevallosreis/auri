"use client"

import { yupResolver } from "@hookform/resolvers/yup"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
} from "react-hook-form"
import { schema } from "./validations"
import { CategoriesContext } from "@/contexts/Categories"
import { Dispatch, SetStateAction, useContext, useState } from "react"

interface Inputs {
  name: string
}

export interface ICreateCategoryModel {
  onSubmit: (data: Inputs) => Promise<void>
  handleSubmit: UseFormHandleSubmit<Inputs>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  is_open: boolean
  set_is_open: Dispatch<SetStateAction<boolean>>
}

const useCreateCategoryModel = (): ICreateCategoryModel => {
  const { createCategory } = useContext(CategoriesContext)
  const [is_open, set_is_open] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<Inputs>({ resolver: yupResolver(schema) })

  const onSubmit = async (data: Inputs): Promise<void> => {
    await createCategory(data)
    reset()
    set_is_open(false)
  }

  return {
    onSubmit,
    handleSubmit,
    register,
    errors,
    is_open,
    set_is_open,
  }
}

export default useCreateCategoryModel
