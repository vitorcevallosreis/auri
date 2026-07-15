"use client"

import { useState, useEffect, useContext } from "react"
import { useParams } from "next/navigation"
import { AssistantsContext } from "@/contexts/Assistants"
import { yupResolver } from "@hookform/resolvers/yup"
import { useForm } from "react-hook-form"
import * as yup from "yup"

// Interface para o sub-agente
export interface SubAgent {
  id: string
  name: string
  prompt: string
  status: "active" | "disabled"
  examples: string[]
  assistant_id: string
}

// Schema de validação para o formulário de sub-agente
const subAgentSchema = yup.object({
  name: yup.string().required("Nome é obrigatório"),
  prompt: yup.string().required("Prompt é obrigatório"),
  status: yup.string().oneOf(["active", "disabled"] as const).required(),
  examples: yup.array().of(yup.string().required()).default([]),
}).required()

// Tipo para o formulário alinhado com o schema
interface SubAgentFormInputs {
  name: string
  prompt: string
  status: "active" | "disabled"
  examples: string[]
}

export interface ISubAgentsModel {
  subAgents: SubAgent[]
  isLoading: boolean
  currentSubAgent: SubAgent | null
  setCurrentSubAgent: (subAgent: SubAgent | null) => void
  handleSubmit: any
  register: any
  errors: any
  reset: any
  onSubmit: (data: SubAgentFormInputs) => Promise<void>
  deleteSubAgent: (id: string) => Promise<void>
  toggleStatus: (id: string) => Promise<void>
  isEditing: boolean
  setIsEditing: (value: boolean) => void
  addExample: () => void
  removeExample: (index: number) => void
  examples: string[]
  setExamples: (examples: string[]) => void
}

const useSubAgentsModel = (): ISubAgentsModel => {
  const { assistant_id }: { assistant_id: string } = useParams()
  const { assistant } = useContext(AssistantsContext)
  
  const [subAgents, setSubAgents] = useState<SubAgent[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [currentSubAgent, setCurrentSubAgent] = useState<SubAgent | null>(null)
  const [isEditing, setIsEditing] = useState<boolean>(false)
  const [examples, setExamples] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SubAgentFormInputs>({
    resolver: yupResolver<SubAgentFormInputs>(subAgentSchema),
    defaultValues: {
      name: "",
      prompt: "",
      status: "active",
      examples: [],
    },
  })

  useEffect(() => {
    // Aqui implementaremos a busca de sub-agentes quando tivermos a API
    // Por enquanto, vamos simular com dados de exemplo
    const fetchSubAgents = async () => {
      try {
        setIsLoading(true)
        // Dados simulados para teste
        const mockSubAgents: SubAgent[] = [
          {
            id: "1",
            name: "Agente de Vendas",
            prompt: "Você é um assistente de vendas especializado em ajudar clientes a encontrar produtos.",
            status: "active",
            examples: ["Como posso ajudá-lo a encontrar o produto ideal?", "Quais são suas necessidades específicas?"],
            assistant_id
          },
          {
            id: "2",
            name: "Agente de Suporte",
            prompt: "Você é um assistente de suporte técnico especializado em resolver problemas.",
            status: "disabled",
            examples: ["Qual problema você está enfrentando?", "Já tentou reiniciar o sistema?"],
            assistant_id
          }
        ]
        
        setSubAgents(mockSubAgents)
      } catch (error) {
        console.error("Erro ao buscar sub-agentes:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (assistant_id) {
      fetchSubAgents()
    }
  }, [assistant_id])

  useEffect(() => {
    if (currentSubAgent) {
      setValue("name", currentSubAgent.name)
      setValue("prompt", currentSubAgent.prompt)
      setValue("status", currentSubAgent.status)
      setExamples(currentSubAgent.examples || [])
    } else {
      reset()
      setExamples([])
    }
  }, [currentSubAgent, reset, setValue])

  const onSubmit = async (data: SubAgentFormInputs): Promise<void> => {
    try {
      const formattedData = {
        ...data,
        examples,
        assistant_id
      }

      if (isEditing && currentSubAgent) {
        // Atualizar sub-agente existente
        const updatedSubAgents = subAgents.map(subAgent => 
          subAgent.id === currentSubAgent.id 
            ? { ...formattedData, id: currentSubAgent.id } as SubAgent
            : subAgent
        )
        setSubAgents(updatedSubAgents)
        // Aqui implementaremos a chamada de API para atualizar no banco quando tivermos a API
      } else {
        // Criar novo sub-agente
        const newSubAgent: SubAgent = {
          ...formattedData,
          id: Date.now().toString(), // ID temporário
          status: data.status || "active",
        } as SubAgent
        
        setSubAgents([...subAgents, newSubAgent])
        // Aqui implementaremos a chamada de API para salvar no banco quando tivermos a API
      }
      
      // Resetar o formulário e estado
      reset()
      setCurrentSubAgent(null)
      setIsEditing(false)
      setExamples([])
    } catch (error) {
      console.error("Erro ao salvar sub-agente:", error)
    }
  }

  const deleteSubAgent = async (id: string): Promise<void> => {
    try {
      // Remover sub-agente da lista local
      setSubAgents(subAgents.filter(subAgent => subAgent.id !== id))
      // Aqui implementaremos a chamada de API para remover do banco quando tivermos a API
      
      if (currentSubAgent?.id === id) {
        setCurrentSubAgent(null)
        setIsEditing(false)
      }
    } catch (error) {
      console.error("Erro ao deletar sub-agente:", error)
    }
  }

  const toggleStatus = async (id: string): Promise<void> => {
    try {
      // Atualizar status do sub-agente na lista local
      const updatedSubAgents = subAgents.map(subAgent => {
        if (subAgent.id === id) {
          const newStatus = subAgent.status === "active" ? "disabled" : "active"
          return { ...subAgent, status: newStatus } as SubAgent
        }
        return subAgent
      })
      
      setSubAgents(updatedSubAgents)
      // Aqui implementaremos a chamada de API para atualizar o status no banco quando tivermos a API
    } catch (error) {
      console.error("Erro ao alternar status do sub-agente:", error)
    }
  }

  const addExample = () => {
    setExamples([...examples, ""])
  }

  const removeExample = (index: number) => {
    const newExamples = [...examples]
    newExamples.splice(index, 1)
    setExamples(newExamples)
  }

  return {
    subAgents,
    isLoading,
    currentSubAgent,
    setCurrentSubAgent,
    handleSubmit,
    register,
    errors,
    reset,
    onSubmit,
    deleteSubAgent,
    toggleStatus,
    isEditing,
    setIsEditing,
    addExample,
    removeExample,
    examples,
    setExamples
  }
}

export default useSubAgentsModel
