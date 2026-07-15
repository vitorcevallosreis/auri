"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import {
  Contact,
  ContactsContextType,
  ContactsProps,
  CreateContactBody,
} from "./interfaces"
import { supabase } from "@/lib/supabase/config"
import { toast } from "sonner"
import { Default } from "./defaults"
import SUPA_TABLES from "../supa_tables"
import { AuthContext } from "../Auth"
import { realtimeService } from "@/lib/supabase/realtime.service"

export const ContactsContext = createContext({} as ContactsContextType)

export function useContacts() {
  const context = useContext(ContactsContext);
  if (context === undefined) {
    throw new Error('useContacts must be used within a ContactsProvider');
  }
  return context;
}

export function ContactsProvider({ children }: ContactsProps) {
  const { user } = useContext(AuthContext)

  const [isLoading, setIsLoading] = useState(Default.isLoading)
  const [contacts, set_contacts] = useState(Default.contacts)

  useEffect(() => {
    realtimeService.subscribeToTable<Contact>(
      SUPA_TABLES.table_myia_contacts,
      (payload) => {
        if (payload.eventType === "INSERT") {
          set_contacts((prevData) => [...prevData, payload.new])
          // playSound();
        }

        if (payload.eventType === "UPDATE") {
          set_contacts((prevData) => {
            return prevData.map((chat) => {
              if (chat.id === payload.new.id) {
                return { ...chat, ...payload.new }
              }

              return chat
            })
          })
        }
      }
    )

    return () => {
      realtimeService.unsubscribeFromTable(SUPA_TABLES.table_myia_contacts)
    }
  }, [user])

  async function getContacts(): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Contact[] | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_contacts)
          .select("*")
          .eq("company_id", user?.company_id)

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_contacts(data)
    } catch (error) {
      console.log(error)

      set_contacts(Default.contacts)
    } finally {
      setIsLoading(false)
    }
  }

  async function createContact(body: CreateContactBody): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Contact | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_contacts)
          .insert({
            name: body.name ?? body.number,
            number: body.number,
            remote_jid: body.remote_jid,
            company_id: user?.company_id,
          })
          .select()
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      // set_contacts((prevData) => [...prevData, data])
    } catch (error) {
      console.log(error)

      set_contacts(Default.contacts)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ContactsContext.Provider
      value={{
        isLoading,
        getContacts,
        contacts,
        createContact,
      }}
    >
      {children}
    </ContactsContext.Provider>
  )
}
