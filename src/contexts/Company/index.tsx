import React, { createContext, useContext, useState, useEffect } from "react"
import {
  BodyCompanyAddress,
  BodyUpdateCompany,
  CompanyContextType,
  CompanyProviderProps,
  BodyCompanyAgreement,
  BodyCompanyPaymentMethod,
  BodyCompanyPolicy,
  BodyCompanySpecialty
} from "./interfaces"
import { supabase } from "@/lib/supabase/config"
import SUPA_TABLES from "../supa_tables"
import { toast } from "sonner"
import { Default } from "./defaults"

import { check_ff_address_exists } from "./functions"
import { AuthContext } from "../Auth"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export const CompanyContext = createContext({} as CompanyContextType)

// Utility function for retrying API calls with exponential backoff
const retryWithBackoff = async (
  fn: () => Promise<any>, 
  maxRetries = 3,
  onError: (error: any) => void
) => {
  let retries = 0;
  
  const execute = async (): Promise<any> => {
    try {
      return await fn();
    } catch (error) {
      if (retries < maxRetries) {
        retries++;
        // Exponential backoff: 1s, 2s, 4s...
        const delay = 1000 * Math.pow(2, retries - 1);
        
        return new Promise(resolve => {
          setTimeout(() => resolve(execute()), delay);
        });
      }
      
      // If we've exhausted our retries, handle the error
      onError(error);
      throw error;
    }
  };
  
  return execute();
};

export function CompanyProvider({ children }: CompanyProviderProps) {
  const { user } = useContext(AuthContext)
  const queryClient = useQueryClient()
  
  // Estados locais para manter compatibilidade com o código existente
  const [isLoading, setIsLoading] = useState(false) // Adicionado novamente para compatibilidade
  const [company, set_company] = useState(Default.company)
  const [company_address, set_company_address] = useState(
    Default.company_address
  )
  const [companyAgreements, setCompanyAgreements] = useState(Default.companyAgreements)
  const [companyPaymentMethods, setCompanyPaymentMethods] = useState(Default.companyPaymentMethods)
  const [companyPolicies, setCompanyPolicies] = useState(Default.companyPolicies)
  const [companySpecialties, setCompanySpecialties] = useState(Default.companySpecialties)
  
  // Variáveis para controlar o debounce e evitar loops infinitos
  const [lastPolicyUpdate, setLastPolicyUpdate] = useState(0)
  const [lastPaymentMethodUpdate, setLastPaymentMethodUpdate] = useState(0)
  const debounceTime = 2000 // 2 segundos
  
  // Flag to track if data has been loaded already to prevent redundant fetches
  const [dataLoaded, setDataLoaded] = useState({
    agreements: false,
    paymentMethods: false,
    policies: false,
    specialties: false
  })
  
  // Armazenar o company_id atual para evitar carregamentos redundantes
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null)

  // Handling company data with react-query
  const companyQuery = useQuery({
    queryKey: ['company', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) throw new Error('No company ID')
      
      // DESENVOLVIMENTO: Retornar dados mock se estivermos em desenvolvimento
      if (process.env.NODE_ENV === 'development' && user.company_id === 'dev-company-id') {
        return {
          id: 'dev-company-id',
          name: 'Clínica Nexa - Desenvolvimento',
          description: 'Clínica de desenvolvimento para testes',
          site_url: 'https://clinica-nexa.com.br',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
      
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_companies)
        .select()
        .match({ id: user.company_id })
        .single()
        
      if (error) throw error
      return data
    },
    enabled: !!user?.company_id && user.company_id !== '',
    staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: process.env.NODE_ENV === 'development' ? 0 : 3, // No retry in development
  })

  // Efeito para processar os resultados da query
  useEffect(() => {
    if (companyQuery.isSuccess && companyQuery.data) {
      set_company(companyQuery.data)
      // Atualizar o company_id atual quando os dados forem carregados com sucesso
      if (companyQuery.data.id && companyQuery.data.id !== currentCompanyId) {
        setCurrentCompanyId(companyQuery.data.id)
      }
    } else if (companyQuery.isError) {
      set_company(Default.company)
      console.log(companyQuery.error)
      // Em desenvolvimento, não exibir toast de erro
      if (process.env.NODE_ENV !== 'development') {
        toast.error("Erro ao buscar Empresa!", {
          duration: 3000,
          description: "Erro ao buscar Empresa!",
          closeButton: true,
        })
      }
    }
  }, [companyQuery.data, companyQuery.isSuccess, companyQuery.isError, currentCompanyId])

  // Efeito para escutar eventos de autenticação e carregar dados da empresa
  useEffect(() => {
    // Função para carregar dados da empresa
    const loadCompanyData = async (companyId: string) => {
      if (!companyId) return
      
      // Verificar se já está carregando os dados da mesma empresa
      if (companyId === currentCompanyId && company?.id === companyId) return
      
      try {
        // Invalidar queries existentes
        await queryClient.invalidateQueries({ queryKey: ['company', companyId] })
        
        // Carregar dados da empresa
        await getCompany()
        
        // Carregar dados relacionados
        await getCompanyAddress()
        
        // Carregar outros dados relacionados se necessário
        if (!dataLoaded.agreements) await getCompanyAgreements()
        if (!dataLoaded.paymentMethods) await getCompanyPaymentMethods()
        if (!dataLoaded.policies) await getCompanyPolicies()
        if (!dataLoaded.specialties) await getCompanySpecialties()
      } catch (error) {
        console.error("Erro ao carregar dados da empresa:", error)
      }
    }
    
    // Listener para evento de login
    const handleLogin = (event: CustomEvent<{company_id: string}>) => {
      const { company_id } = event.detail
      if (company_id) {
        loadCompanyData(company_id)
      }
    }
    
    // Listener para evento de logout
    const handleLogout = () => {
      // Limpar dados da empresa ao fazer logout
      set_company(Default.company)
      set_company_address(Default.company_address)
      setCompanyAgreements(Default.companyAgreements)
      setCompanyPaymentMethods(Default.companyPaymentMethods)
      setCompanyPolicies(Default.companyPolicies)
      setCompanySpecialties(Default.companySpecialties)
      setCurrentCompanyId(null)
      
      // Resetar flags de dados carregados
      setDataLoaded({
        agreements: false,
        paymentMethods: false,
        policies: false,
        specialties: false
      })
    }
    
    // Registrar listeners de eventos
    if (typeof window !== "undefined") {
      window.addEventListener('myia:auth:login', handleLogin as EventListener)
      window.addEventListener('myia:auth:logout', handleLogout as EventListener)
    }
    
    // Carregar dados iniciais se já estiver autenticado
    if (user?.company_id && (!company?.id || company.id !== user.company_id)) {
      loadCompanyData(user.company_id)
    }
    
    // Cleanup
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener('myia:auth:login', handleLogin as EventListener)
        window.removeEventListener('myia:auth:logout', handleLogout as EventListener)
      }
    }
  }, [user?.company_id])

  // Função antiga mantida para compatibilidade, mas modificada para garantir que os dados sejam carregados
  async function getCompany(): Promise<void> {
    if (!user?.company_id) return
    
    setIsLoading(true)
    try {
      // Força um refetch dos dados
      await queryClient.invalidateQueries({ queryKey: ['company', user.company_id] })
      
      // Executamos a query manualmente para garantir que os dados sejam carregados
      const result = await companyQuery.refetch()
      
      // Atualiza o estado local se houver dados
      if (result.data) {
        set_company(result.data)
      }
    } catch (error) {
      console.error("Erro ao buscar empresa:", error)
      // Em desenvolvimento, não exibir toast de erro
      if (process.env.NODE_ENV !== 'development') {
        toast.error("Erro ao buscar Empresa!", {
          duration: 3000,
          description: "Erro ao buscar Empresa!",
          closeButton: true,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Handling company address data with react-query
  const companyAddressQuery = useQuery({
    queryKey: ['companyAddress', user?.company_id],
    queryFn: async () => {
      if (!user?.company_id) throw new Error('No company ID')
      
      // DESENVOLVIMENTO: Retornar dados mock se estivermos em desenvolvimento
      if (process.env.NODE_ENV === 'development' && user.company_id === 'dev-company-id') {
        return {
          id: 'dev-address-id',
          company_id: 'dev-company-id',
          zip_code: '01310-100',
          street: 'Av. Paulista',
          number: '1000',
          complement: 'Sala 101',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'São Paulo',
          state_code: 'SP',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      }
      
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_company_addresses)
        .select()
        .eq('company_id', user.company_id)
        .single()
        
      if (error) {
        if (error.code === 'PGRST116') {
          // No address found, return null
          return null
        }
        throw error
      }
      return data
    },
    enabled: !!user?.company_id && user.company_id !== '',
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: process.env.NODE_ENV === 'development' ? 0 : 3,
  })

  // Efeito para processar os resultados da query de endereço
  useEffect(() => {
    if (companyAddressQuery.isSuccess && companyAddressQuery.data) {
      set_company_address(companyAddressQuery.data)
    } else if (companyAddressQuery.isError) {
      set_company_address(Default.company_address)
      console.log(companyAddressQuery.error)
      // Em desenvolvimento, não exibir toast de erro
      if (process.env.NODE_ENV !== 'development') {
        toast.error("Erro ao buscar Endereço Empresa!", {
          duration: 3000,
          description: "Erro ao buscar Endereço Empresa!",
          closeButton: true,
        })
      }
    }
  }, [companyAddressQuery.data, companyAddressQuery.isSuccess, companyAddressQuery.isError])

  // Função antiga mantida para compatibilidade, mas modificada para garantir que os dados sejam carregados
  async function getCompanyAddress(): Promise<void> {
    if (!user?.company_id) return
    
    setIsLoading(true)
    try {
      // Força um refetch
      await queryClient.invalidateQueries({ queryKey: ['companyAddress', user.company_id] })
      
      // Executamos a query manualmente para garantir que os dados sejam carregados
      const result = await companyAddressQuery.refetch()
      
      // Atualiza o estado local se houver dados
      if (result.data) {
        set_company_address(result.data)
      }
    } catch (error) {
      console.error("Erro ao buscar endereço da empresa:", error)
      // Em desenvolvimento, não exibir toast de erro
      if (process.env.NODE_ENV !== 'development') {
        toast.error("Erro ao buscar Endereço Empresa!", {
          duration: 3000,
          description: "Erro ao buscar Endereço Empresa!",
          closeButton: true,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Mutation para atualizar empresa
  const updateCompanyMutation = useMutation({
    mutationFn: async (body: BodyUpdateCompany) => {
      if (!user?.company_id) throw new Error("ID da empresa não encontrado")
      
      const { data, error } = await supabase
        .from(SUPA_TABLES.table_companies)
        .update(body)
        .eq("id", user?.company_id)
        .select()
        .single()
        
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      set_company(data)
      // Atualiza o cache do React Query
      queryClient.setQueryData(['company', user?.company_id], data)
      
      toast.success("Informações da Empresa Atualizadas com sucesso!", {
        duration: 1000,
      })
    },
    onError: (error) => {
      console.log(error)
      toast.error("Erro ao atualizar Empresa!", {
        duration: 3000,
        description: "Erro ao atualizar Empresa!",
        closeButton: true,
      })
    }
  })
  
  // Função antiga mantida para compatibilidade
  async function updateCompany(body: BodyUpdateCompany): Promise<void> {
    if (!user?.company_id) return
    await updateCompanyMutation.mutateAsync(body)
  }

  async function updateCompanyAddress(
    company_id: string,
    body: BodyCompanyAddress
  ): Promise<void> {
    if (!company_id) {
      toast.error("ID da empresa não encontrado!")
      return
    }

    setIsLoading(true)

    try {
      const exists_address = await check_ff_address_exists(company_id)

      let data, error

      if (exists_address) {
        const { data: updatedData, error: updateError } = await supabase
          .from(SUPA_TABLES.table_company_addresses)
          .update(body)
          .eq("company_id", company_id)
          .select()
          .single()

        data = updatedData
        error = updateError
      } else {
        const { data: insertedData, error: insertError } = await supabase
          .from(SUPA_TABLES.table_company_addresses)
          .insert({ company_id, ...body })
          .select()
          .single()

        data = insertedData
        error = insertError
      }

      if (error) throw error

      set_company_address(data)

      toast.success(
        exists_address
          ? "Informações de Endereço da Empresa Atualizadas com sucesso!"
          : "Endereço da Empresa Adicionado com sucesso!",
        { duration: 900 }
      )
    } catch (error) {
      set_company_address(Default.company_address)

      toast.error("Erro ao Atualizar Endereço da Empresa!", {
        duration: 3000,
        description: "Erro ao buscar Empresa!",
        closeButton: true,
      })

      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Company Agreements
  async function getCompanyAgreements(forceReload = false): Promise<void> {
    if (!user?.company_id || (!forceReload && dataLoaded.agreements)) return

    setIsLoading(true)
    
    try {
      // Check if in development mode - use mock data
      if (process.env.NODE_ENV === 'development') {
        // Mock agreements data for development
        const mockAgreements = [
          {
            id: '1',
            company_id: user.company_id,
            name: 'Unimed',
            description: 'Convênio médico Unimed',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '2',
            company_id: user.company_id,
            name: 'Bradesco Saúde',
            description: 'Plano de saúde Bradesco',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '3',
            company_id: user.company_id,
            name: 'SulAmérica',
            description: 'Seguro saúde SulAmérica',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
        
        setCompanyAgreements(mockAgreements)
        setDataLoaded(prev => ({ ...prev, agreements: true }))
        return
      }
      
      // Safety timeout to reset loading state after 10 seconds if something goes wrong
      const safetyTimeout = setTimeout(() => {
        setIsLoading(false);
      }, 10000);
      
      await retryWithBackoff(
        async () => {
          const { data, error } = await supabase
            .from(SUPA_TABLES.table_company_agreements)
            .select()
            .match({ company_id: user.company_id })
            .order('name', { ascending: true })
  
          if (error) throw error
          setCompanyAgreements(data || [])
          // Mark as loaded to prevent redundant fetches
          setDataLoaded(prev => ({ ...prev, agreements: true }))
        },
        3, // Max 3 retries
        (error) => {
          setCompanyAgreements([])
          // Suppress error toast in development
          if (process.env.NODE_ENV !== 'development') {
            toast.error("Erro ao buscar convênios!", {
              duration: 3000,
              closeButton: true,
            })
          }
          console.log(error)
        }
      );
      
      clearTimeout(safetyTimeout);
    } finally {
      setIsLoading(false)
    }
  }

  async function createCompanyAgreement(body: BodyCompanyAgreement): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)
    
    // Safety timeout to reset loading state after 10 seconds if something goes wrong
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);
    
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_company_agreements)
        .insert({
          company_id: user.company_id,
          ...body
        })

      if (error) throw error
      // Reset data loaded flag to force refresh
      setDataLoaded(prev => ({ ...prev, agreements: false }))
      toast.success("Convênio adicionado com sucesso!", { duration: 1000 })
    } catch (error) {
      toast.error("Erro ao adicionar convênio!", {
        duration: 3000,
        closeButton: true,
      })
      console.log(error)
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false)
    }
  }

  async function updateCompanyAgreement(id: string, body: BodyCompanyAgreement): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)
    
    // Safety timeout to reset loading state after 10 seconds if something goes wrong
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);
    
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_company_agreements)
        .update(body)
        .match({ id, company_id: user.company_id })

      if (error) throw error
      // Reset data loaded flag to force refresh
      setDataLoaded(prev => ({ ...prev, agreements: false }))
      toast.success("Convênio atualizado com sucesso!", { duration: 1000 })
    } catch (error) {
      toast.error("Erro ao atualizar convênio!", {
        duration: 3000,
        closeButton: true,
      })
      console.log(error)
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false)
    }
  }

  async function deleteCompanyAgreement(id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)
    
    // Safety timeout to reset loading state after 10 seconds if something goes wrong
    const safetyTimeout = setTimeout(() => {
      setIsLoading(false);
    }, 10000);
    
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_company_agreements)
        .delete()
        .match({ id, company_id: user.company_id })

      if (error) throw error
      // Reset data loaded flag to force refresh
      setDataLoaded(prev => ({ ...prev, agreements: false }))
      toast.success("Convênio removido com sucesso!", { duration: 1000 })
    } catch (error) {
      toast.error("Erro ao remover convênio!", {
        duration: 3000,
        closeButton: true,
      })
      console.log(error)
    } finally {
      clearTimeout(safetyTimeout);
      setIsLoading(false)
    }
  }

  // Company Payment Methods
  async function getCompanyPaymentMethods(forceReload = false): Promise<void> {
    if (!user?.company_id || (!forceReload && dataLoaded.paymentMethods)) return

    setIsLoading(true)
    
    try {
      // Check if in development mode - use mock data
      if (process.env.NODE_ENV === 'development') {
        // Mock payment methods data for development
        const mockPaymentMethods = [
          {
            id: '1',
            company_id: user.company_id,
            name: 'Cartão de Crédito',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '2',
            company_id: user.company_id,
            name: 'Cartão de Débito',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '3',
            company_id: user.company_id,
            name: 'PIX',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '4',
            company_id: user.company_id,
            name: 'Dinheiro',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
        
        setCompanyPaymentMethods(mockPaymentMethods)
        setDataLoaded(prev => ({ ...prev, paymentMethods: true }))
        return
      }
      
      // Delay starting this request to avoid concurrent requests
      await new Promise(resolve => setTimeout(resolve, 500));
      
      await retryWithBackoff(
        async () => {
          const { data, error } = await supabase
            .from(SUPA_TABLES.table_company_payment_methods)
            .select()
            .match({ company_id: user.company_id })
            .order('name', { ascending: true })
  
          if (error) throw error
          setCompanyPaymentMethods(data || [])
          // Mark as loaded to prevent redundant fetches
          setDataLoaded(prev => ({ ...prev, paymentMethods: true }))
        },
        3, // Max 3 retries
        (error) => {
          setCompanyPaymentMethods([])
          // Suppress error toast in development
          if (process.env.NODE_ENV !== 'development') {
            toast.error("Erro ao buscar formas de pagamento!", {
              duration: 3000,
              closeButton: true,
            })
          }
          console.log(error)
        }
      );
    } finally {
      setIsLoading(false)
    }
  }

  async function createCompanyPaymentMethod(body: BodyCompanyPaymentMethod): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_company_payment_methods)
        .insert({
          company_id: user.company_id,
          ...body
        })

      if (error) throw error
      toast.success("Forma de pagamento adicionada com sucesso!", { duration: 1000 })
    } catch (error) {
      toast.error("Erro ao adicionar forma de pagamento!", {
        duration: 3000,
        closeButton: true,
      })
      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function updateCompanyPaymentMethod(id: string, body: BodyCompanyPaymentMethod): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_company_payment_methods)
        .update(body)
        .match({ id, company_id: user.company_id })

      if (error) throw error
      toast.success("Forma de pagamento atualizada com sucesso!", { duration: 1000 })
    } catch (error) {
      toast.error("Erro ao atualizar forma de pagamento!", {
        duration: 3000,
        closeButton: true,
      })
      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteCompanyPaymentMethod(id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_company_payment_methods)
        .delete()
        .match({ id, company_id: user.company_id })

      if (error) {
        throw error
      }

      // Atualizar a lista após a exclusão
      await getCompanyPaymentMethods(true) // Forçar recarga dos dados
      
      toast.success("Forma de Pagamento excluída com sucesso!", {
        duration: 3000,
      })
    } catch (error) {
      toast.error("Erro ao remover forma de pagamento!", {
        duration: 3000,
        closeButton: true,
      })
      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Company Policies
  async function getCompanyPolicies(forceReload = false): Promise<void> {
    if (!user?.company_id || (!forceReload && dataLoaded.policies)) return

    setIsLoading(true)
    
    try {
      // Check if in development mode - use mock data
      if (process.env.NODE_ENV === 'development') {
        // Mock policies data for development
        const mockPolicies = [
          {
            id: '1',
            company_id: user.company_id,
            name: 'Política de Cancelamento',
            description: 'Cancelamento deve ser feito com 24h de antecedência',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '2',
            company_id: user.company_id,
            name: 'Política de Reagendamento',
            description: 'Reagendamento permitido até 12h antes da consulta',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: '3',
            company_id: user.company_id,
            name: 'Política de Atraso',
            description: 'Tolerância de 15 minutos para atraso do paciente',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
        
        setCompanyPolicies(mockPolicies)
        setDataLoaded(prev => ({ ...prev, policies: true }))
        return
      }
      
      // Delay starting this request to avoid concurrent requests
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await retryWithBackoff(
        async () => {
          const { data, error } = await supabase
            .from(SUPA_TABLES.table_company_policies)
            .select()
            .match({ company_id: user.company_id })
            .order('name', { ascending: true })
  
          if (error) throw error
          setCompanyPolicies(data || [])
          // Mark as loaded to prevent redundant fetches
          setDataLoaded(prev => ({ ...prev, policies: true }))
        },
        3, // Max 3 retries
        (error) => {
          setCompanyPolicies([])
          // Suppress error toast in development
          if (process.env.NODE_ENV !== 'development') {
            toast.error("Erro ao buscar regras gerais!", {
              duration: 3000,
              closeButton: true,
            })
          }
          console.log(error)
        }
      );
    } finally {
      setIsLoading(false)
    }
  }

  async function createCompanyPolicy(body: BodyCompanyPolicy): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_company_policies)
        .insert({
          company_id: user.company_id,
          ...body
        })

      if (error) throw error
      toast.success("Regra geral adicionada com sucesso!", { duration: 1000 })
    } catch (error) {
      toast.error("Erro ao adicionar regra geral!", {
        duration: 3000,
        closeButton: true,
      })
      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function updateCompanyPolicy(id: string, body: BodyCompanyPolicy): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_company_policies)
        .update(body)
        .match({ id, company_id: user.company_id })

      if (error) throw error
      toast.success("Regra geral atualizada com sucesso!", { duration: 1000 })
    } catch (error) {
      toast.error("Erro ao atualizar regra geral!", {
        duration: 3000,
        closeButton: true,
      })
      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }

  async function deleteCompanyPolicy(id: string): Promise<void> {
    if (!user?.company_id) return

    setIsLoading(true)
    try {
      const { error } = await supabase
        .from(SUPA_TABLES.table_company_policies)
        .delete()
        .match({ id, company_id: user.company_id })

      if (error) {
        throw error
      }

      // Atualizar a lista após a exclusão
      await getCompanyPolicies(true) // Forçar recarga dos dados
      
      toast.success("Política Geral excluída com sucesso!", {
        duration: 3000,
      })
    } catch (error) {
      toast.error("Erro ao remover regra geral!", {
        duration: 3000,
        closeButton: true,
      })
      console.log(error)
    } finally {
      setIsLoading(false)
    }
  }
  
  // Function to reset the data loaded flags and invalidate cached data
  const resetDataLoaded = () => {
    setDataLoaded({
      agreements: false,
      paymentMethods: false,
      policies: false,
      specialties: false
    })
    
    // Invalidate cached data if user has a company ID
    if (user?.company_id) {
      queryClient.invalidateQueries({ queryKey: ['companyAgreements', user.company_id] })
      queryClient.invalidateQueries({ queryKey: ['companyPaymentMethods', user.company_id] })
      queryClient.invalidateQueries({ queryKey: ['companyPolicies', user.company_id] })
      queryClient.invalidateQueries({ queryKey: ['companySpecialties', user.company_id] })
    }
  };

  // Efeito para carregar os dados da empresa quando o usuário estiver disponível
  useEffect(() => {
    if (user?.company_id) {
      // Carregamos os dados iniciais
      getCompany()
      getCompanyAddress()
      getCompanySpecialties() // Carregando especialidades junto com outros dados
      // Usuário autenticado, carregando dados da empresa
    }
  }, [user?.company_id])
  
  // Configuração do realtime para políticas da empresa
  useEffect(() => {
    if (!user?.company_id) return
    
    // Configurando realtime para políticas gerais
    
    // Inscrição para atualizações em tempo real na tabela de políticas
    const channel = supabase.channel('company-policies-changes')
    
    // Função para lidar com mudanças nas políticas gerais com debounce
    const handlePolicyChange = (payload: any, type: string) => {
      const now = Date.now()
      if (now - lastPolicyUpdate > debounceTime) {
        setLastPolicyUpdate(now)
        getCompanyPolicies()
      }
    }
    
    // Evento INSERT
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: SUPA_TABLES.table_company_policies,
      filter: `company_id=eq.${user.company_id}`
    }, (payload) => handlePolicyChange(payload, 'Nova'))
    
    // Evento UPDATE
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: SUPA_TABLES.table_company_policies,
      filter: `company_id=eq.${user.company_id}`
    }, (payload) => handlePolicyChange(payload, 'Atualizada'))
    
    // Evento DELETE
    channel.on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: SUPA_TABLES.table_company_policies,
      filter: `company_id=eq.${user.company_id}`
    }, (payload) => handlePolicyChange(payload, 'Removida'))
    
    // Ativar a inscrição
    channel.subscribe()
    
    // Limpar a inscrição quando o componente for desmontado
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.company_id])
  
  // Configuração do realtime para formas de pagamento da empresa
  useEffect(() => {
    if (!user?.company_id) return
    
    // Configurando realtime para formas de pagamento
    
    // Inscrição para atualizações em tempo real na tabela de formas de pagamento
    const channel = supabase.channel('company-payment-methods-changes')
    
    // Função para lidar com mudanças nas formas de pagamento com debounce
    const handlePaymentMethodChange = (payload: any, type: string) => {
      const now = Date.now()
      if (now - lastPaymentMethodUpdate > debounceTime) {
        setLastPaymentMethodUpdate(now)
        getCompanyPaymentMethods()
      }
    }
    
    // Evento INSERT
    channel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: SUPA_TABLES.table_company_payment_methods,
      filter: `company_id=eq.${user.company_id}`
    }, (payload) => handlePaymentMethodChange(payload, 'Nova'))
    
    // Evento UPDATE
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: SUPA_TABLES.table_company_payment_methods,
      filter: `company_id=eq.${user.company_id}`
    }, (payload) => handlePaymentMethodChange(payload, 'Atualizada'))
    
    // Evento DELETE
    channel.on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: SUPA_TABLES.table_company_payment_methods,
      filter: `company_id=eq.${user.company_id}`
    }, (payload) => handlePaymentMethodChange(payload, 'Removida'))
    
    // Ativar a inscrição
    channel.subscribe()
    
    // Limpar a inscrição quando o componente for desmontado
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.company_id])

  // Mantemos o estado isLoading local e o manipulamos manualmente nas funções
  // para manter compatibilidade com o código existente

  // Company Specialties
  async function getCompanySpecialties(forceReload = false): Promise<void> {
    if (!user?.company_id) return
    
    // Don't fetch if data is already loaded and force reload is not requested
    if (dataLoaded.specialties && !forceReload) return
    
    setIsLoading(true)
    try {
      // DESENVOLVIMENTO: Retornar dados mock se estivermos em desenvolvimento
      if (process.env.NODE_ENV === 'development' && user.company_id === 'dev-company-id') {
        const mockSpecialties = [
          {
            id: 'mock-spec-1',
            company_id: 'dev-company-id',
            name: 'Cardiologia',
            description: 'Especialidade em doenças do coração',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'mock-spec-2',
            company_id: 'dev-company-id',
            name: 'Dermatologia',
            description: 'Especialidade em doenças da pele',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'mock-spec-3',
            company_id: 'dev-company-id',
            name: 'Pediatria',
            description: 'Especialidade em medicina infantil',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ];
        setCompanySpecialties(mockSpecialties)
        setDataLoaded(prev => ({ ...prev, specialties: true }))
        return
      }
      
      const { data, error } = await supabase
        .from('myia_specialties')
        .select()
        .match({ company_id: user.company_id })
        .order('name', { ascending: true })
      
      if (error) throw error
      
      setCompanySpecialties(data || [])
      setDataLoaded(prev => ({ ...prev, specialties: true }))
    } catch (error) {
      // Em desenvolvimento, não exibir erros de conexão com Supabase
      if (process.env.NODE_ENV === 'development') {
        console.log('Modo desenvolvimento: ignorando erro de Supabase para especialidades')
        setCompanySpecialties([])
      } else {
        console.log(error)
        toast.error("Erro ao buscar Especialidades!", {
          duration: 3000,
          description: "Erro ao buscar Especialidades!",
          closeButton: true,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }
  
  async function createCompanySpecialty(body: BodyCompanySpecialty): Promise<void> {
    if (!user?.company_id) return
    
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('myia_specialties')
        .insert([{ ...body, company_id: user.company_id }])
        .select()
      
      if (error) throw error
      
      // Re-fetch specialties with the new addition
      getCompanySpecialties(true)
      
      toast.success("Especialidade criada com sucesso!", {
        duration: 3000,
        closeButton: true,
      })
    } catch (error) {
      console.log(error)
      toast.error("Erro ao criar Especialidade!", {
        duration: 3000,
        description: "Erro ao criar Especialidade!",
        closeButton: true,
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  async function updateCompanySpecialty(id: string, body: BodyCompanySpecialty): Promise<void> {
    if (!user?.company_id) return
    
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('myia_specialties')
        .update(body)
        .match({ id, company_id: user.company_id })
      
      if (error) throw error
      
      // Re-fetch specialties with the updated item
      getCompanySpecialties(true)
      
      toast.success("Especialidade atualizada com sucesso!", {
        duration: 3000,
        closeButton: true,
      })
    } catch (error) {
      console.log(error)
      toast.error("Erro ao atualizar Especialidade!", {
        duration: 3000,
        description: "Erro ao atualizar Especialidade!",
        closeButton: true,
      })
    } finally {
      setIsLoading(false)
    }
  }
  
  async function deleteCompanySpecialty(id: string): Promise<void> {
    if (!user?.company_id) return
    
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('myia_specialties')
        .delete()
        .match({ id, company_id: user.company_id })
      
      if (error) throw error
      
      // Update the local state by removing the deleted specialty
      setCompanySpecialties(companySpecialties.filter(specialty => specialty.id !== id))
      
      toast.success("Especialidade excluída com sucesso!", {
        duration: 3000,
        closeButton: true,
      })
    } catch (error) {
      console.log(error)
      toast.error("Erro ao excluir Especialidade!", {
        duration: 3000,
        description: "Erro ao excluir Especialidade!",
        closeButton: true,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <CompanyContext.Provider
      value={{
        isLoading,
        getCompany,
        company,
        updateCompany,
        getCompanyAddress,
        company_address,
        updateCompanyAddress,
        
        // Company Agreements
        companyAgreements,
        getCompanyAgreements,
        createCompanyAgreement,
        updateCompanyAgreement,
        deleteCompanyAgreement,
        
        // Company Payment Methods
        companyPaymentMethods,
        getCompanyPaymentMethods,
        createCompanyPaymentMethod,
        updateCompanyPaymentMethod,
        deleteCompanyPaymentMethod,
        
        // Company Policies
        companyPolicies,
        getCompanyPolicies,
        createCompanyPolicy,
        updateCompanyPolicy,
        deleteCompanyPolicy,
        
        // Company Specialties
        companySpecialties,
        getCompanySpecialties,
        createCompanySpecialty,
        updateCompanySpecialty,
        deleteCompanySpecialty,
        
        // Reset data loaded flags
        resetDataLoaded,
      }}
    >
      {children}
    </CompanyContext.Provider>
  )
}

// Hook para utilizar o contexto de Company em outros componentes
export const useCompany = () => useContext(CompanyContext);
