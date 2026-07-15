import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Configurações do Minio
const MINIO_SERVER = process.env.NEXT_PUBLIC_MINIO_SERVER_URL || 'https://s3.techtopus.dev';
const MINIO_BUCKET = process.env.NEXT_PUBLIC_MINIO_BUCKET || 'audios';
const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER || 'Techtoplus';
const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD || 'U2f97A_TechMIN_5f48wS';

/**
 * API para upload de áudio para o Minio S3
 */
export async function POST(request: NextRequest) {
  console.log('API de upload de áudio iniciada');
  
  try {
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
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
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
