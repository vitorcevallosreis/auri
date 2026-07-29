"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase/config"
import SUPA_TABLES from "@/contexts/supa_tables"

export default function TestAuthPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [directResult, setDirectResult] = useState<any>(null)
  const [apiResult, setApiResult] = useState<any>(null)

  async function checkUserInAllSchemas() {
    setLoading(true)
    setResult(null)
    setDirectResult(null)
    setApiResult(null)

    try {
      // Verificar no schema padrão (nexa)
      const { data: nexaData, error: nexaError } = await supabase
        .from(SUPA_TABLES.table_myia_users)
        .select("id, email, name, created_at")
        .eq("email", email)
        .maybeSingle()

      // Verificar no schema public
      const { data: publicData, error: publicError } = await supabase
        .from("public.users")
        .select("id, email, name, created_at")
        .eq("email", email)
        .maybeSingle()

      // Verificar no schema public com prefixo myia_
      const { data: publicMyiaData, error: publicMyiaError } = await supabase
        .from("public.myia_users")
        .select("id, email, name, created_at")
        .eq("email", email)
        .maybeSingle()

      // Consulta direta para verificar todos os usuários
      const { data: allUsers, error: allUsersError } = await supabase
        .from(SUPA_TABLES.table_myia_users)
        .select("id, email, name, created_at")
        .limit(10)

      // Verificar schemas disponíveis
      const { data: schemas, error: schemasError } = await supabase
        .from("information_schema.tables")
        .select("table_schema, table_name")
        .ilike("table_name", "%users%")

      setResult({
        nexaResult: {
          found: !!nexaData,
          data: nexaData,
          error: nexaError ? nexaError.message : null,
        },
        publicResult: {
          found: !!publicData,
          data: publicData,
          error: publicError ? publicError.message : null,
        },
        publicMyiaResult: {
          found: !!publicMyiaData,
          data: publicMyiaData,
          error: publicMyiaError ? publicMyiaError.message : null,
        },
        allUsers: {
          count: allUsers?.length || 0,
          data: allUsers,
          error: allUsersError ? allUsersError.message : null,
        },
        schemas: schemas || [],
        schemasError: schemasError ? schemasError.message : null,
        clientConfig: {
          schema: supabase.options?.db?.schema || "não definido",
          url: process.env.NEXT_PUBLIC_SUPABASE_URL || "não definido",
        },
      })
    } catch (error: any) {
      console.error("Erro ao verificar usuário:", error)
      setResult({ error: error.message || "Erro desconhecido" })
    } finally {
      setLoading(false)
    }
  }

  async function checkUserDirect() {
    setLoading(true)
    setDirectResult(null)

    try {
      // Consulta SQL direta para verificar em todos os schemas
      const query = `
        SELECT EXISTS (
          SELECT 1 FROM nexa.myia_users WHERE email = '${email}'
        ) as exists_in_nexa,
        EXISTS (
          SELECT 1 FROM public.myia_users WHERE email = '${email}'
        ) as exists_in_public_myia,
        EXISTS (
          SELECT 1 FROM public.users WHERE email = '${email}'
        ) as exists_in_public
      `

      const { data, error } = await supabase.rpc("exec_sql", { sql: query })

      setDirectResult({
        data,
        error: error ? error.message : null,
      })
    } catch (error: any) {
      console.error("Erro na consulta direta:", error)
      setDirectResult({ error: error.message || "Erro desconhecido" })
    } finally {
      setLoading(false)
    }
  }

  async function checkUserApi() {
    setLoading(true)
    setApiResult(null)

    try {
      const response = await fetch("/api/check-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()
      setApiResult(data)
    } catch (error: any) {
      console.error("Erro na API:", error)
      setApiResult({ error: error.message || "Erro desconhecido" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Teste de Autenticação</h1>

      <div className="mb-4">
        <label htmlFor="email" className="block mb-2">
          Email para verificar:
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 w-full max-w-md"
          placeholder="Digite o email para verificar"
        />
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={checkUserInAllSchemas}
          disabled={loading || !email}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          Verificar Usuário
        </button>

        <button
          onClick={checkUserDirect}
          disabled={loading || !email}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          Consulta SQL Direta
        </button>

        <button
          onClick={checkUserApi}
          disabled={loading || !email}
          className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          Verificar via API
        </button>
      </div>

      {loading && <p className="mb-4">Carregando...</p>}

      {result && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Resultado da Verificação</h2>
          <div className="bg-muted p-4 rounded overflow-auto max-h-96">
            <pre>{JSON.stringify(result, null, 2)}</pre>
          </div>
        </div>
      )}

      {directResult && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Resultado da Consulta SQL</h2>
          <div className="bg-muted p-4 rounded overflow-auto max-h-96">
            <pre>{JSON.stringify(directResult, null, 2)}</pre>
          </div>
        </div>
      )}

      {apiResult && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Resultado da API</h2>
          <div className="bg-muted p-4 rounded overflow-auto max-h-96">
            <pre>{JSON.stringify(apiResult, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
