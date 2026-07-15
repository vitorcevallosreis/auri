import React from "react"
import useDevicesModel from "./model"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { Card, CardHeader, CardBody, CardFooter, Button, Spinner, Chip, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@nextui-org/react"
import { Phone, Plus, Smartphone, Wifi, WifiOff, MessageSquare, Trash2 } from "lucide-react"
import Image from "next/image"
import { formatChannelName } from "@/utils/channelFormat"

export default function DevicesView({
  channels,
  isLoading,
  error,
  openAddChannelModal,
  isAddChannelModalOpen,
  closeAddChannelModal
}: ReturnType<typeof useDevicesModel>) {
  // Helper function to render status chip
  const renderStatusChip = (status: string) => {
    switch (status) {
      case "open":
        return <Chip color="success" startContent={<Wifi size={16} />}>Conectado</Chip>
      case "close":
        return <Chip color="danger" startContent={<WifiOff size={16} />}>Desconectado</Chip>
      case "created":
        return <Chip color="warning" startContent={<Smartphone size={16} />}>Aguardando</Chip>
      default:
        return <Chip color="default">{status}</Chip>
    }
  }

  // formatChannelName importado de util compartilhado

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Canais de Comunicação</h1>
          <Button 
            color="primary" 
            startContent={<Plus size={18} />}
            onPress={openAddChannelModal}
          >
            Adicionar Canal
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <Spinner size="lg" label="Carregando canais..." />
          </div>
        ) : error ? (
          <div className="p-6 text-center bg-danger-50 rounded-lg">
            <p className="text-danger font-medium">{error}</p>
            <Button className="mt-4" color="primary" onPress={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-12 h-64">
            <Image
              alt="WhatsApp"
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/WhatsApp.svg/640px-WhatsApp.svg.png"
              width={80}
              height={80}
            />
            <p className="mt-4 text-gray-600">Nenhum canal vinculado à empresa</p>
            <Button 
              color="primary" 
              className="mt-4"
              startContent={<Plus size={18} />}
              onPress={openAddChannelModal}
            >
              Adicionar Canal
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {channels.map((channel) => (
              <Card key={channel.id} className="shadow-md">
                <CardHeader className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Smartphone className="text-primary" />
                    <div>
                      <h3 className="text-lg font-semibold">{formatChannelName(channel.nome)}</h3>
                      <p className="text-sm text-gray-500">{channel.tipoConexao || "WhatsApp"}</p>
                    </div>
                  </div>
                  {renderStatusChip(channel.status)}
                </CardHeader>
                <CardBody className="py-2">
                  <div className="space-y-2">
                    {channel.numeroTel && (
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-gray-500" />
                        <span>{channel.numeroTel}</span>
                      </div>
                    )}
                    {channel.titular && (
                      <div className="flex items-center gap-2">
                        <MessageSquare size={16} className="text-gray-500" />
                        <span>Titular: {channel.titular}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Wifi size={16} className="text-gray-500" />
                      <span>Última atualização: {channel.ultimaAtualizacao || "N/A"}</span>
                    </div>
                  </div>
                </CardBody>
                <CardFooter className="flex justify-between">
                  <Button color="primary" size="sm" variant="flat">
                    Detalhes
                  </Button>
                  <Button color="danger" size="sm" variant="light" startContent={<Trash2 size={16} />}>
                    Remover
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modal para adicionar novo canal */}
      <Modal isOpen={isAddChannelModalOpen} onClose={closeAddChannelModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Adicionar Novo Canal</ModalHeader>
              <ModalBody>
                <p>Funcionalidade em desenvolvimento.</p>
                <p className="text-sm text-gray-500">Esta funcionalidade será implementada em breve.</p>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancelar
                </Button>
                <Button color="primary" onPress={onClose}>
                  Adicionar
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </DashboardLayout>
  )
}
