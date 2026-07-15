import { Channel } from "@/contexts/Assistants/interfaces";

// Usar a URL fixa do webhook para garantir que estamos usando o valor correto
const WEBHOOK_BASE_URL = "https://webhooks.sejanexa.com.br";

export interface ChannelWebhookPayload {
  assistent_id: string;
  nome: string;
  evento: "criar" | "open" | "parar" | "excluir";
  empresaId: string;
  // Novo campo para informar o tipo de API do canal
  tipoApi?: "Evolution" | "Waha";
}

export class ChannelService {
  /**
   * Envia uma requisição para o webhook de gerenciamento de canais
   * @param payload Dados para o webhook
   * @returns Resposta da API
   */
  private static async sendWebhookRequest(payload: ChannelWebhookPayload): Promise<any> {
    console.log("Enviando requisição para o webhook:", payload);
    
    try {
      const response = await fetch(`${WEBHOOK_BASE_URL}/webhook/gerenciar-channel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      // Capturar o texto da resposta
      const responseText = await response.text();
      console.log("Resposta bruta do webhook:", responseText);
      
      // Tentar converter para JSON, se possível
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        console.log("Resposta não é um JSON válido, retornando como texto");
        responseData = { message: responseText };
      }
      
      if (!response.ok) {
        console.error(`Erro na requisição: ${response.status} - ${responseText}`);
        throw new Error(`Erro na requisição: ${response.status} - ${responseText}`);
      }

      console.log("Resposta do webhook:", responseData);
      return responseData;
    } catch (error) {
      console.error("Erro ao enviar requisição para o webhook:", error);
      throw error;
    }
  }

  /**
   * Cria um novo canal
   * @param assistantId ID do assistente
   * @param companyId ID da empresa
   * @param channelName Nome do canal
   * @returns Resposta da API
   */
  static async createChannel(
    assistantId: string,
    companyId: string,
    channelName: string,
    apiType?: "Evolution" | "Waha"
  ): Promise<any> {
    console.log("Criando canal com parâmetros:", { assistantId, companyId, channelName, apiType });
    return this.sendWebhookRequest({
      assistent_id: assistantId,
      nome: channelName,
      evento: "criar",
      empresaId: companyId,
      tipoApi: apiType,
    });
  }

  /**
   * Gera o QR code para um canal existente
   * @param assistantId ID do assistente
   * @param companyId ID da empresa
   * @param channelName Nome do canal
   * @returns Resposta da API com o QR code em base64
   */
  static async generateQRCode(
    assistantId: string,
    companyId: string,
    channelName: string,
    apiType?: "Evolution" | "Waha"
  ): Promise<any> {
    console.log("Gerando QR code com parâmetros:", { assistantId, companyId, channelName, apiType });
    return this.sendWebhookRequest({
      assistent_id: assistantId,
      nome: channelName,
      evento: "open",
      empresaId: companyId,
      tipoApi: apiType,
    });
  }

  /**
   * Desconecta um canal (logout)
   * @param assistantId ID do assistente
   * @param companyId ID da empresa
   * @param channelName Nome do canal
   * @returns Resposta da API
   */
  static async stopChannel(
    assistantId: string,
    companyId: string,
    channelName: string,
    apiType?: "Evolution" | "Waha"
  ): Promise<any> {
    console.log("Desconectando canal com parâmetros:", { assistantId, companyId, channelName, apiType });
    return this.sendWebhookRequest({
      assistent_id: assistantId,
      nome: channelName,
      evento: "parar",
      empresaId: companyId,
      tipoApi: apiType,
    });
  }

  /**
   * Exclui um canal
   * @param assistantId ID do assistente
   * @param companyId ID da empresa
   * @param channelName Nome do canal
   * @returns Resposta da API
   */
  static async deleteChannel(
    assistantId: string,
    companyId: string,
    channelName: string,
    apiType?: "Evolution" | "Waha"
  ): Promise<any> {
    console.log("Excluindo canal com parâmetros:", { assistantId, companyId, channelName, apiType });
    return this.sendWebhookRequest({
      assistent_id: assistantId,
      nome: channelName,
      evento: "excluir",
      empresaId: companyId,
      tipoApi: apiType,
    });
  }
}
