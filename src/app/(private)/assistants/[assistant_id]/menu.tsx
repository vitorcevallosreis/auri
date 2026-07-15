import { Book, Link, Database, Settings, Clock } from "lucide-react"
import { MenuItem } from "./model"

export const menuData: MenuItem[] = [
  {
    id: "dados",
    label: "Dados",
    icon: <Database />,
    subItems: [
      { id: "profile", label: "Perfil" },
      { id: "settings", label: "Configurações" },
    ],
  },
  {
    id: "conhecimento",
    label: "Conhecimento",
    icon: <Book />,
    subItems: [
      { id: "trainings", label: "Treinamentos" },
      { id: "personality", label: "Personalidade" },
      { id: "statistic", label: "Estatísticas" },
    ],
  },
  {
    id: "connections",
    label: "Conexões",
    icon: <Link />,
    subItems: [
      { id: "channels", label: "Canais" },
      { id: "integrations", label: "Integrações" },
      { id: "followups", label: "Follow-ups" },
    ],
  },
  {
    id: "assistant_settings",
    label: "Configurações",
    icon: <Settings />,
    subItems: [
      {
        id: "assistant_settings",
        label: "API",
      },
    ],
  },
]
