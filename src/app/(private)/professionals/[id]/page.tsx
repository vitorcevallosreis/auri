"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProfessionals } from '@/contexts/Professionals';
import { useServices } from '@/contexts/Services';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Trash2, Calendar } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function ProfessionalPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { professionals, loading, createProfessional, updateProfessional, deleteProfessional } = useProfessionals();
  const { services } = useServices();
  
  const isNew = params.id === 'new';
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    bio: '',
    active: true,
    services: [] as string[]
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Carregar dados do profissional se estiver editando
  useEffect(() => {
    if (!isNew && !loading) {
      const professional = professionals.find(p => p.id.toString() === params.id);
      if (professional) {
        setFormData({
          name: professional.name,
          email: professional.email || '',
          phone: professional.phone || '',
          specialty: professional.specialty || '',
          bio: professional.bio || '',
          active: professional.active !== false,
          services: professional.services?.map(s => s.toString()) || []
        });
      } else {
        toast.error('Profissional não encontrado');
        router.push('/professionals');
      }
    }
  }, [isNew, params.id, professionals, loading, router]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, active: checked }));
  };
  
  const handleServiceToggle = (serviceId: string) => {
    setFormData(prev => {
      const services = [...prev.services];
      if (services.includes(serviceId)) {
        return { ...prev, services: services.filter(id => id !== serviceId) };
      } else {
        return { ...prev, services: [...services, serviceId] };
      }
    });
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const professionalData = {
        ...formData
      };
      
      if (isNew) {
        await createProfessional(professionalData);
        toast.success('Profissional criado com sucesso!');
      } else {
        await updateProfessional(params.id, professionalData);
        toast.success('Profissional atualizado com sucesso!');
      }
      
      router.push('/professionals');
    } catch (error) {
      console.error('Erro ao salvar profissional:', error);
      toast.error('Erro ao salvar profissional');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja excluir este profissional? Esta ação não pode ser desfeita.')) {
      try {
        await deleteProfessional(params.id);
        toast.success('Profissional excluído com sucesso!');
        router.push('/professionals');
      } catch (error) {
        console.error('Erro ao excluir profissional:', error);
        toast.error('Erro ao excluir profissional');
      }
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/professionals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {isNew ? 'Novo Profissional' : 'Editar Profissional'}
          </h1>
        </div>
        
        <div className="flex space-x-2">
          {!isNew && (
            <>
              <Button variant="outline" asChild>
                <Link href={`/professionals/availability?id=${params.id}`}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Gerenciar Disponibilidade
                </Link>
              </Button>
              
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </>
          )}
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{isNew ? 'Criar novo profissional' : 'Editar profissional'}</CardTitle>
            <CardDescription>
              {isNew 
                ? 'Preencha os campos abaixo para criar um novo profissional' 
                : 'Atualize as informações do profissional conforme necessário'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="specialty">Especialidade</Label>
                  <Input
                    id="specialty"
                    name="specialty"
                    value={formData.specialty}
                    onChange={handleChange}
                    placeholder="Ex: Psicólogo, Nutricionista, etc."
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="email@exemplo.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="bio">Biografia</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Breve descrição sobre o profissional..."
                  rows={4}
                />
              </div>
              
              <Separator />
              
              <div>
                <Label>Serviços Oferecidos</Label>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {services.map(service => (
                    <div key={service.id.toString()} className="flex items-center space-x-2">
                      <Checkbox
                        id={`service-${service.id}`}
                        checked={formData.services.includes(service.id.toString())}
                        onCheckedChange={() => handleServiceToggle(service.id.toString())}
                      />
                      <Label 
                        htmlFor={`service-${service.id}`}
                        className="text-sm font-normal"
                      >
                        {service.name}
                      </Label>
                    </div>
                  ))}
                </div>
                {services.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Nenhum serviço cadastrado. <Link href="/services/new" className="text-primary underline">Adicionar serviço</Link>
                  </p>
                )}
              </div>
              
              <Separator />
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={handleSwitchChange}
                />
                <Label htmlFor="active">Profissional Ativo</Label>
                <p className="text-sm text-muted-foreground ml-2">
                  Profissionais inativos não aparecem para agendamento
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" asChild>
              <Link href="/professionals">Cancelar</Link>
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </span>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
