import { CompanyContext } from "@/contexts/Company"
import { BodyUpdateCompany } from "@/contexts/Company/interfaces"

import { yupResolver } from "@hookform/resolvers/yup"
import { useContext, useEffect } from "react"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
} from "react-hook-form"
import { schema } from "./validations"
import { AuthContext } from "@/contexts/Auth"

interface Inputs extends BodyUpdateCompany {}

export interface ICompanyPageModel {
  isLoading: boolean
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
}

const useCompanyPageModel = (): ICompanyPageModel => {
  const { user } = useContext(AuthContext)
  const { isLoading, getCompany, company, updateCompany } =
    useContext(CompanyContext)

  useEffect(() => {
    getCompany()
  }, [user])

  useEffect(() => {
    if (!company) return

    setValue("name", company.name)
    setValue("description", company.description)
    setValue("site_url", company.site_url)
  }, [company])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
  } = useForm<Inputs>({
    resolver: yupResolver(schema),
  })

  const onSubmit = async (data: Inputs): Promise<void> =>
    await updateCompany(data)

  return {
    isLoading,
    register,
    handleSubmit,
    onSubmit,
    errors,
  }
}

export default useCompanyPageModel
