import { Defaults } from "./interfaces"

export const Default: Defaults = {
  isLoading: false,
  categories: [],
  category: {
    id: "",
    name: "",
    children: false,
    parent_id: "",
    company_id: "",
  },
  children_categories: [],
}
