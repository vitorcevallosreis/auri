import { useContext, useEffect, useState } from "react"
import { AuthContext } from "@/contexts/Auth"
import { useProfessionals } from "@/contexts/Professionals"
import { Professional } from "@/contexts/Professionals/interfaces"
import { UUID } from "crypto"

// Custom hook para gerenciar os profissionais
const useProfessionalPageModel = () => {
  const { user } = useContext(AuthContext)
  const { 
    fetchProfessionals, 
    professionals, 
    loading, 
    updateProfessional, 
    deleteProfessional 
  } = useProfessionals()

  const [showForm, setShowForm] = useState<boolean>(false)
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.company_id) return

    fetchProfessionals(user?.company_id as UUID)
  }, [user])

  // Função para selecionar um profissional para edição
  const selectProfessional = (professional: Professional) => {
    setSelectedProfessional(professional)
  }

  // Função para lidar com a exclusão de um profissional
  const handleDeleteProfessional = async (professional: Professional) => {
    if (!professional.id) return
    try {
      setDeletingId(professional.id)
      await deleteProfessional(professional.id as UUID)
    } catch (error) {
      console.error("Erro ao excluir profissional:", error)
    } finally {
      setDeletingId(null)
    }
  }

  return {
    loading,
    showForm,
    setShowForm,
    professionals,
    selectedProfessional,
    selectProfessional,
    handleDeleteProfessional,
    deletingId,
    editingId,
    setEditingId,
    viewingId,
    setViewingId
  }
}

export default useProfessionalPageModel
