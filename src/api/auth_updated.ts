"use server"

import { supabase } from "@/lib/supabase/config"
import bcrypt from "bcrypt"

interface LoginResponse {
  success: boolean
  error: any
  user?: any
}

interface RegisterResponse {
  success: boolean
  user?: any
}

export const RefreshToken = async (
  hashed_password: string
): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from("myia_users")
      .select("*")
      .eq("hashed_password", hashed_password)
      .single()

    if (error || !data) throw error

    return true
  } catch (error) {
    return false
  }
}

export const Login = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  try {
    const { data, error } = await supabase
      .from("myia_users")
      .select("*")
      .eq("email", email)
      .single()

    if (error || !data) throw new Error("E-mail ou senha inválidos!")

    const isPasswordValid = await bcrypt.compare(password, data.hashed_password)

    if (!isPasswordValid) throw new Error("Senha inválida!")

    return { success: true, user: data, error: null }
  } catch (error: unknown) {
    // Tratar o erro como instância de `Error` ou outro formato.
    let errorMessage = "Ocorreu um erro inesperado."

    if (error instanceof Error) {
      errorMessage = error.message
    } else if (typeof error === "string") {
      errorMessage = error // Caso o erro seja uma string
    } else if (typeof error === "object" && error !== null) {
      // Tentar acessar a mensagem se for um objeto
      errorMessage = (error as { message?: string }).message || errorMessage
    }

    return { success: false, error: errorMessage }
  }
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
      .from("myia_users")
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
