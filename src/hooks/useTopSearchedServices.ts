import { useEffect, useState } from 'react';
// Ajuste para o seu config real
import { supabase } from '@/lib/supabase/config';

// Configuração de logs removida para ambiente de produção

export interface TopService {
  id: string;
  service_id: string;
  created_at: string;
  contact_id: string | null;
  company_id: string | null;
}

export function useTopSearchedServices(company_id?: string, limit = 10) {

  const [services, setServices] = useState<TopService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {

    
    async function fetchTopServices() {

      setLoading(true);
      setError(null);
      
      try {

        
        // Abordagem simplificada: buscar todos os registros primeiro
        const { data, error: fetchError } = await supabase
          .from('myia_services_searches')
          .select('*')
          .order('created_at', { ascending: false });
        

        
        if (fetchError) {
          throw fetchError;
        }
        
        if (!data || data.length === 0) {

          setServices([]);
          return;
        }
        

        
        // Filtrar por company_id no cliente
        let filteredData = data;
        
        if (company_id) {

          
          filteredData = data.filter(item => {
            if (!item.company_id) return false;
            return String(item.company_id) === String(company_id);
          });
          

        }
        
        // Limitar resultados
        const limitedData = filteredData.slice(0, limit);

        
        // Definir serviços
        setServices(limitedData);

      } catch (error: any) {

        setError(error.message || 'Erro desconhecido ao buscar pesquisas de serviços');
        
        // Usar dados mockados como fallback em caso de erro

        const mockServices: TopService[] = [
          { id: '1', service_id: '1', created_at: new Date().toISOString(), contact_id: null, company_id: company_id || null },
          { id: '2', service_id: '2', created_at: new Date().toISOString(), contact_id: null, company_id: company_id || null },
          { id: '3', service_id: '3', created_at: new Date().toISOString(), contact_id: null, company_id: company_id || null }
        ];
        setServices(mockServices);
      } finally {
        setLoading(false);

      }
    }
    fetchTopServices();
  }, [limit, company_id]);

  return { services, loading, error };
}
