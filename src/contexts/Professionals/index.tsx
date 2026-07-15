import React, { createContext, useContext, useState } from "react"
import {
  Professional,
  ProfessionalAvailability,
  ProfessionalsContextType,
} from "./interfaces"
import { defaultProfessionalsContext } from "./defaults"
import { supabase } from "@/lib/supabase/client"
import { UUID } from "crypto"
import SUPA_TABLES from "../supa_tables"

const ProfessionalsContext = createContext<ProfessionalsContextType>(
  defaultProfessionalsContext
)

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
        .from("myia_professional_availability")
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

  const createProfessional = async (professionalData: any) => {
    try {
      console.log(
        "TESTE: Dados básicos do profissional a serem salvos:",
        professionalData
      )

      // // Enviar exatamente os dados formatados para o banco
      // const { data, error } = await supabase
      //   .from('myia_professionals_medical')
      //   .insert(professionalData)
      //   .select()
      //   .single();

      // if (error) {
      //   console.error("TESTE: Erro ao criar profissional:", error);
      //   throw error;
      // }

      // if (!data) {
      //   console.error("TESTE: Nenhum dado retornado após a inserção do profissional");
      //   throw new Error("Nenhum dado retornado após a inserção do profissional");
      // }

      // console.log("TESTE: Dados retornados após a inserção:", data);

      // // Formatar o profissional para o formato da interface
      // const formattedProfessional = formatProfessionalForInterface(data);
      // console.log("TESTE: Profissional formatado para interface:", formattedProfessional);

      // return formattedProfessional;

      // Temporariamente lançar um erro ou retornar undefined, pois a criação agora é via webhook
      console.warn(
        "createProfessional no contexto não deve mais ser usado para inserção direta. Use o endpoint."
      )
      // Opcional: Adicionar o profissional ao estado local se ele for passado como argumento após sucesso do webhook
      // fetchProfessionals(); // Ou apenas adiciona ao estado local
      return undefined // ou lançar erro
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Erro desconhecido ao criar profissional"
      console.error("Erro ao criar profissional:", errorMessage)
      throw new Error(errorMessage)
    }
  }

  const updateProfessional = async (
    id: UUID,
    professional: Partial<Professional>
  ) => {
    setLoading(true)
    setError(null)

    try {
      // Preparar dados para o formato esperado pela tabela
      const updateData: any = {}

      if (professional.name) updateData.nome = professional.name
      if (professional.specialization) {
        updateData.formacao = professional.specialization[0] || ""
        updateData.registro = professional.specialization[1] || ""
      }
      if (professional.email) updateData.email = professional.email
      if (professional.phone) updateData.telefone = professional.phone
      if (professional.observations)
        updateData.observacoes = professional.observations

      // Categorias de idade como JSONB
      if (
        professional.attend_adult !== undefined ||
        professional.attend_teen !== undefined ||
        professional.attend_child !== undefined
      ) {
        // Buscar o registro atual para obter dados existentes
        const { data: existingData } = await supabase
          .from("myia_professionals_medical")
          .select("atende_cat_idade")
          .eq("id", id)
          .single()

        // Mesclar com os dados existentes
        const currentCatIdade = existingData?.atende_cat_idade || {
          adulto: false,
          adolescente: false,
          crianca: false,
        }

        updateData.atende_cat_idade = {
          adulto:
            professional.attend_adult !== undefined
              ? professional.attend_adult
              : currentCatIdade.adulto,
          adolescente:
            professional.attend_teen !== undefined
              ? professional.attend_teen
              : currentCatIdade.adolescente,
          crianca:
            professional.attend_child !== undefined
              ? professional.attend_child
              : currentCatIdade.crianca,
        }
      }

      // Convênios como JSONB
      if (professional.agreements) {
        // Buscar os convênios atuais para mesclar
        const { data: existingData } = await supabase
          .from("myia_professionals_medical")
          .select("convenios_aceitos")
          .eq("id", id)
          .single()

        const currentConvenios = existingData?.convenios_aceitos || {}

        // Criar um objeto com todos os convênios definidos como true
        const updatedConvenios = professional.agreements.reduce(
          (acc, convName) => ({ ...acc, [convName]: true }),
          {} as Record<string, boolean>
        )

        // Mesclar com os convênios existentes
        updateData.convenios_aceitos = {
          ...currentConvenios,
          ...updatedConvenios,
        }
      }

      console.log("Atualizando profissional com ID:", id, "Dados:", updateData)

      // // Comentado: Chamada direta ao Supabase para update
      // const { error } = await supabase
      //   .from('myia_professionals_medical')
      //   .update(updateData)
      //   .eq('id', id);

      // if (error) {
      //   console.error('Erro ao atualizar profissional:', error);
      //   throw error;
      // }

      // Lógica de atualização local (pode ser mantida ou ajustada dependendo do fluxo pós-webhook)
      console.warn(
        "updateProfessional no contexto não deve mais ser usado para atualização direta via Supabase. Use o endpoint apropriado (se houver)."
      )

      // Atualizar o profissional na lista local (exemplo)
      const updatedIndex = professionals.findIndex((p) => p.id === id)
      if (updatedIndex !== -1) {
        const updatedProfessional = {
          ...professionals[updatedIndex],
          ...professional,
        }

        const newProfessionals = [...professionals]
        newProfessionals[updatedIndex] = updatedProfessional
        setProfessionals(newProfessionals)
      }
    } catch (err: any) {
      setError(err.message)
      console.error("Error updating professional:", err)
    } finally {
      setLoading(false)
    }
  }

  const deleteProfessional = async (id: UUID) => {
    setLoading(true)
    setError(null)

    try {
      const { error } = await supabase
        .from("myia_professionals_medical")
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
        .from("myia_professional_availability")
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
        deleteProfessional,
        setAvailability,
      }}
    >
      {children}
    </ProfessionalsContext.Provider>
  )
}

export const useProfessionals = () => useContext(ProfessionalsContext)
