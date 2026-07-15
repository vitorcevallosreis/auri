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

  // Deriva o tipo de API do canal com base nos campos retornados do backend
  const deriveApiTypeFromChannel = (ch?: Channel | null): "Evolution" | "Waha" => {
    const s = `${ch?.apiUtilizada || ""} ${ch?.tipoConexao || ""}`.toLowerCase()
    if (s.includes("waha")) return "Waha"
    return "Evolution"
  }

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

      // Chamar o webhook para criar o canal
      const response = await ChannelService.createChannel(
        assistant.id,
        user.company_id,
        channelName,
        apiType
      );

      console.log("Webhook chamado com sucesso:", response);
      
      // Se o backend retornou sucesso, o canal foi criado
      if (response && (response.status === "Sucesso" || response.status === "sucesso")) {
        toast.success(response.motivo || "Canal criado com sucesso!");
        
        // Atualizar a lista de canais
        const updatedChannels = await getChannels();
        console.log("Lista de canais atualizada após criação");
        
        // Informar ao usuário que o canal foi criado com sucesso
        toast.info("Canal criado com sucesso! Se não aparecer na lista, atualize a página.");
        
        // Retornar null, pois não temos o canal completo ainda
        // O componente que chamou esta função deve lidar com isso adequadamente
        return null;
      } else {
        console.error("Resposta inesperada do backend:", response);
        toast.error("Erro ao criar canal: resposta inesperada do servidor");
        return null;
      }
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

      // Chamar o webhook para gerar o QR code
      const response = await ChannelService.generateQRCode(
        assistant.id,
        user.company_id,
        currentChannel.nome,
        deriveApiTypeFromChannel(currentChannel)
      );

      console.log("Resposta da API de geração de QR code:", response);

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
    if (!channel_id || !assistant.id || !user?.company_id || !channel.nome) return

    setIsLoading(true)

    try {
      // Chamar o webhook para parar o canal
      await ChannelService.stopChannel(
        assistant.id,
        user.company_id,
        channel.nome,
        deriveApiTypeFromChannel(channel)
      );

      // Atualizar o status no banco de dados local
      const { error }: { error: any } = await supabase
        .from(SUPA_TABLES.table_myia_channels)
        .update({ status: "close" })
        .match({ id: channel_id })
        .single()

      if (error) throw error

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
    if (!channel_id || !assistant.id || !user?.company_id || !channel.nome) return false

    setIsLoading(true)

    try {
      // Chamar o webhook para excluir o canal
      const response = await ChannelService.deleteChannel(
        assistant.id,
        user.company_id,
        channel.nome,
        deriveApiTypeFromChannel(channel)
      );

      // Validar resposta do webhook
      const statusStr = (response?.status || "").toString().toLowerCase()
      const success = statusStr === "sucesso" || statusStr === "success"
      if (!success) {
        toast.error(response?.motivo || "Erro ao excluir canal")
        return false
      }

      // Excluir o canal do banco de dados local somente em caso de sucesso
      const { error }: { error: any } = await supabase
        .from(SUPA_TABLES.table_myia_channels)
        .delete()
        .match({ id: channel_id })

      if (error) throw error

      // Resetar o estado do canal
      set_channel(Default.channel)
      
      toast.success(response?.motivo || "Canal excluído com sucesso!")
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
