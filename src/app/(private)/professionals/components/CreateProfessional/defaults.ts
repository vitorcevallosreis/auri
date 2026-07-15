export const formSteps = [
  {
    key: "select",
    title: "Selecionar Profissional",
    description: "Escolha entre criar um novo profissional ou selecionar um existente",
  },
  {
    key: "info",
    title: "Informações Básicas",
    description: "Dados gerais do profissional",
  },
  {
    key: "ageCategories",
    title: "Categorias de Atendimento",
    description: "Selecione as faixas etárias que o profissional atende",
  },
  {
    key: "agreements",
    title: "Convênios",
    description: "Selecione os convênios aceitos pelo profissional",
  },
  {
    key: "specialties",
    title: "Especialidades",
    description: "Selecione as especialidades do profissional",
  },
  {
    key: "services",
    title: "Serviços Oferecidos",
    description: "Selecione os serviços que este profissional oferece",
  },
  {
    key: "schedule",
    title: "Horários de Atendimento",
    description: "Configure os horários disponíveis para agendamento",
  },
  {
    key: "observations",
    title: "Observações",
    description: "Informações adicionais sobre o atendimento",
  },
] as const

export interface Specialty {
  id: string
  name: string
  description?: string
}

export const weekDays = [
  { id: "monday", name: "Segunda-Feira" },
  { id: "tuesday", name: "Terça-Feira" },
  { id: "wednesday", name: "Quarta-Feira" },
  { id: "thursday", name: "Quinta-Feira" },
  { id: "friday", name: "Sexta-Feira" },
  { id: "saturday", name: "Sábado" },
  { id: "sunday", name: "Domingo" },
] as const
