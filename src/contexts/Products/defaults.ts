import { Defaults } from "./interfaces"

export const Default: Defaults = {
  isLoading: false,
  products: [],
  product: {
    id: "",
    name: "",
    description: "",
    price: 0.0,
    category_id: "",
    available: false,
    company_id: "",
    created_at: "",
    image_path: "",
  },
}
