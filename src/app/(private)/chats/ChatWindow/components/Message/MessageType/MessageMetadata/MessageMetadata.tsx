import { MessageSchemaTyped } from "@/contexts/Messages/schemas"
import { MessageIconStatus } from "@/lib/utils/MessageStatus"
import moment from "moment"
import 'moment/locale/pt-br'
import React, { useMemo } from "react"
import { twMerge } from "tailwind-merge"

interface MessageMetadataProps {
  message: MessageSchemaTyped
  bgColor?: string
  textColor?: string
}

export default function MessageMetadata({
  message,
  bgColor = "",
  textColor = "",
}: MessageMetadataProps) {
  // Formata a data no estilo WhatsApp com useMemo para melhor performance
  const formattedDate = useMemo(() => {
    if (!message.created_at) return "";
    
    // Forçar a criação de uma nova instância do momento para evitar cache
    const messageDate = moment(new Date(message.created_at));
    const now = moment();
    const diffDays = now.diff(messageDate, 'days');
    
    // Menos de 24 horas: mostrar apenas a hora (HH:mm)
    if (diffDays < 1) {
      return messageDate.format('HH:mm');
    }
    // Entre 1 e 7 dias: mostrar o dia da semana e hora
    else if (diffDays < 7) {
      return messageDate.format('ddd HH:mm');
    }
    // Mais de 7 dias no mesmo ano: mostrar dia/mês e hora
    else if (messageDate.year() === now.year()) {
      return messageDate.format('DD/MM HH:mm');
    }
    // Ano diferente: mostrar data completa
    else {
      return messageDate.format('DD/MM/YYYY HH:mm');
    }
  }, [message.created_at]);

  return message.from_me ? (
    <div
      className={twMerge(
        "flex items-center justify-end gap-1 text-xs text-muted-foreground ml-auto text-right rounded",
        bgColor,
        textColor
      )}
    >
      {message.created_at && (
        <div>{formattedDate}</div>
      )}
      {MessageIconStatus(message.status)}
    </div>
  ) : (
    <div
      className={twMerge(
        "flex-end items-center gap-1 text-xs text-muted-foreground p-1 rounded",
        bgColor,
        textColor
      )}
    >
      {message.created_at && (
        <div>{formattedDate}</div>
      )}
    </div>
  )
}
