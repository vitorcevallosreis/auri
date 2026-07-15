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
