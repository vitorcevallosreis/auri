"use client"

import React, { createContext, useContext, useState } from "react"
import {
  BodyCreateService,
  BodyUpdateService,
  Service,
  ServicesContextType,
  ServicesProps,
} from "./interfaces"
import { supabase, supabase_storage } from "@/lib/supabase/config"
import { toast } from "sonner"
import { Default } from "./defaults"
import SUPA_TABLES from "../supa_tables"
import { AuthContext } from "../Auth"
import { removeCurrentFile } from "./utils"

export const ServicesContext = createContext({} as ServicesContextType)

export function useServices() {
  const context = useContext(ServicesContext);
  if (context === undefined) {
    throw new Error('useServices must be used within a ServicesProvider');
  }
  return context;
}

export function ServicesProvider({ children }: ServicesProps) {
  const { user } = useContext(AuthContext)

  const [isLoading, setIsLoading] = useState(Default.isLoading)
  const [services, set_services] = useState(Default.services)
  const [service, set_service] = useState(Default.service)

  async function getServices(): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      // Check if in development mode - use mock data
      if (process.env.NODE_ENV === 'development') {
        // Mock services data for development
        const mockServices = [
          {
            id: '1',
            company_id: user.company_id,
            name: 'Consulta Clínica Geral',
            description: 'Consulta com médico clínico geral',
            price: 200.00,
            tempo_medio: '30',
            available: true,
            image_path: null,
            aceita_convenio: true,
            valores_convenios: [
              { convenio: 'Unimed', valor: 180.00, enable: true },
              { convenio: 'Bradesco Saúde', valor: 175.00, enable: true }
            ],
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            company_id: user.company_id,
            name: 'Consulta Cardiologia',
            description: 'Consulta especializada em cardiologia',
            price: 350.00,
            tempo_medio: '45',
            available: true,
            image_path: null,
            aceita_convenio: true,
            valores_convenios: [
              { convenio: 'Unimed', valor: 320.00, enable: true },
              { convenio: 'Bradesco Saúde', valor: 310.00, enable: true }
            ],
            created_at: new Date().toISOString()
          }
        ]
        
        set_services(mockServices)
        return
      }

      const { data, error }: { data: Service[] | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_services)
          .select("*")
          .eq("company_id", user?.company_id)

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_services(data)
    } catch (error) {
      console.log(error)
      set_services(Default.services)
    } finally {
      setIsLoading(false)
    }
  }

  async function getService(service_id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Service | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_myia_services)
          .select("*")
          .eq("id", service_id)
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      set_service(data)
    } catch (error) {
      console.log(error)

      set_service(Default.service)
    } finally {
      setIsLoading(false)
    }
  }

  async function createService(body: BodyCreateService): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_myia_services)
        .insert({
          ...body,
          company_id: user.company_id,
        })
        .select()
        .single()

      if (error) throw error

      toast.success("Serviço cadastrado com sucesso!")

      getServices()
    } catch (error: any) {
      console.log(error)

      toast.error(error?.message || "Erro ao cadastrar serviço!")
    } finally {
      setIsLoading(false)
    }
  }

  async function updateService(
    service_id: string,
    body: BodyUpdateService
  ): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_services)
        .update(body)
        .eq("id", service_id)
        .eq("company_id", user.company_id)

      if (error) throw error

      toast.success("Serviço atualizado com sucesso!")

      getServices()
    } catch (error: any) {
      console.log(error)

      toast.error(error?.message || "Erro ao atualizar serviço!")
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteService(service_id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      // Primeiro obter o serviço para pegar o caminho da imagem, se existir
      const { data: serviceData } = await supabase
        .from(SUPA_TABLES.table_myia_services)
        .select("*")
        .eq("id", service_id)
        .single()

      if (serviceData && serviceData.image_path) {
        await removeCurrentFile(serviceData as Service)
      }

      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_services)
        .delete()
        .eq("id", service_id)
        .eq("company_id", user.company_id)

      if (error) throw error

      toast.success("Serviço removido com sucesso!")

      getServices()
    } catch (error: any) {
      console.log(error)

      toast.error(error?.message || "Erro ao remover serviço!")
    } finally {
      setIsLoading(false)
    }
  }

  async function uploadImageService(
    service: Service,
    file: File,
    file_path: string
  ): Promise<boolean> {
    if (!user?.company_id) return false

    try {
      // Remover arquivo atual, se existir
      await removeCurrentFile(service)

      // Upload do novo arquivo
      const { error: uploadError } = await supabase_storage
        .from("services")
        .upload(file_path, file)

      if (uploadError) throw uploadError

      // Atualizar o registro do serviço com o novo caminho
      const { error: updateError } = await supabase
        .from(SUPA_TABLES.table_myia_services)
        .update({ image_path: file_path })
        .eq("id", service.id)
        .eq("company_id", user.company_id)

      if (updateError) throw updateError

      toast.success("Imagem atualizada com sucesso!")

      getServices()
      return true
    } catch (error: any) {
      console.error(error)
      toast.error(error?.message || "Erro ao fazer upload da imagem!")
      return false
    }
  }

  return (
    <ServicesContext.Provider
      value={{
        isLoading,
        getServices,
        services,
        getService,
        service,
        createService,
        updateService,
        deleteService,
        uploadImageService,
      }}
    >
      {children}
    </ServicesContext.Provider>
  )
}
