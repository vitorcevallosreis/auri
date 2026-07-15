"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TypingIndicatorProps {
  isTyping: boolean;
  contactName: string;
}

/**
 * Componente que exibe o indicador de digitação no estilo WhatsApp
 * Mostra "Nome está digitando..." com animação de pontos
 */
export const TypingIndicator = ({ isTyping, contactName }: TypingIndicatorProps) => {
  const [dots, setDots] = useState("");
  
  // Efeito para animar os pontos
  useEffect(() => {
    if (!isTyping) return;
    
    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return "";
        return prev + ".";
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [isTyping]);
  
  return (
    <AnimatePresence>
      {isTyping && (
        <motion.div
          className="px-4 py-2 text-sm text-gray-500 italic" 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <span className="flex items-center">
            <span className="font-medium mr-1">{contactName}</span>
            <span>está digitando{dots}</span>
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TypingIndicator;
