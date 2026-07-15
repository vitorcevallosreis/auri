import { AuthContext } from "@/contexts/Auth"
import { CategoriesContext } from "@/contexts/Categories"
import { Category } from "@/contexts/Categories/interfaces"
import { ProductsContext } from "@/contexts/Products"
import { Product } from "@/contexts/Products/interfaces"
import {
  Dispatch,
  SetStateAction,
  useContext,
  useEffect,
  useState,
} from "react"

export interface IProductsModel {
  deleteProduct: (product_id: string) => Promise<void>
  categories: Category[]
  filteredProducts: Product[]
  selectedCategory: string | null
  setSelectedCategory: Dispatch<SetStateAction<string | null>>
}

const useProductsModel = (): IProductsModel => {
  const { user } = useContext(AuthContext)
  const { getProducts, products, deleteProduct } = useContext(ProductsContext)
  const { getCategories, categories } = useContext(CategoriesContext)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  useEffect(() => {
    getProducts()
    getCategories()
  }, [user])

  const filteredProducts = selectedCategory
    ? products.filter((product) => product.category_id === selectedCategory)
    : products

  return {
    deleteProduct,
    categories,
    filteredProducts,
    selectedCategory,
    setSelectedCategory,
  }
}

export default useProductsModel
