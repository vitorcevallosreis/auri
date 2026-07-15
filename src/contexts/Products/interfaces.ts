export interface ProductsProps {
  children: React.ReactNode
}

export interface ProductsContextType {
  isLoading: boolean
  getProducts: () => Promise<void>
  products: Product[]
  getProduct: (product_id: string) => Promise<void>
  product: Product
  createProduct: (body: BodyCreateProduct) => Promise<void>
  updateProduct: (product_id: string, body: BodyUpdateProduct) => Promise<void>
  deleteProduct: (product_id: string) => Promise<void>
  uploadImageProduct: (
    product: Product,
    file: File,
    file_path: string
  ) => Promise<boolean>
}

export interface Defaults {
  isLoading: boolean
  products: Product[]
  product: Product
}

export interface Product {
  id: string
  created_at: string
  category_id: string
  name: string
  price: number
  description: string
  available: boolean
  company_id: string
  image_path: string | null
}

export interface BodyCreateProduct {
  category_id: string
  name: string
  price: number
  description: string
  available: boolean
}

export interface BodyUpdateProduct {
  category_id: string
  name: string
  price: number
  description: string
  available: boolean
}
