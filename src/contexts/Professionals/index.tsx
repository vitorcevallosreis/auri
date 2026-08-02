import React, { createContext, useContext, useState } from "react"
import {
  NewProfessionalInput,
  Professional,
  ProfessionalAvailability,
  ProfessionalCatalogInput,
  ProfessionalUpdateInput,
  ProfessionalsContextType,
} from "./interfaces"
import { defaultProfessionalsContext } from "./defaults"
import { supabase } from "@/lib/supabase/client"
import { UUID } from "crypto"
import SUPA_TABLES from "../supa_tables"

const ProfessionalsContext = createContext<ProfessionalsContextType>(
  defaultProfessionalsContext
)

// Dias do formulário → coluna `weekday` (1=Segunda … 7=Domingo). É a MESMA
// convenção de `isoWeekday` em worker/tools.mts; divergir aqui faria o agente
// oferecer horário no dia errado, sem nenhum erro aparecer.
const WEEKDAY_BY_KEY: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sunday: 7,
}

export const ProfessionalsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [availability, setAvailabilityState] = useState<
    ProfessionalAvailability[]
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfessionals = async (company_id: UUID) => {
    if (!company_id) return

    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_professionals_medical)
        .select("*")
        .eq("company_id", company_id)

      if (error) throw error

      setProfessionals(data)
    } catch (err: any) {
      setError(err.message)
      console.error("Error fetching professionals:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailability = async (professionalId: UUID) => {
    setLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_myia_professional_availability)
        .select("*")
        .eq("professional_id", professionalId)

      if (error) throw error

      setAvailabilityState(data || [])
    } catch (err: any) {
      setError(err.message)
      console.error("Error fetching availability:", err)
    } finally {
      setLoading(false)
    }
  }

  const createProfessional = async (
    professionalData: NewProfessionalInput,
    catalog?: ProfessionalCatalogInput
  ): Promise<Professional | undefined> => {
    setError(null)

    // O insert do profissional e o do catálogo são requisições separadas — o
    // PostgREST não dá transação entre elas. Um profissional gravado SEM
    // disponibilidade é pior que nenhum: ele aparece em `listar_profissionais`
    // e o agente nunca acha horário, sem erro em lugar nenhum. Por isso, se o
    // catálogo falhar, apagamos o profissional e propagamos o erro.
    let createdId: UUID | null = null

    try {
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_professionals_medical)
        .insert(professionalData)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new Error("Nenhum dado retornado após a inserção")

      createdId = data.id as UUID

      if (catalog) {
        await saveProfessionalCatalog(createdId, catalog)
      }

      setProfessionals((prev) => [...prev, data as Professional])
      return data as Professional
    } catch (err: any) {
      if (createdId) {
        // Best-effort: se o rollback também falhar, o erro original é o que
        // interessa para quem está na tela.
        try {
          await supabase
            .from(SUPA_TABLES.table_professionals_medical)
            .delete()
            .eq("id", createdId)
        } catch {
          // ignorado de propósito
        }
      }

      const message = err?.message ?? "Erro desconhecido ao criar profissional"
      setError(message)
      console.error("Erro ao criar profissional:", err)
      throw new Error(message)
    }
  }

  // Grava serviços atendidos + agenda semanal. A disponibilidade é por
  // (profissional, serviço, dia): a tabela exige `service_id`, então cada dia
  // habilitado vira uma linha para CADA serviço selecionado.
  //
  // Upsert, não insert: o formulário também roda sobre profissional já
  // cadastrado, e aí (profissional, serviço) e (profissional, serviço, dia,
  // início) já podem existir. As duas restrições únicas são totais, então o
  // `onConflict` acerta o índice (ao contrário do caso de índice PARCIAL, que
  // o PostgREST não mira).
  const saveProfessionalCatalog = async (
    professionalId: UUID,
    catalog: ProfessionalCatalogInput
  ) => {
    const services = catalog.services ?? []
    if (services.length === 0) return

    const serviceRows = services.map((s) => ({
      professional_id: professionalId,
      service_id: s.service_id,
      mode: s.tipo ?? "INDIVIDUAL",
      price: s.amount ?? null,
    }))

    const { error: servicesError } = await supabase
      .from(SUPA_TABLES.table_myia_professional_services)
      .upsert(serviceRows, { onConflict: "professional_id,service_id" })

    if (servicesError) throw servicesError

    const availabilityRows: Array<Record<string, unknown>> = []

    for (const [dayKey, day] of Object.entries(catalog.scheduler ?? {})) {
      const weekday = WEEKDAY_BY_KEY[dayKey]
      if (!weekday || !day?.enabled || !day.opening || !day.closing) continue

      for (const service of services) {
        availabilityRows.push({
          professional_id: professionalId,
          service_id: service.service_id,
          weekday,
          start_time: day.opening,
          end_time: day.closing,
          max_simultaneous_clients: 1,
        })
      }
    }

    if (availabilityRows.length === 0) return

    const { error: availabilityError } = await supabase
      .from(SUPA_TABLES.table_myia_professional_availability)
      .upsert(availabilityRows, {
        onConflict: "professional_id,service_id,weekday,start_time",
      })

    if (availabilityError) throw availabilityError
  }

  const updateProfessional = async (
    id: UUID,
    professional: ProfessionalUpdateInput
  ) => {
    setLoading(true)
    setError(null)

    try {
      // Só as colunas que existem na tabela. O modal de edição carrega junto
      // campos de UI (`agreements`, `specialties`, `services`, `id`), e mandar
      // qualquer um deles faz o PostgREST rejeitar a linha inteira.
      const COLUMNS = [
        "nome",
        "formacao",
        "especialidade",
        "registro",
        "atende_cat_idade",
        "convenios_aceitos",
        "horarios_atendimento",
        "email",
        "telefone",
        "observacoes",
        "search_tags",
        "notificame_dia",
        "notificame_horas",
        // Prescrição digital (0026). Entram na allowlist porque o modal de
        // edição é o único lugar onde a clínica preenche isso.
        "cpf",
        "data_nascimento",
        "conselho_sigla",
        "conselho_numero",
        "conselho_uf",
      ] as const

      const updateData: Record<string, unknown> = {}
      for (const column of COLUMNS) {
        if (professional[column] !== undefined) {
          updateData[column] = professional[column]
        }
      }

      if (Object.keys(updateData).length === 0) return

      updateData.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from(SUPA_TABLES.table_professionals_medical)
        .update(updateData)
        .eq("id", id)
        .select()
        .single()

      if (error) throw error

      // Reflete o que o banco realmente gravou, não o que o formulário mandou.
      setProfessionals((prev) =>
        prev.map((p) => (p.id === id ? ({ ...p, ...data } as Professional) : p))
      )
    } catch (err: any) {
      const message = err?.message ?? "Erro desconhecido ao atualizar profissional"
      setError(message)
      console.error("Erro ao atualizar profissional:", err)
      throw new Error(message)
    } finally {
      setLoading(false)
    }
  }

  const deleteProfessional = async (id: UUID) => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_professionals_medical)
        .delete()
        .eq("id", id)

      if (error) throw error

      setProfessionals(professionals.filter((p) => p.id !== id))
    } catch (err: any) {
      setError(err.message)
      console.error("Error deleting professional:", err)
    } finally {
      setLoading(false)
    }
  }

  const setAvailability = async (
    availabilityData: Omit<
      ProfessionalAvailability,
      "id" | "created_at" | "updated_at"
    >[]
  ) => {
    try {
      console.log("Salvando disponibilidades:", availabilityData)
      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_professional_availability)
        .insert(availabilityData)

      if (error) {
        console.error("Erro ao salvar disponibilidades:", error)
        throw error
      }
    } catch (err: any) {
      console.error("Error setting availability:", err)
      throw err
    }
  }

  return (
    <ProfessionalsContext.Provider
      value={{
        professionals,
        availability,
        loading,
        error,
        fetchProfessionals,
        fetchAvailability,
        createProfessional,
        updateProfessional,
        setProfessionalCatalog: saveProfessionalCatalog,
        deleteProfessional,
        setAvailability,
      }}
    >
      {children}
    </ProfessionalsContext.Provider>
  )
}

export const useProfessionals = () => useContext(ProfessionalsContext)
