import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { getAuthedCompanyId } from '@/lib/auth/tenant';

/**
 * AUTENTICAÇÃO E CREDENCIAIS.
 *
 * Esta rota respondia a QUALQUER pessoa na internet e gravava no bucket. Pior
 * que as irmãs `presign`: elas ficam inertes sem `MINIO_*` no ambiente, e esta
 * não ficava — trazia usuário e SENHA do MinIO escritos no código como valor
 * padrão, então funcionava sem configuração nenhuma. Um POST anônimo subia
 * arquivo para o object storage do fornecedor antigo.
 *
 * Os padrões foram removidos: sem `MINIO_*` no ambiente a rota agora falha
 * fechada (500), em vez de silenciosamente usar uma credencial de terceiro.
 * A identidade vem do JWT do Supabase em `Authorization: Bearer`, e o objeto
 * é gravado dentro da pasta da empresa do chamador.
 */
const MINIO_SERVER = process.env.MINIO_SERVER_URL || process.env.NEXT_PUBLIC_MINIO_SERVER_URL;
const MINIO_BUCKET = process.env.MINIO_BUCKET || process.env.NEXT_PUBLIC_MINIO_BUCKET || 'audios';
const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER || process.env.MINIO_ACCESS_KEY;
const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD || process.env.MINIO_SECRET_KEY;

/**
 * API para upload de áudio para o Minio S3
 */
export async function POST(request: NextRequest) {
  console.log('API de upload de áudio iniciada');
  
  try {
    const callerCompanyId = await getAuthedCompanyId(request);
    if (!callerCompanyId) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    if (!MINIO_SERVER || !MINIO_ROOT_USER || !MINIO_ROOT_PASSWORD) {
      console.error('[upload/audio] MINIO_* ausente — recusando em vez de usar credencial embutida');
      return NextResponse.json({ error: 'MinIO environment not configured' }, { status: 500 });
    }

    // Verificar se o request é multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('Nenhum arquivo enviado');
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400 }
      );
    }
    
    console.log('Arquivo recebido:', {
      name: file.name,
      type: file.type,
      size: file.size
    });
    
    // Verificar tipo de arquivo
    if (!file.type.startsWith('audio/') && file.type !== 'application/octet-stream') {
      console.error('Tipo de arquivo inválido:', file.type);
      return NextResponse.json(
        { error: 'Tipo de arquivo inválido. Envie apenas arquivos de áudio.' },
        { status: 400 }
      );
    }
    
    // Verificar tamanho do arquivo (máximo 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      console.error('Arquivo muito grande:', file.size);
      return NextResponse.json(
        { error: 'Arquivo muito grande. O tamanho máximo é 10MB.' },
        { status: 400 }
      );
    }
    
    // Criar cliente S3 para o Minio
    const s3Client = new S3Client({
      region: 'stub', // Alterado de 'us-east-1' para 'stub' conforme a mensagem de erro
      endpoint: MINIO_SERVER,
      credentials: {
        accessKeyId: MINIO_ROOT_USER,
        secretAccessKey: MINIO_ROOT_PASSWORD
      },
      forcePathStyle: true
    });
    
    // Gerar nome único para o arquivo
    const fileExtension = file.name.split('.').pop() || 'mp3';
    // Prefixo por empresa: sem ele os arquivos de todas as clínicas caem no
    // mesmo nível do bucket.
    const uniqueFileName = `company/${callerCompanyId}/${uuidv4()}.${fileExtension}`;
    console.log('Nome único gerado para o arquivo:', uniqueFileName);
    
    // Converter o arquivo para buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Configurar o comando de upload
    const params = {
      Bucket: MINIO_BUCKET,
      Key: uniqueFileName,
      Body: buffer,
      ContentType: file.type
    };
    
    console.log('Enviando arquivo para o Minio');
    // Executar o comando de upload
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    
    // Construir a URL pública do arquivo
    const publicUrl = `${MINIO_SERVER}/${MINIO_BUCKET}/${uniqueFileName}`;
    console.log('Upload bem-sucedido. URL pública:', publicUrl);
    
    // Retornar a URL pública
    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('Erro no upload de áudio:', error);
    
    return NextResponse.json(
      { error: `Erro no upload: ${error.message}` },
      { status: 500 }
    );
  }
}
