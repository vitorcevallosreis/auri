import { useEffect, useContext, useState } from "react"
import { CompanyContext } from "@/contexts/Company"
import { BodyCompanyAddress } from "@/contexts/Company/interfaces"

import { yupResolver } from "@hookform/resolvers/yup"

import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
} from "react-hook-form"
import { schema } from "./validations"
import { toast } from "sonner"
import { useAuthStore } from "@/lib/auth-store"
import { useBuscaCep } from "@/lib/BuscaCep.service"
import { AuthContext } from "@/contexts/Auth"

// Define a interface Inputs explicitamente para corresponder ao esquema de validação
interface Inputs {
  zip_code: string;
  complement: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  state_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface ICompanyAddressModel {
  isLoading: boolean
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
}

const useCompanyAddressModel = (): ICompanyAddressModel => {
  const {
    isLoading,
    company,
    getCompanyAddress,
    company_address,
    updateCompanyAddress,
  } = useContext(CompanyContext)

  const { get_zip_code } = useBuscaCep()
  const { user } = useContext(AuthContext)

  useEffect(() => {
    getCompanyAddress()
  }, [user])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<Inputs>({
    resolver: yupResolver(schema) as any,
    defaultValues: {
      zip_code: "",
      complement: null,
      street: null,
      number: null,
      neighborhood: null,
      city: null,
      state: null,
      state_code: null,
      latitude: null,
      longitude: null
    }
  })

  useEffect(() => {
    setValue("zip_code", company_address.zip_code || "")
    setValue("city", company_address.city)
    setValue("complement", company_address.complement)
    setValue("neighborhood", company_address.neighborhood)
    setValue("street", company_address.street)
    setValue("state", company_address.state)
    setValue("state_code", company_address.state_code)
    setValue("latitude", company_address.latitude)
    setValue("longitude", company_address.longitude)
    setValue("number", company_address.number)
  }, [company_address, user, setValue])

  useEffect(() => {
    if (!watch("zip_code")) return

    handleZipCode()
  }, [watch("zip_code")])

  const handleZipCode = async () => {
    try {
      const result = await get_zip_code(watch("zip_code"))

      setValue("city", result?.localidade as string)
      setValue("complement", result?.complemento as string)
      setValue("neighborhood", result?.bairro as string)
      setValue("street", result?.logradouro as string)
      setValue("state", result?.estado as string)
      setValue("state_code", result?.uf as string)
    } catch (error) {
      console.log(error)
    }
  }

  const onSubmit = async (data: Inputs): Promise<void> => {
    await updateCompanyAddress(company?.id, data)
    // Buscar os dados atualizados após salvar
    getCompanyAddress()
  }

  return {
    isLoading,
    register,
    handleSubmit,
    onSubmit,
    errors,
  }
}

export default useCompanyAddressModel
