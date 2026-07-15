import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from "@nextui-org/react";
import { Professional } from "@/contexts/Professionals/interfaces";

interface ProfessionalDeleteConfirmationProps {
  isOpen: boolean;
  onClose: () => void;
  professional: Professional;
  onConfirm: () => void;
  isLoading: boolean;
}

export default function ProfessionalDeleteConfirmation({
  isOpen,
  onClose,
  professional,
  onConfirm,
  isLoading,
}: ProfessionalDeleteConfirmationProps) {
  if (!professional) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" data-delete-modal-open={isOpen ? "true" : undefined}>
      <ModalContent>
        <>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-xl">Confirmar exclusão</h2>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <p>
                Tem certeza que deseja excluir o profissional{" "}
                <strong>{professional.nome}</strong>?
              </p>
              <p className="text-sm text-danger">
                Esta ação não pode ser desfeita e todos os dados relacionados a este profissional serão perdidos.
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              color="danger"
              onPress={onConfirm}
              isLoading={isLoading}
            >
              Excluir
            </Button>
          </ModalFooter>
        </>
      </ModalContent>
    </Modal>
  );
}
