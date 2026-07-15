import React, { useState, useRef, useContext } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { messageService } from '@/services/MessageService';
import { ChatsContext } from '@/contexts/Chats';
import { supabase } from '@/lib/supabase/config';
import SUPA_TABLES from '@/contexts/supa_tables';

export function MessageServiceTester() {
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selected_chat_windows } = useContext(ChatsContext);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const sendTextMessage = async () => {
    if (!selected_chat_windows || !message) return;
    
    try {
      setIsSending(true);
      
      const { data: data_chat, error: error_channel } = await supabase
        .from(SUPA_TABLES.table_myia_chats)
        .select(
          `
          id,
          company_id,
          channel:channel_id (nome, urlapi, token, instance_id),
          contact:contact_id (*)
        `
        )
        .match({ id: selected_chat_windows })
        .single();
      
      if (error_channel) throw error_channel;

      const result = await messageService.sendTextMessage(
        {
          chat_id: selected_chat_windows,
          company_id: data_chat?.company_id,
          channel_info: data_chat?.channel,
          contact_info: data_chat?.contact,
        },
        message
      );
      
      setResult(result);
      console.log('Resultado do envio:', result);
      
      if (result.success) {
        setMessage('');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setResult({ success: false, error });
    } finally {
      setIsSending(false);
    }
  };

  const sendMediaMessage = async () => {
    if (!selected_chat_windows || !selectedFile) return;
    
    try {
      setIsSending(true);
      
      const { data: data_chat, error: error_channel } = await supabase
        .from(SUPA_TABLES.table_myia_chats)
        .select(
          `
          id,
          company_id,
          channel:channel_id (nome, urlapi, token, instance_id),
          contact:contact_id (*)
        `
        )
        .match({ id: selected_chat_windows })
        .single();
      
      if (error_channel) throw error_channel;

      const fileType = selectedFile.type.startsWith('image/') 
        ? 'imageMessage' 
        : selectedFile.type.startsWith('audio/') 
          ? 'audioMessage' 
          : 'documentMessage';
      
      let result;
      
      if (fileType === 'imageMessage') {
        result = await messageService.sendImageMessage(
          {
            chat_id: selected_chat_windows,
            company_id: data_chat?.company_id,
            channel_info: data_chat?.channel,
            contact_info: data_chat?.contact,
          },
          selectedFile
        );
      } else if (fileType === 'audioMessage') {
        result = await messageService.sendAudioMessage(
          {
            chat_id: selected_chat_windows,
            company_id: data_chat?.company_id,
            channel_info: data_chat?.channel,
            contact_info: data_chat?.contact,
          },
          selectedFile
        );
      } else {
        throw new Error('Tipo de arquivo não suportado');
      }
      
      setResult(result);
      console.log('Resultado do envio:', result);
      
      if (result.success) {
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mídia:', error);
      setResult({ success: false, error });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto my-4">
      <CardHeader>
        <CardTitle>Teste do Message Service</CardTitle>
        <CardDescription>
          Envie mensagens diretamente usando o novo MessageService otimizado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!selected_chat_windows ? (
          <div className="p-4 bg-amber-100 text-amber-800 rounded-md">
            Selecione um chat primeiro para testar o envio de mensagens.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="message">Mensagem de Texto</Label>
              <Textarea
                id="message"
                placeholder="Digite sua mensagem aqui..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
              />
              <Button 
                onClick={sendTextMessage} 
                disabled={isSending || !message}
                className="w-full"
              >
                {isSending ? 'Enviando...' : 'Enviar Mensagem de Texto'}
              </Button>
            </div>
            
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="media">Arquivo de Mídia (Imagem ou Áudio)</Label>
              <Input
                ref={fileInputRef}
                id="media"
                type="file"
                onChange={handleFileChange}
                accept="image/*,audio/*"
              />
              <Button 
                onClick={sendMediaMessage} 
                disabled={isSending || !selectedFile}
                className="w-full"
              >
                {isSending ? 'Enviando...' : 'Enviar Mídia'}
              </Button>
            </div>
            
            {result && (
              <div className={`p-4 rounded-md ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                <h3 className="font-medium">Resultado:</h3>
                <pre className="text-xs mt-2 overflow-auto max-h-40">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-gray-500">Esta é uma ferramenta de teste para o novo serviço de mensagens diretas.</p>
      </CardFooter>
    </Card>
  );
}
