"use client"

import React from "react"
import { Input, Select, SelectItem } from "@nextui-org/react"

/**
 * Dados que a Memed exige para cadastrar o prescritor.
 *
 * Vive fora dos dois formulários de profissional (o wizard de cadastro e o
 * modal de edição) porque os dois precisam exatamente do mesmo bloco, e porque
 * as regras de formato aqui espelham CHECKs do banco (migration 0026) — se
 * cada tela reimplementasse a máscara, uma delas ia divergir do CHECK e o erro
 * só apareceria no salvamento.
 *
 * É um componente CONTROLADO: as duas telas guardam estado de formas
 * diferentes (react-hook-form num lado, useState no outro), então quem manda
 * no valor é sempre quem chama.
 */

/** Os conselhos aceitos pelo CHECK `myia_professionals_conselho_sigla`. */
export const CONSELHOS = [
  { sigla: "CRM", nome: "CRM — Medicina" },
  { sigla: "CRO", nome: "CRO — Odontologia" },
  { sigla: "COREN", nome: "COREN — Enfermagem" },
  { sigla: "CRMV", nome: "CRMV — Medicina Veterinária" },
  { sigla: "CRF", nome: "CRF — Farmácia" },
  { sigla: "CRN", nome: "CRN — Nutrição" },
  { sigla: "CREFITO", nome: "CREFITO — Fisioterapia e T. Ocupacional" },
  { sigla: "CRP", nome: "CRP — Psicologia" },
  { sigla: "CRFa", nome: "CRFa — Fonoaudiologia" },
  { sigla: "CREF", nome: "CREF — Educação Física" },
] as const

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const

/** Só dígitos, no máximo 11 — é a forma que o banco aceita. */
export function apenasDigitosCpf(valor: string): string {
  return valor.replace(/\D/g, "").slice(0, 11)
}

/** 000.000.000-00 para exibir. O que é gravado continua sendo só dígito. */
export function mascararCpf(digitos: string): string {
  const d = apenasDigitosCpf(digitos)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/**
 * Confere os dois dígitos verificadores.
 *
 * O banco só exige 11 dígitos, e a Memed é quem recusaria um CPF inexistente —
 * mas aí o erro chega como "a Memed recusou o cadastro (422)" na hora de
 * prescrever, longe de quem digitou. Validar aqui transforma isso em um erro
 * embaixo do campo, no momento da digitação.
 */
export function cpfValido(valor: string): boolean {
  const d = apenasDigitosCpf(valor)
  if (d.length !== 11) return false
  // Todos os dígitos iguais passam na conta dos verificadores, mas nenhum é
  // CPF de verdade.
  if (/^(\d)\1{10}$/.test(d)) return false

  const digito = (ate: number) => {
    let soma = 0
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

/**
 * O que ainda falta para este profissional prescrever.
 *
 * Repete a regra de `camposFaltando()` em `src/lib/memed/cliente.ts` de
 * propósito: aquele módulo lê `MEMED_SECRET_KEY` e não pode ser importado por
 * componente de cliente. A lista de campos obrigatórios é da Memed — se ela
 * mudar, os dois lugares mudam juntos.
 */
export function faltamDadosMemed(p: DadosPrescricaoValores): string[] {
  const falta: string[] = []
  if (!p.cpf) falta.push("CPF")
  if (!p.data_nascimento) falta.push("data de nascimento")
  if (!p.conselho_sigla) falta.push("conselho")
  if (!p.conselho_numero) falta.push("número do conselho")
  if (!p.conselho_uf) falta.push("UF do conselho")
  return falta
}

export interface DadosPrescricaoValores {
  cpf?: string | null
  data_nascimento?: string | null
  conselho_sigla?: string | null
  conselho_numero?: string | null
  conselho_uf?: string | null
}

interface Props {
  valores: DadosPrescricaoValores
  onChange: (campo: keyof DadosPrescricaoValores, valor: string) => void
  /** Some com o título/descrição quando o bloco já está sob um cabeçalho. */
  semCabecalho?: boolean
}

export default function DadosPrescricao({ valores, onChange, semCabecalho }: Props) {
  const cpf = valores.cpf ?? ""
  const cpfIncompleto = cpf.length > 0 && cpf.length < 11
  const cpfErrado = cpf.length === 11 && !cpfValido(cpf)

  return (
    <div className="space-y-4">
      {!semCabecalho && (
        <div>
          <h3 className="text-md font-medium">Prescrição digital (Memed)</h3>
          <p className="text-sm text-muted-foreground">
            Opcional. Sem estes dados o profissional atende normalmente, mas não
            consegue emitir receita pelo prontuário.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="CPF"
          placeholder="000.000.000-00"
          inputMode="numeric"
          value={mascararCpf(cpf)}
          onChange={(e) => onChange("cpf", apenasDigitosCpf(e.target.value))}
          isInvalid={cpfErrado}
          errorMessage={cpfErrado ? "CPF inválido — confira os dígitos." : undefined}
          description={cpfIncompleto ? "Faltam dígitos." : undefined}
        />

        <Input
          label="Data de nascimento"
          type="date"
          placeholder=" "
          value={valores.data_nascimento ?? ""}
          onChange={(e) => onChange("data_nascimento", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Conselho"
          placeholder="Selecione"
          selectedKeys={valores.conselho_sigla ? [valores.conselho_sigla] : []}
          onChange={(e) => onChange("conselho_sigla", e.target.value)}
        >
          {CONSELHOS.map((c) => (
            <SelectItem key={c.sigla} value={c.sigla} textValue={c.sigla}>
              {c.nome}
            </SelectItem>
          ))}
        </Select>

        <Input
          label="Número do conselho"
          placeholder="Ex: 118432"
          inputMode="numeric"
          value={valores.conselho_numero ?? ""}
          onChange={(e) => onChange("conselho_numero", e.target.value.replace(/\D/g, ""))}
        />

        <Select
          label="UF do conselho"
          placeholder="Selecione"
          selectedKeys={valores.conselho_uf ? [valores.conselho_uf] : []}
          onChange={(e) => onChange("conselho_uf", e.target.value)}
        >
          {UFS.map((uf) => (
            <SelectItem key={uf} value={uf}>
              {uf}
            </SelectItem>
          ))}
        </Select>
      </div>
    </div>
  )
}
