import React, { useState } from "react";
import { Button, Tooltip, useDisclosure, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react";
import { Professional } from "@/contexts/Professionals/interfaces";
import ProfessionalViewModal from "./ProfessionalViewModal";
import ProfessionalDeleteConfirmation from "./ProfessionalDeleteConfirmation";
import ProfessionalEditModal from "./ProfessionalEditModal";

interface ProfessionalActionsProps {
  professional: Professional;
  onEdit: (professional: Professional) => void;
  onView?: () => void;
  onDelete: (professional: Professional) => void;
  isDeleting?: boolean;
  isEditing?: boolean;
  isViewing?: boolean;
}

export default function ProfessionalActions({
  professional,
  onEdit,
  onView,
  onDelete,
  isDeleting = false,
  isEditing = false,
  isViewing = false,
}: ProfessionalActionsProps) {
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleDeleteClick = () => setDeleteModalOpen(true);
  const handleDeleteConfirm = async () => {
    await onDelete(professional);
    setDeleteModalOpen(false);
  };
  const handleDeleteCancel = () => setDeleteModalOpen(false);

  return (
    <>
      <div className="flex space-x-2">
        <Tooltip content="Visualizar detalhes">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            color="primary"
            isLoading={isViewing}
            onPress={onView}
          >
            {/* Ícone de olho para visualizar */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Button>
        </Tooltip>

        <Tooltip content="Editar profissional">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={() => onEdit(professional)}
            isLoading={isEditing}
            disabled={isEditing || isDeleting}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </Button>
        </Tooltip>

        <Tooltip content="Excluir profissional" color="danger">
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={handleDeleteClick}
            className="text-danger"
            isLoading={isDeleting}
            disabled={isDeleting}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18" />
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" x2="10" y1="11" y2="17" />
              <line x1="14" x2="14" y1="11" y2="17" />
            </svg>
          </Button>
        </Tooltip>
      </div>
      <Modal isOpen={isDeleteModalOpen} onClose={handleDeleteCancel} hideCloseButton>
        <ModalContent>
          <ModalHeader>Confirmar exclusão</ModalHeader>
          <ModalBody>
            Tem certeza que deseja excluir este profissional? Esta ação não poderá ser desfeita.
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={handleDeleteCancel} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button color="danger" onPress={handleDeleteConfirm} isLoading={isDeleting}>
              Excluir
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
