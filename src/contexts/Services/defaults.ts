import { Defaults, Service } from "./interfaces"

export const Default: Defaults = {
  isLoading: false,
  services: [],
  service: {
    id: "",
    created_at: "",
    name: "",
    price: 0,
    description: "",
    tempo_medio: "60",
    available: true,
    company_id: "",
    image_path: null,
    aceita_convenio: false,
    valores_convenios: null,
  },
}
