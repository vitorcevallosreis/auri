'use client';

import React from 'react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Calendar, Clock, User, Bookmark, MapPin, AlertCircle, 
  DollarSign, Phone, Mail, CreditCard
} from 'lucide-react';
import { Appointment, AppointmentStatus } from '@/contexts/Appointments/interfaces';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAppointments } from '@/contexts/Appointments';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';

interface AppointmentDetailsProps {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (appointment: Appointment) => void;
}

export const AppointmentDetails = ({ 
  appointment, 
  isOpen, 
  onClose,
  onEdit
}: AppointmentDetailsProps) => {
  const { updateAppointment, deleteAppointment } = useAppointments();

  if (!appointment) return null;

  const handleStatusChange = async (status: AppointmentStatus) => {
    if (!appointment) return;
    
    try {
      await updateAppointment(appointment.id, { status });
      toast({
        title: "Status atualizado",
        description: "O status do agendamento foi atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status do agendamento.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;
    
    if (window.confirm("Tem certeza que deseja excluir este agendamento?")) {
      try {
        const success = await deleteAppointment(appointment.id);
        
        if (success) {
          toast({
            title: "Agendamento excluído",
            description: "O agendamento foi excluído com sucesso.",
          });
          onClose();
        } else {
          throw new Error("Falha ao excluir");
        }
      } catch (error) {
        toast({
          title: "Erro",
          description: "Não foi possível excluir o agendamento.",
          variant: "destructive",
        });
      }
    }
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      scheduled: 'Agendado',
      completed: 'Concluído',
      cancelled: 'Cancelado',
      no_show: 'Não Compareceu',
      rescheduled: 'Reagendado'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
      completed: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30',
      cancelled: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
      no_show: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-500/15 dark:text-yellow-300 dark:border-yellow-500/30',
      rescheduled: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30'
    };
    return colorMap[status] || '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex justify-between items-center">
            <span>Detalhes do Agendamento</span>
            <Badge className={getStatusColor(appointment.status)}>
              {getStatusLabel(appointment.status)}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Informações completas sobre o agendamento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-1 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-medium text-lg">
                {appointment.cliente_nome || "Cliente não informado"}
              </h3>
              
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(parseISO(appointment.appointment_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {appointment.start_time.substring(0, 5)} - {appointment.end_time.substring(0, 5)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 border rounded-lg">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Profissional</h3>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{appointment.professional_name}</span>
                </div>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Serviço</h3>
                <div className="flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                  <span>{appointment.service_name}</span>
                </div>
              </div>
            </div>

            {(appointment.location || appointment.notes) && (
              <div className="grid grid-cols-2 gap-4">
                {appointment.location && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Local</h3>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{appointment.location}</span>
                    </div>
                  </div>
                )}
                
                {appointment.notes && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Observações</h3>
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <span>{appointment.notes}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {(appointment.cliente_telefone || appointment.cliente_email) && (
              <div className="grid grid-cols-2 gap-4">
                {appointment.cliente_telefone && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Telefone</h3>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{appointment.cliente_telefone}</span>
                    </div>
                  </div>
                )}
                
                {appointment.cliente_email && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Email</h3>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{appointment.cliente_email}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {(appointment.convenio_usado || appointment.valor_cobrado !== null) && (
              <div className="grid grid-cols-2 gap-4">
                {appointment.convenio_usado && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Convênio</h3>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span>{appointment.convenio_usado}</span>
                    </div>
                  </div>
                )}
                
                {appointment.valor_cobrado !== null && (
                  <div className="p-4 border rounded-lg">
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">Valor</h3>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL'
                        }).format(appointment.valor_cobrado)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <Separator className="my-2" />

        <DialogFooter className="flex justify-between sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onEdit(appointment)}>
              Editar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                Alterar Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleStatusChange('scheduled')}>
                Agendado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('completed')}>
                Concluído
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('cancelled')}>
                Cancelado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('no_show')}>
                Não Compareceu
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleStatusChange('rescheduled')}>
                Reagendado
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
