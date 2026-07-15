// Este arquivo pode ser usado para testar a implementação do MessageService

import { messageService } from './MessageService';

/**
 * Função para testar o envio de uma mensagem de texto
 */
async function testSendTextMessage() {
  try {
    // Substitua com dados reais de um chat
    const chatData = {
      chat_id: 'ID_DO_CHAT',
      company_id: 'ID_DA_EMPRESA',
      channel_info: {
        nome: 'NOME_DO_CANAL',
        urlapi: 'URL_DA_API',
        token: 'TOKEN_DO_CANAL',
        instance_id: 'ID_DA_INSTANCIA',
      },
      contact_info: {
        remote_jid: 'NUMERO@s.whatsapp.net', // Ou utilize o campo number abaixo
        number: 'NUMERO',
      }
    };
    
    const message = 'Esta é uma mensagem de teste enviada diretamente da aplicação!';
    
    console.log('Iniciando teste de envio de mensagem de texto...');
    const result = await messageService.sendTextMessage(chatData, message);
    
    if (result.success) {
      console.log('✅ Mensagem enviada com sucesso!');
      console.log('ID da mensagem:', result.messageId);
    } else {
      console.error('❌ Falha ao enviar mensagem:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  }
}

/**
 * Função para testar o envio de um áudio
 */
async function testSendAudioMessage(audioFile: File) {
  try {
    // Substitua com dados reais de um chat
    const chatData = {
      chat_id: 'ID_DO_CHAT',
      company_id: 'ID_DA_EMPRESA',
      channel_info: {
        nome: 'NOME_DO_CANAL',
        urlapi: 'URL_DA_API',
        token: 'TOKEN_DO_CANAL',
        instance_id: 'ID_DA_INSTANCIA',
      },
      contact_info: {
        remote_jid: 'NUMERO@s.whatsapp.net', // Ou utilize o campo number abaixo
        number: 'NUMERO',
      }
    };
    
    console.log('Iniciando teste de envio de áudio...');
    const result = await messageService.sendAudioMessage(chatData, audioFile);
    
    if (result.success) {
      console.log('✅ Áudio enviado com sucesso!');
      console.log('URL do áudio:', result.url);
      console.log('ID da mensagem:', result.messageId);
    } else {
      console.error('❌ Falha ao enviar áudio:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  }
}

/**
 * Função para testar o envio de uma imagem
 */
async function testSendImageMessage(imageFile: File) {
  try {
    // Substitua com dados reais de um chat
    const chatData = {
      chat_id: 'ID_DO_CHAT',
      company_id: 'ID_DA_EMPRESA',
      channel_info: {
        nome: 'NOME_DO_CANAL',
        urlapi: 'URL_DA_API',
        token: 'TOKEN_DO_CANAL',
        instance_id: 'ID_DA_INSTANCIA',
      },
      contact_info: {
        remote_jid: 'NUMERO@s.whatsapp.net', // Ou utilize o campo number abaixo
        number: 'NUMERO',
      }
    };
    
    console.log('Iniciando teste de envio de imagem...');
    const result = await messageService.sendImageMessage(chatData, imageFile);
    
    if (result.success) {
      console.log('✅ Imagem enviada com sucesso!');
      console.log('URL da imagem:', result.url);
      console.log('ID da mensagem:', result.messageId);
    } else {
      console.error('❌ Falha ao enviar imagem:', result.error);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  }
}

// Exportar funções de teste para uso em outros componentes
export {
  testSendTextMessage,
  testSendAudioMessage,
  testSendImageMessage
};
