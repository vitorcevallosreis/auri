import { Channel } from "@/contexts/Assistants/interfaces";
import { supabase } from "@/lib/supabase/config";

// Cliente fino das rotas Next de gestão de instância do Evolution (Plano 2 — P2.5).
// Substitui o antigo POST para o webhook n8n `gerenciar-channel`. Toda a lógica
// (chamar o Evolution com a API key GLOBAL, persistir em myia_channels) mora no
// servidor em `/api/whatsapp/instance`; aqui só disparamos a ação e devolvemos a
// resposta já parseada para o contexto/UI.

const INSTANCE_ROUTE = "/api/whatsapp/instance";

type InstanceAction = "create" | "connect" | "logout" | "delete";

export interface InstanceResponse {
  ok: boolean;
  channel?: Channel;
  qrcode64?: string | null;
  pairing_code?: string | null;
  status?: string | null;
  deleted?: boolean;
  error?: string | null;
  warning?: string | null;
}

export class ChannelService {
  private static async call(
    action: InstanceAction,
    payload: Record<string, unknown>
  ): Promise<InstanceResponse> {
    // A rota /api/whatsapp/instance é server-only e opera via service role, então
    // exige o JWT do Supabase para autenticar/escopar o tenant (o middleware não
    // protege /api/*). Enviamos o access_token da sessão como Bearer.
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

    const response = await fetch(INSTANCE_ROUTE, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, ...payload }),
    });

    const data = (await response.json().catch(() => ({}))) as InstanceResponse;

    if (!response.ok && data?.ok === undefined) {
      // Erro de rede/desconhecido sem corpo útil.
      throw new Error(`Erro na requisição (${action}): ${response.status}`);
    }
    return data;
  }

  /**
   * Cria um novo canal: cria a linha em myia_channels e provisiona a instância
   * no Evolution (com webhook de ingress embutido). Retorna o canal já gravado.
   */
  static async createChannel(
    assistantId: string,
    nome: string,
    apiType?: "Evolution" | "Waha"
  ): Promise<InstanceResponse> {
    return this.call("create", { assistantId, nome, apiType });
  }

  /**
   * Gera/renova o QR code (ou pairing code) de um canal existente.
   */
  static async generateQRCode(channelId: string): Promise<InstanceResponse> {
    return this.call("connect", { channelId });
  }

  /**
   * Desconecta o número do canal (logout), mantendo a instância provisionada.
   */
  static async stopChannel(channelId: string): Promise<InstanceResponse> {
    return this.call("logout", { channelId });
  }

  /**
   * Exclui o canal: remove a instância no Evolution e a linha em myia_channels.
   */
  static async deleteChannel(channelId: string): Promise<InstanceResponse> {
    return this.call("delete", { channelId });
  }
}
