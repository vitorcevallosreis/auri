import { AuthContext } from "@/contexts/Auth"
import { ContactsContext } from "@/contexts/Contacts"
import { Contact } from "@/contexts/Contacts/interfaces"
import { useState, useEffect, useContext } from "react"

export interface IContactsModel {
  isLoading: boolean
  contacts: Contact[]
  searchTerm: string
  handleSearch: (term: string) => void
}

const useContactsModel = (): IContactsModel => {
  const { user } = useContext(AuthContext)
  const { isLoading, contacts: apiContacts } = useContext(ContactsContext)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [allContacts, setAllContacts] = useState<Contact[]>([])
  const [searchTerm, setSearchTerm] = useState<string>('')

  useEffect(() => {
    if (apiContacts && apiContacts.length > 0) {
      setContacts(apiContacts)
      setAllContacts(apiContacts)
    }
  }, [apiContacts])

  // Função para filtrar contatos baseado no termo de busca
  const handleSearch = (term: string) => {
    setSearchTerm(term)
    
    if (!term.trim()) {
      setContacts(allContacts)
      return
    }
    
    const filtered = allContacts.filter(contact => {
      const nameMatch = contact.name.toLowerCase().includes(term.toLowerCase())
      const numberMatch = contact.number.toLowerCase().includes(term.toLowerCase())
      return nameMatch || numberMatch
    })
    
    setContacts(filtered)
  }

  return {
    isLoading,
    contacts,
    searchTerm,
    handleSearch
  }
}

export default useContactsModel
