import { useState } from "react"
import axios from "axios"

interface ViaCepResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  estado: string
  erro?: boolean
}

export function useBuscaCep() {
  const [loading, setLoading] = useState(false)

  const get_zip_code = async (cep: string): Promise<ViaCepResponse | null> => {
    const cleanCep = cep.replace(/\D/g, "") // Remove caracteres não numéricos

    if (cleanCep.length !== 8) return null // Verifica o tamanho do CEP

    setLoading(true)

    try {
      const { data } = await axios.get<ViaCepResponse>(
        `https://viacep.com.br/ws/${cleanCep}/json/`
      )

      if (data.erro) {
        console.error("CEP não encontrado")
        return null
      }

      return data
    } catch (error) {
      console.error("Erro ao buscar o CEP:", error)
      return null
    } finally {
      setLoading(false)
    }
  }

  return {
    get_zip_code,
    loading,
  }
}
