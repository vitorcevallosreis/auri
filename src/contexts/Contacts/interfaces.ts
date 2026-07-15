export interface ContactsProps {
  children: React.ReactNode
}

export interface ContactsContextType {
  isLoading: boolean
  getContacts: () => Promise<void>
  contacts: Contact[]
  createContact: (body: CreateContactBody) => Promise<void>
}

export interface Defaults {
  isLoading: boolean
  contacts: Contact[]
  contact: Contact
}

export interface Contact {
  id: string
  name: string
  avatar_url: string
  remote_jid: string
  number: string
  company_id: string
  checked: boolean
}

export interface CreateContactBody {
  name: string
  number: string
  remote_jid: string
}
