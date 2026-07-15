import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// Configurações do Minio
const MINIO_SERVER = process.env.NEXT_PUBLIC_MINIO_SERVER_URL || 'https://s3.techtopus.dev';
const MINIO_ROOT_USER = process.env.MINIO_ROOT_USER || 'Techtoplus';
const MINIO_ROOT_PASSWORD = process.env.MINIO_ROOT_PASSWORD || 'U2f97A_TechMIN_5f48wS';

/**
 * API para upload de mídia (imagens e documentos) para o Minio S3
 */
export async function POST(request: NextRequest) {
  console.log('API de upload de mídia iniciada');
  
  try {
    // Verificar se o request é multipart/form-data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'image'; // Tipo padrão: image
    
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
      size: file.size,
      uploadType: type
    });
    
    // Determinar o tipo de mídia e o bucket apropriado
    let bucket = 'imagens'; // Bucket padrão para imagens
    let validTypes: string[] = [];
    
    if (type === 'image') {
      bucket = 'imagens';
      validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      
      // Verificar tipo de arquivo
      if (!validTypes.includes(file.type)) {
        console.error('Tipo de imagem inválido:', file.type);
        return NextResponse.json(
          { error: 'Tipo de arquivo inválido. Envie apenas imagens nos formatos: JPEG, PNG, GIF, WEBP, SVG.' },
          { status: 400 }
        );
      }
    } else if (type === 'document') {
      bucket = 'arquivos';
      validTypes = [
        'application/pdf', 
        'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx
        'text/plain',
        'application/zip',
        'application/x-rar-compressed',
        'application/octet-stream'
      ];
      
      // Para documentos, aceitamos qualquer tipo, mas logamos para monitoramento
      if (!validTypes.includes(file.type)) {
        console.warn('Tipo de documento não reconhecido:', file.type);
      }
    } else {
      console.error('Tipo de upload inválido:', type);
      return NextResponse.json(
        { error: 'Tipo de upload inválido. Use "image" ou "document".' },
        { status: 400 }
      );
    }
    
    // Verificar tamanho do arquivo (máximo 15MB)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      console.error('Arquivo muito grande:', file.size);
      return NextResponse.json(
        { error: 'Arquivo muito grande. O tamanho máximo é 15MB.' },
        { status: 400 }
      );
    }
    
    // Criar cliente S3 para o Minio
    const s3Client = new S3Client({
      region: 'stub',
      endpoint: MINIO_SERVER,
      credentials: {
        accessKeyId: MINIO_ROOT_USER,
        secretAccessKey: MINIO_ROOT_PASSWORD
      },
      forcePathStyle: true
    });
    
    // Gerar nome único para o arquivo
    const fileExtension = file.name.split('.').pop() || '';
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;
    console.log('Nome único gerado para o arquivo:', uniqueFileName);
    
    // Converter o arquivo para buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Configurar o comando de upload
    const params = {
      Bucket: bucket,
      Key: uniqueFileName,
      Body: buffer,
      ContentType: file.type
    };
    
    console.log(`Enviando arquivo para o Minio (bucket: ${bucket})`);
    // Executar o comando de upload
    const command = new PutObjectCommand(params);
    await s3Client.send(command);
    
    // Construir a URL pública do arquivo
    const publicUrl = `${MINIO_SERVER}/${bucket}/${uniqueFileName}`;
    console.log('Upload bem-sucedido. URL pública:', publicUrl);
    
    // Retornar a URL pública e metadados adicionais
    return NextResponse.json({
      url: publicUrl,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      bucket: bucket
    });
  } catch (error) {
    console.error('Erro no upload de mídia:', error);
    
    return NextResponse.json(
      { error: `Erro no upload: ${error.message}` },
      { status: 500 }
    );
  }
}
