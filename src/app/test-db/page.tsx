"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/config"
import SUPA_TABLES from "@/contexts/supa_tables"

export default function TestDbPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tables, setTables] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [schema, setSchema] = useState<string>("nexa")

  useEffect(() => {
    testConnection()
  }, [])

  async function testConnection() {
    try {
      setLoading(true)
      setError(null)

      // Testar conexão básica
      const { data: tablesData, error: tablesError } = await supabase
        .from("information_schema.tables")
        .select("table_name")
        .eq("table_schema", "nexa")
        .limit(10)

      if (tablesError) {
        throw new Error(`Erro ao listar tabelas: ${tablesError.message}`)
      }

      setTables(tablesData || [])

      // Tentar listar usuários (sem mostrar senhas)
      const { data: usersData, error: usersError } = await supabase
        .from(SUPA_TABLES.table_myia_users)
        .select("id, email, name, created_at")
        .limit(10)

      if (usersError) {
        throw new Error(`Erro ao listar usuários: ${usersError.message}`)
      }

      setUsers(usersData || [])
    } catch (err: any) {
      console.error("Erro no teste de conexão:", err)
      setError(err.message || "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }

  async function changeSchema(newSchema: string) {
    setSchema(newSchema)
    // Não é possível mudar o schema em runtime, mas podemos testar consultas em outros schemas
    try {
      const { data, error } = await supabase.rpc("get_schema_tables", { 
        schema_name: newSchema 
      })
      
      if (error) throw error
      setTables(data || [])
    } catch (err: any) {
      setError(`Erro ao consultar schema ${newSchema}: ${err.message}`)
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Teste de Conexão com Banco de Dados</h1>
      
      {loading ? (
        <p>Carregando...</p>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p><strong>Erro:</strong> {error}</p>
        </div>
      ) : (
        <div>
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <p>Conexão com o banco de dados estabelecida com sucesso!</p>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Schemas</h2>
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => changeSchema("nexa")}
                className={`px-3 py-1 rounded ${schema === "nexa" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
              >
                nexa
              </button>
              <button 
                onClick={() => changeSchema("public")}
                className={`px-3 py-1 rounded ${schema === "public" ? "bg-blue-500 text-white" : "bg-gray-200"}`}
              >
                public
              </button>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Tabelas Disponíveis</h2>
            {tables.length === 0 ? (
              <p>Nenhuma tabela encontrada no schema {schema}</p>
            ) : (
              <ul className="list-disc pl-5">
                {tables.map((table, index) => (
                  <li key={index}>{table.table_name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">Usuários Cadastrados</h2>
            {users.length === 0 ? (
              <p>Nenhum usuário encontrado</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border border-gray-300">
                  <thead>
                    <tr>
                      <th className="py-2 px-4 border-b">ID</th>
                      <th className="py-2 px-4 border-b">Email</th>
                      <th className="py-2 px-4 border-b">Nome</th>
                      <th className="py-2 px-4 border-b">Data de Criação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="py-2 px-4 border-b">{user.id}</td>
                        <td className="py-2 px-4 border-b">{user.email}</td>
                        <td className="py-2 px-4 border-b">{user.name}</td>
                        <td className="py-2 px-4 border-b">{new Date(user.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              onClick={testConnection}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Testar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
