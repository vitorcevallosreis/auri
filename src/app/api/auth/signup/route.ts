import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase/server"

// Onboarding de nova conta (self-registration).
//
// Por que server-only: o cadastro precisa criar três coisas ligadas entre si —
// o usuário no Supabase Auth, a empresa, e o vínculo em myia_users (cujo `id`
// É o auth.users.id). Do browser isso é impossível: o anon não passa pela RLS
// de myia_companies (política `id = auth_company_id()`), então o insert falhava
// em silêncio. Aqui usamos o service role, que ignora a RLS.
//
// Ordem: auth.users -> myia_companies -> myia_users. Se um passo falhar,
// desfazemos os anteriores para não deixar empresa órfã nem usuário sem tenant.
//
// email_confirm: true — o projeto não tem SMTP configurado; sem isso o usuário
// criaria a conta e não conseguiria logar (esperando um e-mail que nunca chega).
// Quando houver SMTP, trocar por fluxo de confirmação real.

export const dynamic = "force-dynamic"

interface SignupBody {
  name?: string
  email?: string
  password?: string
  company_name?: string
  domain_server?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeDomain(raw: string): string {
  return raw.trim().toLowerCase()
}

/** Empresa já usa esse domínio? Consulta com service role (RLS não se aplica). */
async function domainTaken(domain: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from("myia_companies")
    .select("id")
    .ilike("domain_server", domain)
    .limit(1)

  if (error) throw new Error(`falha ao verificar domínio: ${error.message}`)
  return (data?.length ?? 0) > 0
}

/** GET /api/auth/signup?domain=x — checagem de disponibilidade para o formulário. */
export async function GET(req: Request) {
  try {
    const domain = new URL(req.url).searchParams.get("domain")
    if (!domain || !domain.trim()) {
      return NextResponse.json({ error: "domain_required" }, { status: 400 })
    }

    return NextResponse.json({ available: !(await domainTaken(normalizeDomain(domain))) })
  } catch (err: any) {
    console.error("[auth/signup] GET falhou:", err?.message)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let createdUserId: string | null = null
  let createdCompanyId: string | null = null

  try {
    const body = (await req.json()) as SignupBody

    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const companyName = body.company_name?.trim()
    const domain = body.domain_server ? normalizeDomain(body.domain_server) : ""

    // (1) Validação de entrada — espelha o schema yup do formulário.
    if (!name || !email || !password || !companyName || !domain) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 })
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "invalid_email" }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "weak_password" }, { status: 400 })
    }

    // (2) Domínio livre? (checagem best-effort; ver TODO de índice único abaixo)
    if (await domainTaken(domain)) {
      return NextResponse.json({ error: "domain_taken" }, { status: 409 })
    }

    // (3) Usuário no Supabase Auth. É a fonte da verdade do id do tenant.
    const { data: userData, error: userError } =
      await supabaseServer.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      })

    if (userError || !userData?.user) {
      const msg = userError?.message ?? ""
      if (/already|registered|exists/i.test(msg)) {
        return NextResponse.json({ error: "email_taken" }, { status: 409 })
      }
      throw new Error(`falha ao criar usuário: ${msg}`)
    }
    createdUserId = userData.user.id

    // (4) Empresa (tenant).
    const { data: companyData, error: companyError } = await supabaseServer
      .from("myia_companies")
      .insert([{ name: companyName, domain_server: domain }])
      .select("id")
      .single()

    if (companyError || !companyData) {
      throw new Error(`falha ao criar empresa: ${companyError?.message}`)
    }
    createdCompanyId = companyData.id

    // (5) Vínculo usuário <-> empresa. myia_users.id REFERENCIA auth.users(id),
    //     é o que auth_company_id() usa para resolver o tenant na RLS.
    const { error: linkError } = await supabaseServer
      .from("myia_users")
      .insert([{ id: createdUserId, company_id: createdCompanyId, role: "owner" }])

    if (linkError) {
      throw new Error(`falha ao vincular usuário à empresa: ${linkError.message}`)
    }

    return NextResponse.json(
      { ok: true, company_id: createdCompanyId, user_id: createdUserId },
      { status: 201 },
    )
  } catch (err: any) {
    // Rollback na ordem inversa. Best-effort: se a limpeza falhar, logamos —
    // não adianta devolver erro de limpeza para quem tentou se cadastrar.
    if (createdCompanyId) {
      await supabaseServer
        .from("myia_companies")
        .delete()
        .eq("id", createdCompanyId)
        .then(({ error }) => {
          if (error) console.error("[auth/signup] rollback empresa falhou:", error.message)
        })
    }
    if (createdUserId) {
      const { error } = await supabaseServer.auth.admin.deleteUser(createdUserId)
      if (error) console.error("[auth/signup] rollback usuário falhou:", error.message)
    }

    console.error("[auth/signup] POST falhou:", err?.message)
    return NextResponse.json({ error: "internal_error" }, { status: 500 })
  }
}
