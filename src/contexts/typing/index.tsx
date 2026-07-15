"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { realtimeService } from "@/lib/supabase/realtime.service";
import SUPA_TABLES from "../supa_tables";

interface TypingState {
  [chatId: string]: {
    isTyping: boolean;
    contactName: string;
    timestamp: number;
  };
}

interface TypingContextType {
  typingState: TypingState;
  setTypingIndicator: (chatId: string, isTyping: boolean, contactName: string) => void;
}

const TypingContext = createContext<TypingContextType>({
  typingState: {},
  setTypingIndicator: () => {},
});

export const useTyping = () => useContext(TypingContext);

interface TypingProps {
  children: React.ReactNode;
}

export const TypingProvider = ({ children }: TypingProps) => {
  const [typingState, setTypingState] = useState<TypingState>({});
  const timeoutsRef = useRef<{[key: string]: NodeJS.Timeout}>({});

  // Função para atualizar o estado de digitação
  const setTypingIndicator = (chatId: string, isTyping: boolean, contactName: string) => {
    if (isTyping) {
      // Limpar qualquer timeout existente
      if (timeoutsRef.current[chatId]) {
        clearTimeout(timeoutsRef.current[chatId]);
      }

      // Atualizar o estado
      setTypingState(prev => ({
        ...prev,
        [chatId]: {
          isTyping: true,
          contactName,
          timestamp: Date.now(),
        },
      }));

      // Definir um novo timeout para limpar automaticamente após 10 segundos
      timeoutsRef.current[chatId] = setTimeout(() => {
        setTypingState(prev => ({
          ...prev,
          [chatId]: {
            ...prev[chatId],
            isTyping: false,
          },
        }));
      }, 10000);
    } else {
      // Limpar o timeout se existir
      if (timeoutsRef.current[chatId]) {
        clearTimeout(timeoutsRef.current[chatId]);
        delete timeoutsRef.current[chatId];
      }

      // Atualizar o estado
      setTypingState(prev => ({
        ...prev,
        [chatId]: {
          isTyping: false,
          contactName,
          timestamp: Date.now(),
        },
      }));
    }
  };

  // Limpar todos os timeouts ao desmontar
  useEffect(() => {
    return () => {
      Object.values(timeoutsRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);

  // Criar um WebSocket ou listener para receber eventos de digitação...
  useEffect(() => {
    // Aqui você implementaria a escuta de eventos de digitação do backend
    // Por exemplo, via websocket ou realtime do Supabase
    
    // Exemplo: monitorar uma tabela de status de digitação
    const subscription = realtimeService.subscribeToTable(
      SUPA_TABLES.table_myia_chats,
      (payload) => {
        if (payload.eventType === "UPDATE" && payload.new) {
          // Supondo que haja um campo 'is_typing' na tabela de chats
          if (payload.new.is_typing === true) {
            setTypingIndicator(
              payload.new.id,
              true,
              payload.new.contact?.name || "Contato"
            );
          } else if (payload.new.is_typing === false) {
            setTypingIndicator(
              payload.new.id,
              false,
              payload.new.contact?.name || "Contato"
            );
          }
        }
      }
    );

    return () => {
      // Limpar a subscrição ao desmontar
      realtimeService.unsubscribeFromTable(SUPA_TABLES.table_myia_chats);
    };
  }, []);

  return (
    <TypingContext.Provider
      value={{
        typingState,
        setTypingIndicator,
      }}
    >
      {children}
    </TypingContext.Provider>
  );
};
