import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/config'

export async function POST(request: NextRequest) {
  try {
    const { sql } = await request.json()

    if (!sql) {
      return NextResponse.json(
        { error: 'SQL query é obrigatória' },
        { status: 400 }
      )
    }

    // Executar a consulta SQL diretamente
    // Nota: Isso deve ser usado apenas para diagnóstico e não em produção
    const { data, error } = await supabase.rpc('exec_sql', { sql })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ data })
  } catch (error: any) {
    console.error('Erro ao executar SQL:', error)
    return NextResponse.json(
      { error: error.message || 'Erro desconhecido' },
      { status: 500 }
    )
  }
}
