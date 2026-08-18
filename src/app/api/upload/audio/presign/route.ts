import { NextResponse } from "next/server"
import { Client as MinioClient } from "minio"
import { getAuthedCompanyId, chatCompanyId } from "@/lib/auth/tenant"

/**
 * AUTENTICAÇÃO. Esta rota entregava URL assinada de escrita no bucket a QUEM
 * PEDISSE: o middleware exclui `/api/*`, e aqui não havia checagem nenhuma —
 * um POST anônimo com um `chat_id` qualquer recebia permissão de gravar (e a
 * rota ainda criava o bucket se faltasse).
 *
 * A identidade vem do JWT do Supabase em `Authorization: Bearer`, como nas
 * rotas de prontuário e de mensagens. O `company_id` do CORPO é ignorado de
 * propósito: aceitá-lo deixaria um usuário legítimo da clínica A escrever na
 * pasta da clínica B só trocando um campo do JSON.
 */

function parseMinioEndpoint(url: string) {
  const u = new URL(url)
  const useSSL = u.protocol === 'https:'
  const endPoint = u.hostname
  const port = u.port ? Number(u.port) : (useSSL ? 443 : 80)
  return { endPoint, port, useSSL }
}

export async function POST(req: Request) {
  try {
    const callerCompanyId = await getAuthedCompanyId(req)
    if (!callerCompanyId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    const { chat_id, contentType = 'audio/mpeg', ext = 'mp3' } = (await req.json()) || {}

    if (!chat_id) {
      return NextResponse.json({ error: 'chat_id is required' }, { status: 400 })
    }

    // O chat tem de ser da empresa do chamador. Sem isto, autenticar-se em
    // qualquer clínica bastaria para gravar dentro da pasta de outra.
    const donoDoChat = await chatCompanyId(chat_id)
    if (!donoDoChat || donoDoChat !== callerCompanyId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const endpoint = process.env.MINIO_SERVER_URL || process.env.NEXT_PUBLIC_MINIO_SERVER_URL
    const bucket = process.env.MINIO_BUCKET || process.env.NEXT_PUBLIC_MINIO_BUCKET || 'nexa-whatsapp'
    const accessKey = process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY
    const secretKey = process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY

    if (!endpoint || !bucket || !accessKey || !secretKey) {
      return NextResponse.json({ error: 'MinIO environment not configured' }, { status: 500 })
    }

    const { endPoint, port, useSSL } = parseMinioEndpoint(endpoint)

    const minioClient = new MinioClient({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
      // pathStyle is default for minio client
    })

    // Generate object key
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const folderCompany = `company/${callerCompanyId}`
    const objectName = `${folderCompany}/chats/${chat_id}/messages/${ts}-${rand}.audio.${ext}`

    // Ensure bucket exists (no-op if already exists)
    try {
      const exists = await minioClient.bucketExists(bucket)
      if (!exists) {
        try { await minioClient.makeBucket(bucket, '') } catch {}
      }
    } catch {}

    // Put policy: for presign we don't need to set bucket policy here; serving is via public URL configured by infra
    const expiresSeconds = 60 * 5 // 5 minutes

    const uploadUrl = await minioClient.presignedPutObject(
      bucket,
      objectName,
      expiresSeconds
    )

    // Public object URL (virtual-host style by default for your CDN/domain)
    const objectUrl = `${endpoint.replace(/\/$/, '')}/${bucket}/${objectName}`

    return NextResponse.json({ uploadUrl, objectUrl, bucket, objectName, expiresSeconds }, { status: 200 })
  } catch (error) {
    console.error('[presign-audio] error', error)
    return NextResponse.json({ error: 'Failed to presign' }, { status: 500 })
  }
}
