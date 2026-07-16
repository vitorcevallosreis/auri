"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import {
  Assistant,
  AssistantsContextType,
  AssistantsProviderProps,
  BodyCreateAssistant,
  BodyFollowUpStep,
  Channel,
  EnumChannelStatus,
  FollowUpStep,
  Llm,
} from "./interfaces"
import { supabase } from "@/lib/supabase/config"
import { Default } from "./defaults"

import { toast } from "sonner"
import SUPA_TABLES from "../supa_tables"
import { realtimeService } from "@/lib/supabase/realtime.service"
import { OnCreateAssistant } from "./functions"
import { AuthContext } from "../Auth"
import { ChannelService } from "@/services/ChannelService"

export const AssistantsContext = createContext({} as AssistantsContextType)

export function AssistantsProvider({ children }: AssistantsProviderProps) {
  const { user } = useContext(AuthContext)
  const [isLoading, setIsLoading] = useState(Default.isLoading)
  const [assistants, setAssistants] = useState(Default.assistants)
  const [assistant, setAssistant] = useState(Default.assistant)
  const [llms, setLlms] = useState(Default.llms)
  const [channel, set_channel] = useState(Default.channel)
  const [followUpSteps, setFollowUpSteps] = useState(Default.followUpSteps)

  useEffect(() => {
    if (!assistant.id) return

    realtimeService.subscribeToTable<Channel>(
      SUPA_TABLES.table_myia_channels,
      (payload) => {
        console.log(payload)

        if (payload.new.assistant_id === assistant.id) {
          set_channel(payload.new)

          if (
            payload.new.status === EnumChannelStatus.CLOSE ||
            payload.new.status === EnumChannelStatus.CREATED
          ) {
            toast.warning("Aguardando Conectar Dispositivo...", {
              duration: 500,
            })
          }
          if (payload.new.status === EnumChannelStatus.OPEN) {
            toast.success("Dispositivo Conectado com sucesso!")
          }
        }
      }
    )

    return () => {
      realtimeService.unsubscribeFromTable(SUPA_TABLES.table_myia_channels)
    }
  }, [assistant])

  async function getAssistants(): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error }: { data: Assistant[] | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_assistants)
          .select("*")
          .eq("company_id", user?.company_id)

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      setAssistants(data)
    } catch (error) {
      setAssistants(Default.assistants)

      toast.error("Erro ao listar os Assistentes")

      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function getAssistant(assistant_id: string): Promise<void> {
    setIsLoading(true)

    try {
      const { data, error }: { data: Assistant | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_assistants)
          .select()
          .match({ id: assistant_id })
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      setAssistant(data)
    } catch (error) {
      setAssistant(Default.assistant)

      toast.error("Erro ao retonar Assistente")

      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function createAssistant(body: BodyCreateAssistant): Promise<boolean> {
    setIsLoading(true)
    try {
      if (!user?.company_id) return false

      const onCreateData = await OnCreateAssistant(user?.company_id, body)

      if (!onCreateData.data) return false

      setAssistants([...assistants, onCreateData.data])

      toast.success(`Seu Assistente ${body.name} criado com sucesso!`)

      return true
    } catch (error) {
      setAssistants(Default.assistants)

      toast.error("Erro ao Crirar Assistente")

      console.log(error)
      return false
    } finally {
      setIsLoading(false)
    }
  }

  async function updateAssistant(
    assistant_id: string,
    body: BodyCreateAssistant
  ): Promise<void> {
    setIsLoading(true)
    try {
      const { data, error }: { data: Assistant | null; error: any } =
        await supabase
          .from(SUPA_TABLES.table_assistants)
          .update(body)
          .match({ id: assistant_id })
          .select()
          .single()

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      setAssistants(
        assistants.map((assistant) => {
          if (assistant.id === assistant_id) {
            return data
          }

          return assistant
        })
      )

      toast.success("Assistente atualizado com sucesso!")
    } catch (error) {
      console.log(error)
      setAssistants(Default.assistants)

      toast.error("Erro ao Atualizar Assistente")
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteAssistant(assistant_id: string): Promise<void> {
    try {
      const { error }: { error: any } = await supabase
        .from(SUPA_TABLES.table_assistants)
        .delete()
        .match({ id: assistant_id })

      if (error) throw error

      setAssistants(
        assistants.filter((assistant) => assistant.id !== assistant_id)
      )

      toast.success("Assistente deletado com sucesso!")
    } catch (error) {
      setAssistants(Default.assistants)

      toast.error("Erro ao Deletar Assistente")

      console.log(error)
    }
  }

  // llms

  async function getEnabledLlms(): Promise<void> {
    setIsLoading(true)

    try {
      const { data, error }: { data: Llm[] | null; error: any } = await supabase
        .from(SUPA_TABLES.table_llms)
        .select("*")
        .eq("enabled", true)

      if (error) throw error
      if (!data) throw "Dados inválidos!"

      setLlms(data)
    } catch (error) {
      setLlms(Default.llms)

      toast.error("Erro ao listar os LLMs")

      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }

  // llms

  // Channels
  async function getChannels(): Promise<Channel[]> {
    setIsLoading(true)

    try {
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_myia_channels)
        .select()
        .match({ assistant_id: assistant.id })

      if (error) throw error

      return data || []
    } catch (error) {
      console.error("Erro ao buscar canais:", error)
      toast.error("Erro ao buscar canais")
      return []
    } finally {
      setIsLoading(false)
    }
  }

  async function getChannel(channel_id?: string): Promise<Channel | null> {
    if (!assistant.id) return null;

    setIsLoading(true);

    try {
      console.log("Buscando canal com os parâmetros:", {
        assistant_id: assistant.id,
        channel_id: channel_id || "não fornecido"
      });
      
      let query = supabase
        .from(SUPA_TABLES.table_myia_channels)
        .select("*");
        
      // Sempre filtramos pelo assistant_id
      query = query.eq("assistant_id", assistant.id);
      
      // Se um ID de canal específico foi fornecido, filtramos por ele também
      if (channel_id) {
        query = query.eq("id", channel_id);
      }
      
      // A consulta mudará dependendo se um ID de canal específico foi fornecido
      let result;
      if (channel_id) {
        // Se um ID específico foi fornecido, esperamos apenas um resultado
        const { data, error } = await query.single();
        
        if (error) {
          console.error("Erro ao buscar canal específico:", error);
          throw error;
        }
        
        result = data;
      } else {
        // Se nenhum ID específico foi fornecido, pegamos o primeiro canal disponível
        const { data, error } = await query.limit(1);
        
        if (error) {
          console.error("Erro ao buscar canais:", error);
          throw error;
        }
        
        result = data?.[0] || null;
      }
      
      if (!result) {
        console.warn("Nenhum canal encontrado");
        return null;
      }
      
      console.log("Canal encontrado:", result);
      set_channel(result as Channel);
      return result as Channel;
    } catch (error) {
      console.error("Erro ao carregar canal:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }

  async function createChannel(channel_name?: string, apiType?: "Evolution" | "Waha"): Promise<Channel | null> {
    if (!assistant || !assistant.id) {
      console.error("ID do assistente não encontrado");
      throw new Error("ID do assistente não encontrado");
    }
    
    if (!user || !user.company_id) {
      console.error("ID da empresa não encontrado");
      throw new Error("ID da empresa não encontrado");
    }

    setIsLoading(true);

    try {
      // Gerar um nome único para o canal, usar o nome fornecido ou gerar um automaticamente
      const channelName = channel_name || `nexa_${user.company_id}_${assistant.id}`.substring(0, 50);
      
      console.log("Criando canal com nome:", channelName);
      console.log("ID do assistente:", assistant.id);
      console.log("ID da empresa:", user.company_id);

      // Criar o canal + provisionar a instância no Evolution (rota server-only).
      const response = await ChannelService.createChannel(
        assistant.id,
        channelName,
        apiType
      );

      console.log("Rota /api/whatsapp/instance (create) respondeu:", response);

      // A rota já criou a linha em myia_channels e devolve o canal gravado.
      if (response?.channel?.id) {
        const newChannel = response.channel;

        // Atualizar a lista de canais (a rota gravou via service role).
        await getChannels();
        set_channel(newChannel);

        if (response.ok) {
          toast.success("Canal criado com sucesso!");
        } else {
          // Linha criada, mas o Evolution falhou (ex.: VPS ainda não provisionado).
          // Mantemos o canal para permitir reconectar depois.
          toast.warning(
            response.error
              ? "Canal criado, mas a instância do Evolution falhou. Reconecte quando o gateway estiver ativo."
              : "Canal criado."
          );
        }

        // Retornar o canal para a UI abrir o modal de QR automaticamente.
        return newChannel;
      }

      console.error("Resposta inesperada da rota de instância:", response);
      toast.error(response?.error || "Erro ao criar canal: resposta inesperada do servidor");
      return null;
    } catch (error) {
      console.error("Erro ao criar canal:", error);
      toast.error("Erro ao criar canal");
      setIsLoading(false);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function generateQRCode(channel_id?: string): Promise<void> {
    if (!assistant.id || !user?.company_id) {
      console.error("Dados do assistente ou empresa não disponíveis:", { 
        "assistant_id": assistant?.id, 
        "company_id": user?.company_id
      });
      toast.error("Dados necessários não disponíveis para gerar QR Code");
      return;
    }

    setIsLoading(true);

    try {
      // Primeiro, buscar o canal atual para garantir que temos os dados necessários
      const currentChannel = await getChannel(channel_id);
      
      if (!currentChannel || !currentChannel.nome) {
        console.error("Dados do canal não encontrados ou incompletos:", { 
          "channel_id": channel_id,
          "channel_encontrado": !!currentChannel,
          "channel_nome": currentChannel?.nome
        });
        toast.error("Dados do canal não encontrados ou incompletos");
        setIsLoading(false);
        return;
      }
      
      console.log("Iniciando geração de QR code para:", {
        "assistant_id": assistant.id,
        "company_id": user.company_id,
        "channel_nome": currentChannel.nome,
        "channel_id": channel_id
      });

      // Chamar a rota de instância (connect) para gerar/renovar o QR code.
      const response = await ChannelService.generateQRCode(currentChannel.id);

      console.log("Resposta da rota de connect (QR code):", response);
      if (response && response.ok === false && response.error) {
        console.warn("Connect retornou erro do Evolution:", response.error);
      }

      // Atualizar o canal no banco de dados local para obter o QR code atualizado
      // Podemos precisar esperar um pouco para que o QR code seja processado no backend
      let retries = 0;
      const maxRetries = 5;
      let updatedChannel: Channel | null = null;

      while (retries < maxRetries) {
        console.log(`Tentativa ${retries + 1} de ${maxRetries} para buscar o QR code atualizado`);
        
        // Pequena pausa entre as tentativas
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Buscar o canal atualizado
        updatedChannel = await getChannel(channel_id);
        
        // Se o QR code foi encontrado, sair do loop
        if (updatedChannel && updatedChannel.qrcode64) {
          console.log("QR code encontrado após tentativa", retries + 1);
          break;
        }
        
        retries++;
      }

      if (updatedChannel && updatedChannel.qrcode64) {
        toast.success("QR Code gerado com sucesso!");
      } else {
        console.warn("QR code não encontrado após múltiplas tentativas");
        toast.warning("QR Code gerado, mas pode levar alguns segundos para aparecer. Aguarde...");
      }
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
      toast.error("Erro ao gerar QR Code. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }

  async function removeConnectionChannel(channel_id: string): Promise<void> {
    // A rota de instância resolve tudo a partir do channel_id; não dependemos
    // mais do canal atualmente selecionado no contexto (`channel.nome`), que
    // podia estar vazio e bloquear a ação silenciosamente.
    if (!channel_id || !assistant.id) return

    setIsLoading(true)

    try {
      // Desconectar via rota de instância (logout). A rota já atualiza
      // status='close' em myia_channels via service role.
      const response = await ChannelService.stopChannel(channel_id)
      if (response.ok === false && response.error) {
        console.warn("Logout retornou erro do Evolution:", response.error)
      }

      await getChannel(channel_id)

      toast.success("Dispositivo desconectado com sucesso!")
    } catch (error) {
      toast.error("Erro ao desconectar dispositivo")
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteChannel(channel_id: string): Promise<boolean> {
    // Idem removeConnectionChannel: basta o channel_id alvo.
    if (!channel_id || !assistant.id) return false

    setIsLoading(true)

    try {
      // Excluir via rota de instância: remove a instância no Evolution e a
      // linha em myia_channels (service role).
      const response = await ChannelService.deleteChannel(channel_id)

      if (!response?.ok) {
        toast.error(response?.error || "Erro ao excluir canal")
        return false
      }
      if (response.warning) {
        console.warn("Delete concluído com aviso do Evolution:", response.warning)
      }

      // Resetar o estado do canal
      set_channel(Default.channel)

      toast.success("Canal excluído com sucesso!")
      return true
    } catch (error) {
      toast.error("Erro ao excluir canal")
      console.error(error)
      return false
    } finally {
      setIsLoading(false)
    }
  }
  // Follow-up Steps
  async function getFollowUpSteps(assistant_id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error } = await supabase
        .from('myia_followup_steps')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('assistant_id', assistant_id)
        .order('step_number', { ascending: true })

      if (error) throw error
      if (!data) throw 'Dados inválidos!'

      setFollowUpSteps(data)
    } catch (error) {
      setFollowUpSteps(Default.followUpSteps)
      console.error('Erro ao buscar sequência de follow-ups:', error)
      toast.error('Erro ao buscar sequência de follow-ups')
    } finally {
      setIsLoading(false)
    }
  }

  async function createFollowUpStep(assistant_id: string, body: BodyFollowUpStep): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { data, error } = await supabase
        .from('myia_followup_steps')
        .insert([{ 
          ...body,
          company_id: user.company_id,
          assistant_id
        }])
        .select()

      if (error) throw error
      if (!data) throw 'Erro ao criar passo de follow-up'

      // Atualizar a lista de follow-ups
      setFollowUpSteps([...followUpSteps, data[0]])
      toast.success('Passo de follow-up criado com sucesso!')
    } catch (error) {
      console.error('Erro ao criar passo de follow-up:', error)
      toast.error('Erro ao criar passo de follow-up')
    } finally {
      setIsLoading(false)
    }
  }

  async function updateFollowUpStep(id: string, body: BodyFollowUpStep): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { error } = await supabase
        .from('myia_followup_steps')
        .update(body)
        .eq('id', id)
        .eq('company_id', user.company_id)

      if (error) throw error

      // Atualizar a lista de follow-ups
      setFollowUpSteps(
        followUpSteps.map((step) => (step.id === id ? { ...step, ...body } : step))
      )
      toast.success('Passo de follow-up atualizado com sucesso!')
    } catch (error) {
      console.error('Erro ao atualizar passo de follow-up:', error)
      toast.error('Erro ao atualizar passo de follow-up')
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteFollowUpStep(id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)

    try {
      const { error } = await supabase
        .from('myia_followup_steps')
        .delete()
        .eq('id', id)
        .eq('company_id', user.company_id)

      if (error) throw error

      // Atualizar a lista de follow-ups
      setFollowUpSteps(followUpSteps.filter((step) => step.id !== id))
      toast.success('Passo de follow-up excluído com sucesso!')
    } catch (error) {
      console.error('Erro ao excluir passo de follow-up:', error)
      toast.error('Erro ao excluir passo de follow-up')
    } finally {
      setIsLoading(false)
    }
  }

  // Channels

  return (
    <AssistantsContext.Provider
      value={{
        isLoading,
        setIsLoading,
        getAssistants,
        assistants,
        getAssistant,
        assistant,
        createAssistant,
        updateAssistant,
        deleteAssistant,
        getEnabledLlms,
        llms,
        getChannel,
        getChannels,
        channel,
        set_channel,
        removeConnectionChannel,
        createChannel,
        generateQRCode,
        deleteChannel,
        
        // Follow-up steps
        followUpSteps,
        getFollowUpSteps,
        createFollowUpStep,
        updateFollowUpStep,
        deleteFollowUpStep,
      }}
    >
      {children}
    </AssistantsContext.Provider>
  )
}
