import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/config';
import { usePathname } from 'next/navigation';

export interface ServiceSearch {
  id: string;
  service_id: string;
  created_at: string;
  contact_id: string | null;
  company_id: string | null;
  service_name?: string;
  count?: number;
}

export function useServiceSearches(limit = 10, grouped = false, company_id?: string) {
  const [searches, setSearches] = useState<ServiceSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Verificar se estamos em uma rota protegida que requer filtragem por company_id
  const pathname = usePathname();
  const isProtectedRoute = pathname?.startsWith('/(private)') || false;
  
  // Determinar se devemos aplicar o filtro por company_id
  // Aplicamos o filtro apenas se estamos em uma rota protegida E temos um company_id
  const shouldFilterByCompany = isProtectedRoute && !!company_id;

  useEffect(() => {
    async function fetchSearches() {
      setLoading(true);
      setError(null);
      
      try {
        
        if (grouped) {
          // Busca agrupada contando as ocorrências de cada serviço
          let query = supabase
            .from('myia_services_searches')
            .select(`
              service_id,
              myia_services!inner(id, name)
            `);
            
          // Adicionar filtro por company_id se fornecido
          if (company_id) {
            // Aplicando filtro por company_id
            query = query.eq('company_id', company_id);
          }
          
          // Executar a consulta
          const { data, error: fetchError } = await query.limit(100); // Buscamos mais para agrupar corretamente

          if (fetchError) {
            throw fetchError;
          }

          if (!data || data.length === 0) {
            setSearches([]);
            return;
          }

          // Processando os dados para criar o agrupamento
          const groupedServices: Record<string, ServiceSearch> = {};
          
          data.forEach((item: any) => {
            const serviceId = item.service_id;
            const serviceName = item.myia_services?.name || 'Serviço não identificado';
            
            if (!groupedServices[serviceId]) {
              groupedServices[serviceId] = {
                id: serviceId,
                service_id: serviceId,
                created_at: new Date().toISOString(),
                contact_id: null,
                company_id: null,
                service_name: serviceName,
                count: 1
              };
            } else {
              groupedServices[serviceId].count! += 1;
            }
          });

          // Convertendo para array e ordenando por contagem
          const groupedResults = Object.values(groupedServices)
            .sort((a, b) => (b.count || 0) - (a.count || 0))
            .slice(0, limit);

          setSearches(groupedResults);
        } else {
          // Busca detalhada incluindo JOIN com a tabela de serviços
          let query = supabase
            .from('myia_services_searches')
            .select(`
              *,
              myia_services!inner(id, name)
            `)
            .order('created_at', { ascending: false });
            
          // Adicionar filtro por company_id se fornecido
          if (company_id) {
            // Aplicando filtro por company_id
            query = query.eq('company_id', company_id);
          }
          
          // Executar a consulta
          const { data, error: fetchError } = await query.limit(limit);

          if (fetchError) {
            throw fetchError;
          }

          if (!data || data.length === 0) {
            setSearches([]);
            return;
          }

          // Processando os resultados para incluir o nome do serviço
          const processedData = data.map((item: any) => ({
            ...item,
            service_name: item.myia_services?.name || 'Serviço não identificado'
          }));

          setSearches(processedData);
        }
      } catch (error: any) {
        setError(error.message || 'Erro desconhecido ao buscar pesquisas');
        
        // Dados mockados como fallback
        const mockSearches: ServiceSearch[] = [
          { id: '1', service_id: '1', created_at: new Date().toISOString(), contact_id: null, company_id: company_id || null, service_name: 'Consulta Psicológica', count: 12 },
          { id: '2', service_id: '2', created_at: new Date().toISOString(), contact_id: null, company_id: company_id || null, service_name: 'Terapia Ocupacional', count: 8 },
          { id: '3', service_id: '3', created_at: new Date().toISOString(), contact_id: null, company_id: company_id || null, service_name: 'Fisioterapia', count: 5 }
        ];
        setSearches(mockSearches);
      } finally {
        setLoading(false);
      }
    }
    
    fetchSearches();
    
    // Cleanup function
    return () => {};
  }, [limit, grouped, company_id]);

  return { searches, loading, error };
}
