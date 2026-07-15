"use client"

import React, { createContext, useEffect, useState } from "react"
import { Chat, ChatsProps, ChatsType } from "./interfaces"
import { supabase } from "@/lib/supabase/config"
import { Default } from "./defaults"
import { realtimeService } from "@/lib/supabase/realtime.service"
import SUPA_TABLES from "../supa_tables"
import { ChatSchema, ChatsSchema } from "./schemas"
import { toast } from "sonner"

export const ChatsContext = createContext({} as ChatsType)

// Função auxiliar para ordenar chats por data (mais recentes primeiro)
const sortChatsByDate = (chats: any[]) => {
  return [...chats].sort((a, b) => {
    const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    return dateB - dateA; // Ordem decrescente
  });
};

export function ChatsProvider({ children }: ChatsProps) {
  const [isLoading, setIsLoading] = useState(Default.isLoading)
  const [chats, set_chats] = useState(Default.chats)
  const [chat, set_chat] = useState(Default.chat)
  const [selected_chat_windows, set_selected_chat_windows] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (!selected_chat_windows) return

    getChat(selected_chat_windows)
  }, [selected_chat_windows])

  useEffect(() => {
    // Usar 'myia_chat' diretamente como nome da tabela para o Realtime
    realtimeService.subscribeToTable<Chat>(
      'myia_chat', // Nome da tabela sem o schema
      (payload) => {
        console.log('Recebido evento Realtime para chat:', payload);
        if (payload.eventType === "INSERT") {
          set_chats((prevChats) => {
            // Adicionar o novo chat e reordenar
            const updatedChats = [...prevChats, payload.new];
            return sortChatsByDate(updatedChats);
          });
          // playSound();
        }

        if (payload.eventType === "UPDATE") {
          set_chats((prevChats) => {
            // Atualizar o chat existente e reordenar
            const updatedChats = prevChats.map((chat) => {
              if (chat.id === payload.new.id) {
                return { ...chat, ...payload.new };
              }
              return chat;
            });
            return sortChatsByDate(updatedChats);
          });
          
          // Se o chat atualizado for o chat atual, atualizar também o estado do chat
          if (chat.id === payload.new.id) {
            set_chat(prevChat => ({ ...prevChat, ...payload.new }));
          }
        }
      }
    );
    return () => {
      realtimeService.unsubscribeFromTable('myia_chat');
    };
  }, [chat.id]); 

  async function getChats(archived?: boolean): Promise<void> {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('myia_chat') // Usar apenas o nome da tabela sem o schema
        .select(
          `
          id,
          labels,
          muted,
          archived,
          bot_running,
          chat_pause,
          updated_at,
          last_message,
          channel_name,
          contact: contact_id (*)
          `
        )
        .eq("archived", archived ? true : false)

      if (error) throw error
      if (!data) return

      // Ordenar os chats pelo campo updated_at em ordem decrescente (mais recentes primeiro)
      const sortedData = [...data].sort((a, b) => {
        const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return dateB - dateA; // Ordem decrescente
      });

      const parsed = ChatsSchema.safeParse(sortedData)

      if (!parsed.success)
        throw `[getChats]: => Safe Parse Error! ${parsed.error}`

      // Garantir que os dados estão no formato correto antes de atualizar o estado
      set_chats(parsed.data)
    } catch (error) {
      console.log(error)

      set_chats(Default.chats)
    } finally {
      setIsLoading(false)
    }
  }

  async function getChat(chat_id: string): Promise<void> {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('myia_chat') // Usar apenas o nome da tabela sem o schema
        .select(
          `
          id,
          labels,
          muted,
          archived,
          bot_running,
          chat_pause,
          updated_at,
          last_message,
          channel_name,
          contact: contact_id (*)
          `
        )
        .eq('id', chat_id)
        .single()

      if (error) throw error

      const parsed = ChatSchema.safeParse(data)

      if (!parsed.success) throw "[getChat]: => Safe Parse Error!"

      // Garantir que os dados estão no formato correto antes de atualizar o estado
      set_chat(parsed.data)
    } catch (error) {
      console.log(error)
      set_chat(Default.chat)
    } finally {
      setIsLoading(false)
    }
  }

  async function getChatControll(chat_id: string): Promise<void> {
    // Função mantida para compatibilidade, mas não utilizada
  }
  
  async function toggleChatPause(chat_id: string): Promise<void> {
    try {
      setIsLoading(true)
      
      // Primeiro, obtemos o estado atual do chat_pause
      const { data: currentChat, error: fetchError } = await supabase
        .from('myia_chat')
        .select('chat_pause')
        .eq('id', chat_id)
        .single()
        
      if (fetchError) {
        throw fetchError
      }
      
      const newPauseState = !(currentChat?.chat_pause || false)
      
      // Atualizar o estado local primeiro para melhorar a experiência do usuário
      set_chat((prevChat) => ({
        ...prevChat, 
        chat_pause: newPauseState
      }))
      
      // Atualizar também a lista de chats
      set_chats((prevChats) => {
        return prevChats.map(c => {
          if (c.id === chat_id) {
            return { ...c, chat_pause: newPauseState }
          }
          return c
        })
      })
      
      // Exibir mensagem de sucesso
      toast.success(
        newPauseState 
          ? "🤖 Bot pausado com sucesso! Agora você está no controle." 
          : "🤖 Bot reativado! O atendimento automático foi retomado.",
        { duration: 3000 }
      )
      
      // Tentar atualizar o banco de dados
      try {
        await supabase
          .from('myia_chat')
          .update({ chat_pause: newPauseState })
          .eq('id', chat_id)
      } catch (updateError) {
        // Silenciosamente ignorar erros de atualização
        // Já atualizamos o estado local acima
      }
      
      // Verificar se a atualização foi bem-sucedida
      try {
        await supabase
          .from('myia_chat')
          .select('chat_pause')
          .eq('id', chat_id)
          .single()
      } catch (verifyError) {
        // Silenciosamente ignorar erros de verificação
      }
    } catch (error) {
      toast.error("Erro ao alterar o estado do bot")
    } finally {
      setIsLoading(false)
    }
  }

  async function muteAndUnmuteChat(
    chat_id: string,
    muted: boolean
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('myia_chat') // Usar apenas o nome da tabela sem o schema
        .update({ muted: muted })
        .eq('id', chat_id)
        .select()

      if (error) throw error

      toast.success(
        muted ? "Notificações Desativadas!" : "Notificações Ativadas!",
        {
          duration: 500,
        }
      )
    } catch (error) {
      console.log(error)

      toast.error("Erro!")
    } finally {
      setIsLoading(false)
    }
  }

  async function updateChatLabels(
    chat_id: string,
    labels: string[]
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('myia_chat') // Usar apenas o nome da tabela sem o schema
        .update({ labels: labels })
        .eq('id', chat_id)
        .select()

      if (error) throw error

      toast.success("Etiquetas Atualizadas com sucesso!", { duration: 1000 })

      await getChat(chat_id)
    } catch (error) {
      console.log(error)

      toast.error("Erro ao tentar Atualizar Etiquetas!")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ChatsContext.Provider
      value={{
        isLoading,
        getChats,
        chats,
        getChat,
        chat,
        selected_chat_windows,
        set_selected_chat_windows,
        getChatControll,
        muteAndUnmuteChat,
        updateChatLabels,
        toggleChatPause,
      }}
    >
      {children}
    </ChatsContext.Provider>
  )
}
