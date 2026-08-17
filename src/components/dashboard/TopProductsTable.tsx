'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import type { TopService } from '@/hooks/useTopSearchedServices';

interface TopServicesTableProps {
  services: TopService[];
}

export function TopProductsTable({ services = [] }: TopServicesTableProps) {
  console.log('[TopProductsTable] rendered', services);
  
  // Informações de depuração
  const totalServices = services.length;
  const servicesWithCompanyId = services.filter(s => s.company_id !== null && s.company_id !== undefined).length;
  
  return (
    <Card className="bg-card">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          Serviços Mais Procurados
        </CardTitle>
        <div className="text-xs text-muted-foreground mt-1">
          Total: {totalServices} | Com company_id: {servicesWithCompanyId}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {services.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">Nenhum serviço encontrado</div>
          ) : (services ?? []).map((service: TopService, index: number) => (
            <div key={index} className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="font-medium">ID do Serviço: {service.service_id}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(service.created_at).toLocaleDateString('pt-BR', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <div className="text-right">
                {/* Mesmo caso do painel: teal-50 é fixo e --primary vira menta
                    no escuro, dando 1,55:1. Menta como fundo tingido. */}
                <Badge variant="outline" className="bg-accent/15 text-foreground border-accent/40">
                  Pesquisado
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
