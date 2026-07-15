import { AuthContext } from "@/contexts/Auth"
import { CategoriesContext } from "@/contexts/Categories"
import { Category } from "@/contexts/Categories/interfaces"
import { ServicesContext } from "@/contexts/Services"
import { Service } from "@/contexts/Services/interfaces"
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react"

export interface IServicesModel {
  deleteService: (service_id: string) => Promise<void>
  categories: Category[]
  filteredServices: Service[]
  selectedCategory: string | null
  setSelectedCategory: Dispatch<SetStateAction<string | null>>
  isLoading: boolean
  services: Service[]
}

const useServicesModel = (): IServicesModel => {
  const { user } = useContext(AuthContext)
  const { getServices, services, deleteService, isLoading } =
    useContext(ServicesContext)
  const { getCategories, categories } = useContext(CategoriesContext)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    getServices()
    getCategories()
  }, [user])

  const filteredServices = selectedCategory
    ? services.filter((service) => service.category_id === selectedCategory)
    : services

  return {
    services,
    deleteService,
    categories,
    filteredServices,
    selectedCategory,
    setSelectedCategory,
    isLoading,
  }
}

export default useServicesModel
