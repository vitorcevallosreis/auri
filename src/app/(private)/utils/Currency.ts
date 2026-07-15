export const formatToBRL = (value: string | number): string => {
  const numericValue = Number(value) || 0
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue)
}
