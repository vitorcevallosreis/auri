// Utilitário para formatação de nomes de canais
// Exibe apenas a primeira parte antes de "_" e aplica um fallback opcional

export function formatChannelName(value?: string, fallback: string = "Canal WhatsApp"): string {
  if (!value || typeof value !== "string") return fallback
  const first = value.split("_")[0]
  return first || fallback
}
