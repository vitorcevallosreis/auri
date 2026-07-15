import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { MinioService } from './MinioService';
import { supabase } from '@/lib/supabase/config';
import SUPA_TABLES from '@/contexts/supa_tables';
import { EnumMessageTyped } from '@/contexts/Messages/schemas';
import { getAPIClient } from '@/lib/webhooks/axios';

export class MessageService {
  /**
   * Envia uma mensagem de texto diretamente para a API do canal
   */
  async sendTextMessage(chatData: any, message: string) {
    console.time('DirectTextMessageSend'); // Adicionar o timer no início da função
    let realMessageId = null;
    let temporaryId = null;
    
    try {
      // Validação dos dados de entrada
      if (!chatData) {
        console.error('chatData é nulo ou indefinido');
        return { success: false, error: 'Dados de chat inválidos' };
      }
      
      if (!message || typeof message !== 'string') {
        console.error('Mensagem inválida:', message);
        return { success: false, error: 'Mensagem inválida' };
      }
      
      // Log detalhado para debug
      console.log('Dados de chat recebidos:', JSON.stringify({
        chat_id: chatData.chat_id,
        company_id: chatData.company_id,
        channel_info: chatData.channel_info ? {
          nome: chatData.channel_info.nome,
          urlapi: chatData.channel_info.urlapi,
          has_token: !!chatData.channel_info.token,
          instance_id: chatData.channel_info.instance_id
        } : null,
        contact_info: chatData.contact_info ? {
          has_remote_jid: !!chatData.contact_info.remote_jid,
          has_number: !!chatData.contact_info.number
        } : null
      }, null, 2));
      
      // Formatar texto para JSON
      const formattedText = this.formatTextForJSON(message);
      
      // Gerar ID temporário para exibição imediata na interface
      temporaryId = uuidv4();
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Primeiro, salvar a mensagem com status 'PENDING' para exibição imediata
      await this.saveTextMessageToDatabase(
        chatData,
        temporaryId,
        message,
        timestamp,
        "PENDING" // Status inicial válido enquanto mensagem está sendo processada
      );
      
      try {
        // Enviar para API e esperar a resposta para obter o ID real
        const apiResponse = await this.sendToChannelAPI(chatData, formattedText);
        
        console.log('Resposta da API:', JSON.stringify(apiResponse.data, null, 2));
        
        // Verificar a resposta completa para localizar qualquer campo que contenha a chave "id"
        if (apiResponse.data) {
          console.log('Analisando resposta para encontrar key.id:');
          this.findKeyId(apiResponse.data);
        }
        
        // Atualizar a mensagem no banco de dados com o ID real e o objeto key completo
        console.log('Atualizando mensagem com dados completos da API');
        await this.updateMessageWithFullKey(temporaryId, apiResponse.data);
        
        // Extrair o ID real para retorno
        const keyId = apiResponse.data?.key?.id;
        if (keyId) {
          realMessageId = keyId;
        } else {
          console.warn('Resposta da API não contém key.id:', apiResponse.data);
          realMessageId = temporaryId;
        }
      } catch (apiError) {
        // Gerenciar retry de mensagens com falha
        if (!await this.handleMessageError(temporaryId, apiError)) {
          console.error('Erro na API de envio:', apiError);
          
          // Mesmo com erro na API, não vamos falhar completamente
          // Apenas atualizamos o status da mensagem para indicar erro
          await supabase
            .from(SUPA_TABLES.table_myia_messages)
            .update({ status: "PENDING" })
            .match({ message_id: temporaryId });
            
          // Propagar o erro para tratamento adequado
          throw apiError;
        }
      }
      
      // Atualizar chat em segundo plano (não aguardar para retornar)
      this.updateChat(chatData.chat_id).catch(err => 
        console.error('Erro ao atualizar chat:', err)
      );
      
      console.timeEnd('DirectTextMessageSend');
      return { 
        success: true, 
        temporaryId,
        messageId: realMessageId || temporaryId
      };
    } catch (error) {
      // Log detalhado do erro
      console.error('Error sending text message:', error);
      if (error.isAxiosError) {
        console.error('Detalhes da resposta Axios:', error.response?.data);
        console.error('Status do erro Axios:', error.response?.status);
      }
      return { 
        success: false, 
        error: {
          message: error.message,
          stack: error.stack,
          details: error.isAxiosError ? {
            status: error.response?.status,
            data: error.response?.data
          } : undefined
        } 
      };
    }
  }
  
  /**
   * Envia uma mensagem de áudio
   * @param chatData Dados do chat
   * @param audioUrl URL do áudio (opcional)
   * @param audioFile Arquivo de áudio (obrigatório)
   * @returns ID da mensagem criada
   */
  async sendAudioMessage(chatData: any, audioUrl: string | null, audioFile: any) {
    console.log('Iniciando envio de mensagem de áudio:', {
      chatId: chatData.chat_id,
      audioFile: audioFile ? `${audioFile.name} (${audioFile.size} bytes)` : 'Não fornecido'
    });
    
    let temporaryId = '';
    let realMessageId = '';
    let minioUrl = '';
    
    try {
      // Validação dos dados de entrada
      if (!chatData) {
        console.error('chatData é nulo ou indefinido');
        return { success: false, error: 'Dados de chat inválidos' };
      }
      
      if (!audioFile) {
        console.error('Arquivo de áudio é nulo ou indefinido');
        return { success: false, error: 'Arquivo de áudio inválido' };
      }
      
      // Gerar ID temporário para a mensagem
      temporaryId = uuidv4();
      console.log('ID temporário gerado:', temporaryId);
      
      // Criar timestamp
      const timestamp = Math.floor(Date.now() / 1000); // Timestamp em segundos em vez de milissegundos
      
      // URL temporária inicial enquanto fazemos upload
      const initialUrl = 'pending://audio_upload';
      
      // Criar estrutura de mensagem para o banco
      const remoteJid = chatData.contact_info.remote_jid || 
                      (chatData.contact_info.number ? `${chatData.contact_info.number}@s.whatsapp.net` : null);
                      
      if (!remoteJid) {
        throw new Error('Número de telefone inválido');
      }
      
      // Inserir a mensagem no banco com dados iniciais
      await this.saveAudioMessageToDatabase(
        chatData,
        temporaryId,
        initialUrl,
        '',
        audioFile.name,
        audioFile.size,
        timestamp,
        "PENDING" // Status inicial
      );
      
      // 1. Enviar o áudio para o Minio e obter a URL
      console.log('Iniciando upload do áudio para Minio...');
      minioUrl = await MinioService.uploadAudio(audioFile);
      console.log('Upload para Minio concluído. URL:', minioUrl);
      
      // 2. Atualizar a URL do áudio no banco de dados com a URL do Minio
      await this.updateAudioUrl(temporaryId, minioUrl);
      console.log('URL do áudio atualizada no banco de dados para Minio URL');
      
      // 3. Enviar a URL do áudio para a API externa
      console.log('Enviando áudio para API Evolution...');
      const apiResponse = await this.sendAudioToChannel(chatData, minioUrl, audioFile);
      
      console.log('Resposta da API de áudio:', JSON.stringify(apiResponse.data, null, 2));
      
      // Atualizar a mensagem no banco de dados com o ID real e o objeto key completo
      await this.updateMessageWithFullKey(temporaryId, apiResponse.data, minioUrl);
      
      // Extrair o ID real para retorno
      const keyId = apiResponse.data?.key?.id;
      if (keyId) {
        realMessageId = keyId;
      } else {
        console.warn('Resposta da API não contém key.id:', apiResponse.data);
        realMessageId = temporaryId;
      }
      
      // Atualizar o status da mensagem para enviado
      await this.updateMessageStatus(temporaryId, "SENT");
      
      // Atualizar o chat em segundo plano (não aguardar)
      this.updateChat(chatData.chat_id).catch(error => {
        console.error('Erro ao atualizar chat:', error);
      });
      
      return {
        success: true,
        id: realMessageId,
        temporary_id: temporaryId
      };
    } catch (error) {
      console.error('Erro ao enviar mensagem de áudio:', error);
      
      // Atualizar a mensagem com status de erro se o ID temporário foi gerado
      if (temporaryId) {
        await this.updateMessageStatus(temporaryId, "ERROR", error.message);
      }
      
      return {
        success: false,
        error: error.message,
        temporary_id: temporaryId
      };
    }
  }
  
  /**
   * Envia áudio para a API do canal
   */
  private async sendAudioToChannel(chatData: any, audioUrl: string, filename: string) {
    if (!chatData || !chatData.channel_info) {
      console.error('Dados de chat inválidos:', chatData);
      throw new Error('Dados de chat inválidos para envio de áudio');
    }

    try {
      // Configurar a URL da API de destino
      const nome = chatData.channel_info.nome || "myia";
      const apiChannel = chatData.channel_info.urlapi || "https://evo2.techtopus.dev";
      const url = `${apiChannel}/message/sendWhatsAppAudio/${nome}`;
      
      console.log(`Enviando áudio para URL: ${url}`);
      
      const headers = {
        apikey: chatData.channel_info.token
      };
      
      const remoteJid = chatData.contact_info.remote_jid || 
                      (chatData.contact_info.number ? `${chatData.contact_info.number}@s.whatsapp.net` : null);
      
      if (!remoteJid) {
        throw new Error('Número de telefone inválido');
      }
      
      // Corpo da requisição para a API conforme documentação da Evolution API
      // https://doc.evolution-api.com/v2/api-reference/message-controller/send-audio
      const body = {
        number: remoteJid,
        audio: audioUrl,
        options: {
          delay: 1200,
          presence: "recording", // Simular a gravação de áudio
          ptt: true // Send as PTT (Push to Talk / Voice Message)
        }
      };
      
      console.log('Requisição para API Evolution:', { 
        url, 
        audioUrl,
        number: remoteJid
      });
      
      // Enviar a requisição para a API
      const api = getAPIClient();
      const response = await api.post(url, body, { 
        headers,
        timeout: 60000 // 60 segundos para arquivos maiores
      });
      
      console.log('Resposta da API de áudio:', JSON.stringify(response.data, null, 2));
      
      return response;
    } catch (error) {
      console.error('Erro ao enviar áudio para API:', error);
      if (error.isAxiosError) {
        console.error('Detalhes da resposta:', error.response?.data);
        console.error('Status do erro:', error.response?.status);
        
        throw new Error(`Erro na API (${error.response?.status}): ${error.response?.data?.error || error.message}`);
      }
      throw error;
    }
  }
  
  /**
   * Envia qualquer mídia para a API do canal
   */
  async sendMidiaMessage(chatData: any, imageUrl: string, imageFile: any, type: string = "image") {
    let realMessageId = null;
    let temporaryId = null;
    
    try {
      console.time('DirectImageMessageSend');
      
      // Gerar ID temporário para exibição imediata na interface
      temporaryId = uuidv4();
      const timestamp = Math.floor(Date.now() / 1000);
      const filename = imageFile.name;
      const fileSize = imageFile.size;
      const fileType = imageFile.type;
      
      // Adicionar dado a mais para o upload
      const fileData = {
        chat_id: chatData.chat_id,
        company_id: chatData.company_id,
        sending_user_id: undefined,
        local_id: temporaryId,
        path: "MEDIA",
        type: "image"
      };
      
      // Primeiro, salvar a mensagem com ID temporário para exibição imediata
      await this.saveMidiaMessageToDatabase(
        chatData,
        temporaryId,
        imageUrl,
        filename,
        fileType,
        fileSize,
        timestamp,
        "PENDING" // Status inicial
      );
      
      // Enviar para API e esperar a resposta para obter o ID real
      const apiResponse = await this.sendImageToChannel(chatData, imageUrl, imageFile.name);
      
      console.log('Resposta da API de imagem:', JSON.stringify(apiResponse.data, null, 2));
      
      // Verificar a resposta completa para localizar qualquer campo que contenha a chave "id"
      if (apiResponse.data) {
        console.log('Analisando resposta para encontrar key.id:');
        this.findKeyId(apiResponse.data);
      }
      
      // Extrair o objeto key completo da resposta
      const keyObject = apiResponse.data?.key;
      // Extrair o ID do objeto key
      const keyId = keyObject?.id;

      console.log('Key object da API:', JSON.stringify(keyObject, null, 2));
      console.log('Key ID extraído:', keyId);

      if (!keyId) {
        console.warn('Resposta da API não contém key.id:', apiResponse.data);
        // Como não temos o ID real, vamos manter o ID temporário como ID final da mensagem
        console.log('Mantendo o ID temporário como ID final da mensagem para message_id:', temporaryId);
        realMessageId = temporaryId; // Garantir que realMessageId seja definido
      } else {
        // Se temos o keyId, usar como realMessageId também
        realMessageId = keyId;
        
        // Atualizar a mensagem no banco de dados com o ID real e o objeto key completo
        console.log('Atualizando mensagem com key.id e objeto key completo:', keyId);
        await this.updateMessageWithFullKey(temporaryId, apiResponse.data, imageUrl);
      }
      
      // Atualizar chat em segundo plano (não aguardar para retornar)
      this.updateChat(chatData.chat_id);
      
      console.timeEnd('DirectImageMessageSend');
      return { 
        success: true, 
        temporaryId,
        messageId: realMessageId || temporaryId
      };
    } catch (error) {
      console.error('Error sending image message:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Envia imagem para a API do canal
   */
  private async sendImageToChannel(chatData: any, imageUrl: string, originalFilename: string) {
    if (!chatData || !chatData.channel_info) {
      console.error('Dados de chat inválidos:', chatData);
      throw new Error('Dados de chat inválidos para envio de imagem');
    }

    try {
      const url = `${chatData.channel_info.urlapi}/message/sendMedia/${chatData.channel_info.nome}`;
      
      console.log('Enviando imagem para URL:', url);
      
      const headers = {
        apikey: chatData.channel_info.token
      };
      
      const remoteJid = chatData.contact_info.remote_jid || 
                      (chatData.contact_info.number ? `${chatData.contact_info.number}@s.whatsapp.net` : null);
      
      if (!remoteJid) {
        throw new Error('Número de telefone inválido');
      }
      
      const body = {
        number: remoteJid,
        mediatype: "image",
        mimetype: "image/png",
        caption: originalFilename,
        media: imageUrl,
        fileName: originalFilename,
        delay: 1200
      };
      
      console.log('Dados de imagem enviados:', { url, headers, body });
      
      // Usar o cliente Axios configurado do projeto
      const api = getAPIClient();
      const response = await api.post(url, body, { headers });
      
      // Exibir resposta completa para análise detalhada
      console.log('RESPOSTA COMPLETA DA API DE IMAGEM (para análise):', JSON.stringify(response.data, null, 2));
      
      return response;
    } catch (error) {
      console.error('Erro ao enviar imagem para API:', error);
      if (error.isAxiosError) {
        console.error('Detalhes da resposta:', error.response?.data);
        console.error('Status do erro:', error.response?.status);
      }
      throw error;
    }
  }
  
  /**
   * Envia uma mensagem de imagem
   * @param chatData Dados do chat
   * @param imageUrl URL da imagem (opcional)
   * @param imageFile Arquivo de imagem (obrigatório)
   * @returns ID da mensagem criada
   */
  async sendImageMessage(chatData: any, imageUrl: string | null, imageFile: File) {
    console.log('Enviando imagem, tamanho:', imageFile.size, 'tipo:', imageFile.type);
    let temporaryId = null;
    let realMessageId = null;
    let minioUrl = null;
    
    try {
      // Validações iniciais
      if (!chatData || !chatData.channel_info || !chatData.contact_info) {
        console.error('Dados de chat inválidos para envio de imagem');
        throw new Error('Dados de chat inválidos');
      }
      
      if (!imageFile) {
        console.error('Arquivo de imagem não fornecido');
        throw new Error('Arquivo de imagem não fornecido');
      }
      
      // Gerar ID temporário para exibição imediata na interface
      temporaryId = uuidv4();
      const timestamp = Math.floor(Date.now() / 1000); // Timestamp em segundos em vez de milissegundos
      
      // Fazer upload para o Minio se não tiver URL fornecida
      if (!imageUrl) {
        try {
          console.log('Fazendo upload da imagem para o Minio...');
          minioUrl = await MinioService.uploadImage(imageFile);
          console.log('Imagem enviada para o Minio com sucesso. URL:', minioUrl);
        } catch (uploadError) {
          console.error('Erro ao fazer upload da imagem para o Minio:', uploadError);
          minioUrl = await MinioService.fallbackToBase64(imageFile);
          console.log('Usando fallback para base64');
        }
      } else {
        minioUrl = imageUrl;
      }
      
      // Salvar mensagem no banco com status PENDING
      await this.saveMidiaMessageToDatabase(
        chatData,
        temporaryId,
        minioUrl,
        imageFile.name,
        imageFile.type,
        imageFile.size,
        timestamp,
        'PENDING'
      );
      
      // Enviar para a API
      try {
        // Enviar mensagem para a API do canal
        const response = await this.sendImageToChannel(chatData, minioUrl, imageFile.name);
        
        if (response && response.data) {
          console.log('Resposta da API de imagem:', response.data);
          
          // Atualizar mensagem com dados completos da API
          await this.updateMessageWithFullKey(
            temporaryId,
            response.data,
            minioUrl
          );
        }
        
        return temporaryId;
      } catch (apiError) {
        console.error('Erro ao enviar para API:', apiError);
        
        // Atualizar status para ERROR
        const { data, error } = await supabase
          .from(SUPA_TABLES.table_myia_messages)
          .update({ status: 'ERROR' })
          .match({ message_id: temporaryId });
          
        throw apiError;
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem de imagem:', error);
      throw error;
    }
  }
  
  /**
   * Envia uma mensagem de documento
   * @param chatData Dados do chat
   * @param documentUrl URL do documento (opcional)
   * @param documentFile Arquivo de documento (obrigatório)
   * @returns ID da mensagem criada
   */
  async sendDocumentMessage(chatData: any, documentUrl: string | null, documentFile: File) {
    console.log('Enviando documento, tamanho:', documentFile.size, 'tipo:', documentFile.type);
    let temporaryId = null;
    let realMessageId = null;
    let minioUrl = null;
    
    try {
      // Validações iniciais
      if (!chatData || !chatData.channel_info || !chatData.contact_info) {
        console.error('Dados de chat inválidos para envio de documento');
        throw new Error('Dados de chat inválidos');
      }
      
      if (!documentFile) {
        console.error('Arquivo de documento não fornecido');
        throw new Error('Arquivo de documento não fornecido');
      }
      
      // Gerar ID temporário para exibição imediata na interface
      temporaryId = uuidv4();
      const timestamp = Math.floor(Date.now() / 1000); // Timestamp em segundos em vez de milissegundos
      
      // Fazer upload para o Minio se não tiver URL fornecida
      if (!documentUrl) {
        try {
          console.log('Fazendo upload do documento para o Minio...');
          minioUrl = await MinioService.uploadDocument(documentFile);
          console.log('Documento enviado para o Minio com sucesso. URL:', minioUrl);
        } catch (uploadError) {
          console.error('Erro ao fazer upload do documento para o Minio:', uploadError);
          throw uploadError;
        }
      } else {
        minioUrl = documentUrl;
      }
      
      // Salvar mensagem no banco com status PENDING
      await this.saveMidiaMessageToDatabase(
        chatData,
        temporaryId,
        minioUrl,
        documentFile.name,
        documentFile.type,
        documentFile.size,
        timestamp,
        'PENDING'
      );
      
      // Enviar para a API
      try {
        const response = await this.sendDocumentToChannel(chatData, minioUrl, documentFile.name);
        
        if (response && response.data) {
          console.log('Resposta da API de documento:', response.data);
          
          // Atualizar mensagem com dados completos da API
          await this.updateMessageWithFullKey(
            temporaryId,
            response.data,
            minioUrl
          );
        }
        
        return temporaryId;
      } catch (apiError) {
        console.error('Erro ao enviar para API:', apiError);
        
        // Atualizar status para ERROR
        const { data, error } = await supabase
          .from(SUPA_TABLES.table_myia_messages)
          .update({ status: 'ERROR' })
          .match({ message_id: temporaryId });
          
        throw apiError;
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem de documento:', error);
      throw error;
    }
  }
  
  /**
   * Salva mensagem de texto no banco de dados
   */
  private async saveTextMessageToDatabase(
    chatData: any,
    messageId: string,
    text: string,
    timestamp: number,
    status: string = "PENDING" // Corrigido de "SENDING" para "PENDING"
  ) {
    // Criar dois formatos de mensagem para garantir compatibilidade
    const messageContent: any = {
      // Formato tradicional
      conversation: text
    };
    
    // Adicionar também o formato extendedTextMessage para compatibilidade
    messageContent.extendedTextMessage = {
      text: text
    };
    
    const messageData = {
      from_me: true,
      message_id: messageId,
      key: {
        id: messageId,
        fromMe: true,
        remoteJid: chatData.contact_info?.remote_jid
      },
      message_type: "conversation",
      message: messageContent,
      message_timestamp: timestamp,
      instance_id: chatData.channel_info.instance_id,
      chat_id: chatData.chat_id,
      status: status
    };
    
    const { data, error } = await supabase
      .from(SUPA_TABLES.table_myia_messages)
      .insert(messageData);
      
    if (error) throw error;
    
    return data;
  }
  
  /**
   * Salva mensagem de áudio no banco de dados
   */
  private async saveAudioMessageToDatabase(
    chatData: any,
    messageId: string,
    audioUrl: string,
    location: string,
    filename: string,
    fileSize: number,
    timestamp: number,
    status: string = "PENDING" // Alterado de "SENDING" para "PENDING"
  ) {
    // Se a URL do áudio começa com blob:, não podemos salvá-la diretamente
    // pois ela será inválida quando o usuário mudar de página ou recarregar
    let persistentUrl = audioUrl;
    
    // Verificar se a URL é persistente (não é um blob)
    if (audioUrl.startsWith('blob:')) {
      console.log('URL de áudio é um blob, será substituída mais tarde');
      // A URL será atualizada mais tarde quando tivermos o base64 ou URL externa
    }
    
    const messageData = {
      from_me: true,
      message_id: messageId,
      key: {
        id: messageId,
        fromMe: true,
        remoteJid: chatData.contact_info.remote_jid
      },
      message_type: "audioMessage",
      message: {
        audioMessage: {
          ptt: true,
          url: persistentUrl,
          seconds: 10, // Valor aproximado, ajustar conforme necessário
          mediaKey: "",
          mimetype: "audio/mp3",
          waveform: "",
          directPath: "",
          fileLength: fileSize.toString(),
          fileSha256: "",
          fileEncSha256: "",
          mediaKeyTimestamp: timestamp.toString()
        },
        messageContextInfo: {
          messageSecret: "s9Rbd7Zwqf/9K4QSmIZkVGs1sj836qeLjdRDE3Aed3c=",
          deviceListMetadata: {
            senderKeyHash: "yMtD+cEu3GiRGA==",
            senderTimestamp: Date.now(),
            recipientKeyHash: "+R23GArnZXanEA==",
            recipientTimestamp: Date.now()
          },
          deviceListMetadataVersion: 2
        }
      },
      message_timestamp: timestamp,
      instance_id: chatData.channel_info.instance_id,
      chat_id: chatData.chat_id,
      status: status
    };
    
    const { data, error } = await supabase
      .from(SUPA_TABLES.table_myia_messages)
      .insert(messageData);
      
    if (error) throw error;
    
    return data;
  }
  
  /**
   * Salva mensagem de imagem no banco de dados
   */
  private async saveImageMessageToDatabase(
    chatData: any,
    messageId: string,
    imageUrl: string,
    filename: string,
    fileType: string,
    fileSize: number,
    timestamp: number,
    status: string = "PENDING" // Alterado de "SENDING" para "PENDING"
  ) {
    const messageData = {
      from_me: true,
      message_id: messageId,
      key: {
        id: messageId,
        fromMe: true,
        remoteJid: chatData.contact_info.remote_jid
      },
      message_type: "imageMessage",
      message: {
        imageMessage: {
          url: imageUrl,
          mimetype: fileType,
          caption: filename,
          fileSha256: "bjTheQR+CxDzzBqmutWyzJaVe2CdCCamtOIXrS65nD4=",
          fileLength: fileSize.toString(),
          mediaKey: "vwGaBr3kxsaArwP7JU2EhbwXTj/W9CtBWLkBkLW/V3U=",
          fileEncSha256: "YDDzxw6sZvz/aKnWExEllL/7rjBelQ60m8odBax1R24=",
          directPath: "/o1/v/t62.7118-24/f2/m239/AQObXuYisT4Qxyy_nt8Ci1feLacrvDcFh0E2FxmID-wgo6kybpbxVEmAU_iK-vJk5BqkQEeTl-AE7KuJR9B-X1_shKg7bEArDzGb25teFw",
          mediaKeyTimestamp: timestamp.toString(),
          contextInfo: {}
        }
      },
      message_timestamp: timestamp,
      instance_id: chatData.channel_info.instance_id,
      chat_id: chatData.chat_id,
      status: status
    };
    
    const { data, error } = await supabase
      .from(SUPA_TABLES.table_myia_messages)
      .insert(messageData);
      
    if (error) throw error;
    
    return data;
  }
  
  /**
   * Salva mensagem de mídia no banco de dados
   */
  private async saveMidiaMessageToDatabase(
    chatData: any,
    messageId: string,
    mediaUrl: string,
    filename: string,
    fileType: string,
    fileSize: number,
    timestamp: number,
    status: string = "PENDING" 
  ) {
    console.log('Salvando mídia no banco, tipo MIME:', fileType);
    
    // Determinar o tipo de mídia com base no mimetype
    let messageType = "";
    let messageContent = {};
    
    // Verificação mais robusta do tipo de arquivo
    if (fileType.startsWith("image/") || 
        filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/)) {
      // É uma imagem - prioridade de detecção
      messageType = "imageMessage";
      messageContent = {
        imageMessage: {
          url: mediaUrl,
          mimetype: fileType,
          caption: filename,
          fileSha256: "bjTheQR+CxDzzBqmutWyzJaVe2CdCCamtOIXrS65nD4=",
          fileLength: fileSize.toString(),
          mediaKey: "vwGaBr3kxsaArwP7JU2EhbwXTj/W9CtBWLkBkLW/V3U=",
          fileEncSha256: "YDDzxw6sZvz/aKnWExEllL/7rjBelQ60m8odBax1R24=",
          directPath: "/o1/v/t62.7118-24/f2/m239/AQObXuYisT4Qxyy_nt8Ci1feLacrvDcFh0E2FxmID-wgo6kybpbxVEmAU_iK-vJk5BqkQEeTl-AE7KuJR9B-X1_shKg7bEArDzGb25teFw",
          mediaKeyTimestamp: timestamp.toString(),
          contextInfo: {}
        }
      };
      console.log('Detectado como IMAGEM');
    } else if (fileType.startsWith("audio/") || 
              filename.toLowerCase().match(/\.(mp3|wav|ogg|m4a|aac)$/)) {
      // É um áudio
      messageType = "audioMessage";
      messageContent = {
        audioMessage: {
          url: mediaUrl,
          mimetype: fileType,
          ptt: true,
          fileSha256: "bjTheQR+CxDzzBqmutWyzJaVe2CdCCamtOIXrS65nD4=",
          fileLength: fileSize.toString(),
          mediaKey: "vwGaBr3kxsaArwP7JU2EhbwXTj/W9CtBWLkBkLW/V3U=",
          fileEncSha256: "YDDzxw6sZvz/aKnWExEllL/7rjBelQ60m8odBax1R24=",
          directPath: "/o1/v/t62.7118-24/f2/m239/AQObXuYisT4Qxyy_nt8Ci1feLacrvDcFh0E2FxmID-wgo6kybpbxVEmAU_iK-vJk5BqkQEeTl-AE7KuJR9B-X1_shKg7bEArDzGb25teFw",
          mediaKeyTimestamp: timestamp.toString()
        },
        messageContextInfo: {
          messageSecret: "s9Rbd7Zwqf/9K4QSmIZkVGs1sj836qeLjdRDE3Aed3c=",
          deviceListMetadata: {
            senderKeyHash: "yMtD+cEu3GiRGA==",
            senderTimestamp: Date.now(),
            recipientKeyHash: "+R23GArnZXanEA==",
            recipientTimestamp: Date.now()
          },
          deviceListMetadataVersion: 2
        }
      };
      console.log('Detectado como ÁUDIO');
    } else {
      // É um documento (qualquer outro tipo)
      messageType = "documentMessage";
      messageContent = {
        documentMessage: {
          url: mediaUrl,
          mimetype: fileType,
          title: filename,
          fileName: filename,
          fileLength: fileSize.toString(),
          mediaKey: uuidv4(),
          fileSha256: uuidv4(), // Adicionado o campo fileSha256
          fileEncSha256: uuidv4(),
          directPath: "",
          mediaKeyTimestamp: timestamp.toString(),
          contextInfo: {} // Adicionado o campo contextInfo
        }
      };
      console.log('Detectado como DOCUMENTO');
    }
    
    const messageData = {
      from_me: true,
      message_id: messageId,
      key: {
        id: messageId,
        fromMe: true,
        remoteJid: chatData.contact_info.remote_jid
      },
      message_type: messageType,
      message: messageContent,
      message_timestamp: timestamp,
      instance_id: chatData.channel_info.instance_id,
      chat_id: chatData.chat_id,
      status: status
    };
    
    console.log('Salvando mensagem com tipo:', messageType);
    
    const { data, error } = await supabase
      .from(SUPA_TABLES.table_myia_messages)
      .insert(messageData);
      
    if (error) throw error;
    
    return data;
  }

  /**
   * Salva uma mensagem de mídia (imagem, documento, etc.) no banco de dados
   */
  private async saveMidiaMessageToDatabase(
    chatData: any,
    messageId: string,
    mediaUrl: string, 
    filename: string,
    mimetype: string,
    filesize: number,
    timestamp: number,
    status: "PENDING" | "SENT" | "DELIVERED" | "READ" | "ERROR" = "PENDING"
  ) {
    try {
      console.log('Salvando mensagem de mídia no banco de dados:', {
        messageId,
        chatId: chatData.chat_id,
        filename,
        status
      });
      
      // Validar entradas
      if (!chatData || !messageId || !timestamp) {
        throw new Error('Dados inválidos para salvar mensagem de mídia');
      }
      
      // Determinar o tipo de mídia com base no mimetype
      const isImage = mimetype.startsWith('image/');
      const messageType = isImage ? "imageMessage" : "documentMessage";
      
      // Criar a estrutura de mensagem conforme definido no banco de dados
      const messageData = {
        from_me: true,
        message_id: messageId,
        key: {
          id: messageId,
          fromMe: true,
          remoteJid: chatData.contact_info.remote_jid
        },
        message_type: messageType,
        message: isImage 
          ? {
              imageMessage: {
                url: mediaUrl,
                mimetype: mimetype,
                caption: filename,
                fileSha256: "bjTheQR+CxDzzBqmutWyzJaVe2CdCCamtOIXrS65nD4=",
                fileLength: filesize.toString(),
                mediaKey: "vwGaBr3kxsaArwP7JU2EhbwXTj/W9CtBWLkBkLW/V3U=",
                fileEncSha256: "YDDzxw6sZvz/aKnWExEllL/7rjBelQ60m8odBax1R24=",
                directPath: "/o1/v/t62.7118-24/f2/m239/AQObXuYisT4Qxyy_nt8Ci1feLacrvDcFh0E2FxmID-wgo6kybpbxVEmAU_iK-vJk5BqkQEeTl-AE7KuJR9B-X1_shKg7bEArDzGb25teFw",
                mediaKeyTimestamp: timestamp.toString(),
                contextInfo: {}
              }
            }
          : {
              documentMessage: {
                url: mediaUrl,
                mimetype: mimetype,
                title: filename,
                fileName: filename,
                fileLength: filesize.toString(),
                mediaKey: uuidv4(),
                fileSha256: uuidv4(),
                fileEncSha256: uuidv4(),
                directPath: "",
                mediaKeyTimestamp: timestamp.toString(),
                contextInfo: {}
              }
            },
        message_timestamp: timestamp,
        instance_id: chatData.channel_info.instance_id,
        chat_id: chatData.chat_id,
        status: status
      };
      
      console.log('Salvando mensagem com tipo:', messageType);
      
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_myia_messages)
        .insert(messageData);
        
      if (error) {
        console.error('Erro ao salvar mensagem de mídia no banco de dados:', error);
        throw error;
      }
      
      console.log('Mensagem de mídia salva com sucesso:', data);
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Erro ao salvar mensagem de mídia:', error);
      throw error;
    }
  }
  
  /**
   * Atualiza o chat no banco de dados
   */
  private async updateChat(chatId: string) {
    const { data, error } = await supabase
      .from(SUPA_TABLES.table_myia_chats)
      .update({
        updated_at: new Date().toISOString()
      })
      .match({ id: chatId });
      
    if (error) throw error;
    
    return data;
  }
  
  /**
   * Função auxiliar para procurar recursivamente por campos id em objetos aninhados
   * Útil para entender a estrutura da resposta da API
   */
  private findKeyId(obj: any, path: string = '') {
    if (!obj || typeof obj !== 'object') return;
    
    // Verificar cada propriedade no objeto atual
    for (const key in obj) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (key === 'id' && path.includes('key')) {
        console.log(`Encontrado possível key.id em: ${currentPath} = ${obj[key]}`);
      }
      
      // Se o valor for um objeto ou array, procurar recursivamente
      if (obj[key] && typeof obj[key] === 'object') {
        this.findKeyId(obj[key], currentPath);
      }
    }
  }
  
  /**
   * Atualiza a mensagem no banco de dados com o ID real e o objeto key completo
   */
  private async updateMessageWithFullKey(temporaryId: string, apiResponse: any, minioUrl: string = '') {
    try {
      // Extrair os dados da resposta da API
      const keyObject = apiResponse?.key;
      const messageObject = apiResponse?.message;
      const messageTimestamp = apiResponse?.messageTimestamp;
      const status = apiResponse?.status;
      
      // Extrair o ID real da mensagem do objeto key
      const keyId = keyObject?.id;
      
      if (!keyId) {
        console.error('ID da mensagem não encontrado na resposta da API:', apiResponse);
        console.log('Mantendo o ID temporário como ID final da mensagem');
        return false;
      }
      
      console.log(`Atualizando mensagem temporária ${temporaryId} com ID real ${keyId}`);
      
      // Se não foi fornecida uma URL do Minio diretamente, buscar da mensagem atual
      let finalMinioUrl = minioUrl;
      if (!finalMinioUrl) {
        // Primeiro, buscar a mensagem atual para obter a URL do Minio
        const { data: existingMessage, error: fetchError } = await supabase
          .from(SUPA_TABLES.table_myia_messages)
          .select('*')
          .eq('message_id', temporaryId)
          .single();
          
        if (fetchError || !existingMessage) {
          console.error('Erro ao buscar mensagem existente:', fetchError);
          throw fetchError || new Error('Mensagem não encontrada');
        }
        
        // Extrair a URL do Minio da mensagem atual
        const messageType = existingMessage.message_type;
        
        if (messageType === 'imageMessage' && existingMessage.message?.imageMessage?.url) {
          finalMinioUrl = existingMessage.message.imageMessage.url;
        } else if (messageType === 'documentMessage' && existingMessage.message?.documentMessage?.url) {
          finalMinioUrl = existingMessage.message.documentMessage.url;
        } else if (messageType === 'audioMessage' && existingMessage.message?.audioMessage?.url) {
          finalMinioUrl = existingMessage.message.audioMessage.url;
        }
      }
      
      if (finalMinioUrl) {
        console.log('URL do Minio preservada:', finalMinioUrl);
      }
      
      // Preparar os dados para atualização
      const updateData: any = {
        // Salvar o objeto key completo da API
        key: keyObject,
        
        // Atualizar o message_id com o ID real da mensagem (key.id)
        message_id: keyId
      };
      
      // Adicionar o objeto message se disponível
      if (messageObject) {
        updateData.message = { ...messageObject };
        
        // Preservar a URL do Minio
        if (finalMinioUrl) {
          const messageType = Object.keys(messageObject)[0]; // imageMessage, documentMessage, etc.
          
          if (messageType === 'imageMessage' && updateData.message.imageMessage) {
            console.log('Preservando URL do Minio para imageMessage:', finalMinioUrl);
            updateData.message.imageMessage.url = finalMinioUrl;
          } else if (messageType === 'documentMessage' && updateData.message.documentMessage) {
            console.log('Preservando URL do Minio para documentMessage:', finalMinioUrl);
            updateData.message.documentMessage.url = finalMinioUrl;
          } else if (messageType === 'audioMessage' && updateData.message.audioMessage) {
            console.log('Preservando URL do Minio para audioMessage:', finalMinioUrl);
            updateData.message.audioMessage.url = finalMinioUrl;
          }
        }
      }
      
      // Adicionar o timestamp se disponível
      if (messageTimestamp) {
        updateData.message_timestamp = messageTimestamp;
      }
      
      // Adicionar o status se disponível
      if (status) {
        updateData.status = status;
      }
      
      console.log('Atualizando mensagem com dados completos:', JSON.stringify(updateData, null, 2));
      
      // Atualizar a mensagem no banco de dados
      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_messages)
        .update(updateData)
        .eq('message_id', temporaryId);
      
      if (error) {
        console.error('Erro ao atualizar mensagem com ID real:', error);
        throw error;
      }
      
      console.log('Mensagem atualizada com sucesso com ID real e dados completos da API.');
      return true;
    } catch (error) {
      console.error('Erro ao atualizar mensagem com ID real:', error);
      return false;
    }
  }
  
  /**
   * Atualiza a mensagem de áudio no banco de dados com o ID real e o objeto key completo
   */
  private async updateAudioMessageWithFullKey(temporaryId: string, keyId: string, keyObject: any, responseData: any = null, minioUrl: string = '') {
    try {
      console.log(`Atualizando mensagem de áudio. ID temporário: ${temporaryId}, ID real: ${keyId}`);
      
      // Se não foi fornecida uma URL do Minio diretamente, buscar da mensagem atual
      if (!minioUrl) {
        // Primeiro, obter a mensagem atual para preservar a URL do Minio
        const { data: currentMessage, error: fetchError } = await supabase
          .from(SUPA_TABLES.table_myia_messages)
          .select('message')
          .eq('message_id', temporaryId)
          .single();
          
        if (fetchError) {
          console.error('Erro ao buscar mensagem atual:', fetchError);
          throw fetchError;
        }
        
        // Extrair a URL do Minio da mensagem atual
        minioUrl = currentMessage?.message?.audioMessage?.url || '';
      }
      
      console.log('URL do Minio a ser preservada:', minioUrl);
      
      // Extrair informações adicionais da resposta, se disponíveis
      const audioInfo = responseData?.message?.audioMessage || {};
      
      // Atualizar o message_id e key
      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_messages)
        .update({
          message_id: keyId,  // Atualizar message_id com o ID real (key.id)
          key: keyObject,             // Salvar o objeto key completo
          status: 'DELIVERY_ACK'      // Atualizar status para DELIVERY_ACK
        })
        .eq('message_id', temporaryId);
      
      if (error) {
        console.error('Erro ao atualizar mensagem de áudio no banco de dados:', error);
        throw error;
      } else {
        console.log('Mensagem de áudio atualizada com sucesso no banco de dados');
        
        // Se temos informações adicionais do áudio na resposta, atualizar também
        // mas preservando a URL do Minio
        if (Object.keys(audioInfo).length > 0) {
          console.log('Atualizando informações adicionais do áudio, preservando URL do Minio');
          
          // Criar um objeto audioMessage combinando os dados da API com a URL do Minio
          const updatedAudioMessage = {
            ...audioInfo,
            url: minioUrl // Manter a URL do Minio
          };
          
          // Verificar se a URL está realmente definida
          if (!updatedAudioMessage.url || updatedAudioMessage.url === '') {
            console.warn('ALERTA: URL do Minio está vazia! Usando URL de fallback');
            updatedAudioMessage.url = minioUrl || 'error://failed_to_preserve_url';
          }
          
          console.log('Objeto audioMessage atualizado:', JSON.stringify(updatedAudioMessage, null, 2));
          
          // Atualização adicional com dados completos do áudio
          const { error: updateError } = await supabase
            .from(SUPA_TABLES.table_myia_messages)
            .update({
              message: {
                audioMessage: updatedAudioMessage
              }
            })
            .eq('message_id', keyId);
            
          if (updateError) {
            console.error('Erro ao atualizar informações adicionais do áudio:', updateError);
          } else {
            console.log('Informações de áudio atualizadas com sucesso, mantendo URL do Minio');
          }
        } else {
          // Se não temos informações adicionais, apenas garantir que a URL do Minio seja preservada
          console.log('Não há informações adicionais do áudio, apenas preservando a URL do Minio');
          
          const { error: updateUrlError } = await supabase
            .from(SUPA_TABLES.table_myia_messages)
            .update({
              message: {
                audioMessage: {
                  url: minioUrl,
                  ptt: true,
                  mimetype: "audio/ogg; codecs=opus"
                }
              }
            })
            .eq('message_id', keyId);
            
          if (updateUrlError) {
            console.error('Erro ao preservar URL do Minio:', updateUrlError);
          } else {
            console.log('URL do Minio preservada com sucesso');
          }
        }
      }
    } catch (error) {
      console.error('Exceção ao atualizar mensagem de áudio no banco de dados:', error);
      throw error;
    }
  }
  
  /**
   * Atualiza a URL do áudio no banco de dados
   */
  private async updateAudioUrl(messageId: string, newAudioUrl: string) {
    if (!messageId || !newAudioUrl) {
      console.error('Não é possível atualizar a URL do áudio: parâmetros inválidos', { messageId, newAudioUrl });
      return;
    }
    
    console.log(`Atualizando URL do áudio no banco de dados. ID: ${messageId}`);
    
    try {
      // Atualizar usando SQL direto devido a limitações com o raw
      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_messages)
        .update({
          message: supabase.rpc('jsonb_deep_set', { 
            json: 'message', 
            path: '{audioMessage,url}', 
            value: newAudioUrl 
          })
        })
        .eq('message_id', messageId);
      
      if (error) {
        console.error('Erro ao atualizar URL do áudio no banco:', error);
      } else {
        console.log('URL do áudio atualizada com sucesso');
      }
    } catch (error) {
      console.error('Exceção ao atualizar URL do áudio:', error);
    }
  }
  
  /**
   * Garantir que o método updateMediaUrl atualize corretamente a URL da mídia no banco de dados
   */
  private async updateMediaUrl(messageId: string, mediaUrl: string, mediaType: 'audio' | 'image' | 'document') {
    try {
      console.log(`Atualizando URL da mídia (${mediaType}) para mensagem ${messageId}:`, mediaUrl);
      
      // Primeiro, buscar a mensagem atual para não perder os outros dados
      const { data: messageData, error: fetchError } = await supabase
        .from(SUPA_TABLES.table_myia_messages)
        .select('*')
        .eq('message_id', messageId)
        .single();
        
      if (fetchError || !messageData) {
        console.error(`Erro ao buscar mensagem ${messageId}:`, fetchError);
        throw fetchError || new Error('Mensagem não encontrada');
      }
      
      // Clonar a mensagem para modificar
      const message = { ...messageData.message };
      
      // Atualizar a URL de acordo com o tipo de mídia
      if (mediaType === 'audio' && message.audioMessage) {
        message.audioMessage.url = mediaUrl;
      } else if (mediaType === 'image' && message.imageMessage) {
        message.imageMessage.url = mediaUrl;
      } else if (mediaType === 'document' && message.documentMessage) {
        message.documentMessage.url = mediaUrl;
      } else {
        console.warn(`Tipo de mídia ${mediaType} não encontrado na mensagem:`, message);
        
        // Criar a estrutura se não existir
        if (mediaType === 'image') {
          message.imageMessage = {
            ...(message.imageMessage || {}),
            url: mediaUrl
          };
        } else if (mediaType === 'document') {
          message.documentMessage = {
            ...(message.documentMessage || {}),
            url: mediaUrl
          };
        } else if (mediaType === 'audio') {
          message.audioMessage = {
            ...(message.audioMessage || {}),
            url: mediaUrl
          };
        }
      }
      
      console.log('Atualizando mensagem com nova URL:', JSON.stringify(message, null, 2));
      
      // Atualizar a mensagem no banco de dados
      const { error } = await supabase
        .from(SUPA_TABLES.table_myia_messages)
        .update({ message })
        .eq('message_id', messageId);
      
      if (error) {
        console.error(`Erro ao atualizar URL da mídia (${mediaType}):`, error);
        throw error;
      }
      
      console.log(`URL da mídia (${mediaType}) atualizada com sucesso para: ${mediaUrl}`);
    } catch (error) {
      console.error(`Erro ao atualizar URL da mídia (${mediaType}):`, error);
      throw error;
    }
  }
  
  /**
   * Formata o texto para JSON, escapando caracteres especiais
   */
  private formatTextForJSON(text: string) {
    if (typeof text !== 'string') {
      throw new Error("A entrada deve ser uma string.");
    }
    
    return text
      .replace(/\\/g, '\\\\')  // Escapa barras invertidas
      .replace(/"/g, '\\"')    // Escapa aspas duplas
      .replace(/\n/g, '\\n')   // Garante que as quebras de linha sejam formatadas corretamente
      .replace(/\n\s*/g, '\\n') // Remove espaços excessivos após as quebras de linha
      .replace(/\*\*/g, '*');  // Substitui ** por * para compatibilidade com o WhatsApp
  }
  
  /**
   * Envia texto para a API do canal
   */
  private async sendToChannelAPI(chatData: any, formattedText: string) {
    if (!chatData || !chatData.channel_info) {
      console.error('Dados de chat inválidos:', chatData);
      throw new Error('Dados de chat inválidos para envio de mensagem');
    }

    try {
      const url = `${chatData.channel_info.urlapi}/message/sendText/${chatData.channel_info.nome}`;
      
      console.log('Enviando para URL:', url);
      
      const headers = {
        apikey: chatData.channel_info.token
      };
      
      const remoteJid = chatData.contact_info.remote_jid || 
                      (chatData.contact_info.number ? `${chatData.contact_info.number}@s.whatsapp.net` : null);
      
      if (!remoteJid) {
        throw new Error('Número de telefone inválido');
      }
      
      const body = {
        number: remoteJid,
        text: formattedText,
        delay: 500 // Reduzido de 1200 para 500ms
      };
      
      console.log('Dados enviados:', { url, headers, body });
      
      // Usar o cliente Axios configurado do projeto
      const api = getAPIClient();
      const response = await api.post(url, body, { headers });
      
      // Exibir resposta completa para análise detalhada
      console.log('RESPOSTA COMPLETA DA API (para análise):', JSON.stringify(response.data, null, 2));
      
      return response;
    } catch (error) {
      console.error('Erro ao enviar para API:', error);
      if (error.isAxiosError) {
        console.error('Detalhes da resposta:', error.response?.data);
        console.error('Status do erro:', error.response?.status);
      }
      throw error;
    }
  }
}

// Criar uma instância da classe para exportação
export const messageService = new MessageService();
