import { CompanyContext } from "@/contexts/Company"
import { BodyCompanyAgreement } from "@/contexts/Company/interfaces"
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
  name: yup.string().required("Nome do convênio é obrigatório!"),
  status: yup.boolean().required(),
})

interface Inputs extends BodyCompanyAgreement {}

export interface ICompanyAgreementsModel {
  isLoading: boolean
  agreements: any[]
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  isEditing: boolean
  currentAgreementId: string | null
  setIsEditing: (value: boolean) => void
  setCurrentAgreementId: (id: string | null) => void
  handleDelete: (id: string) => Promise<void>
  handleEdit: (id: string) => void
  handleCancel: () => void
}

const useCompanyAgreementsModel = (): ICompanyAgreementsModel => {
  const [isEditing, setIsEditing] = useState(false)
  const [currentAgreementId, setCurrentAgreementId] = useState<string | null>(null)
  const [localLoading, setLocalLoading] = useState(false)
  
  const {
    isLoading: contextLoading,
    companyAgreements,
    getCompanyAgreements,
    createCompanyAgreement: contextCreateCompanyAgreement,
    updateCompanyAgreement: contextUpdateCompanyAgreement,
    deleteCompanyAgreement: contextDeleteCompanyAgreement,
  } = useContext(CompanyContext)

  const isLoading = localLoading || contextLoading;

  useEffect(() => {
    if (getCompanyAgreements && typeof getCompanyAgreements === 'function') {
      getCompanyAgreements()
    }
  }, [getCompanyAgreements])

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
    const agreement = companyAgreements.find((a) => a.id === id)
    if (agreement) {
      setValue("name", agreement.name)
      setValue("status", agreement.status)
      setCurrentAgreementId(id)
      setIsEditing(true)
    }
  }

  const handleCancel = () => {
    reset()
    setIsEditing(false)
    setCurrentAgreementId(null)
  }

  const deleteCompanyAgreement = async (id: string) => {
    setLocalLoading(true);
    try {
      await contextDeleteCompanyAgreement(id);
    } finally {
      // Set timeout to ensure state is updated after UI rerenders
      setTimeout(() => {
        setLocalLoading(false);
      }, 500);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteCompanyAgreement(id)
  }

  const createCompanyAgreement = async (data: BodyCompanyAgreement) => {
    setLocalLoading(true);
    try {
      await contextCreateCompanyAgreement(data);
    } finally {
      // Set timeout to ensure state is updated after UI rerenders
      setTimeout(() => {
        setLocalLoading(false);
      }, 500);
    }
  };

  const updateCompanyAgreement = async (id: string, data: BodyCompanyAgreement) => {
    setLocalLoading(true);
    try {
      await contextUpdateCompanyAgreement(id, data);
    } finally {
      // Set timeout to ensure state is updated after UI rerenders
      setTimeout(() => {
        setLocalLoading(false);
      }, 500);
    }
  };

  const onSubmit = async (data: Inputs): Promise<void> => {
    if (isEditing && currentAgreementId) {
      await updateCompanyAgreement(currentAgreementId, data)
    } else {
      await createCompanyAgreement(data)
    }
    reset()
    setIsEditing(false)
    setCurrentAgreementId(null)
  }

  return {
    isLoading,
    agreements: companyAgreements || [],
    register,
    handleSubmit,
    onSubmit,
    errors,
    isEditing,
    currentAgreementId,
    setIsEditing,
    setCurrentAgreementId,
    handleDelete,
    handleEdit,
    handleCancel,
  }
}

export default useCompanyAgreementsModel
