"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "next-themes"
import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/app/layout/dashboard-layout"

export default function PreferencesPage() {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [notifications, setNotifications] = useState(true)
  const [sounds, setSounds] = useState(true)
  const [chatAutoScroll, setChatAutoScroll] = useState(true)

  return (
    <DashboardLayout>
      <div className="container py-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5 text-[#00897B]" />
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Preferências</h1>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Aparência</CardTitle>
              <CardDescription>
                Personalize a aparência do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup 
                defaultValue={theme} 
                onValueChange={(value) => setTheme(value)}
                className="space-y-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="light" id="light-theme" className="text-[#00897B] border-[#00897B] focus:ring-[#00897B]" />
                  <Label htmlFor="light-theme">Tema Claro</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dark" id="dark-theme" className="text-[#00897B] border-[#00897B] focus:ring-[#00897B]" />
                  <Label htmlFor="dark-theme">Tema Escuro</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="system" id="system-theme" className="text-[#00897B] border-[#00897B] focus:ring-[#00897B]" />
                  <Label htmlFor="system-theme">Usar tema do sistema</Label>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notificações</CardTitle>
              <CardDescription>
                Configure suas preferências de notificação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications">Notificações de mensagens</Label>
                <Switch 
                  id="notifications" 
                  checked={notifications}
                  onCheckedChange={setNotifications}
                  className="data-[state=checked]:bg-[#00897B]"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sounds">Sons de notificação</Label>
                <Switch 
                  id="sounds" 
                  checked={sounds}
                  onCheckedChange={setSounds}
                  className="data-[state=checked]:bg-[#00897B]"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Comportamento</CardTitle>
              <CardDescription>
                Configure o comportamento da aplicação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="auto-scroll" className="block">Auto-scroll em chats</Label>
                  <p className="text-sm text-muted-foreground">Rolar automaticamente para a mensagem mais recente</p>
                </div>
                <Switch 
                  id="auto-scroll" 
                  checked={chatAutoScroll}
                  onCheckedChange={setChatAutoScroll}
                  className="data-[state=checked]:bg-[#00897B]"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end mt-4">
            <Button className="bg-[#00897B] hover:bg-[#007366] text-white">Salvar Preferências</Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
