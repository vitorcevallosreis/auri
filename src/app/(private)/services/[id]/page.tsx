"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useServices } from '@/contexts/Services';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

export default function ServicePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { services, loading, createService, updateService, deleteService } = useServices();
  
  const isNew = params.id === 'new';
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tempo_medio: '60',
    price: '',
    active: true
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Carregar dados do serviço se estiver editando
  useEffect(() => {
    if (!isNew && !loading) {
      const service = services.find(s => s.id.toString() === params.id);
      if (service) {
        setFormData({
          name: service.name,
          description: service.description || '',
          tempo_medio: service.tempo_medio?.toString() || '60',
          price: service.price?.toString() || '',
          active: service.active !== false
        });
      } else {
        toast.error('Serviço não encontrado');
        router.push('/services');
      }
    }
  }, [isNew, params.id, services, loading, router]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSwitchChange = (checked: boolean) => {
    setFormData(prev => ({ ...prev, active: checked }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      const serviceData = {
        ...formData,
        tempo_medio: parseInt(formData.tempo_medio),
        price: formData.price ? parseFloat(formData.price) : null
      };
      
      if (isNew) {
        await createService(serviceData);
        toast.success('Serviço criado com sucesso!');
      } else {
        await updateService(params.id, serviceData);
        toast.success('Serviço atualizado com sucesso!');
      }
      
      router.push('/services');
    } catch (error) {
      console.error('Erro ao salvar serviço:', error);
      toast.error('Erro ao salvar serviço');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDelete = async () => {
    if (window.confirm('Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.')) {
      try {
        await deleteService(params.id);
        toast.success('Serviço excluído com sucesso!');
        router.push('/services');
      } catch (error) {
        console.error('Erro ao excluir serviço:', error);
        toast.error('Erro ao excluir serviço');
      }
    }
  };
  
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="icon" asChild>
            <Link href="/services">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            {isNew ? 'Novo Serviço' : 'Editar Serviço'}
          </h1>
        </div>
        
        {!isNew && (
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            size="sm"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        )}
      </div>
      
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>{isNew ? 'Criar novo serviço' : 'Editar serviço'}</CardTitle>
            <CardDescription>
              {isNew 
                ? 'Preencha os campos abaixo para criar um novo serviço' 
                : 'Atualize as informações do serviço conforme necessário'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Serviço *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ex: Consulta Psicológica"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="price">Preço (R$)</Label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="Ex: 150.00"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Descreva o serviço..."
                  rows={4}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="tempo_medio">Duração (minutos) *</Label>
                <Input
                  id="tempo_medio"
                  name="tempo_medio"
                  type="number"
                  min="5"
                  step="5"
                  value={formData.tempo_medio}
                  onChange={handleChange}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Tempo médio de duração do serviço em minutos
                </p>
              </div>
              
              <Separator />
              
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={handleSwitchChange}
                />
                <Label htmlFor="active">Serviço Ativo</Label>
                <p className="text-sm text-muted-foreground ml-2">
                  Serviços inativos não aparecem para agendamento
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline" asChild>
              <Link href="/services">Cancelar</Link>
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
