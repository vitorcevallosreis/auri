import React from "react"
import useContactsModel from "./model"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import CreateContact from "./CreateContact"
import { Avatar } from "@nextui-org/react"
import { Users } from "lucide-react"

export default function ContactsView({
  isLoading,
  contacts,
  searchTerm,
  handleSearch,
}: ReturnType<typeof useContactsModel>) {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Cadastro de Pacientes</h1>
            <p className="text-muted-foreground mt-1">Gerenciamento completo dos pacientes da clínica.</p>
          </div>
          <CreateContact />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Pacientes</p>
                <h2 className="text-4xl font-bold mt-1">{contacts.length}</h2>
                <p className="text-sm text-muted-foreground mt-1">Pacientes na base de dados</p>
              </div>
              <div className="bg-teal-50 p-3 rounded-full">
                <Users className="h-6 w-6 text-[#00897B]" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border shadow-sm p-6">
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-medium">Lista de Pacientes</h2>
              <div className="relative w-72">
                <input
                  type="text"
                  placeholder="Buscar por nome ou telefone..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#00897B] focus:border-transparent"
                  value={searchTerm || ''}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                <div className="absolute left-3 top-2.5 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <path d="m21 21-4.3-4.3"></path>
                  </svg>
                </div>
              </div>
            </div>
            
            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-4 font-medium text-gray-500 text-sm">Nome</th>
                    <th className="text-left py-4 font-medium text-gray-500 text-sm">Telefone</th>
                    <th className="text-left py-4 font-medium text-gray-500 text-sm">Verificado</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-4">
                        <div className="flex items-center space-x-3">
                          <Avatar
                            isBordered
                            color="default"
                            src={contact?.avatar_url as string}
                            className="h-8 w-8"
                          />
                          <span className="font-medium">{contact.name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-gray-600">{contact.number}</td>
                      <td className="py-4">
                        {contact.checked ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-green-400" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                            Sim
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <svg className="-ml-0.5 mr-1.5 h-2 w-2 text-red-400" fill="currentColor" viewBox="0 0 8 8">
                              <circle cx="4" cy="4" r="3" />
                            </svg>
                            Não
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
