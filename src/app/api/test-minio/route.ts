import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListBucketsCommand, HeadBucketCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// Configurações do Minio (S3 compatible)
const MINIO_SERVER_URL = process.env.MINIO_SERVER_URL || 'https://s3.techtopus.dev';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'audios';
const MINIO_USER = process.env.MINIO_ROOT_USER || 'Techtoplus';
const MINIO_PASSWORD = process.env.MINIO_ROOT_PASSWORD || 'U2f97A_TechMIN_5f48wS';

// Log para debug das configurações
console.log('Configuração do Minio (API de teste):', {
  url: MINIO_SERVER_URL,
  bucket: MINIO_BUCKET,
  user: MINIO_USER,
  hasPassword: MINIO_PASSWORD ? 'Sim' : 'Não'
});

// Configurar cliente S3 para o Minio
const s3Client = new S3Client({
  region: 'stub', // Alterado para 'stub' conforme necessário pelo Minio
  endpoint: MINIO_SERVER_URL,
  credentials: {
    accessKeyId: MINIO_USER,
    secretAccessKey: MINIO_PASSWORD
  },
  forcePathStyle: true, // Necessário para Minio
  connectTimeout: 15000, // 15 segundos de timeout
  maxAttempts: 3 // Três tentativas de conexão
});

/**
 * Teste de conexão com o Minio e listagem de buckets
 */
export async function GET(request: NextRequest) {
  try {
    console.log('Testando conexão com o Minio...');
    console.log('Configurações do Minio:', {
      endpoint: MINIO_SERVER_URL,
      user: MINIO_USER,
      bucket: MINIO_BUCKET
    });
    
    // Resultados dos testes
    const testResults = {
      bucketExists: false,
      canListBuckets: false,
      canWrite: false,
      buckets: [],
      errors: []
    };
    
    // Testar existência do bucket específico
    try {
      testResults.bucketExists = await testBucketExists(MINIO_BUCKET);
      
      if (!testResults.bucketExists) {
        console.error(`Bucket '${MINIO_BUCKET}' não existe!`);
        testResults.errors.push(`Bucket '${MINIO_BUCKET}' não existe`);
      } else {
        console.log(`Bucket '${MINIO_BUCKET}' existe e é acessível.`);
      }
    } catch (error) {
      console.error('Erro ao verificar existência do bucket:', error);
      testResults.errors.push(`Erro ao verificar bucket: ${error.message}`);
    }
    
    // Testar a conexão listando os buckets
    try {
      const command = new ListBucketsCommand({});
      const response = await s3Client.send(command);
      
      // Verificar se temos buckets
      const buckets = response.Buckets || [];
      const bucketNames = buckets.map(bucket => bucket.Name);
      
      testResults.canListBuckets = true;
      testResults.buckets = bucketNames;
      
      console.log('Listagem de buckets bem-sucedida. Buckets:', bucketNames);
    } catch (error) {
      console.error('Erro ao listar buckets:', error);
      testResults.errors.push(`Erro ao listar buckets: ${error.message}`);
    }
    
    // Testar escrita no bucket
    if (testResults.bucketExists) {
      try {
        const testResult = await testWriteToBucket(MINIO_BUCKET);
        testResults.canWrite = testResult.success;
        
        if (!testResult.success) {
          testResults.errors.push(`Erro ao escrever no bucket: ${testResult.error}`);
        }
      } catch (error) {
        console.error('Erro ao testar escrita no bucket:', error);
        testResults.errors.push(`Erro ao testar escrita: ${error.message}`);
      }
    }
    
    // Determinar o status geral do teste
    const success = testResults.bucketExists && 
                   (testResults.canListBuckets || testResults.canWrite);
    
    // Gerar mensagem de status
    let statusMessage = '';
    if (success) {
      statusMessage = 'Conexão com Minio bem-sucedida';
      if (testResults.canWrite) {
        statusMessage += ' e permissões de escrita confirmadas';
      }
    } else {
      statusMessage = 'Problemas na conexão com Minio';
      if (testResults.errors.length > 0) {
        statusMessage += `: ${testResults.errors[0]}`;
      }
    }
    
    return NextResponse.json({
      success,
      message: statusMessage,
      buckets: testResults.buckets,
      audioBucketExists: testResults.bucketExists,
      canWrite: testResults.canWrite,
      errors: testResults.errors,
      config: {
        serverUrl: MINIO_SERVER_URL,
        bucket: MINIO_BUCKET
      }
    });
  } catch (error) {
    console.error('Erro ao conectar com o Minio:', error);
    
    // Log detalhado do erro
    if (error.message) {
      console.error('Mensagem de erro:', error.message);
    }
    if (error.code) {
      console.error('Código de erro:', error.code);
    }
    if (error.requestId) {
      console.error('ID da requisição:', error.requestId);
    }
    
    return NextResponse.json({
      success: false,
      message: `Erro ao conectar com o Minio: ${error.message}`,
      code: error.code || 'UNKNOWN_ERROR',
      config: {
        serverUrl: MINIO_SERVER_URL,
        bucket: MINIO_BUCKET
      }
    });
  }
}

/**
 * Verifica se um bucket específico existe
 */
async function testBucketExists(bucketName: string): Promise<boolean> {
  try {
    const command = new HeadBucketCommand({
      Bucket: bucketName
    });
    
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error(`Erro ao verificar existência do bucket '${bucketName}':`, error);
    return false;
  }
}

/**
 * Testa a escrita em um bucket
 */
async function testWriteToBucket(bucketName: string): Promise<{success: boolean, error?: string}> {
  try {
    const testKey = `test-write-${Date.now()}.txt`;
    const testContent = 'Teste de escrita no Minio ' + new Date().toISOString();
    
    console.log(`Testando escrita no bucket '${bucketName}' com chave '${testKey}'`);
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain'
    });
    
    await s3Client.send(command);
    
    console.log('Teste de escrita bem-sucedido');
    return { success: true };
  } catch (error) {
    console.error('Erro ao testar escrita no bucket:', error);
    return { 
      success: false, 
      error: error.message || 'Erro desconhecido ao escrever no bucket'
    };
  }
}
