import React from "react"
import Link from "next/link"
import useCompanyPageModel from "./model"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@nextui-org/react"
import CompanyAddress from "./company_address"
import { DashboardLayout } from "@/app/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { UserRound, Tag, Boxes, Handshake, Building2, CreditCard, Scroll, FileCheck, Award } from "lucide-react"
import CompanyAgreements from "./company_agreements"
import CompanyPaymentMethods from "./company_payment_methods"
import CompanyPolicies from "./company_policies"
import CompanySpecialties from "./company_specialties"

const companyLinks = [
  {
    title: "Profissionais",
    description: "Gerencie os profissionais da sua empresa",
    icon: <UserRound className="h-8 w-8 text-primary" />,
    href: "/professionals",
  },
  {
    title: "Categorias",
    description: "Organize seus produtos e serviços em categorias",
    icon: <Tag className="h-8 w-8 text-primary" />,
    href: "/categories",
  },
  {
    title: "Produtos",
    description: "Gerencie seu catálogo de produtos",
    icon: <Boxes className="h-8 w-8 text-primary" />,
    href: "/products",
  },
  {
    title: "Serviços",
    description: "Configure os serviços oferecidos pela sua empresa",
    icon: <Handshake className="h-8 w-8 text-primary" />,
    href: "/services",
  },
]

export default function CompanyPageView({
  register,
  handleSubmit,
  onSubmit,
  errors,
  isLoading,
}: ReturnType<typeof useCompanyPageModel>) {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-gray-50/30 p-6">
        {/* Header Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestão da Empresa</h1>
          <p className="text-gray-600">
            Acesse os diferentes módulos de gestão da sua empresa.
          </p>
        </div>

        {/* Navigation Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {companyLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              <Card className="group h-full bg-white border-0 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-teal-50 rounded-xl group-hover:bg-teal-100 transition-colors">
                      {React.cloneElement(link.icon, { className: "h-6 w-6 text-[#00897B]" })}
                    </div>
                    <div className="text-[#00897B] opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{link.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{link.description}</p>
                  <div className="mt-4">
                    <span className="inline-flex items-center text-sm font-medium text-[#00897B] group-hover:text-[#007366]">
                      Gerenciar
                      <svg className="ml-1 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Company Information */}
          <Card className="bg-white border-0 shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-50 rounded-lg">
                  <Building2 className="h-5 w-5 text-[#00897B]" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">Informações da Empresa</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Nome da Empresa</label>
                  <Input
                    type="text"
                    placeholder="Clínica Inclua+"
                    {...register("name")}
                    disabled={isLoading}
                    className="border-gray-200 focus:border-[#00897B] focus:ring-[#00897B]"
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Site da Empresa</label>
                  <Input
                    type="text"
                    placeholder="incluamaissaude.plano10.com.br"
                    {...register("site_url")}
                    disabled={isLoading}
                    className="border-gray-200 focus:border-[#00897B] focus:ring-[#00897B]"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Descrição da Empresa</label>
                  <Textarea
                    placeholder="teste"
                    rows={4}
                    {...register("description")}
                    disabled={isLoading}
                    className="border-gray-200 focus:border-[#00897B] focus:ring-[#00897B] resize-none"
                  />
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                    É importante você fornecer o máximo de informações possível de sua Empresa para os Assistentes saberem lidar melhor!
                  </p>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-[#00897B] hover:bg-[#007366] text-white font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  {isLoading ? "Atualizando..." : "Atualizar Informações"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Company Address */}
          <Card className="bg-white border-0 shadow-sm">
            <CompanyAddress />
          </Card>
        </div>

        {/* Bottom Section - Agreements, Payment Methods, Policies, Specialties */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <CompanyAgreements />
          <CompanyPaymentMethods />
          <CompanyPolicies />
          <CompanySpecialties />
        </div>
      </div>
    </DashboardLayout>
  )
}
