'use client';

import React, { useState, useEffect } from 'react';
import { AppointmentsProvider, useAppointments } from '@/contexts/Appointments';
import { useProfessionals } from '@/contexts/Professionals';
import { AuthContext } from '@/contexts/Auth';
import { useServices } from '@/contexts/Services';
import { Appointment, AppointmentStatus } from '@/contexts/Appointments/interfaces';
import { WeeklyCalendar } from '@/components/appointments/WeeklyCalendar';
import { AppointmentDetails } from '@/components/appointments/AppointmentDetails';
import { MultiStepAppointmentForm } from '@/components/appointments/MultiStepAppointmentForm';
import { CalendarView } from '@/types/calendar';
import { CalendarContainer } from '@/components/appointments/calendar';
import { DayView } from '@/components/appointments/calendar/DayView';
import { WeekView } from '@/components/appointments/calendar/WeekView';
import { MonthView } from '@/components/appointments/calendar/MonthView';
import { AgendaView } from '@/components/appointments/calendar/AgendaView';
import { DashboardLayout } from "@/app/layout/dashboard-layout";
import { 
  format, parseISO, startOfWeek, endOfWeek, addDays, subDays,
  startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths,
  isSameMonth, isToday, isSameDay, isWithinInterval, getHours, setHours,
  setMinutes, addHours, differenceInMinutes, isBefore, isAfter, getDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { 
  CalendarIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Plus, 
  Search, Filter, Clock, Calendar, LayoutGrid, List, User, MapPin,
  AlertCircle, X, ArrowDownUp, RefreshCw, Bookmark, Menu, FileEdit
} from 'lucide-react';

// Usando o tipo CalendarView importado de '@/types/calendar'

// Cores para os status de consultas médicas
const statusColors = {
  scheduled: { bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-primary', border: 'border-teal-200 dark:border-teal-500/30', badgeBg: 'bg-teal-100 dark:bg-teal-500/15' },
  completed: { bg: 'bg-green-50 dark:bg-green-500/10', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-500/30', badgeBg: 'bg-green-100 dark:bg-green-500/15' },
  cancelled: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-500/30', badgeBg: 'bg-red-100 dark:bg-red-500/15' },
  no_show: { bg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-200 dark:border-yellow-500/30', badgeBg: 'bg-yellow-100 dark:bg-yellow-500/15' },
  rescheduled: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-500/30', badgeBg: 'bg-purple-100 dark:bg-purple-500/15' }
};

// Mapeamento de labels para status das consultas
const statusLabels = {
  scheduled: 'Consulta Agendada',
  completed: 'Consulta Realizada',
  cancelled: 'Consulta Cancelada',
  no_show: 'Paciente Faltou',
  rescheduled: 'Consulta Reagendada'
};

/**
 * Agenda Médica - Interface otimizada para recepcionistas
 */
const AppointmentsPageContent = () => {
  // Contextos
  const { 
    appointments, 
    isLoading, 
    error, 
    filters,
    setFilters,
    fetchAppointments,
  } = useAppointments();
  
  const { user } = React.useContext(AuthContext);
  const { professionals, fetchProfessionals } = useProfessionals();
  const { services, getServices } = useServices();
  
  // Estados para gerenciar agendamentos
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showAppointmentDetails, setShowAppointmentDetails] = useState(false);
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  
  // Estados para visualização do calendário
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>('week');
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Carregar dados
  useEffect(() => {
    const loadData = async () => {
      if (professionals.length === 0 && user?.company_id) {
        await fetchProfessionals(user.company_id as any);
      }
      if (services.length === 0) {
        await getServices();
      }
    };
    
    loadData();
  }, [professionals.length, services.length, fetchProfessionals, getServices, user?.company_id]);
  
  // Handlers para agendamentos
  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowAppointmentDetails(true);
  };

  const handleNewAppointment = () => {
    setAppointmentToEdit(null);
    setShowAppointmentForm(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setAppointmentToEdit(appointment);
    setShowAppointmentForm(true);
    setShowAppointmentDetails(false);
  };

  const handleFormClose = () => {
    setShowAppointmentForm(false);
    fetchAppointments();
  };

  const handleDetailsClose = () => {
    setShowAppointmentDetails(false);
  };

  const handleRefresh = () => {
    fetchAppointments();
  };
  
  // Handlers para navegação do calendário
  const goToPrevious = () => {
    if (calendarView === 'day') {
      setCurrentDate(prev => subDays(prev, 1));
    } else if (calendarView === 'week') {
      setCurrentDate(prev => subDays(prev, 7));
    } else if (calendarView === 'month') {
      setCurrentDate(prev => subMonths(prev, 1));
    } else if (calendarView === 'agenda') {
      setCurrentDate(prev => subDays(prev, 7));
    }
  };

  const goToNext = () => {
    if (calendarView === 'day') {
      setCurrentDate(prev => addDays(prev, 1));
    } else if (calendarView === 'week') {
      setCurrentDate(prev => addDays(prev, 7));
    } else if (calendarView === 'month') {
      setCurrentDate(prev => addMonths(prev, 1));
    } else if (calendarView === 'agenda') {
      setCurrentDate(prev => addDays(prev, 7));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };
  
  // Handlers para filtros
  const handleFilterChange = (type: string, value: string | Date | undefined) => {
    if (value === '') value = undefined;
    setFilters({ ...filters, [type]: value });
  };
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    handleFilterChange('searchQuery', e.target.value);
  };
  
  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };
  
  // Formatação do título baseado na visualização atual
  const getHeaderTitle = () => {
    if (calendarView === 'day') {
      return format(currentDate, "d 'de' MMMM, yyyy", { locale: ptBR });
    } else if (calendarView === 'week') {
      const startOfTheWeek = startOfWeek(currentDate, { locale: ptBR });
      const endOfTheWeek = endOfWeek(currentDate, { locale: ptBR });
      return `${format(startOfTheWeek, "d", { locale: ptBR })} - ${format(endOfTheWeek, "d 'de' MMMM, yyyy", { locale: ptBR })}`;
    } else if (calendarView === 'month') {
      return format(currentDate, "MMMM yyyy", { locale: ptBR });
    } else {
      return "Consultas";
    }
  };
  
  // Função para encontrar a cor correspondente ao status
  const getStatusColor = (status: AppointmentStatus) => {
    return statusColors[status] || { bg: 'bg-muted', text: 'text-foreground', border: 'border-border', badgeBg: 'bg-muted' };
  };
  
  // Função para obter o label do status
  const getStatusLabel = (status: AppointmentStatus) => {
    return statusLabels[status] || status;
  };
  
  // Renderização do componente
  return (
    <div className="space-y-4 h-full">
      {/* Cabeçalho moderno com ações primárias */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-3 pb-4 border-b">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground dark:text-gray-50">
            Agenda Inteligente
          </h1>
          <p className="text-sm text-muted-foreground dark:text-gray-400 mt-1">
            {getHeaderTitle()} • Automatizada com Ana IA
          </p>
        </div>
        
        <div className="flex items-center gap-2 mt-3 md:mt-0">
          <div className="flex items-center rounded-md border bg-card dark:bg-gray-800 p-1 shadow-sm">
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "rounded-sm",
                calendarView === "day" && "bg-muted dark:bg-gray-700"
              )}
              onClick={() => setCalendarView("day")}
            >
              <Calendar className="h-4 w-4 mr-1" /> Dia
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "rounded-sm",
                calendarView === "week" && "bg-muted dark:bg-gray-700"
              )}
              onClick={() => setCalendarView("week")}
            >
              <LayoutGrid className="h-4 w-4 mr-1" /> Semana
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "rounded-sm",
                calendarView === "month" && "bg-muted dark:bg-gray-700"
              )}
              onClick={() => setCalendarView("month")}
            >
              <CalendarIcon className="h-4 w-4 mr-1" /> Mês
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className={cn(
                "rounded-sm",
                calendarView === "agenda" && "bg-muted dark:bg-gray-700"
              )}
              onClick={() => setCalendarView("agenda")}
            >
              <List className="h-4 w-4 mr-1" /> Agenda
            </Button>
          </div>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-muted dark:bg-gray-800")}
          >
            <Filter className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleNewAppointment}
            className="gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            Nova Consulta
          </Button>
        </div>
      </div>
      
      {/* Barra de navegação e ferramentas */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPrevious} className="text-primary border-primary hover:bg-accent/20 hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            className="font-medium text-primary border-primary hover:bg-accent/20 hover:text-foreground" 
            onClick={goToToday}
          >
            Hoje
          </Button>
          <Button variant="outline" size="icon" onClick={goToNext} className="text-primary border-primary hover:bg-accent/20 hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar agendamentos"
              className="pl-8 w-48 md:w-64 h-9"
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>
          
          <Button variant="outline" size="sm" className="h-9 text-primary border-primary hover:bg-accent/20 hover:text-foreground" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Filtros de profissionais e serviços com dropdowns */}
      <div className="flex flex-wrap sm:flex-nowrap gap-6 mb-4">
        <div className="w-full sm:w-1/2">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="professional-filter" className="flex items-center text-sm font-medium">
              <User className="h-4 w-4 mr-2 text-primary" />
              Profissional
            </Label>
            <Select 
              value={filters.professional_id as string || 'all'} 
              onValueChange={(value) => handleFilterChange('professional_id', value === 'all' ? undefined : value)}
            >
              <SelectTrigger id="professional-filter" className="w-full">
                <SelectValue placeholder="Todos os profissionais" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="font-medium">Todos os profissionais</div>
                </SelectItem>
                
                {professionals.map((professional) => (
                  <SelectItem key={professional.id as string} value={professional.id as string}>
                    <div>
                      <div className="font-medium">{professional.nome}</div>
                      {professional.formacao && (
                        <div className="text-xs text-muted-foreground">{professional.formacao}</div>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="w-full sm:w-1/2">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="service-filter" className="flex items-center text-sm font-medium">
              <Bookmark className="h-4 w-4 mr-2 text-primary" />
              Serviço
            </Label>
            <Select 
              value={filters.service_id as string || 'all'} 
              onValueChange={(value) => handleFilterChange('service_id', value === 'all' ? undefined : value)}
            >
              <SelectTrigger id="service-filter" className="w-full">
                <SelectValue placeholder="Todos os serviços" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="font-medium">Todos os serviços</div>
                </SelectItem>
                
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    <div className="font-medium">{service.name}</div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* Filtros - Animação suave */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0, overflow: "hidden" }}
            animate={{ opacity: 1, height: "auto", overflow: "visible" }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-lg border bg-card dark:bg-gray-800 shadow-sm"
          >
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Filtro: Profissional */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-muted-foreground">Profissional</label>
                </div>
                <select 
                  className="w-full h-9 rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-gray-950"
                  value={filters.professional_id as string || ''}
                  onChange={(e) => handleFilterChange('professional_id', e.target.value)}
                >
                  <option value="">Todos os profissionais</option>
                  {professionals.map((professional) => (
                    <option key={professional.id as string} value={professional.id as string}>
                      {professional.nome}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Filtro: Serviço */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-primary">Serviço</label>
                </div>
                <select 
                  className="w-full h-9 rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-gray-950"
                  value={filters.service_id as string || ''}
                  onChange={(e) => handleFilterChange('service_id', e.target.value)}
                >
                  <option value="">Todos os serviços</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Filtro: Status */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-medium text-primary">Status</label>
                </div>
                <select 
                  className="w-full h-9 rounded-md border border-border bg-card px-3 py-2 text-sm ring-offset-white focus:outline-none focus:ring-2 focus:ring-gray-950"
                  value={filters.status as string || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <option value="">Todos os status</option>
                  <option value="scheduled">Agendado</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                  <option value="no_show">Não Compareceu</option>
                  <option value="rescheduled">Reagendado</option>
                </select>
              </div>
              
              {/* Ações dos filtros */}
              <div className="flex items-end">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={clearFilters} 
                  className="text-xs h-9 w-full text-primary border-primary hover:bg-accent/20 hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Limpar filtros
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Exibição do calendário */}
      <div className="min-h-[calc(100vh-16rem)] bg-card dark:bg-gray-800 rounded-lg border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="h-full w-full flex items-center justify-center p-12">
            <div className="space-y-4 w-full max-w-md">
              <div className="flex justify-between">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-32" />
              </div>
              <Skeleton className="h-[500px] w-full" />
            </div>
          </div>
        ) : error ? (
          <div className="h-full w-full flex items-center justify-center p-12">
            <div className="text-center max-w-md mx-auto p-6 rounded-lg bg-red-50 border border-red-100 dark:bg-red-500/10">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-red-700 mb-2 dark:text-red-300">Erro ao carregar agendamentos</h3>
              <p className="text-red-600 mb-4 dark:text-red-400">Ocorreu um problema ao buscar os dados. Por favor, tente novamente.</p>
              <Button 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-300" 
                onClick={handleRefresh}
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-0">
            <CalendarContainer
              view={calendarView}
              currentDate={currentDate}
              isLoading={isLoading}
              appointments={appointments}
              onAppointmentClick={handleAppointmentClick}
            />
          </div>
        )}
      </div>
      
      {/* Modais de interação */}
      {showAppointmentDetails && selectedAppointment && (
        <AppointmentDetails
          appointment={selectedAppointment}
          isOpen={showAppointmentDetails}
          onClose={handleDetailsClose}
          onEdit={handleEditAppointment}
        />
      )}
      
      {showAppointmentForm && (
        <MultiStepAppointmentForm
          isOpen={showAppointmentForm}
          onClose={handleFormClose}
          appointmentToEdit={appointmentToEdit}
        />
      )}
    </div>
  );
};

export default function AppointmentsPage() {
  return (
    <DashboardLayout>
      <AppointmentsProvider>
        <AppointmentsPageContent />
      </AppointmentsProvider>
    </DashboardLayout>
  );
}
