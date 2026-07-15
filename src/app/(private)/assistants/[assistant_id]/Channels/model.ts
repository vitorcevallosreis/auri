"use client"

import { AssistantsContext } from "@/contexts/Assistants"
import { Channel, EnumChannelStatus } from "@/contexts/Assistants/interfaces"
import { useContext, useEffect, useState, useCallback } from "react"
import { useDisclosure } from "@nextui-org/react"
import { useParams } from "next/navigation"
import { toast } from "sonner"
import { supabase, SUPA_TABLES } from "@/lib/supabase/config"

export interface IChannelsModel {
  channel: Channel
  channels: Channel[]
  isWatingConnect: boolean
  isOpen: boolean
  onOpen: () => void
  onOpenChange: () => void
  handleRemoveConnection: (channelId: string) => Promise<void>
  handleCreateChannel: (channelName?: string, apiType?: "Evolution" | "Waha") => Promise<Channel | null>
  handleGenerateQRCode: (channelId: string) => Promise<void>
  handleDeleteChannel: (channelId: string) => Promise<boolean>
  assistant: any
  isPollingQRCode: boolean
}

const useChannelsModel = (): IChannelsModel => {
  const { 
    getChannel, 
    channel, 
    removeConnectionChannel,
    createChannel,
    generateQRCode,
    deleteChannel,
    getChannels,
    getAssistant,
    assistant,
    set_channel // Corrigir para usar set_channel
  } = useContext(AssistantsContext)
  
  const { isOpen, onOpen, onOpenChange } = useDisclosure()
  const [channels, setChannels] = useState<Channel[]>([])
  const params = useParams()
  const assistant_id = params.assistant_id as string

  useEffect(() => {
    // Verificar se temos um ID de assistente válido
    if (!assistant_id) {
      console.error("ID do assistente não encontrado nos parâmetros da URL")
      return
    }

    console.log("Carregando assistente com ID:", assistant_id)
    
    // Carregar o assistente primeiro
    getAssistant(assistant_id)
      .then(() => {
        console.log("Assistente carregado, buscando canais")
        // Depois carregar os canais
        return Promise.all([
          getChannel(),
          getChannels().then(channelsList => setChannels(channelsList))
        ])
      })
      .catch(error => {
        console.error("Erro ao carregar assistente:", error)
      })
  }, [assistant_id])
  
  // Quando o canal é atualizado, atualizamos a lista de canais
  useEffect(() => {
    if (channel && channel.id) {
      // Verificar se o canal já existe na lista
      const existingIndex = channels.findIndex(ch => ch.id === channel.id)
      
      if (existingIndex >= 0) {
        // Atualizar o canal existente
        const updatedChannels = [...channels]
        updatedChannels[existingIndex] = channel
        setChannels(updatedChannels)
      } else {
        // Adicionar o novo canal à lista
        setChannels(prev => [...prev, channel])
      }
    }
  }, [channel])

  const isWatingConnect =
    channel.status === EnumChannelStatus.CLOSE ||
    channel.status === EnumChannelStatus.CREATED
      ? true
      : false

  const [isPollingQRCode, setIsPollingQRCode] = useState(false)
  const [qrCodePollingInterval, setQrCodePollingInterval] = useState<NodeJS.Timeout | null>(null)

  // Função para verificar periodicamente se o QR code foi atualizado
  const startQRCodePolling = useCallback((channelId: string) => {
    console.log("Iniciando polling do QR code para o canal:", channelId)
    
    // Limpar qualquer intervalo existente
    if (qrCodePollingInterval) {
      clearInterval(qrCodePollingInterval)
    }
    
    setIsPollingQRCode(true)
    
    // Iniciar um novo intervalo para verificar o QR code a cada 3 segundos
    const interval = setInterval(async () => {
      try {
        // Buscar o canal atualizado
        const updatedChannel = await getChannel(channelId)
        
        if (!updatedChannel) {
          console.warn("Canal não encontrado durante o polling. ID:", channelId)
          return
        }
        
        // Verificar se o canal atual tem QR code
        console.log("Verificando QR code...", 
          updatedChannel.qrcode64 ? "Disponível" : "Não disponível", 
          "Status:", updatedChannel.status || "undefined"
        )
        
        // Se o QR code estiver disponível ou o canal estiver conectado, parar o polling
        if (updatedChannel.qrcode64 || updatedChannel.status === EnumChannelStatus.OPEN) {
          console.log("QR code encontrado ou canal conectado. Parando polling.")
          stopQRCodePolling()
          
          // Se canal estiver conectado, mostrar mensagem de sucesso
          if (updatedChannel.status === EnumChannelStatus.OPEN) {
            console.log("Canal conectado com sucesso!")
          }
        }
      } catch (error) {
        console.error("Erro ao verificar QR code:", error)
      }
    }, 3000) // Verificar a cada 3 segundos
    
    setQrCodePollingInterval(interval)
  }, [qrCodePollingInterval, getChannel])
  
  // Função para parar o polling do QR code
  const stopQRCodePolling = useCallback(() => {
    console.log("Parando polling do QR code")
    
    if (qrCodePollingInterval) {
      clearInterval(qrCodePollingInterval)
      setQrCodePollingInterval(null)
    }
    
    setIsPollingQRCode(false)
  }, [qrCodePollingInterval])

  const handleRemoveConnection = async (channelId: string) => {
    await removeConnectionChannel(channelId)
    // Atualizar a lista de canais após desconectar
    const updatedChannels = await getChannels()
    setChannels(updatedChannels)
  }

  const handleCreateChannel = async (channelName?: string, apiType?: "Evolution" | "Waha"): Promise<Channel | null> => {
    try {
      console.log("=== Iniciando criação de canal ===");
      
      if (!assistant || !assistant.id) {
        toast.error("Assistente não carregado. Por favor, recarregue a página.");
        console.error("Assistente não encontrado para criar canal");
        return null;
      }

      // Chamar o método do contexto para criar o canal
      console.log("Chamando createChannel do contexto com nome:", channelName || "nome automático", "e apiType:", apiType);
      const newChannel = await createChannel(channelName, apiType);
      
      // Se o canal for null, significa que o webhook retornou sucesso, mas o canal ainda não está disponível no frontend
      if (!newChannel) {
        console.log("Canal criado com sucesso no backend, mas ainda não está disponível no frontend");
        
        // Atualizar a lista de canais para mostrar os canais existentes
        await getChannels();
        
        return null;
      }
      
      console.log("Canal criado e encontrado com sucesso:", newChannel);
      
      // Atualizar a lista de canais
      await getChannels();
      console.log("Lista de canais atualizada");
      
      // Definir o canal atual
      set_channel(newChannel);
      
      // Abrir o modal para mostrar o QR code
      onOpen();
      
      return newChannel;
    } catch (error) {
      console.error("Erro ao criar canal:", error);
      toast.error("Erro ao criar canal. Por favor, tente novamente.");
      return null;
    }
  }

  const handleGenerateQRCode = async (channelId: string): Promise<void> => {
    try {
      console.log("=== Iniciando geração de QR Code ===");
      console.log("Canal recebido para geração:", channelId);
      
      if (!channelId) {
        console.error("Canal não encontrado para geração de QR Code");
        return;
      }

      setIsPollingQRCode(true);
      console.log("Estado de polling definido como true");

      // Chamar a função de geração de QR code
      console.log("Chamando função generateQRCode com channel_id:", channelId);
      await generateQRCode(channelId);
      
      // Iniciar o polling para verificar se o QR code foi gerado
      console.log("Iniciando polling para QR code");
      await pollQRCode(channelId, setIsPollingQRCode);
    } catch (error) {
      console.error("Erro ao gerar QR Code:", error);
      setIsPollingQRCode(false);
    }
  }

  const pollQRCode = async (channelId: string, setIsPollingQRCode: React.Dispatch<React.SetStateAction<boolean>>) => {
    console.log("=== Iniciando polling do QR Code ===");
    
    // Verificar se o canal existe
    if (!channelId) {
      console.error("Canal não encontrado para polling de QR Code");
      setIsPollingQRCode(false);
      return;
    }
    
    console.log("Polling para canal:", channelId);
    
    // Configurações de polling
    const maxRetries = 10;
    const pollingInterval = 2000; // 2 segundos
    let retries = 0;

    // Função de polling
    const poll = async () => {
      if (retries >= maxRetries) {
        console.log("Número máximo de tentativas atingido:", retries);
        setIsPollingQRCode(false);
        return;
      }

      retries++;
      console.log(`Tentativa ${retries} de ${maxRetries}`);

      try {
        // Buscar o canal no Supabase para verificar se o QR code foi gerado
        const updatedChannel = await getChannel(channelId)

        if (!updatedChannel) {
          console.warn("Canal não encontrado durante polling");
        } else {
          console.log("Canal atualizado durante polling:", {
            id: updatedChannel.id,
            tem_qrcode: !!updatedChannel.qrcode64,
            qrcode_length: updatedChannel.qrcode64 ? updatedChannel.qrcode64.length : 0,
          });

          if (updatedChannel.qrcode64) {
            console.log("QR code encontrado! Terminando polling.");
            setIsPollingQRCode(false);
            return;
          }
        }

        // Continuar o polling se o QR code ainda não foi gerado
        setTimeout(poll, pollingInterval);
      } catch (err) {
        console.error("Erro durante o polling:", err);
        setIsPollingQRCode(false);
      }
    };

    // Iniciar o polling
    poll();
  }

  const handleDeleteChannel = async (channelId: string): Promise<boolean> => {
    const success = await deleteChannel(channelId)
    if (success) {
      // Atualizar a lista de canais após excluir
      const updatedChannels = await getChannels()
      setChannels(updatedChannels)
    }
    return success
  }

  // Limpar o intervalo quando o componente for desmontado
  useEffect(() => {
    return () => {
      if (qrCodePollingInterval) {
        clearInterval(qrCodePollingInterval)
      }
    }
  }, [qrCodePollingInterval])

  return {
    channel,
    channels,
    isWatingConnect,
    isOpen,
    onOpen,
    onOpenChange,
    handleRemoveConnection,
    handleCreateChannel,
    handleGenerateQRCode,
    handleDeleteChannel,
    assistant,
    isPollingQRCode,
  }
}

export default useChannelsModel
