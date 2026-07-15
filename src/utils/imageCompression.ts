/**
 * Utilitário para compressão de imagens antes do envio
 * Isso reduz o tempo de upload e o uso de dados do usuário
 */

/**
 * Comprime uma imagem para reduzir seu tamanho antes do upload
 * @param file Arquivo de imagem original
 * @param maxSizeKB Tamanho máximo em KB (padrão: 500KB)
 * @param maxWidthOrHeight Largura ou altura máxima em pixels (padrão: 1200px)
 * @returns Promise com o arquivo comprimido
 */
export async function compressImage(
  file: File,
  maxSizeKB: number = 500,
  maxWidthOrHeight: number = 1200
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Verificar se o arquivo já é menor que o tamanho máximo
    if (file.size <= maxSizeKB * 1024) {
      console.log('Imagem já está abaixo do tamanho máximo, sem necessidade de compressão');
      resolve(file);
      return;
    }

    // Criar um URL temporário para o arquivo
    const objectUrl = URL.createObjectURL(file);
    
    // Carregar a imagem
    const img = new Image();
    img.onload = () => {
      // Revogar o URL para liberar memória
      URL.revokeObjectURL(objectUrl);
      
      // Calcular as dimensões para manter a proporção
      let width = img.width;
      let height = img.height;
      
      if (width > height && width > maxWidthOrHeight) {
        height = Math.round((height * maxWidthOrHeight) / width);
        width = maxWidthOrHeight;
      } else if (height > maxWidthOrHeight) {
        width = Math.round((width * maxWidthOrHeight) / height);
        height = maxWidthOrHeight;
      }
      
      // Criar um canvas para desenhar a imagem redimensionada
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      
      // Desenhar a imagem no canvas
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Iniciar com qualidade alta
      let quality = 0.9;
      
      // Função para comprimir e verificar o tamanho
      const compressAndCheck = () => {
        // Converter para Blob com a qualidade atual
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Falha ao comprimir imagem'));
              return;
            }
            
            console.log(`Imagem comprimida para ${Math.round(blob.size / 1024)}KB com qualidade ${quality}`);
            
            // Se ainda estiver acima do tamanho máximo e a qualidade for maior que o mínimo
            if (blob.size > maxSizeKB * 1024 && quality > 0.5) {
              // Reduzir a qualidade e tentar novamente
              quality -= 0.1;
              compressAndCheck();
              return;
            }
            
            // Criar um novo arquivo a partir do blob
            const compressedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            
            console.log(`Compressão concluída: ${Math.round(file.size / 1024)}KB -> ${Math.round(compressedFile.size / 1024)}KB`);
            
            resolve(compressedFile);
          },
          file.type,
          quality
        );
      };
      
      // Iniciar o processo de compressão
      compressAndCheck();
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Erro ao carregar a imagem para compressão'));
    };
    
    img.src = objectUrl;
  });
}

/**
 * Verifica se um arquivo é uma imagem baseado no tipo MIME
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Comprime uma imagem se necessário antes do upload
 * Se não for uma imagem, retorna o arquivo original
 */
export async function compressFileIfImage(file: File): Promise<File> {
  if (isImageFile(file)) {
    return compressImage(file);
  }
  return file;
}
