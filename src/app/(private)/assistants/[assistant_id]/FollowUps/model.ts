"use client"

import { useContext, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { AuthContext } from "@/contexts/Auth"
import { AssistantsContext } from "@/contexts/Assistants"
import { BodyFollowUpStep, FollowUpStep } from "@/contexts/Assistants/interfaces"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"

// Esquema de validação para o formulário de follow-up
export const followUpStepSchema = z.object({
  step_number: z.number().min(1, "A ordem deve ser no mínimo 1"),
  delay_minutes: z.number().min(1, "O tempo de espera deve ser no mínimo 1 minuto"),
  message: z.string().min(5, "A mensagem deve ter no mínimo 5 caracteres"),
  auto_close: z.boolean().default(false)
})

export type FollowUpStepFormValues = z.infer<typeof followUpStepSchema>

export interface IFollowUpsModel {
  isLoading: boolean
  followUpSteps: FollowUpStep[]
  currentStep: FollowUpStep | null
  isEditing: boolean
  isModalOpen: boolean
  form: ReturnType<typeof useForm<FollowUpStepFormValues>>
  openModal: () => void
  closeModal: () => void
  editStep: (step: FollowUpStep) => void
  deleteStep: (id: string) => Promise<void>
  onSubmit: (data: FollowUpStepFormValues) => Promise<void>
  refreshSteps: () => Promise<void>
}

export const useFollowUpsModel = (): IFollowUpsModel => {
  const { assistant_id } = useParams<{ assistant_id: string }>()
  const { user } = useContext(AuthContext)
  const { 
    isLoading, 
    followUpSteps, 
    getFollowUpSteps, 
    createFollowUpStep, 
    updateFollowUpStep,
    deleteFollowUpStep
  } = useContext(AssistantsContext)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [currentStep, setCurrentStep] = useState<FollowUpStep | null>(null)

  // Configuração do formulário
  const form = useForm<FollowUpStepFormValues>({
    resolver: zodResolver(followUpStepSchema),
    defaultValues: {
      step_number: 1,
      delay_minutes: 60,
      message: "",
      auto_close: false
    }
  })

  // Carregar os follow-ups quando o componente for montado
  useEffect(() => {
    if (user?.company_id && assistant_id) {
      getFollowUpSteps(assistant_id)
    }
  }, [user, assistant_id])

  // Funções para manipulação do modal
  const openModal = () => {
    // Determinar o próximo número do passo
    const nextStepNumber = followUpSteps.length > 0
      ? Math.max(...followUpSteps.map(step => step.step_number)) + 1
      : 1

    form.reset({
      step_number: nextStepNumber,
      delay_minutes: 60,
      message: "",
      auto_close: false
    })
    setIsEditing(false)
    setCurrentStep(null)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    form.reset()
  }

  // Função para editar um passo existente
  const editStep = (step: FollowUpStep) => {
    setCurrentStep(step)
    form.reset({
      step_number: step.step_number,
      delay_minutes: step.delay_minutes,
      message: step.message,
      auto_close: step.auto_close
    })
    setIsEditing(true)
    setIsModalOpen(true)
  }

  // Função para excluir um passo
  const deleteStep = async (id: string) => {
    if (confirm("Tem certeza que deseja excluir este passo de follow-up?")) {
      await deleteFollowUpStep(id)
    }
  }

  // Função para atualizar a lista de passos
  const refreshSteps = async () => {
    if (assistant_id) {
      await getFollowUpSteps(assistant_id)
    }
  }

  // Função para submeter o formulário
  const onSubmit = async (data: FollowUpStepFormValues) => {
    if (isEditing && currentStep) {
      await updateFollowUpStep(currentStep.id, data)
    } else {
      await createFollowUpStep(assistant_id, data)
    }
    closeModal()
  }

  return {
    isLoading,
    followUpSteps,
    currentStep,
    isEditing,
    isModalOpen,
    form,
    openModal,
    closeModal,
    editStep,
    deleteStep,
    onSubmit,
    refreshSteps
  }
}

export default useFollowUpsModel
