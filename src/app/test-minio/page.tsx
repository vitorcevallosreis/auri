'use client';

import { useState, useRef } from 'react';
import { MinioService } from '@/services/MinioService';
import { messageService } from '@/services/MessageService';

export default function TestMinioPage() {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [apiTestResult, setApiTestResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para testar a conexão com o Minio
  const testMinioConnection = async () => {
    setLoading(true);
    setError(null);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/test-minio');
      const data = await response.json();
      
      setTestResult(data);
      
      if (!data.success) {
        setError(data.message || 'Erro ao testar conexão com o Minio');
      }
    } catch (error) {
      console.error('Erro ao testar conexão:', error);
      setError('Erro ao testar conexão com o Minio');
    } finally {
      setLoading(false);
    }
  };

  // Função para fazer upload de áudio
  const handleUpload = async () => {
    if (!fileInputRef.current?.files?.length) {
      setError('Selecione um arquivo de áudio');
      return;
    }
    
    const audioFile = fileInputRef.current.files[0];
    
    setLoading(true);
    setError(null);
    setAudioUrl(null);
    
    try {
      // Usar o serviço MinioService para fazer upload
      const url = await MinioService.uploadAudio(audioFile);
      setAudioUrl(url);
      
      // Verificar se a URL é do Minio
      const isMinioUrl = MinioService.isMinioUrl(url);
      console.log('É URL do Minio?', isMinioUrl);
      
    } catch (error) {
      console.error('Erro ao fazer upload:', error);
      setError('Erro ao fazer upload do áudio');
    } finally {
      setLoading(false);
    }
  };

  // Função para testar o envio de áudio para a API externa
  const testSendToApi = async () => {
    if (!audioUrl) {
      setError('Faça o upload do áudio primeiro');
      return;
    }

    setLoading(true);
    setError(null);
    setApiTestResult(null);

    try {
      // Dados de teste para simular um chat
      const testChatData = {
        chat_id: 'test-chat-id',
        company_id: 'test-company-id',
        channel_info: {
          nome: process.env.NEXT_PUBLIC_CHANNEL_NAME || 'myia',
          urlapi: process.env.NEXT_PUBLIC_CHANNEL_API || 'https://evo2.techtopus.dev',
          token: process.env.NEXT_PUBLIC_CHANNEL_TOKEN || 'seu-token-aqui',
          instance_id: 'test-instance'
        },
        contact_info: {
          remote_jid: process.env.NEXT_PUBLIC_TEST_PHONE || '5511999999999@s.whatsapp.net',
          number: process.env.NEXT_PUBLIC_TEST_PHONE || '5511999999999'
        }
      };

      // Usar o serviço MessageService para enviar o áudio
      if (!fileInputRef.current?.files?.length) {
        setError('Selecione um arquivo de áudio');
        return;
      }
      
      const audioFile = fileInputRef.current.files[0];
      const result = await messageService.sendAudioMessage(testChatData, audioUrl, audioFile);
      
      setApiTestResult(result);
      
      if (!result.success) {
        setError(result.error || 'Erro ao enviar áudio para API');
      }
    } catch (error) {
      console.error('Erro ao testar envio para API:', error);
      setApiTestResult({ success: false, error: error.message });
      setError('Erro ao enviar áudio para API');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Teste de Upload para Minio S3</h1>
      
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Testar Conexão</h2>
        <button 
          onClick={testMinioConnection}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testando...' : 'Testar Conexão com Minio'}
        </button>
        
        {testResult && (
          <div className="mt-4 p-4 bg-muted rounded">
            <h3 className="font-semibold">{testResult.success ? 'Conexão bem-sucedida' : 'Falha na conexão'}</h3>
            <p>{testResult.message}</p>
            {testResult.buckets && (
              <div className="mt-2">
                <p className="font-semibold">Buckets disponíveis:</p>
                <ul className="list-disc pl-5">
                  {testResult.buckets.map((bucket: string) => (
                    <li key={bucket}>{bucket}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      
      <div className="p-4 border rounded-lg mb-8">
        <h2 className="text-xl font-semibold mb-4">Upload de Áudio</h2>
        
        <div className="mb-4">
          <label className="block mb-2">Selecione um arquivo de áudio:</label>
          <input 
            type="file" 
            ref={fileInputRef}
            accept="audio/*"
            className="border p-2 w-full"
          />
        </div>
        
        <button 
          onClick={handleUpload}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Fazer Upload'}
        </button>
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}
        
        {audioUrl && (
          <div className="mt-4">
            <h3 className="font-semibold mb-2">Áudio enviado com sucesso:</h3>
            <div className="p-3 bg-muted rounded break-all">
              <p className="mb-2">URL: {audioUrl}</p>
              <audio controls src={audioUrl} className="w-full mt-2" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Testar Envio para API</h2>
        
        <button 
          onClick={testSendToApi}
          disabled={loading || !audioUrl}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Enviar para API'}
        </button>
        
        <p className="text-sm text-muted-foreground mt-2">
          Primeiro faça o upload do áudio acima, depois teste o envio para a API.
        </p>
        
        {apiTestResult && (
          <div className="mt-4 p-4 bg-muted rounded">
            <h3 className="font-semibold">{apiTestResult.success ? 'Envio bem-sucedido' : 'Falha no envio'}</h3>
            {apiTestResult.success ? (
              <div>
                <p>ID temporário: {apiTestResult.temporaryId}</p>
                <p>ID da mensagem: {apiTestResult.messageId}</p>
              </div>
            ) : (
              <p className="text-red-600">{apiTestResult.error}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
