import { CompanyContext } from "@/contexts/Company"
import { BodyCompanyPaymentMethod } from "@/contexts/Company/interfaces"
import { yupResolver } from "@hookform/resolvers/yup"
import { useContext, useEffect, useState } from "react"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
  Resolver,
} from "react-hook-form"
import * as yup from "yup"

const schema = yup.object().shape({
  name: yup.string().required("Nome da forma de pagamento é obrigatório!"),
  status: yup.boolean().required(),
})

interface Inputs extends BodyCompanyPaymentMethod {}

export interface ICompanyPaymentMethodsModel {
  isLoading: boolean
  paymentMethods: any[]
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  isEditing: boolean
  currentPaymentMethodId: string | null
  setIsEditing: (value: boolean) => void
  setCurrentPaymentMethodId: (id: string | null) => void
  handleDelete: (id: string) => Promise<void>
  handleEdit: (id: string) => void
  handleCancel: () => void
}

const useCompanyPaymentMethodsModel = (): ICompanyPaymentMethodsModel => {
  const [isEditing, setIsEditing] = useState(false)
  const [currentPaymentMethodId, setCurrentPaymentMethodId] = useState<string | null>(null)
  
  const {
    isLoading,
    companyPaymentMethods,
    getCompanyPaymentMethods,
    createCompanyPaymentMethod,
    updateCompanyPaymentMethod,
    deleteCompanyPaymentMethod,
  } = useContext(CompanyContext)

  useEffect(() => {
    if (getCompanyPaymentMethods && typeof getCompanyPaymentMethods === 'function') {
      getCompanyPaymentMethods()
    }
  }, [getCompanyPaymentMethods])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    reset,
  } = useForm<Inputs>({
    resolver: yupResolver(schema) as Resolver<Inputs>,
    defaultValues: {
      name: "",
      status: true,
    },
  })

  const handleEdit = (id: string) => {
    const paymentMethod = companyPaymentMethods.find((p) => p.id === id)
    if (paymentMethod) {
      setValue("name", paymentMethod.name)
      setValue("status", paymentMethod.status)
      setCurrentPaymentMethodId(id)
      setIsEditing(true)
    }
  }

  const handleCancel = () => {
    reset()
    setIsEditing(false)
    setCurrentPaymentMethodId(null)
  }

  const handleDelete = async (id: string) => {
    await deleteCompanyPaymentMethod(id)
    getCompanyPaymentMethods()
  }

  const onSubmit = async (data: Inputs): Promise<void> => {
    if (isEditing && currentPaymentMethodId) {
      await updateCompanyPaymentMethod(currentPaymentMethodId, data)
    } else {
      await createCompanyPaymentMethod(data)
    }
    
    reset()
    setIsEditing(false)
    setCurrentPaymentMethodId(null)
    getCompanyPaymentMethods()
  }

  return {
    isLoading,
    paymentMethods: companyPaymentMethods || [],
    register,
    handleSubmit,
    onSubmit,
    errors,
    isEditing,
    currentPaymentMethodId,
    setIsEditing,
    setCurrentPaymentMethodId,
    handleDelete,
    handleEdit,
    handleCancel,
  }
}

export default useCompanyPaymentMethodsModel
