'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { ServiceSearch } from '@/hooks/useServiceSearches';

interface ServiceSearchesTableProps {
  searches: ServiceSearch[];
}

export function ServiceSearchesTable({ searches = [] }: ServiceSearchesTableProps) {
  console.log('[ServiceSearchesTable] rendered', searches);
  return (
    <Card className="bg-white">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          Pesquisas de Serviços
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {searches.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma pesquisa de serviço encontrada.</p>
          ) : (
            searches.map((search, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium">ID do Serviço: {search.service_id}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(search.created_at).toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: '2-digit', 
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    Pesquisado
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
