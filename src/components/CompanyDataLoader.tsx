'use client'

import { useContext, useEffect } from 'react'
import { CompanyContext } from '@/contexts/Company'
import { AuthContext } from '@/contexts/Auth'

/**
 * Componente que carrega os dados da empresa automaticamente em todas as páginas
 * quando o usuário está autenticado.
 */
export function CompanyDataLoader() {
  const { user } = useContext(AuthContext)
  const { 
    getCompany, 
    getCompanyAddress, 
    getCompanyAgreements,
    getCompanyPaymentMethods,
    getCompanyPolicies,
    getCompanySpecialties,
    company 
  } = useContext(CompanyContext)

  // Efeito para carregar os dados da empresa quando o usuário estiver autenticado
  useEffect(() => {
    if (user?.company_id) {
      // Primeiro carregamos os dados básicos da empresa
      getCompany()
      
      // Depois carregamos os dados relacionados
      getCompanyAddress()
      getCompanyAgreements()
      getCompanyPaymentMethods()
      getCompanyPolicies()
      getCompanySpecialties()
    }
  }, [user?.company_id])

  // Este componente não renderiza nada visualmente
  return null
}
