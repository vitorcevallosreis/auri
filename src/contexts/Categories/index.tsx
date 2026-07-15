"use client"

import React, { createContext, useContext, useState } from "react"
import {
  BodyCreateCategory,
  BodyUpdateCategory,
  CategoriesContextType,
  CategoriesProps,
  Category,
} from "./interfaces"
import { supabase } from "@/lib/supabase/config"
import { toast } from "sonner"
import { Default } from "./defaults"
import SUPA_TABLES from "../supa_tables"
import { AuthContext } from "../Auth"

export const CategoriesContext = createContext({} as CategoriesContextType)

export function CategoriesProvider({ children }: CategoriesProps) {
  const { user } = useContext(AuthContext)

  const [isLoading, setIsLoading] = useState(Default.isLoading)
  const [categories, set_categories] = useState(Default.categories)
  const [category, set_category] = useState(Default.category)

  async function getCategories(): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Category[] | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_categories)
          .select("*")
          .eq("company_id", user?.company_id)

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_categories(data)
    } catch (error) {
      console.log(error)

      set_categories(Default.categories)
    } finally {
      setIsLoading(false)
    }
  }

  async function getCategory(category_id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Category | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_categories)
          .select("*")
          .match({ id: category_id })
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_category(data)
    } catch (error) {
      console.log(error)

      set_category(Default.category)
    } finally {
      setIsLoading(false)
    }
  }

  async function createCategory(body: BodyCreateCategory): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Category | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_categories)
          .insert({ ...body, company_id: user?.company_id })
          .select()
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_categories((prev) => [...prev, data])
      toast.success("Categoria criada com sucesso!")
    } catch (error) {
      console.log(error)
      set_categories(Default.categories)

      toast.error("Erro ao criar categoria!")
    } finally {
      setIsLoading(false)
    }
  }

  async function updateCategory(
    category_id: string,
    body: BodyUpdateCategory
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_categories)
        .update(body)
        .match({ id: category_id })

      if (error) throw error

      toast.success("Categoria atualizada com sucesso!")
    } catch (error) {}
  }

  async function destroyCategory(category_id: string): Promise<void> {
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_categories)
        .delete()
        .match({ id: category_id })

      if (error) throw error

      toast.success("Categoria deletada com sucesso!")

      set_categories((prev) => prev.filter((item) => item.id !== category_id))
    } catch (error) {
      toast.error("Erro ao deletar categoria!")

      set_categories(Default.categories)
    }
  }

  return (
    <CategoriesContext.Provider
      value={{
        isLoading,
        getCategories,
        categories,
        getCategory,
        category,
        createCategory,
        updateCategory,
        destroyCategory,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  )
}
