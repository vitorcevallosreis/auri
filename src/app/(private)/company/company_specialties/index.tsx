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
    <Card className="bg-card border-0 shadow-sm h-fit">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-50 rounded-lg dark:bg-teal-500/10">
            <Stethoscope className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg font-semibold text-foreground">Especialidades</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-muted-foreground">Adicione as especialidades médicas oferecidas</p>
          <Button 
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-1.5 px-3 rounded-md text-sm transition-colors"
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
            <div className="bg-muted rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Clínica Geral</p>
              <p className="text-sm text-muted-foreground mt-2">Cardiologia</p>
              <p className="text-sm text-muted-foreground mt-2">Dermatologia</p>
            </div>
          ) : (
            companySpecialties.map((specialty) => (
              <div 
                key={specialty.id} 
                className="flex justify-between items-center p-3 bg-muted rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{specialty.name}</p>
                  {specialty.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{specialty.description}</p>
                  )}
                </div>
                <div className="flex gap-1 ml-4">
                  <Button 
                    isIconOnly 
                    size="sm" 
                    variant="light" 
                    className="h-8 w-8 hover:bg-muted"
                    onClick={() => handleOpenEdit(specialty)}
                  >
                    <Edit size={14} className="text-primary" />
                  </Button>
                  <Button 
                    isIconOnly 
                    size="sm" 
                    variant="light" 
                    className="h-8 w-8 text-primary hover:bg-destructive/10"
                    onClick={() => confirmDelete(specialty)}
                  >
                    <Trash size={14} className="text-primary" />
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
                <span className="text-foreground font-medium">
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
                      label: "text-sm font-medium text-foreground mb-1",
                      input: "border-border focus:border-primary",
                    }}
                  />
                  <Textarea
                    label="Descrição"
                    labelPlacement="outside"
                    placeholder="Descreva a especialidade (opcional)"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    classNames={{
                      label: "text-sm font-medium text-foreground mb-1",
                      input: "border-border focus:border-primary resize-none",
                    }}
                    minRows={3}
                  />
                </div>
              </ModalBody>
              <ModalFooter className="border-t pt-3">
                <Button 
                  variant="light" 
                  className="text-foreground hover:bg-muted" 
                  onPress={onClose}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground" 
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
                <span className="text-foreground font-medium">Confirmar Exclusão</span>
              </ModalHeader>
              <ModalBody className="py-4">
                <p className="text-foreground">
                  Tem certeza que deseja excluir a especialidade{" "}
                  <strong>{deleteItem?.name}</strong>?
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Esta ação não pode ser desfeita.
                </p>
              </ModalBody>
              <ModalFooter className="border-t pt-3">
                <Button 
                  variant="light" 
                  className="text-foreground hover:bg-muted" 
                  onPress={onClose}
                >
                  Cancelar
                </Button>
                <Button 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground" 
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
