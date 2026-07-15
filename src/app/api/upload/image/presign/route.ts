import { NextResponse } from "next/server"
import { Client as MinioClient } from "minio"

function parseMinioEndpoint(url: string) {
  const u = new URL(url)
  const useSSL = u.protocol === 'https:'
  const endPoint = u.hostname
  const port = u.port ? Number(u.port) : (useSSL ? 443 : 80)
  return { endPoint, port, useSSL }
}

export async function POST(req: Request) {
  try {
    const { chat_id, company_id, contentType = 'image/jpeg', ext = 'jpg' } = (await req.json()) || {}

    if (!chat_id) {
      return NextResponse.json({ error: 'chat_id is required' }, { status: 400 })
    }

    const endpoint = process.env.MINIO_SERVER_URL || process.env.NEXT_PUBLIC_MINIO_SERVER_URL
    const bucket = process.env.MINIO_BUCKET || process.env.NEXT_PUBLIC_MINIO_BUCKET || 'nexa-whatsapp'
    const accessKey = process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY
    const secretKey = process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY

    if (!endpoint || !bucket || !accessKey || !secretKey) {
      return NextResponse.json({ error: 'MinIO environment not configured' }, { status: 500 })
    }

    const { endPoint, port, useSSL } = parseMinioEndpoint(endpoint)

    const minioClient = new MinioClient({ endPoint, port, useSSL, accessKey, secretKey })

    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2, 8)
    const folderCompany = company_id ? `company/${company_id}` : 'company/unknown'
    const objectName = `${folderCompany}/chats/${chat_id}/messages/${ts}-${rand}.image.${ext}`

    try {
      const exists = await minioClient.bucketExists(bucket)
      if (!exists) {
        try { await minioClient.makeBucket(bucket, '') } catch {}
      }
    } catch {}

    const expiresSeconds = 60 * 5

    const uploadUrl = await minioClient.presignedPutObject(
      bucket,
      objectName,
      expiresSeconds
    )

    const objectUrl = `${endpoint.replace(/\/$/, '')}/${bucket}/${objectName}`

    return NextResponse.json({ uploadUrl, objectUrl, bucket, objectName, expiresSeconds }, { status: 200 })
  } catch (error) {
    console.error('[presign-image] error', error)
    return NextResponse.json({ error: 'Failed to presign' }, { status: 500 })
  }
}
