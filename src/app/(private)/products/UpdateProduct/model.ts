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
import { Product } from "@/contexts/Products/interfaces"
import { toast } from "sonner"
import { renameFile } from "@/lib/utils"

interface Inputs {
  category_id: string
  name: string
  price: number
  description: string
  available: boolean
}

export interface IUpdateProductModel {
  is_open: boolean
  set_is_open: Dispatch<SetStateAction<boolean>>
  onSubmit: (data: Inputs) => Promise<void>
  handleSubmit: UseFormHandleSubmit<Inputs>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  categories: Category[]
  watch: UseFormWatch<Inputs>
  setValue: UseFormSetValue<Inputs>
  uploadFile: () => Promise<void>
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  previewUrl: string
  uploading: boolean
}

const useUpdateProductModel = (product: Product): IUpdateProductModel => {
  const { getCategories, categories } = useContext(CategoriesContext)
  const { updateProduct, uploadImageProduct } = useContext(ProductsContext)
  const [is_open, set_is_open] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState<boolean>(false)
  const [previewUrl, setPreviewUrl] = useState<string>("")

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const selectedFile = event.target.files[0]
      setFile(selectedFile)

      setPreviewUrl(URL.createObjectURL(selectedFile))
    }
  }

  const uploadFile = async () => {
    if (!file) return

    setUploading(true)

    try {
      const file_path = renameFile(file)
      const result = await uploadImageProduct(product, file, file_path)

      if (!result) return

      setPreviewUrl("")
      setFile(null)
    } catch (error) {
      toast.error("Erro ao enviar arquivo.")
    } finally {
      setUploading(false)
    }
  }

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
    if (!is_open && !product.id) return

    getCategories()
  }, [is_open, product])

  useEffect(() => {
    if (!product) return

    setValue("category_id", product?.category_id)
    setValue("name", product?.name)
    setValue("price", product?.price)
    setValue("description", product?.description)
    setValue("available", product?.available)
  }, [is_open, product])

  const onSubmit = async (data: Inputs): Promise<void> =>
    await updateProduct(product.id, data)

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
    previewUrl,
    uploading,
    handleFileChange,
    uploadFile,
  }
}

export default useUpdateProductModel
