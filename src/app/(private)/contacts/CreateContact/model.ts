"use client"

import { yupResolver } from "@hookform/resolvers/yup"
import {
  UseFormHandleSubmit,
  UseFormRegister,
  FieldErrors,
  useForm,
  UseFormWatch,
  UseFormClearErrors,
  UseFormReset,
} from "react-hook-form"
import { schema } from "./validations"
import { useContext } from "react"
import { ContactsContext } from "@/contexts/Contacts"

interface Inputs {
  name: string
  country_code: number
  state_code: number
  number: string
  remote_jid?: string | null
}

interface Country {
  key: number
  label: string
  icon: string
}

interface StateCode {
  key: string
  label: string
}

export interface ICreateContactModel {
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  watch: UseFormWatch<Inputs>
  countries: Country[]
  state_codes: StateCode[]
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  final_number: string
}

const useCreateContactModel = (): ICreateContactModel => {
  const { createContact } = useContext(ContactsContext)
  const countries = [
    {
      key: 55,
      label: "+55 - Brasil",
      icon: "https://flagsapi.com/BR/flat/64.png",
    },
    {
      key: 1,
      label: "+1 - Estados Unidos",
      icon: "https://flagsapi.com/US/flat/64.png",
    },
  ]

  const state_codes = [
    { key: "11", label: "11 - São Paulo" },
    { key: "12", label: "12 - São Paulo" },
    { key: "13", label: "13 - São Paulo" },
    { key: "14", label: "14 - São Paulo" },
    { key: "15", label: "15 - São Paulo" },
    { key: "16", label: "16 - São Paulo" },
    { key: "17", label: "17 - São Paulo" },
    { key: "18", label: "18 - São Paulo" },
    { key: "19", label: "19 - São Paulo" },
    { key: "21", label: "21 - Rio de Janeiro" },
    { key: "22", label: "22 - Rio de Janeiro" },
    { key: "24", label: "24 - Rio de Janeiro" },
    { key: "27", label: "27 - Espírito Santo" },
    { key: "28", label: "28 - Espírito Santo" },
    { key: "31", label: "31 - Minas Gerais" },
    { key: "32", label: "32 - Minas Gerais" },
    { key: "33", label: "33 - Minas Gerais" },
    { key: "34", label: "34 - Minas Gerais" },
    { key: "35", label: "35 - Minas Gerais" },
    { key: "37", label: "37 - Minas Gerais" },
    { key: "38", label: "38 - Minas Gerais" },
    { key: "41", label: "41 - Paraná" },
    { key: "42", label: "42 - Paraná" },
    { key: "43", label: "43 - Paraná" },
    { key: "44", label: "44 - Paraná" },
    { key: "45", label: "45 - Paraná" },
    { key: "46", label: "46 - Paraná" },
    { key: "47", label: "47 - Santa Catarina" },
    { key: "48", label: "48 - Santa Catarina" },
    { key: "49", label: "49 - Santa Catarina" },
    { key: "51", label: "51 - Rio Grande do Sul" },
    { key: "53", label: "53 - Rio Grande do Sul" },
    { key: "54", label: "54 - Rio Grande do Sul" },
    { key: "55", label: "55 - Rio Grande do Sul" },
    { key: "61", label: "61 - Distrito Federal" },
    { key: "62", label: "62 - Goiás" },
    { key: "63", label: "63 - Tocantins" },
    { key: "64", label: "64 - Goiás" },
    { key: "65", label: "65 - Mato Grosso" },
    { key: "66", label: "66 - Mato Grosso" },
    { key: "67", label: "67 - Mato Grosso do Sul" },
    { key: "68", label: "68 - Acre" },
    { key: "69", label: "69 - Rondônia" },
    { key: "71", label: "71 - Bahia" },
    { key: "73", label: "73 - Bahia" },
    { key: "74", label: "74 - Bahia" },
    { key: "75", label: "75 - Bahia" },
    { key: "77", label: "77 - Bahia" },
    { key: "79", label: "79 - Sergipe" },
    { key: "81", label: "81 - Pernambuco" },
    { key: "82", label: "82 - Alagoas" },
    { key: "83", label: "83 - Paraíba" },
    { key: "84", label: "84 - Rio Grande do Norte" },
    { key: "85", label: "85 - Ceará" },
    { key: "86", label: "86 - Piauí" },
    { key: "87", label: "87 - Pernambuco" },
    { key: "88", label: "88 - Ceará" },
    { key: "89", label: "89 - Piauí" },
    { key: "91", label: "91 - Pará" },
    { key: "92", label: "92 - Amazonas" },
    { key: "93", label: "93 - Pará" },
    { key: "94", label: "94 - Pará" },
    { key: "95", label: "95 - Roraima" },
    { key: "96", label: "96 - Amapá" },
    { key: "97", label: "97 - Amazonas" },
    { key: "98", label: "98 - Maranhão" },
    { key: "99", label: "99 - Maranhão" },
  ]

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<Inputs>({
    resolver: yupResolver(schema),
  })

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value

    const cleanValue = rawValue.replace(/\D/g, "")

    setValue("number", cleanValue)
  }

  const set_remote_jid = (data: Inputs): string => {
    return `${data.country_code}${data.state_code}${data.number}@s.whatsapp.net`
  }

  const set_number = (data: Inputs): string => {
    return `${data.country_code}${data.state_code}${data.number}`
  }

  const onSubmit = async (data: Inputs): Promise<void> => {
    data.remote_jid = set_remote_jid(data)

    data.name = data.name ? data.name : set_number(data)

    data.number = set_number(data)

    await createContact(data)
    reset()
  }

  const final_number = `+${watch("country_code")} (${watch(
    "state_code"
  )}) ${watch("number")}`

  return {
    register,
    handleSubmit,
    onSubmit,
    errors,
    countries,
    state_codes,
    handleChange,
    watch,
    final_number,
  }
}

export default useCreateContactModel
