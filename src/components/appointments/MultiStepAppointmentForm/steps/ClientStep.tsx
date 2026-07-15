'use client';

import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/contexts/Auth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { User, UserPlus, UserX, Search, CheckCircle, Edit, X, Save, Loader2, Phone } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/lib/supabase/config';
import { AppointmentFormData } from '..';

interface Contact {
  id: string;
  name: string;
  number?: string;
}

interface ClientStepProps {
  formData: AppointmentFormData;
  updateFormData: (data: Partial<AppointmentFormData>) => void;
  isEdit: boolean;
}

export const ClientStep: React.FC<ClientStepProps> = ({
  formData,
  updateFormData,
  isEdit
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | undefined>(formData.client.id);
  const [createNew, setCreateNew] = useState(!formData.client.id);
  const { user } = useContext(AuthContext);
  
  // Dados do formulário para novo cliente
  const [newClient, setNewClient] = useState({
    name: formData.client.name || '',
    phone: formData.client.phone || '',
    email: formData.client.email || ''
  });

  // Buscar contatos
  useEffect(() => {
    const fetchContacts = async () => {
      setIsLoading(true);
      try {
        // Verificar se temos o company_id do usuário
        if (!user?.company_id) {
          console.error('Company ID não disponível');
          return;
        }

        let query = supabase
          .from('myia_contacts')
          .select('id, name, number')
          .eq('company_id', user.company_id);
        
        if (searchQuery) {
          // Usar ilike para busca de texto simples em vez de textSearch
          query = query.ilike('name', `%${searchQuery}%`);
        }
        
        const { data, error } = await query.limit(20);
        
        if (error) {
          throw error;
        }
        
        setContacts(data || []);
      } catch (error) {
        console.error('Erro ao buscar contatos:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchContacts();
  }, [searchQuery]);

  // Atualizar dados do formulário quando o cliente selecionado mudar
  useEffect(() => {
    if (createNew) {
      // Verificar se os dados realmente mudaram antes de atualizar
      const nameChanged = newClient.name !== formData.client.name;
      const phoneChanged = newClient.phone !== formData.client.phone;
      const emailChanged = newClient.email !== formData.client.email;
      const idChanged = formData.client.id !== undefined;
      
      if (nameChanged || phoneChanged || emailChanged || idChanged) {
        updateFormData({
          client: {
            id: undefined,
            name: newClient.name,
            phone: newClient.phone,
            email: newClient.email
          }
        });
      }
    } else if (selectedContactId) {
      const selectedContact = contacts.find(c => c.id === selectedContactId);
      if (selectedContact) {
        // Verificar se os dados realmente mudaram antes de atualizar
        const idChanged = selectedContact.id !== formData.client.id;
        const nameChanged = selectedContact.name !== formData.client.name;
        const phoneChanged = selectedContact.number !== formData.client.phone;
        
        if (idChanged || nameChanged || phoneChanged) {
          updateFormData({
            client: {
              id: selectedContact.id,
              name: selectedContact.name,
              phone: selectedContact.number,
              email: undefined
            }
          });
        }
      }
    }
  }, [selectedContactId, createNew, newClient, contacts, formData.client]);

  const handleContactSelect = (contactId: string) => {
    setSelectedContactId(contactId);
    setCreateNew(false);
  };

  const handleNewClientChange = (field: keyof typeof newClient, value: string) => {
    setNewClient(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <div className="bg-blue-50 p-4 border-b">
          <h3 className="text-base font-medium text-blue-700 flex items-center">
            <User className="mr-2 h-5 w-5" />
            Selecione ou crie um cliente
          </h3>
        </div>
        
        <div className="p-4">
          <RadioGroup 
            value={createNew ? 'new' : 'existing'} 
            onValueChange={(value) => setCreateNew(value === 'new')}
            className="flex flex-col md:flex-row gap-4 mb-4 p-3 bg-gray-50 rounded-md border"
          >
            <div className="flex items-center space-x-2 flex-1 p-2 rounded-md hover:bg-white transition-colors">
              <RadioGroupItem value="existing" id="existing" className="text-blue-600" />
              <Label htmlFor="existing" className="flex items-center cursor-pointer">
                <User className="mr-2 h-5 w-5 text-blue-600" />
                <span className="font-medium">Selecionar cliente existente</span>
              </Label>
            </div>
            <div className="flex items-center space-x-2 flex-1 p-2 rounded-md hover:bg-white transition-colors">
              <RadioGroupItem value="new" id="new" className="text-green-600" />
              <Label htmlFor="new" className="flex items-center cursor-pointer">
                <UserPlus className="mr-2 h-5 w-5 text-green-600" />
                <span className="font-medium">Criar novo cliente</span>
              </Label>
            </div>
          </RadioGroup>

          {!createNew ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar cliente por nome, telefone ou email"
                  className="pl-10 py-6 border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="border rounded-md overflow-hidden shadow-sm">
                {isLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
                    <p className="text-gray-500">Buscando clientes...</p>
                  </div>
                ) : contacts.length === 0 ? (
                  <div className="p-8 text-center">
                    <UserX className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600 mb-2">Nenhum cliente encontrado.</p>
                    <p className="text-sm text-gray-500 mb-4">Tente outra busca ou crie um novo cliente.</p>
                    <Button
                      variant="outline"
                      onClick={() => setCreateNew(true)}
                      className="bg-white"
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Criar novo cliente
                    </Button>
                  </div>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto">
                    <div className="divide-y">
                      {contacts.map((contact) => (
                        <div
                          key={contact.id}
                          className={`p-4 hover:bg-blue-50 cursor-pointer transition-colors ${
                            selectedContactId === contact.id ? 'bg-blue-100 border-l-4 border-blue-500' : ''
                          }`}
                          onClick={() => handleContactSelect(contact.id)}
                        >
                          <div className="flex items-center">
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{contact.name}</div>
                              {contact.number && (
                                <div className="text-sm text-gray-500 flex items-center mt-1">
                                  <Phone className="h-3.5 w-3.5 mr-1.5" />
                                  {contact.number}
                                </div>
                              )}
                            </div>
                            {selectedContactId === contact.id && (
                              <CheckCircle className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border p-4 shadow-sm">
              <div className="flex items-center mb-4 text-green-700">
                <UserPlus className="h-5 w-5 mr-2" />
                <h4 className="font-medium">Informações do novo cliente</h4>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-gray-700">Nome do cliente *</Label>
                  <Input
                    id="name"
                    value={newClient.name}
                    onChange={(e) => handleNewClientChange('name', e.target.value)}
                    className="border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-gray-700">Telefone</Label>
                  <Input
                    id="phone"
                    value={newClient.phone}
                    onChange={(e) => handleNewClientChange('phone', e.target.value)}
                    className="border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) => handleNewClientChange('email', e.target.value)}
                    className="border-gray-300 focus:border-blue-400 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
