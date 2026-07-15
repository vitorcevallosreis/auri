import { supabase } from "@/lib/supabase/config"
import SUPA_TABLES from "@/contexts/supa_tables"
import bcrypt from "bcrypt"

// Interface para a resposta de Login
export interface LoginResponse {
  success: boolean
  user?: any
  error?: string | null
}

export const Login = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  try {
    console.log(`Tentando login com email: ${email}`)
    
    // Verificar se o email está em formato válido
    if (!email || !email.includes('@')) {
      console.log('Email em formato inválido')
      return { success: false, error: "Formato de e-mail inválido" }
    }
    
    // Consulta ao banco de dados usando schema explícito
    const { data, error } = await supabase
      .from("nexa.myia_users")
      .select("*")
      .eq("email", email)
      .single()
    
    // Log detalhado do resultado da consulta
    console.log('Resultado da consulta:', { 
      data: data ? 'Dados encontrados' : 'Dados não encontrados', 
      error: error ? {
        message: error.message,
        code: error.code,
        details: error.details
      } : 'Sem erro'
    })
    
    if (error) {
      // Verificar se o erro é "não encontrado" ou outro tipo de erro
      if (error.code === 'PGRST116') {
        console.log('Usuário não encontrado na base de dados')
        throw new Error("E-mail não cadastrado no sistema!")
      } else {
        console.log('Erro na consulta:', error)
        throw new Error(`Erro na consulta: ${error.message}`)
      }
    }
    
    if (!data) {
      console.log('Dados não encontrados, mas sem erro específico')
      throw new Error("E-mail ou senha inválidos!")
    }

    // Verificar se a senha é válida
    console.log('Verificando senha para o usuário:', data.email)
    const isPasswordValid = await bcrypt.compare(password, data.hashed_password)
    console.log('Validação de senha:', isPasswordValid)

    if (!isPasswordValid) throw new Error("Senha inválida!")

    return { success: true, user: data, error: null }
  } catch (error: unknown) {
    // Tratar o erro como instância de `Error` ou outro formato.
    let errorMessage = "Ocorreu um erro inesperado."

    if (error instanceof Error) {
      errorMessage = error.message
      console.log('Erro de login (Error):', errorMessage)
    } else if (typeof error === "string") {
      errorMessage = error // Caso o erro seja uma string
      console.log('Erro de login (string):', errorMessage)
    } else if (typeof error === "object" && error !== null) {
      // Tentar acessar a mensagem se for um objeto
      errorMessage = (error as { message?: string }).message || errorMessage
      console.log('Erro de login (objeto):', error)
    }

    return { success: false, error: errorMessage }
  }
}

// Interface para a resposta de Register
export interface RegisterResponse {
  success: boolean
  user?: any
}

export const Register = async ({
  company_id,
  name,
  email,
  password,
}: {
  company_id: string
  name: string
  email: string
  password: string
}): Promise<RegisterResponse> => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    const { data, error } = await supabase
      .from("nexa.myia_users")
      .insert([
        {
          company_id: company_id,
          name: name,
          email: email,
          hashed_password: hashedPassword,
        },
      ])
      .select()
      .single()

    if (error)
      throw new Error(`Não foi possível criar o usuário. ${error.message}`)

    return { success: true, user: data }
  } catch (error) {
    console.log(error)

    return { success: false }
  }
}

export const RefreshToken = async (
  hashed_password: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("nexa.myia_users")
      .select("*")
      .eq("hashed_password", hashed_password)
      .single()

    if (error || !data) throw error

    return true
  } catch (error) {
    return false
  }
}

// Função para verificar se o usuário existe no banco de dados
export const CheckUserExists = async (email: string): Promise<boolean> => {
  try {
    console.log(`Verificando se o usuário existe: ${email}`)
    
    // Consulta direta no schema nexa, usando o nome completo da tabela
    const { data, error } = await supabase
      .from("nexa.myia_users")
      .select("id, email")
      .eq("email", email)
      .maybeSingle()

    console.log('Resultado da consulta:', { 
      encontrado: !!data, 
      erro: error ? error.message : null 
    })

    return !!data
  } catch (error) {
    console.log('Erro ao verificar usuário:', error)
    return false
  }
}
