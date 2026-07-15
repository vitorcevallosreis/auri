"use client"

import { Product } from "@/contexts/Products/interfaces"
import useUpdateProductModel from "./model"
import UpdateProductView from "./view"

interface ProductProps {
  product: Product
}

export default function UpdateProduct({ product }: ProductProps) {
  const UpdateProductModel = useUpdateProductModel(product)

  return <UpdateProductView {...UpdateProductModel} />
}
