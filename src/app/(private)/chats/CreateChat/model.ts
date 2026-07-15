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
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react"
import { Contact } from "@/contexts/Contacts/interfaces"
import { ContactsContext } from "@/contexts/Contacts"
import { AuthContext } from "@/contexts/Auth"
import { countries } from "./constants"

interface Inputs {
  number?: string
  country_code?: string
  contact_id?: string
}

interface Country {
  key: string
  label: string
  icon: string
}

export interface ICreateChatModel {
  countries: Country[]
  contacts: Contact[]
  handleSubmit: UseFormHandleSubmit<Inputs>
  onSubmit: (data: Inputs) => Promise<void>
  register: UseFormRegister<Inputs>
  errors: FieldErrors<Inputs>
  watch: UseFormWatch<Inputs>
  clearErrors: UseFormClearErrors<Inputs>
  reset: UseFormReset<Inputs>
  handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  tab: "BY_CONTACTS" | "MANUAL"
  set_tab: Dispatch<SetStateAction<"BY_CONTACTS" | "MANUAL">>
  uncheckedContacts: string[]
}

const useCreateChatModel = (): ICreateChatModel => {
  const { user } = useContext(AuthContext)
  const { getContacts, contacts } = useContext(ContactsContext)
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    clearErrors,
    setValue,
    reset,
  } = useForm<Inputs>({
    resolver: yupResolver(schema),
  })

  const [tab, set_tab] = useState<"BY_CONTACTS" | "MANUAL">("BY_CONTACTS")

  useEffect(() => {
    if (!user?.company_id) return

    getContacts()
  }, [user])

  useEffect(() => {
    setValue("country_code", "55")
  }, [])

  const onSubmit = async (data: Inputs): Promise<void> => {
    console.log(data)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value

    const cleanValue = rawValue.replace(/\D/g, "")

    setValue("number", cleanValue)
  }

  const uncheckedContacts = contacts
    .filter((contact) => !contact.checked)
    .map((contact) => contact.id)

  return {
    register,
    handleSubmit,
    onSubmit,
    watch,
    clearErrors,
    reset,
    errors,
    countries,
    contacts,
    handleChange,
    tab,
    set_tab,
    uncheckedContacts,
  }
}

export default useCreateChatModel
