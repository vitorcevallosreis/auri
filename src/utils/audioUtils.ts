/**
 * Utilitários para manipulação de áudio
 */

/**
 * Verifica se um arquivo de áudio é válido
 * @param file Arquivo a ser verificado
 * @returns Objeto com resultado da validação
 */
export function validateAudioFile(file: File): { 
  valid: boolean; 
  message?: string;
  details: {
    name: string;
    type: string;
    size: number;
    validType: boolean;
    validSize: boolean;
  }
} {
  if (!file) {
    return {
      valid: false,
      message: 'Arquivo não fornecido',
      details: {
        name: 'N/A',
        type: 'N/A',
        size: 0,
        validType: false,
        validSize: false
      }
    };
  }

  // Tipos de áudio válidos
  const validAudioTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 
    'audio/aac', 'audio/m4a', 'audio/mp4', 'audio/x-m4a',
    'application/octet-stream'
  ];

  // Verificar o tipo do arquivo
  const isValidType = validAudioTypes.includes(file.type) || file.type.startsWith('audio/');
  
  // Verificar o tamanho do arquivo (máximo 10MB)
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const isValidSize = file.size <= MAX_SIZE;

  // Resultado da validação
  const isValid = isValidType && isValidSize;
  
  // Mensagem de erro
  let errorMessage = '';
  if (!isValidType) {
    errorMessage = 'Tipo de arquivo inválido. Apenas arquivos de áudio são permitidos.';
  } else if (!isValidSize) {
    errorMessage = `Arquivo muito grande. O tamanho máximo permitido é ${MAX_SIZE / (1024 * 1024)}MB.`;
  }

  return {
    valid: isValid,
    message: isValid ? 'Arquivo válido' : errorMessage,
    details: {
      name: file.name,
      type: file.type,
      size: file.size,
      validType: isValidType,
      validSize: isValidSize
    }
  };
}

/**
 * Converte um arquivo de áudio para base64
 * @param file Arquivo a ser convertido
 * @returns Promise com a string base64
 */
export function convertAudioToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64String = reader.result as string;
        resolve(base64String);
      };
      
      reader.onerror = (error) => {
        reject(new Error('Falha ao converter áudio para base64'));
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Verifica se uma URL é uma URL de áudio válida
 * @param url URL a ser verificada
 * @returns Objeto com resultado da validação
 */
export function validateAudioUrl(url: string): {
  valid: boolean;
  type: 'minio' | 'base64' | 'http' | 'blob' | 'unknown';
  message?: string;
} {
  if (!url) {
    return {
      valid: false,
      type: 'unknown',
      message: 'URL não fornecida'
    };
  }

  // Verificar se é uma URL base64
  if (url.startsWith('data:audio/') || url.startsWith('data:application/octet-stream')) {
    return {
      valid: true,
      type: 'base64',
      message: 'URL base64 válida'
    };
  }

  // Verificar se é uma URL blob
  if (url.startsWith('blob:')) {
    return {
      valid: false,
      type: 'blob',
      message: 'URLs blob não são permanentes e não devem ser armazenadas'
    };
  }

  // Verificar se é uma URL HTTP/HTTPS
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Verificar se é uma URL do Minio
    const minioServerUrl = process.env.NEXT_PUBLIC_MINIO_SERVER_URL || 'https://s3.techtopus.dev';
    const minioBucket = process.env.NEXT_PUBLIC_MINIO_BUCKET || 'audios';
    
    try {
      const urlObj = new URL(url);
      const isMinioHost = urlObj.hostname === new URL(minioServerUrl).hostname;
      const pathIncludesBucket = urlObj.pathname.includes(minioBucket);
      
      if (isMinioHost && pathIncludesBucket) {
        return {
          valid: true,
          type: 'minio',
          message: 'URL do Minio válida'
        };
      }
      
      // Outras URLs HTTP são consideradas válidas
      return {
        valid: true,
        type: 'http',
        message: 'URL HTTP válida'
      };
    } catch (error) {
      return {
        valid: false,
        type: 'unknown',
        message: 'URL malformada'
      };
    }
  }

  // URL desconhecida
  return {
    valid: false,
    type: 'unknown',
    message: 'Formato de URL desconhecido'
  };
}

/**
 * Extrai informações de diagnóstico de um arquivo de áudio
 * @param file Arquivo de áudio
 * @returns Promise com informações de diagnóstico
 */
export async function getAudioDiagnostics(file: File): Promise<any> {
  const validation = validateAudioFile(file);
  
  // Se o arquivo não for válido, retornar apenas a validação
  if (!validation.valid) {
    return validation;
  }
  
  // Informações adicionais
  const diagnostics = {
    ...validation,
    fileInfo: {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toISOString()
    }
  };
  
  // Tentar obter mais informações do arquivo de áudio
  try {
    // Criar uma URL para o arquivo
    const url = URL.createObjectURL(file);
    
    // Criar um elemento de áudio para obter metadados
    const audio = new Audio();
    
    // Promessa para carregar o áudio
    const loadPromise = new Promise<void>((resolve, reject) => {
      audio.onloadedmetadata = () => resolve();
      audio.onerror = () => reject(new Error('Falha ao carregar metadados de áudio'));
      
      // Definir um timeout para evitar espera infinita
      setTimeout(() => reject(new Error('Timeout ao carregar metadados')), 5000);
    });
    
    // Definir a fonte do áudio
    audio.src = url;
    
    try {
      // Aguardar o carregamento dos metadados
      await loadPromise;
      
      // Adicionar metadados ao diagnóstico
      diagnostics.metadata = {
        duration: audio.duration,
        hasAudio: !isNaN(audio.duration) && audio.duration > 0
      };
    } catch (error) {
      diagnostics.metadata = {
        error: error.message,
        hasAudio: false
      };
    } finally {
      // Limpar a URL do objeto
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    diagnostics.error = error.message;
  }
  
  return diagnostics;
}
