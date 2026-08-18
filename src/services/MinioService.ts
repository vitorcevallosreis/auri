import { authedFetch } from "@/lib/api/authedFetch";

/**
 * Serviço para interação com o Minio S3
 */
export class MinioService {
  private static MINIO_SERVER_URL = process.env.NEXT_PUBLIC_MINIO_SERVER_URL || 'https://s3.techtopus.dev';
  private static MINIO_BUCKET = process.env.NEXT_PUBLIC_MINIO_BUCKET || 'audios';
  private static MAX_RETRIES = 2;
  private static RETRY_DELAY = 1000; // 1 segundo
  private static UPLOAD_TIMEOUT = 30000; // 30 segundos

  /**
   * Verifica se uma URL é do Minio
   */
  public static isMinioUrl(url: string): boolean {
    if (!url) return false;
    
    try {
      const urlObj = new URL(url);
      const isMinioHost = urlObj.hostname === new URL(this.MINIO_SERVER_URL).hostname;
      
      return isMinioHost;
    } catch (error) {
      console.error('Erro ao verificar URL do Minio:', error);
      return false;
    }
  }

  /**
   * Verifica se uma URL é base64
   */
  public static isBase64Url(url: string): boolean {
    if (!url) return false;
    
    // Verifica se é uma URL de dados base64
    return url.startsWith('data:') && url.includes('base64');
  }

  /**
   * Converte um arquivo para base64 (usado como fallback)
   * @param file Arquivo para converter em base64
   * @returns URL de dados base64
   */
  public static async fallbackToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Falha ao converter arquivo para base64'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo para conversão base64'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Faz upload de um arquivo de áudio para o Minio S3
   * @param audioFile Arquivo de áudio para upload
   * @returns URL pública do arquivo no Minio
   */
  public static async uploadAudio(audioFile: File): Promise<string> {
    console.log('Iniciando upload de áudio para Minio:', {
      fileName: audioFile.name,
      fileType: audioFile.type,
      fileSize: audioFile.size
    });
    
    // Verificar se o arquivo é válido
    if (!audioFile || audioFile.size === 0) {
      throw new Error('Arquivo de áudio inválido');
    }
    
    let retryCount = 0;
    
    while (retryCount < this.MAX_RETRIES) {
      try {
        // Criar FormData para enviar o arquivo
        const formData = new FormData();
        formData.append('file', audioFile);
        
        console.log(`Tentativa ${retryCount + 1}/${this.MAX_RETRIES} de upload para Minio`);
        
        // Enviar para a API local de upload
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.UPLOAD_TIMEOUT);
        
        const response = await authedFetch('/api/upload/audio', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Verificar se a resposta foi bem-sucedida
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro ${response.status} ao fazer upload`);
        }
        
        // Obter a URL do arquivo
        const data = await response.json();
        
        if (!data.url) {
          throw new Error('URL de áudio não retornada pela API');
        }
        
        console.log('Upload para Minio concluído com sucesso. URL:', data.url);
        return data.url;
      } catch (error) {
        console.error(`Erro na tentativa ${retryCount + 1}:`, error);
        
        // Se for erro de timeout ou abort, não tentamos novamente
        if (error.name === 'AbortError') {
          throw new Error('Timeout ao fazer upload para Minio');
        }
        
        // Aguardar antes de tentar novamente
        if (retryCount < this.MAX_RETRIES - 1) {
          const delay = this.RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        retryCount++;
      }
    }
    
    throw new Error('Não foi possível fazer upload do áudio para o Minio após várias tentativas');
  }

  /**
   * Faz upload de uma imagem para o Minio S3
   * @param imageFile Arquivo de imagem para upload
   * @returns URL pública do arquivo no Minio
   */
  public static async uploadImage(imageFile: File): Promise<string> {
    console.log('Iniciando upload de imagem para Minio:', {
      fileName: imageFile.name,
      fileType: imageFile.type,
      fileSize: imageFile.size
    });
    
    // Verificar se o arquivo é válido
    if (!imageFile || imageFile.size === 0) {
      throw new Error('Arquivo de imagem inválido');
    }
    
    let retryCount = 0;
    
    while (retryCount < this.MAX_RETRIES) {
      try {
        // Criar FormData para enviar o arquivo
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('type', 'image');
        
        console.log(`Tentativa ${retryCount + 1}/${this.MAX_RETRIES} de upload para Minio`);
        
        // Enviar para a API local de upload
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.UPLOAD_TIMEOUT);
        
        const response = await authedFetch('/api/upload/media', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Verificar se a resposta foi bem-sucedida
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro ${response.status} ao fazer upload`);
        }
        
        // Obter a URL do arquivo
        const data = await response.json();
        
        if (!data.url) {
          throw new Error('URL de imagem não retornada pela API');
        }
        
        console.log('Upload de imagem para Minio concluído com sucesso. URL:', data.url);
        return data.url;
      } catch (error) {
        console.error(`Erro na tentativa ${retryCount + 1}:`, error);
        
        // Se for erro de timeout ou abort, não tentamos novamente
        if (error.name === 'AbortError') {
          throw new Error('Timeout ao fazer upload para Minio');
        }
        
        // Aguardar antes de tentar novamente
        if (retryCount < this.MAX_RETRIES - 1) {
          const delay = this.RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        retryCount++;
      }
    }
    
    throw new Error('Não foi possível fazer upload da imagem para o Minio após várias tentativas');
  }

  /**
   * Faz upload de um documento para o Minio S3
   * @param documentFile Arquivo de documento para upload
   * @returns URL pública do arquivo no Minio
   */
  public static async uploadDocument(documentFile: File): Promise<string> {
    console.log('Iniciando upload de documento para Minio:', {
      fileName: documentFile.name,
      fileType: documentFile.type,
      fileSize: documentFile.size
    });
    
    // Verificar se o arquivo é válido
    if (!documentFile || documentFile.size === 0) {
      throw new Error('Arquivo de documento inválido');
    }
    
    let retryCount = 0;
    
    while (retryCount < this.MAX_RETRIES) {
      try {
        // Criar FormData para enviar o arquivo
        const formData = new FormData();
        formData.append('file', documentFile);
        formData.append('type', 'document');
        
        console.log(`Tentativa ${retryCount + 1}/${this.MAX_RETRIES} de upload para Minio`);
        
        // Enviar para a API local de upload
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.UPLOAD_TIMEOUT);
        
        const response = await authedFetch('/api/upload/media', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Verificar se a resposta foi bem-sucedida
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Erro ${response.status} ao fazer upload`);
        }
        
        // Obter a URL do arquivo
        const data = await response.json();
        
        if (!data.url) {
          throw new Error('URL de documento não retornada pela API');
        }
        
        console.log('Upload de documento para Minio concluído com sucesso. URL:', data.url);
        return data.url;
      } catch (error) {
        console.error(`Erro na tentativa ${retryCount + 1}:`, error);
        
        // Se for erro de timeout ou abort, não tentamos novamente
        if (error.name === 'AbortError') {
          throw new Error('Timeout ao fazer upload para Minio');
        }
        
        // Aguardar antes de tentar novamente
        if (retryCount < this.MAX_RETRIES - 1) {
          const delay = this.RETRY_DELAY * Math.pow(2, retryCount);
          console.log(`Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        retryCount++;
      }
    }
    
    throw new Error('Não foi possível fazer upload do documento para o Minio após várias tentativas');
  }
}
