"use client"

import React, { useEffect, useState } from "react"
import useChannelsModel from "./model"
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Image,
  Divider,
  Spinner,
  Badge,
  Tooltip,
  Chip,
  Input,
  Select,
  SelectItem,
} from "@nextui-org/react"
import { Channel, EnumChannelStatus } from "@/contexts/Assistants/interfaces"
import { Plus, Trash2, RefreshCw, PhoneOff, Check, AlertCircle } from "lucide-react"
import { formatChannelName } from "@/utils/channelFormat"

export default function ChannelsView({
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
}: ReturnType<typeof useChannelsModel>) {
  const [showQRModal, setShowQRModal] = useState(false)
  const [currentChannelId, setCurrentChannelId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [channelToDelete, setChannelToDelete] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [channelName, setChannelName] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState("")
  const [apiType, setApiType] = useState<"Evolution" | "Waha" | undefined>(undefined)

  // Normaliza o status para exibição consistente quando a API for WAHA
  const getNormalizedStatus = (ch: Channel): EnumChannelStatus => {
    const apiStr = `${ch.apiUtilizada || ""} ${ch.tipoConexao || ""}`.toLowerCase()
    const isWaha = apiStr.includes("waha")
    const raw = (ch.status || "").toString().toUpperCase()

    // Primeiro: se o status bruto já é um conhecido da WAHA, mapeie independentemente do tipo detectado
    switch (raw) {
      case "WORKING":
        return EnumChannelStatus.OPEN
      case "STOPPED":
      case "FAILED":
        return EnumChannelStatus.CLOSE
      case "STARTING":
      case "SCAN_QR_CODE":
      case "QRCODE":
      case "QR_CODE":
        return EnumChannelStatus.CREATED
    }

    // Caso contrário, se não for WAHA ou status não conhecido, caia no padrão (Evolution)
    return (ch.status as EnumChannelStatus) || EnumChannelStatus.CLOSE
  }

  // formatChannelName importado de util compartilhado

  // Efeito para fechar o modal quando a conexão for bem-sucedida
  useEffect(() => {
    if (currentChannelId) {
      const currentChannel = channels.find((ch: Channel) => ch.id === currentChannelId);
      if (currentChannel && getNormalizedStatus(currentChannel) === EnumChannelStatus.OPEN) {
        setShowQRModal(false);
      }
    }
  }, [channels, currentChannelId]);

  const handleOpenQRModal = (channelId: string) => {
    setCurrentChannelId(channelId);
    setShowQRModal(true);
  };

  const handleGenerateQRForChannel = async () => {
    if (!currentChannelId) return
    await handleGenerateQRCode(currentChannelId)
  };

  const handleDeleteClick = (channelId: string) => {
    setChannelToDelete(channelId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (channelToDelete) {
      const success = await handleDeleteChannel(channelToDelete);
      if (success) {
        setShowDeleteConfirm(false);
        setChannelToDelete(null);
      }
    }
  };

  const openCreateModal = () => {
    setChannelName("")
    setApiType(undefined)
    setShowCreateModal(true)
  }

  const confirmCreateChannel = async () => {
    if (!channelName.trim()) {
      return
    }
    if (!apiType) {
      setCreateError("Selecione o tipo de API.")
      return
    }

    setIsCreating(true)
    setCreateError("")

    try {
      // Verificar se o assistente está carregado
      if (!assistant || !assistant.id) {
        throw new Error("Assistente não carregado. Por favor, recarregue a página.")
      }

      // Criar o canal com o nome fornecido
      const result = await handleCreateChannel(channelName, apiType)
      
      // Se o canal foi criado com sucesso e temos seu ID
      if (result && result.id) {
        // Abre automaticamente o modal de QR code para o canal recém-criado
        setCurrentChannelId(result.id);
        setShowQRModal(true);
      }
      // Fechar o modal de criação
      setShowCreateModal(false)
      setChannelName("")
      setApiType(undefined)
    } catch (error) {
      console.error("Erro ao criar canal:", error)
      setCreateError(error instanceof Error ? error.message : "Erro ao criar canal. Tente novamente.")
    } finally {
      setIsCreating(false)
    }
  };

  const getStatusBadge = (status: EnumChannelStatus | string) => {
    switch (status as EnumChannelStatus) {
      case EnumChannelStatus.OPEN:
        return (
          <Badge content={<Check size={14} />} color="success">
            <Chip color="success" variant="flat">Conectado</Chip>
          </Badge>
        );
      case EnumChannelStatus.CLOSE:
        return (
          <Badge content={<PhoneOff size={14} />} color="warning">
            <Chip color="warning" variant="flat">Desconectado</Chip>
          </Badge>
        );
      case EnumChannelStatus.CREATED:
        return (
          <Badge content={<AlertCircle size={14} />} color="primary">
            <Chip color="primary" variant="flat">Aguardando Conexão</Chip>
          </Badge>
        );
      default:
        return (
          <Chip color="default" variant="flat">{status}</Chip>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Canais de Comunicação</h2>
        <Button 
          color="primary" 
          startContent={<Plus size={18} />}
          onPress={openCreateModal}
        >
          Adicionar Canal
        </Button>
      </div>

      {channels.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg border-gray-300 bg-gray-50">
          <Image
            alt="WhatsApp"
            src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/640px-WhatsApp.svg.png"
            width={80}
          />
          <p className="mt-4 text-gray-600">Nenhum canal configurado</p>
          <Button 
            color="primary" 
            className="mt-4"
            startContent={<Plus size={18} />}
            onPress={openCreateModal}
          >
            Adicionar Canal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channels.map((channel) => {
            const normalized = getNormalizedStatus(channel)
            return (
            <Card key={channel.id} className="border border-gray-200">
              <CardHeader className="flex justify-between items-center px-4 py-3 bg-gray-50">
                <div className="flex items-center gap-2">
                  <Image
                    alt="WhatsApp"
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/640px-WhatsApp.svg.png"
                    width={24}
                  />
                  <span className="font-medium">{formatChannelName(channel.nome)}</span>
                </div>
                {getStatusBadge(normalized)}
              </CardHeader>
              <Divider />
              <CardBody className="px-4 py-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo:</span>
                    <span className="font-medium">{channel.tipoConexao || "WhatsApp"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">API:</span>
                    <span className="font-medium">{channel.apiUtilizada || "-"}</span>
                  </div>
                  {channel.remoteJid && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Número:</span>
                      <span className="font-medium">{channel.remoteJid}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Última atualização:</span>
                    <span className="font-medium">
                      {channel.ultimaAtualizacao 
                        ? new Date(channel.ultimaAtualizacao).toLocaleString() 
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </CardBody>
              <Divider />
              <CardFooter className="px-4 py-3 flex justify-between">
                {normalized === EnumChannelStatus.CREATED && (
                  <Button 
                    color="primary" 
                    variant="flat"
                    onPress={() => handleOpenQRModal(channel.id)}
                  >
                    Gerar QR Code
                  </Button>
                )}
                {normalized === EnumChannelStatus.CLOSE && (
                  <Button 
                    color="primary" 
                    variant="flat"
                    onPress={() => handleOpenQRModal(channel.id)}
                  >
                    {(!channel.numeroTel && !channel.qrcode64) ? "Gerar QR Code" : "Reconectar"}
                  </Button>
                )}
                {normalized === EnumChannelStatus.OPEN && (
                  <Button 
                    color="warning" 
                    variant="flat"
                    onPress={() => handleRemoveConnection(channel.id)}
                  >
                    Desconectar
                  </Button>
                )}
                <Tooltip content="Excluir canal">
                  <Button 
                    isIconOnly 
                    color="danger" 
                    variant="light"
                    onPress={() => handleDeleteClick(channel.id)}
                  >
                    <Trash2 size={18} />
                  </Button>
                </Tooltip>
              </CardFooter>
            </Card>
            )
          })}
        </div>
      )}

      {/* Modal para criação de canal */}
      <Modal isOpen={showCreateModal} onOpenChange={() => setShowCreateModal(false)} size="md">
        <ModalContent>
          {(onClose) => (
            <React.Fragment>
              <ModalHeader className="flex flex-col gap-1">
                Criar Novo Canal
              </ModalHeader>
              <ModalBody>
                <p className="text-gray-600 mb-4">
                  Um novo canal de WhatsApp será criado para este assistente. Após a criação, você poderá conectar seu dispositivo através do QR Code.
                </p>
                <div className="flex justify-center">
                  <Image
                    alt="WhatsApp"
                    src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/640px-WhatsApp.svg.png"
                    width={60}
                    className="mb-4"
                  />
                </div>
                <Input
                  label="Nome do Canal"
                  placeholder="Digite um nome para o canal"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  isRequired
                  description="Este nome será usado para identificar o canal no sistema e API."
                  variant="bordered"
                  className="mb-2"
                  isDisabled={isCreating}
                />
                <Select
                  label="Tipo de API"
                  placeholder="Selecione o tipo de API"
                  selectedKeys={apiType ? [apiType] : []}
                  onSelectionChange={(keys) => {
                    const first = Array.from(keys)[0] as "Evolution" | "Waha" | undefined
                    setApiType(first)
                    if (createError) setCreateError("")
                  }}
                  variant="bordered"
                  className="mb-2"
                  isDisabled={isCreating}
                  isRequired
                >
                  <SelectItem key="Evolution" value="Evolution">
                    Evolution
                  </SelectItem>
                  <SelectItem key="Waha" value="Waha">
                    Waha
                  </SelectItem>
                </Select>
                {createError && (
                  <div className="text-danger text-sm mt-2">
                    {createError}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose} isDisabled={isCreating}>
                  Cancelar
                </Button>
                <Button 
                  color="primary" 
                  onPress={confirmCreateChannel}
                  isDisabled={!channelName.trim() || !apiType || isCreating}
                  isLoading={isCreating}
                >
                  Criar Canal
                </Button>
              </ModalFooter>
            </React.Fragment>
          )}
        </ModalContent>
      </Modal>

      {/* Modal para exibir QR Code */}
      <Modal isOpen={showQRModal} onOpenChange={() => setShowQRModal(false)} size="lg">
        <ModalContent>
          {(onClose) => {
            const currentChannel = currentChannelId ? channels.find((ch: Channel) => ch.id === currentChannelId) : null;
            return (
              <React.Fragment>
                <ModalHeader className="flex flex-col gap-1">
                  Conectar WhatsApp
                </ModalHeader>
                <ModalBody>
                  <div className="border border-gray-300 rounded-md p-4">
                    {currentChannel?.qrcode64 ? (
                      <div className="flex flex-col items-center">
                        <div className="mb-4 text-center">
                          <p className="text-gray-600">Escaneie o QR Code com seu WhatsApp</p>
                          <p className="text-sm text-gray-500 mt-1">Abra o WhatsApp no seu telefone &gt; Menu &gt; WhatsApp Web</p>
                        </div>
                        <div
                          style={{
                            height: "auto",
                            margin: "0 auto",
                            maxWidth: 250,
                            width: "100%",
                          }}
                        >
                          <img
                            src={currentChannel.qrcode64}
                            alt="QR Code"
                            style={{
                              height: "auto",
                              maxWidth: "100%",
                              width: "100%",
                            }}
                            onError={(e) => {
                              console.error("Erro ao carregar imagem do QR code:", currentChannel.qrcode64);
                              e.currentTarget.onerror = null; // prevenir loops infinitos
                              e.currentTarget.src = "https://via.placeholder.com/250x250?text=QR+Code+Erro";
                            }}
                          />
                          <p className="text-xs text-gray-400 mt-2 text-center">ID do Canal: {currentChannel.id}</p>
                        </div>
                      </div>
                    ) : isPollingQRCode ? (
                      <div className="flex flex-col items-center py-8">
                        <div className="mb-4 text-center">
                          <p className="text-gray-600">Gerando QR Code...</p>
                          <p className="text-sm text-gray-500 mt-1">Isso pode levar alguns segundos</p>
                        </div>
                        <div
                          style={{
                            height: "auto",
                            margin: "0 auto",
                            maxWidth: 250,
                            width: "100%",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            border: "1px dashed #ccc",
                            borderRadius: "8px",
                            padding: "20px",
                            backgroundColor: "#f9f9f9"
                          }}
                        >
                          <div className="flex flex-col items-center">
                            <Spinner size="lg" color="primary" className="mb-4" />
                            <p className="text-sm text-gray-500">Aguardando QR Code</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center py-8">
                        <Button 
                          color="primary"
                          startContent={<RefreshCw size={18} />}
                          onPress={handleGenerateQRForChannel}
                          size="lg"
                        >
                          Gerar QR Code
                        </Button>
                      </div>
                    )}

                    {currentChannel?.status === EnumChannelStatus.OPEN && (
                      <div className="mt-4 text-center">
                        <Chip color="success" variant="flat" size="lg">
                          Dispositivo conectado com sucesso!
                        </Chip>
                      </div>
                    )}
                  </div>
                </ModalBody>
                <ModalFooter>
                  {currentChannel?.qrcode64 && currentChannel?.status !== EnumChannelStatus.OPEN && (
                    <Button 
                      color="primary" 
                      variant="light"
                      startContent={<RefreshCw size={18} />}
                      onPress={handleGenerateQRForChannel}
                      isDisabled={isPollingQRCode}
                    >
                      Atualizar QR Code
                    </Button>
                  )}
                  <Button 
                    color="danger" 
                    variant="light" 
                    onPress={onClose}
                    isDisabled={isPollingQRCode && !currentChannel?.qrcode64}
                  >
                    Fechar
                  </Button>
                </ModalFooter>
              </React.Fragment>
            );
          }}
        </ModalContent>
      </Modal>

      {/* Modal de confirmação de exclusão */}
      <Modal isOpen={showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(false)} size="sm">
        <ModalContent>
          {(onClose) => (
            <React.Fragment>
              <ModalHeader className="flex flex-col gap-1">
                Confirmar Exclusão
              </ModalHeader>
              <ModalBody>
                <p>Tem certeza que deseja excluir este canal? Esta ação não pode ser desfeita.</p>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button 
                  color="danger" 
                  onPress={confirmDelete}
                >
                  Excluir
                </Button>
              </ModalFooter>
            </React.Fragment>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
