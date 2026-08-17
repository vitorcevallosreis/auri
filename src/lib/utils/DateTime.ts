import moment from "moment"
import "moment/locale/pt-br"

// Formato DD [de] MMMM => Ex: 06 de janeiro
export const DateReservationCard = (date: string): string => {
  return moment(date).format("DD [de] MMMM")
}

// Formato DD [de] MMMM [de] YYYY => Ex: 24 de dezembro de 2024
export const DateReservationDetailModal = (date: string): string => {
  return moment(date).format("DD [de] MMMM [de] YYYY")
}

// Formato DD/MM/YYYY HH:mm => Ex: 24/01/2024 10:20 com UTC
export const EventDateTime = (date: string): string => {
  return moment(date).utc().format("DD/MM/YYYY HH:mm")
}

export const PromotionDate = (date: string): string => {
  return moment(date).utc().format("DD/MM/YYYY")
}

export const PromotionTime = (time: string): string => {
  const formattedTime = moment(time, "HH:mm:ss", true) // Formato esperado "HH:mm:ss"

  if (!formattedTime.isValid()) {
    return "Data inválida"
  }

  return formattedTime.format("HH:mm")
}

// ---------------------------------------------------------------------------
// Fuso horário — contrato único entre as telas e as RPCs.
//
// As funções de dashboard no banco usam `current_date`, que no Supabase é UTC.
// Num recorte mensal isso é cosmético; numa tela chamada "Meu Dia" é fatal — às
// 21h de Brasília o médico veria a agenda de amanhã. Por isso as RPCs de 0021
// recebem `p_tz`, e a lista de hoje e os agregados usam A MESMA origem de data.
// ---------------------------------------------------------------------------

/** Fuso do navegador, com o de São Paulo como rede de segurança. */
export const clientTz = (): string =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo"

/** Data de hoje como "YYYY-MM-DD" no fuso indicado.
 *
 *  O locale 'sv-SE' é o atalho consagrado para ISO curto: ele formata como
 *  ano-mês-dia com zero à esquerda. `toISOString().slice(0,10)` NÃO serve —
 *  converte para UTC antes e erra o dia nas primeiras e últimas horas. */
export const todayInTz = (tz: string = clientTz()): string =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(new Date())
