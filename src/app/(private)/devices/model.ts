import { useState, useEffect, useContext } from 'react'
import { supabase } from '@/lib/supabase/config'
import { AuthContext } from '@/contexts/Auth'
import { Channel } from '@/contexts/Assistants/interfaces'
import { Button } from '@nextui-org/react'
import SUPA_TABLES from '@/contexts/supa_tables'

export interface IDevicesModel {
  channels: Channel[]
  isLoading: boolean
  error: string | null
  openAddChannelModal: () => void
  isAddChannelModalOpen: boolean
  closeAddChannelModal: () => void
}

const useDevicesModel = (): IDevicesModel => {
  const [channels, setChannels] = useState<Channel[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddChannelModalOpen, setIsAddChannelModalOpen] = useState(false)
  const { user } = useContext(AuthContext)

  const fetchChannels = async () => {
    if (!user?.company_id) {
      setError('Usuário não possui uma empresa vinculada')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_myia_channels)
        .select('*')
        .eq('titular', user.company_id)

      if (error) {
        throw error
      }

      setChannels(data || [])
    } catch (error: any) {
      console.error('Erro ao buscar canais:', error)
      setError(error.message || 'Erro ao buscar canais')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchChannels()
  }, [user?.company_id])

  const openAddChannelModal = () => {
    setIsAddChannelModalOpen(true)
  }

  const closeAddChannelModal = () => {
    setIsAddChannelModalOpen(false)
  }

  return {
    channels,
    isLoading,
    error,
    openAddChannelModal,
    isAddChannelModalOpen,
    closeAddChannelModal
  }
}

export default useDevicesModel
