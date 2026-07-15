"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TabletSmartphone, Settings, Shield, User, Bell } from "lucide-react"
import { DashboardLayout } from "@/app/layout/dashboard-layout"

const settingsLinks = [
  {
    title: "Meus Dispositivos",
    description: "Gerencie seus dispositivos conectados",
    icon: <TabletSmartphone className="h-8 w-8 text-[#00897B]" />,
    href: "/devices",
  },
  {
    title: "Preferências",
    description: "Personalize sua experiência no sistema",
    icon: <Settings className="h-8 w-8 text-[#00897B]" />,
    href: "/settings/preferences",
  },
  {
    title: "Segurança",
    description: "Configure opções de segurança e privacidade",
    icon: <Shield className="h-8 w-8 text-[#00897B]" />,
    href: "/settings/security",
  },
  {
    title: "Perfil",
    description: "Atualize suas informações pessoais",
    icon: <User className="h-8 w-8 text-[#00897B]" />,
    href: "/settings/profile",
  },
  {
    title: "Notificações",
    description: "Configure suas preferências de notificação",
    icon: <Bell className="h-8 w-8 text-[#00897B]" />,
    href: "/settings/notifications",
  },
]

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie suas configurações e preferências do sistema
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {settingsLinks.map((link) => (
            <Link href={link.href} key={link.href}>
              <Card className="h-full transition-all hover:bg-teal-50 hover:text-[#00897B]">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                  <CardTitle className="text-xl">{link.title}</CardTitle>
                  {link.icon}
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{link.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
