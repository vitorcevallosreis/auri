"use client"

import { AuthContext } from "@/contexts/Auth"
import { CategoriesContext } from "@/contexts/Categories"
import { Category } from "@/contexts/Categories/interfaces"

import { useContext, useEffect } from "react"

export interface ICategoriesModel {
  isLoading: boolean
  categories: Category[]
  destroyCategory: (category_id: string) => Promise<void>
}

const useCategoriesModel = (): ICategoriesModel => {
  const { isLoading, getCategories, categories, destroyCategory } =
    useContext(CategoriesContext)
  const { user } = useContext(AuthContext)

  useEffect(() => {
    if (!user?.company_id) return

    getCategories()
  }, [user])

  return { isLoading, categories, destroyCategory }
}

export default useCategoriesModel
