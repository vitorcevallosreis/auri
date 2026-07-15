import { CompanyContext } from "@/contexts/Company"
import { BodyCompanyPolicy } from "@/contexts/Company/interfaces"
import { yupResolver } from "@hookform/resolvers/yup"
import { useContext, useEffect, useState } from "react"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
  Resolver,
  Control,
} from "react-hook-form"
import * as yup from "yup"

const schema = yup.object().shape({
  name: yup.string().required("Nome da política é obrigatório!"),
  description: yup.string().required("Descrição da política é obrigatória!"),
  status: yup.boolean().required(),
})

interface Inputs extends BodyCompanyPolicy {}

export interface ICompanyPoliciesModel {
  isLoading: boolean
  policies: any[]
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  control: Control<Inputs>
  errors: FieldErrors<Inputs>
  isEditing: boolean
  currentPolicyId: string | null
  setIsEditing: (value: boolean) => void
  setCurrentPolicyId: (id: string | null) => void
  handleDelete: (id: string) => Promise<void>
  handleEdit: (id: string) => void
  handleCancel: () => void
}

const useCompanyPoliciesModel = (): ICompanyPoliciesModel => {
  const [isEditing, setIsEditing] = useState(false)
  const [currentPolicyId, setCurrentPolicyId] = useState<string | null>(null)
  
  const {
    isLoading,
    companyPolicies,
    getCompanyPolicies,
    createCompanyPolicy,
    updateCompanyPolicy,
    deleteCompanyPolicy,
  } = useContext(CompanyContext)

  useEffect(() => {
    if (getCompanyPolicies && typeof getCompanyPolicies === 'function') {
      getCompanyPolicies()
    }
  }, [getCompanyPolicies])

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    setValue,
    reset,
  } = useForm<Inputs>({
    resolver: yupResolver(schema) as Resolver<Inputs>,
    defaultValues: {
      name: "",
      description: "",
      status: true,
    },
  })

  const handleEdit = (id: string) => {
    const policy = companyPolicies.find((p) => p.id === id)
    if (policy) {
      setValue("name", policy.name)
      setValue("description", policy.description)
      setValue("status", policy.status)
      setCurrentPolicyId(id)
      setIsEditing(true)
    }
  }

  const handleCancel = () => {
    reset()
    setIsEditing(false)
    setCurrentPolicyId(null)
  }

  const handleDelete = async (id: string) => {
    await deleteCompanyPolicy(id)
    getCompanyPolicies()
  }

  const onSubmit = async (data: Inputs): Promise<void> => {
    if (isEditing && currentPolicyId) {
      await updateCompanyPolicy(currentPolicyId, data)
    } else {
      await createCompanyPolicy(data)
    }
    
    reset()
    setIsEditing(false)
    setCurrentPolicyId(null)
    getCompanyPolicies()
  }

  return {
    isLoading,
    policies: companyPolicies || [],
    register,
    handleSubmit,
    control,
    onSubmit,
    errors,
    isEditing,
    currentPolicyId,
    setIsEditing,
    setCurrentPolicyId,
    handleDelete,
    handleEdit,
    handleCancel,
  }
}

export default useCompanyPoliciesModel
