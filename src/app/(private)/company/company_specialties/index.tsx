import React, { useContext, useEffect, useState } from "react"
import { CompanyContext } from "@/contexts/Company"
import { Plus, Stethoscope } from "lucide-react"
import { 
  Button, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter,
  useDisclosure,
  Input,
  Textarea,
  Switch,
  Tooltip,
  Chip
} from "@nextui-org/react"
import { Edit, Trash } from "lucide-react"
import { BodyCompanySpecialty, CompanySpecialty } from "@/contexts/Company/interfaces"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// Interface para estados de validação do formulário
interface FormValidation {
  name: boolean
}

export default function CompanySpecialties() {
  const { 
    isLoading, 
    companySpecialties, 
    getCompanySpecialties, 
    createCompanySpecialty, 
    updateCompanySpecialty, 
    deleteCompanySpecialty 
  } = useContext(CompanyContext)

  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure()

  // Estados
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState<string>("")
  const [isValid, setIsValid] = useState<FormValidation>({ name: true })
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteItem, setDeleteItem] = useState<CompanySpecialty | null>(null)

  // Carregar as especialidades ao montar o componente
  useEffect(() => {
    getCompanySpecialties()
  }, [])

  // Resetar o formulário
  const resetForm = () => {
    setFormMode("create")
    setSelectedId(null)
    setName("")
    setDescription("")
    setIsValid({ name: true })
  }

  // Abrir modal no modo de criação
  const handleOpenCreate = () => {
    resetForm()
    onOpen()
  }

  // Abrir modal no modo de edição
  const handleOpenEdit = (specialty: CompanySpecialty) => {
    setFormMode("edit")
    setSelectedId(specialty.id)
    setName(specialty.name)
    setDescription(specialty.description || "")
    onOpen()
  }

  // Validar formulário
  const validateForm = (): boolean => {
    const nameValid = name.trim().length > 0
    setIsValid({ name: nameValid })
    return nameValid
  }

  // Salvar (criar ou editar)
  const handleSave = async () => {
    if (!validateForm()) return

    const body: BodyCompanySpecialty = {
      name,
      description
    }

    if (formMode === "create") {
      await createCompanySpecialty(body)
    } else if (formMode === "edit" && selectedId) {
      await updateCompanySpecialty(selectedId, body)
    }

    onClose()
    resetForm()
  }

  // Confirmar exclusão
  const confirmDelete = (specialty: CompanySpecialty) => {
    setDeleteItem(specialty)
    setDeleteModalOpen(true)
  }

  // Executar exclusão
  const handleDelete = async () => {
    if (deleteItem) {
      await deleteCompanySpecialty(deleteItem.id)
      setDeleteModalOpen(false)
      setDeleteItem(null)
    }
  }

  return (
    <Card className="bg-white border-0 shadow-sm h-fit">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 rounded-lg">
            <Stethoscope className="h-5 w-5 text-[#00897B]" />
          </div>
          <CardTitle className="text-lg font-semibold text-gray-900">Especialidades</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-gray-600">Adicione as especialidades médicas oferecidas</p>
          <Button 
            className="bg-[#00897B] hover:bg-[#007366] text-white font-medium py-1.5 px-3 rounded-md text-sm transition-colors"
            size="sm"
            startContent={<Plus size={14} />}
            onClick={handleOpenCreate}
            isLoading={isLoading}
          >
            Adicionar
          </Button>
        </div>

        {/* Lista de especialidades */}
        <div className="space-y-2">
          {companySpecialties.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Clínica Geral</p>
              <p className="text-sm text-gray-500 mt-2">Cardiologia</p>
              <p className="text-sm text-gray-500 mt-2">Dermatologia</p>
            </div>
          ) : (
            companySpecialties.map((specialty) => (
              <div 
                key={specialty.id} 
                className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{specialty.name}</p>
                  {specialty.description && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">{specialty.description}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-4">
                  <Button 
                    isIconOnly 
                    size="sm" 
                    variant="light" 
                    className="h-8 w-8 hover:bg-gray-200"
                    onClick={() => handleOpenEdit(specialty)}
                  >
                    <Edit size={14} color="#00897B" />
                  </Button>
                  <Button 
                    isIconOnly 
                    size="sm" 
                    variant="light" 
                    className="h-8 w-8 hover:bg-red-100 text-[#00897B]"
                    onClick={() => confirmDelete(specialty)}
                  >
                    <Trash size={14} color="#00897B" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* Modal de criação/edição */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="border-b pb-3">
                <span className="text-gray-900 font-medium">
                  {formMode === "create" ? "Nova Especialidade" : "Editar Especialidade"}
                </span>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <Input
                    label="Nome da especialidade"
                    labelPlacement="outside"
                    placeholder="Digite o nome da especialidade"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    isRequired
                    isInvalid={!isValid.name}
                    errorMessage={!isValid.name ? "O nome é obrigatório" : ""}
                    classNames={{
                      label: "text-sm font-medium text-gray-700 mb-1",
                      input: "border-gray-200 focus:border-[#00897B]",
                    }}
                  />
                  <Textarea
                    label="Descrição"
                    labelPlacement="outside"
                    placeholder="Descreva a especialidade (opcional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    classNames={{
                      label: "text-sm font-medium text-gray-700 mb-1",
                      input: "border-gray-200 focus:border-[#00897B] resize-none",
                    }}
                    minRows={3}
                  />
                </div>
              </ModalBody>
              <ModalFooter className="border-t pt-3">
                <Button 
                  variant="light" 
                  className="text-gray-700 hover:bg-gray-100" 
                  onPress={onClose}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-[#00897B] hover:bg-[#007366] text-white" 
                  onPress={handleSave}
                  isLoading={isLoading}
                >
                  Salvar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal isOpen={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="border-b pb-3">
                <span className="text-gray-900 font-medium">Confirmar Exclusão</span>
              </ModalHeader>
              <ModalBody className="py-4">
                <p className="text-gray-800">
                  Tem certeza que deseja excluir a especialidade{" "}
                  <strong>{deleteItem?.name}</strong>?
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Esta ação não pode ser desfeita.
                </p>
              </ModalBody>
              <ModalFooter className="border-t pt-3">
                <Button 
                  variant="light" 
                  className="text-gray-700 hover:bg-gray-100" 
                  onPress={onClose}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-[#00897B] hover:bg-[#007366] text-white" 
                  onPress={handleDelete}
                  isLoading={isLoading}
                >
                  Excluir
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </Card>
  )
}
