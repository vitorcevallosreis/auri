import React from "react"
import {
  Button,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@nextui-org/react"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import useProfessionalPageModel from "./model"
import CreateProfessional from "./components/CreateProfessional"
import ProfessionalActions from "./components/ProfessionalActions"
import ProfessionalEditModal from "./components/ProfessionalActions/ProfessionalEditModal"
import ProfessionalViewModal from "./components/ProfessionalActions/ProfessionalViewModal"

import { useEffect } from "react";

export default function ProfessionalPageView({
  loading,
  showForm,
  setShowForm,
  professionals,
  selectProfessional,
  handleDeleteProfessional,
  deletingId,
  editingId,
  setEditingId,
  viewingId,
  setViewingId,
}: ReturnType<typeof useProfessionalPageModel>) {

  // Reset editingId, viewingId e deletingId se o modal correspondente não estiver aberto
  useEffect(() => {
    // Se não existe modal de edição aberto, reseta editingId
    if (editingId && !document.body.querySelector('[data-edit-modal-open="true"]')) {
      setEditingId(null);
    }
    // Se não existe modal de visualização aberto, reseta viewingId
    if (viewingId && !document.body.querySelector('[data-view-modal-open="true"]')) {
      setViewingId(null);
    }
    // Se não existe modal de exclusão aberto, reseta deletingId
    if (deletingId && !document.body.querySelector('[data-delete-modal-open="true"]')) {
      // Se você usar modal para exclusão, implemente o atributo data-delete-modal-open no modal
      // setDeletingId(null);
    }
  }, [editingId, viewingId, deletingId]);

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Profissionais</h1>
          {!showForm && (
            <Button
              color="primary"
              onPress={() => setShowForm(true)}
              disabled={loading}
              radius="sm"
            >
              Adicionar Profissional
            </Button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center items-center p-10">
            <Spinner size="lg" label="Carregando..." />
          </div>
        )}

        {showForm ? (
          <CreateProfessional setShowForm={setShowForm} />
        ) : (
          !loading && (
            <>
              {professionals.length > 0 ? (
                <Table
                  aria-label="Tabela de profissionais"
                  selectionMode="none"
                  shadow="sm"
                  className="rounded-md"
                >
                  <TableHeader>
                    <TableColumn>NOME</TableColumn>
                    <TableColumn>ESPECIALIDADE</TableColumn>
                    <TableColumn>REGISTRO</TableColumn>
                    <TableColumn>CONTATO</TableColumn>
                    <TableColumn>AÇÕES</TableColumn>
                  </TableHeader>
                  <TableBody>
                    {professionals.map((professional) => (
                      <TableRow key={professional.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {professional.nome}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {professional.formacao}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{professional.especialidade}</TableCell>
                        <TableCell>{professional.registro}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{professional.email}</span>
                            <span>{professional.telefone}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <ProfessionalActions 
                            professional={professional}
                            onEdit={() => setEditingId(professional.id)}
                            onView={() => setViewingId(professional.id)}
                            onDelete={handleDeleteProfessional}
                            isDeleting={deletingId === professional.id}
                            isEditing={editingId === professional.id}
                            isViewing={viewingId === professional.id}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10 bg-muted rounded-lg">
                  <h3 className="font-medium text-lg mb-2">
                    Nenhum profissional cadastrado
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Clique no botão acima para adicionar seu primeiro
                    profissional
                  </p>
                  <Button color="primary" onPress={() => setShowForm(true)}>
                    Adicionar Profissional
                  </Button>
                </div>
              )}
            </>
          )
        )}
      </div>

      {/* Modal de edição controlado pelo componente pai */}
      {editingId && (
        <ProfessionalEditModal
          isOpen={!!editingId}
          onClose={() => setEditingId(null)}
          professional={professionals.find(p => p.id === editingId)!}
        />
      )}

      {/* Modal de visualização controlado pelo componente pai */}
      {viewingId && (
        <ProfessionalViewModal
          isOpen={!!viewingId}
          onClose={() => setViewingId(null)}
          professional={professionals.find(p => p.id === viewingId)!}
          onEdit={() => {
            setViewingId(null);
            setEditingId(viewingId);
          }}
        />
      )}
    </DashboardLayout>
  )
}
