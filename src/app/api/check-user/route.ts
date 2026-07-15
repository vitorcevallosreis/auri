import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/config'
import SUPA_TABLES from '@/contexts/supa_tables'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar no schema padrão (nexa)
    const { data: nexaData, error: nexaError } = await supabase
      .from(SUPA_TABLES.table_myia_users)
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    // Verificar no schema public
    const { data: publicData, error: publicError } = await supabase
      .from('public.' + SUPA_TABLES.table_myia_users.replace('myia_', ''))
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    // Verificar schemas disponíveis
    const { data: schemas, error: schemasError } = await supabase
      .from('information_schema.tables')
      .select('table_schema, table_name')
      .ilike('table_name', '%users%')

    // Verificar configuração do cliente Supabase
    const clientConfig = {
      schema: supabase.options?.db?.schema || 'não definido',
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'não definido',
    }

    return NextResponse.json({
      nexaResult: {
        found: !!nexaData,
        data: nexaData,
        error: nexaError ? nexaError.message : null
      },
      publicResult: {
        found: !!publicData,
        data: publicData,
        error: publicError ? publicError.message : null
      },
      schemas: schemas || [],
      schemasError: schemasError ? schemasError.message : null,
      clientConfig
    })
  } catch (error: any) {
    console.error('Erro ao verificar usuário:', error)
    return NextResponse.json(
      { error: error.message || 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
