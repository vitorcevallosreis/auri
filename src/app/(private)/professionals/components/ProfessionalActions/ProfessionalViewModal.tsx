import React from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Divider,
} from "@nextui-org/react";
import { Professional } from "@/contexts/Professionals/interfaces";

// Interface para representar as categorias de idade
interface AgeCategories {
  adulto?: boolean | string;
  idoso?: boolean | string;
  crianca?: boolean | string;
  adolescente?: boolean | string;
  [key: string]: boolean | string | undefined;
}

// Interface para representar os horários de atendimento
interface ScheduleTime {
  enabled?: boolean | string;
  opening?: string | null;
  closing?: string | null;
  [key: string]: boolean | string | null | undefined;
}

interface ProfessionalViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  professional: Professional;
  onEdit: (professional: Professional) => void;
}

export default function ProfessionalViewModal({
  isOpen,
  onClose,
  professional,
  onEdit,
}: ProfessionalViewModalProps) {
  if (!professional) return null;

  const dayNames: Record<string, string> = {
    monday: "Segunda-feira",
    tuesday: "Terça-feira",
    wednesday: "Quarta-feira",
    thursday: "Quinta-feira",
    friday: "Sexta-feira",
    saturday: "Sábado",
    sunday: "Domingo",
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" data-view-modal-open={isOpen ? "true" : undefined}>
      <ModalContent>
        <>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-xl">{professional.nome}</h2>
            <p className="text-sm text-gray-500 font-normal">
              {professional.formacao} - {professional.especialidade}
            </p>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    Registro
                  </h3>
                  <p>{professional.registro || "Não informado"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-1">
                    Contato
                  </h3>
                  <p>{professional.email}</p>
                  <p>{professional.telefone}</p>
                </div>
              </div>

              <Divider />

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Categorias de Atendimento
                </h3>
                <div className="flex flex-wrap gap-2">
                  {professional.atende_cat_idade && (
                    <>
                      {Array.isArray(professional.atende_cat_idade) ? (
                        // Tratar como array de strings
                        professional.atende_cat_idade.map((categoria) => (
                          <span 
                            key={categoria}
                            className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs"
                          >
                            {categoria}
                          </span>
                        ))
                      ) : (
                        // Tratar como objeto
                        (() => {
                          const ageCategories = professional.atende_cat_idade as unknown as AgeCategories;
                          return (
                            <>
                              {(ageCategories.adulto === true ||
                                ageCategories.adulto === "true" ||
                                ageCategories.adulto === "on") && (
                                <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                                  Adulto
                                </span>
                              )}
                              {(ageCategories.idoso === true ||
                                ageCategories.idoso === "true" ||
                                ageCategories.idoso === "on") && (
                                <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                                  Idoso
                                </span>
                              )}
                              {(ageCategories.crianca === true ||
                                ageCategories.crianca === "true" ||
                                ageCategories.crianca === "on") && (
                                <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                                  Criança
                                </span>
                              )}
                              {(ageCategories.adolescente === true ||
                                ageCategories.adolescente === "true" ||
                                ageCategories.adolescente === "on") && (
                                <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs">
                                  Adolescente
                                </span>
                              )}
                            </>
                          );
                        })()
                      )}
                    </>
                  )}
                </div>
              </div>

              <Divider />

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Convênios Aceitos
                </h3>
                <div className="flex flex-wrap gap-2">
                  {professional.convenios_aceitos && (
                    <>
                      {Array.isArray(professional.convenios_aceitos) ? (
                        // Tratar como array de strings
                        professional.convenios_aceitos.map((convenio) => (
                          <div
                            key={convenio}
                            className="px-2 py-1 bg-primary-50 text-primary-700 rounded-md text-sm"
                          >
                            {convenio}
                          </div>
                        ))
                      ) : (
                        // Tratar como objeto Record<string, boolean | string>
                        Object.entries(professional.convenios_aceitos as Record<string, boolean | string>).map(
                          ([name, value]) =>
                            (value === true ||
                              value === "true" ||
                              value === "on") && (
                              <div
                                key={name}
                                className="px-2 py-1 bg-primary-50 text-primary-700 rounded-md text-sm"
                              >
                                {name}
                              </div>
                            )
                        )
                      )}
                    </>
                  )}
                </div>
              </div>

              <Divider />

              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-2">
                  Horários de Atendimento
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {professional.horarios_atendimento && (
                    <>
                      {typeof professional.horarios_atendimento === 'object' && !Array.isArray(professional.horarios_atendimento) ? (
                        // Tratar como objeto de horários
                        Object.entries(professional.horarios_atendimento as Record<string, ScheduleTime>).map(
                          ([day, schedule]) => {
                            return schedule &&
                              (schedule.enabled === true ||
                                schedule.enabled === "true" ||
                                schedule.enabled === "on") ? (
                              <div key={day} className="border rounded p-2">
                                <p className="font-medium">{dayNames[day]}</p>
                                <p className="text-sm">
                                  {schedule.opening} - {schedule.closing}
                                </p>
                              </div>
                            ) : null;
                          }
                        )
                      ) : (
                        // Caso seja outro formato (como array), exibir mensagem alternativa
                        <div className="col-span-2 text-gray-500 text-sm">
                          Horários não disponíveis no formato esperado
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {professional.observacoes && (
                <>
                  <Divider />
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-2">
                      Observações
                    </h3>
                    <p className="text-sm whitespace-pre-wrap">
                      {professional.observacoes}
                    </p>
                  </div>
                </>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Fechar
            </Button>
            <Button
              color="primary"
              onPress={() => {
                onClose();
                onEdit(professional);
              }}
            >
              Editar
            </Button>
          </ModalFooter>
        </>
      </ModalContent>
    </Modal>
  );
}
