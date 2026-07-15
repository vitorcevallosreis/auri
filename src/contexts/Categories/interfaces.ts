export interface CategoriesProps {
  children: React.ReactNode
}

export interface CategoriesContextType {
  isLoading: boolean
  getCategories: () => Promise<void>
  categories: Category[]
  category: Category
  getCategory: (category_id: string) => Promise<void>
  createCategory: (body: BodyCreateCategory) => Promise<void>
  updateCategory: (
    category_id: string,
    body: BodyUpdateCategory
  ) => Promise<void>
  destroyCategory: (category_id: string) => Promise<void>
}

export interface Defaults {
  isLoading: boolean
  categories: Category[]
  category: Category
}

export interface Category {
  id: string
  name: string
  company_id: string
}

export interface BodyCreateCategory {
  name: string
}

export interface BodyUpdateCategory {
  name: string
}
