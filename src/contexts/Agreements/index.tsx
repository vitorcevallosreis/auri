'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase/config';
import { useCompany } from '@/contexts/Company';
import { AuthContext } from '@/contexts/Auth';

export interface Agreement {
  id: string;
  company_id: string;
  name: string;
  status: boolean;
  created_at: string;
  updated_at: string;
  description: string | null;
}

interface AgreementsContextType {
  agreements: Agreement[];
  loading: boolean;
  error: string | null;
  fetchAgreements: () => Promise<void>;
}

const AgreementsContext = createContext<AgreementsContextType | undefined>(undefined);

export const useAgreements = () => {
  const context = useContext(AgreementsContext);
  if (!context) {
    throw new Error('useAgreements must be used within an AgreementsProvider');
  }
  return context;
};

interface AgreementsProviderProps {
  children: ReactNode;
}

export const AgreementsProvider: React.FC<AgreementsProviderProps> = ({ children }) => {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useContext(AuthContext);
  const { company } = useCompany();

  const fetchAgreements = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Verificar se temos o company_id
      if (!user?.company_id) {
        console.log('Company ID não disponível, não é possível buscar convênios');
        setAgreements([]);
        return;
      }

      // DESENVOLVIMENTO: Retornar dados mock se estivermos em desenvolvimento
      if (process.env.NODE_ENV === 'development' && user.company_id === 'dev-company-id') {
        const mockAgreements: Agreement[] = [
          {
            id: 'mock-1',
            company_id: 'dev-company-id',
            name: 'Unimed',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            description: 'Convênio Unimed'
          },
          {
            id: 'mock-2',
            company_id: 'dev-company-id',
            name: 'Bradesco Saúde',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            description: 'Convênio Bradesco Saúde'
          },
          {
            id: 'mock-3',
            company_id: 'dev-company-id',
            name: 'SulAmérica',
            status: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            description: 'Convênio SulAmérica'
          }
        ];
        setAgreements(mockAgreements);
        return;
      }

      const { data, error } = await supabase
        .from('myia_company_agreements')
        .select('*')
        .eq('company_id', user.company_id)
        .eq('status', true)
        .order('name');

      if (error) {
        throw error;
      }

      setAgreements(data as Agreement[]);
    } catch (error: any) {
      // Em desenvolvimento, não exibir erros de conexão com Supabase
      if (process.env.NODE_ENV === 'development') {
        console.log('Modo desenvolvimento: ignorando erro de Supabase');
        setAgreements([]);
        setError(null);
      } else {
        setError(error.message);
        console.error('Error fetching agreements:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.company_id) {
      fetchAgreements();
    }
  }, [user?.company_id]);

  return (
    <AgreementsContext.Provider
      value={{
        agreements,
        loading,
        error,
        fetchAgreements
      }}
    >
      {children}
    </AgreementsContext.Provider>
  );
};
