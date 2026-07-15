import { supabase } from "@/lib/supabase/config";
import SUPA_TABLES from "@/contexts/supa_tables";
import { messageService } from "./MessageService";

/**
 * Serviço para gerenciar mensagens quando o usuário está offline
 * e sincronizá-las quando ficar online novamente
 */
class OfflineMessageService {
  private isOnline: boolean = navigator.onLine;
  private pendingMessages: any[] = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    // Inicializar ouvintes de eventos online/offline
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Verificar se há mensagens pendentes no início
    this.loadPendingMessages();
  }

  /**
   * Verifica se o dispositivo está online
   */
  public getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Manipulador para quando o dispositivo fica online
   */
  private handleOnline = async (): Promise<void> => {
    console.log('Dispositivo está online. Sincronizando mensagens pendentes...');
    this.isOnline = true;
    
    // Processar a fila de mensagens pendentes
    this.processPendingMessages();
  }

  /**
   * Manipulador para quando o dispositivo fica offline
   */
  private handleOffline = (): void => {
    console.log('Dispositivo está offline. Mensagens serão armazenadas localmente.');
    this.isOnline = false;
  }

  /**
   * Carrega mensagens pendentes do banco de dados local
   */
  private async loadPendingMessages(): Promise<void> {
    try {
      // Buscar mensagens com status PENDING ou ERROR que podem precisar ser reenviadas
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_myia_messages)
        .select('*')
        .in('status', ['PENDING', 'ERROR', 'RETRY'])
        .eq('from_me', true)
        .order('message_timestamp', { ascending: true });
      
      if (error) {
        console.error('Erro ao carregar mensagens pendentes:', error);
        return;
      }
      
      if (data && data.length > 0) {
        console.log(`Encontradas ${data.length} mensagens pendentes para sincronização.`);
        this.pendingMessages = data;
        
        // Se estiver online, tenta processar imediatamente
        if (this.isOnline) {
          this.processPendingMessages();
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens pendentes:', error);
    }
  }

  /**
   * Processa a fila de mensagens pendentes
   */
  private async processPendingMessages(): Promise<void> {
    // Evitar processamento simultâneo da fila
    if (this.isProcessingQueue || !this.isOnline || this.pendingMessages.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    try {
      console.log(`Iniciando processamento de ${this.pendingMessages.length} mensagens pendentes`);
      
      // Processar uma mensagem por vez
      for (let i = 0; i < this.pendingMessages.length; i++) {
        const message = this.pendingMessages[i];
        
        // Atualizar status para PENDING
        await supabase
          .from(SUPA_TABLES.table_myia_messages)
          .update({ status: 'PENDING' })
          .eq('message_id', message.message_id);
        
        try {
          // Reenviar com base no tipo de mensagem
          if (message.message_type === 'conversation') {
            await this.resendTextMessage(message);
          } else if (message.message_type === 'audioMessage') {
            await this.resendAudioMessage(message);
          } else if (message.message_type === 'imageMessage') {
            await this.resendImageMessage(message);
          }
          
          // Remover da fila após envio bem-sucedido
          this.pendingMessages.splice(i, 1);
          i--; // Ajustar índice após remoção
          
        } catch (error) {
          console.error(`Erro ao reenviar mensagem ${message.message_id}:`, error);
          
          // Atualizar status para ERROR novamente
          await supabase
            .from(SUPA_TABLES.table_myia_messages)
            .update({ status: 'ERROR' })
            .eq('message_id', message.message_id);
        }
      }
      
      console.log('Processamento de mensagens pendentes concluído');
    } catch (error) {
      console.error('Erro ao processar mensagens pendentes:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Reenviar mensagem de texto
   */
  private async resendTextMessage(message: any): Promise<void> {
    // Primeiro, buscar os dados necessários do chat
    const { data: chatData, error } = await this.getChatData(message.chat_id);
    
    if (error || !chatData) {
      throw new Error('Não foi possível obter os dados do chat para reenvio');
    }
    
    // Reenviar a mensagem
    const text = message.message.conversation;
    await messageService.sendTextMessage(chatData, text);
  }

  /**
   * Reenviar mensagem de áudio
   */
  private async resendAudioMessage(message: any): Promise<void> {
    // Primeiro, buscar os dados necessários do chat
    const { data: chatData, error } = await this.getChatData(message.chat_id);
    
    if (error || !chatData) {
      throw new Error('Não foi possível obter os dados do chat para reenvio');
    }
    
    // Reenviar a mensagem de áudio
    // Seria necessário recuperar o arquivo de áudio do storage
    const audioUrl = message.message.audioMessage.url;
    
    // Aqui precisaríamos implementar a lógica para obter o arquivo físico do URL
    // Por enquanto, apenas logamos que seria necessário uma implementação mais complexa
    console.log('Para reenviar áudio, seria necessário recuperar o arquivo do storage:', audioUrl);
    
    // Esta é uma simplificação - a implementação real precisaria baixar o arquivo e reenviar
    // await messageService.sendAudioMessage(chatData, audioFile);
  }

  /**
   * Reenviar mensagem de imagem
   */
  private async resendImageMessage(message: any): Promise<void> {
    // Primeiro, buscar os dados necessários do chat
    const { data: chatData, error } = await this.getChatData(message.chat_id);
    
    if (error || !chatData) {
      throw new Error('Não foi possível obter os dados do chat para reenvio');
    }
    
    // Reenviar a mensagem de imagem
    // Seria necessário recuperar o arquivo de imagem do storage
    const imageUrl = message.message.imageMessage.url;
    
    // Aqui precisaríamos implementar a lógica para obter o arquivo físico do URL
    // Por enquanto, apenas logamos que seria necessário uma implementação mais complexa
    console.log('Para reenviar imagem, seria necessário recuperar o arquivo do storage:', imageUrl);
    
    // Esta é uma simplificação - a implementação real precisaria baixar o arquivo e reenviar
    // await messageService.sendImageMessage(chatData, imageFile);
  }

  /**
   * Obter dados do chat necessários para reenvio
   */
  private async getChatData(chatId: string) {
    return await supabase
      .from(SUPA_TABLES.table_myia_chats)
      .select(`
        id,
        company_id,
        channel:channel_id (nome, urlapi, token, instance_id),
        contact:contact_id (*)
      `)
      .eq('id', chatId)
      .single();
  }

  /**
   * Adicionar mensagem à fila para tentar novamente mais tarde
   */
  public addMessageToQueue(messageId: string): void {
    // Buscar a mensagem do banco de dados
    supabase
      .from(SUPA_TABLES.table_myia_messages)
      .select('*')
      .eq('message_id', messageId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('Erro ao buscar mensagem para enfileiramento:', error);
          return;
        }
        
        // Adicionar à fila
        this.pendingMessages.push(data);
        
        // Se estiver online, tentar processar imediatamente
        if (this.isOnline) {
          this.processPendingMessages();
        }
      });
  }
}

// Criar instância única para uso em toda a aplicação
export const offlineMessageService = new OfflineMessageService();
