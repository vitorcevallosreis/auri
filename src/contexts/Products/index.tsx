"use client"

import React, { createContext, useContext, useState } from "react"
import {
  BodyCreateProduct,
  BodyUpdateProduct,
  Product,
  ProductsContextType,
  ProductsProps,
} from "./interfaces"
import { supabase, supabase_storage } from "@/lib/supabase/config"
import { toast } from "sonner"
import { Default } from "./defaults"
import SUPA_TABLES from "../supa_tables"
import { AuthContext } from "../Auth"
import { removeCurrentFile } from "./utils"

export const ProductsContext = createContext({} as ProductsContextType)

export function ProductsProvider({ children }: ProductsProps) {
  const { user } = useContext(AuthContext)

  const [isLoading, setIsLoading] = useState(Default.isLoading)
  const [products, set_products] = useState(Default.products)
  const [product, set_product] = useState(Default.product)

  async function getProducts(): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      // Check if in development mode - use mock data
      if (process.env.NODE_ENV === 'development') {
        // Mock products data for development
        const mockProducts = [
          {
            id: '1',
            company_id: user.company_id,
            category_id: '1',
            name: 'Consulta Médica',
            description: 'Consulta médica geral',
            price: 150.00,
            available: true,
            image_path: null,
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            company_id: user.company_id,
            category_id: '1',
            name: 'Exame de Sangue',
            description: 'Exame laboratorial completo',
            price: 80.00,
            available: true,
            image_path: null,
            created_at: new Date().toISOString()
          }
        ]
        
        set_products(mockProducts)
        return
      }

      const { data, error }: { data: Product[] | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_products)
          .select("*")
          .eq("company_id", user?.company_id)

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_products(data)
    } catch (error) {
      console.log(error)
      set_products(Default.products)
    } finally {
      setIsLoading(false)
    }
  }

  async function getProduct(product_id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Product | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_products)
          .select("*")
          .match({ id: product_id })
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_product(data)
    } catch (error) {
      console.log(error)

      set_product(Default.product)
    } finally {
      setIsLoading(false)
    }
  }

  async function createProduct(body: BodyCreateProduct): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Product | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_products)
          .insert({ ...body, company_id: user?.company_id })
          .select()
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_products((prev) => [...prev, data])
      toast.success("Produto cadastrado com sucesso!")
    } catch (error) {
      console.log(error)
      set_products(Default.products)

      toast.error("Erro ao criar Produto!")
    } finally {
      setIsLoading(false)
    }
  }

  async function updateProduct(
    product_id: string,
    body: BodyUpdateProduct
  ): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Product | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_products)
          .update(body)
          .match({ id: product_id })
          .select()
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_products((prev) =>
        prev.map((product) => (product.id === product_id ? data : product))
      )

      toast.success("Produto atualizado com sucesso!")
    } catch (error) {
      console.log(error)
      set_products(Default.products)

      toast.error("Erro ao criar Produto!")
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteProduct(product_id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_products)
        .delete()
        .match({ id: product_id })

      if (error) throw error

      set_products((prev) =>
        prev.filter((product) => product.id !== product_id)
      )

      toast.success("Produto apagado com sucesso!")
    } catch (error) {
      console.log(error)
      set_products(Default.products)

      toast.error("Erro ao apagar Produto!")
    } finally {
      setIsLoading(false)
    }
  }

  async function uploadImageProduct(
    product: Product,
    file: File,
    file_path: string
  ): Promise<boolean> {
    if (!user?.company_id) return false

    try {
      await removeCurrentFile(product)

      const { data, error } = await supabase_storage.storage
        .from("myia_products")
        .upload(file_path, file)

      if (error) throw error

      const { data: product_data, error: product_error } = await supabase
        .from(SUPA_TABLES.table_myia_products)
        .update({ image_path: data.path })
        .match({ id: product.id })
        .select()
        .single()

      if (product_error) throw product_error

      set_products((prevProducts) =>
        prevProducts.map((p) =>
          p.id === product.id
            ? { ...p, image_path: product_data.image_path }
            : p
        )
      )

      toast.success("Imagem do produto atualizada com sucesso!")

      return true
    } catch (error) {
      console.log(error)
      set_products(Default.products)

      toast.error("Erro ao apagar Produto!")
      return false
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ProductsContext.Provider
      value={{
        isLoading,
        getProducts,
        products,
        getProduct,
        product,
        createProduct,
        updateProduct,
        deleteProduct,
        uploadImageProduct,
      }}
    >
      {children}
    </ProductsContext.Provider>
  )
}
