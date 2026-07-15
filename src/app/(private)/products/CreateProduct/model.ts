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
import { CategoriesContext } from "@/contexts/Categories"
import { ProductsContext } from "@/contexts/Products"
import { Category } from "@/contexts/Categories/interfaces"

interface Inputs {
  category_id: string
  name: string
  price: number
  description: string
  available: boolean
}

export interface ICreateProductModel {
  is_open: boolean
  set_is_open: Dispatch<SetStateAction<boolean>>
  onSubmit: (data: Inputs) => Promise<void>
  handleSubmit: UseFormHandleSubmit<Inputs>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  categories: Category[]
  watch: UseFormWatch<Inputs>
  setValue: UseFormSetValue<Inputs>
}

const useCreateProductModel = (): ICreateProductModel => {
  const { getCategories, categories } = useContext(CategoriesContext)
  const { createProduct } = useContext(ProductsContext)
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
    defaultValues: {
      available: true,
    },
  })

  useEffect(() => {
    if (is_open) return

    reset()
  }, [is_open])

  useEffect(() => {
    if (!is_open) return

    getCategories()
  }, [is_open])

  const onSubmit = async (data: Inputs): Promise<void> => {
    await createProduct(data)

    reset()
    set_is_open(false)
  }

  return {
    is_open,
    set_is_open,
    onSubmit,
    handleSubmit,
    register,
    errors,
    categories,
    watch,
    setValue,
  }
}

export default useCreateProductModel
