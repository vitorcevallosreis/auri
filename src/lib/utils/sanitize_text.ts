export const slice_text = (text: string, length: number = 10): string => {
  return text?.length > length ? `${text.slice(0, length)}...` : text
}

export const formatTextWithBold = (
  text: string
): (string | { bold: boolean; content: string })[] => {
  const parts = text.split(/(\*.*?\*)/g)

  return parts.map((part) => {
    if (part.startsWith("*") && part.endsWith("*")) {
      return { bold: true, content: part.slice(1, -1) }
    }

    return part
  })
}
