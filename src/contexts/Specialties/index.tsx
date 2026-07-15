"use client"

import React, { createContext, useContext, useState } from "react"
import {
  SpecialtiesContextType,
  SpecialtiesProps,
  Specialty,
} from "./interfaces"
import { supabase } from "@/lib/supabase/config"
import { Default } from "./defaults"
import SUPA_TABLES from "../supa_tables"
import { AuthContext } from "../Auth"

export const SpecialtiesContext = createContext({} as SpecialtiesContextType)

export function SpecialtiesProvider({ children }: SpecialtiesProps) {
  const { user } = useContext(AuthContext)
  const [isLoading, setIsLoading] = useState(Default.isLoading)
  const [specialties, set_specialties] = useState(Default.specialties)

  async function getSpecialties(): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Specialty[] | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_specialties)
          .select("*")
          .eq("company_id", user?.company_id)

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_specialties(data)
    } catch (error) {
      console.log(error)

      set_specialties(Default.specialties)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SpecialtiesContext.Provider
      value={{
        isLoading,
        getSpecialties,
        specialties,
      }}
    >
      {children}
    </SpecialtiesContext.Provider>
  )
}

export const useSpecialties = () => useContext(SpecialtiesContext)
