"use server"

import { supabase } from "@/lib/supabase/config"
import bcrypt from "bcrypt"

interface RegisterResponse {
  success: boolean
  user?: any
}

// TODO: onboarding real (RPC). `Register` ainda aponta para o schema antigo
// (insere name/email/hashed_password em myia_users, colunas que não existem no
// schema novo do Plano 1). Continua referenciado por src/contexts/Auth/index.tsx,
// então não foi removido — deve ser substituído por um fluxo de signUp real
// (Supabase Auth + RPC que cria a company e o vínculo em myia_users).
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
