"use client"

import useProductsModel from "./model"
import ProductsView from "./view"

export default function Products() {
  const ProductsModel = useProductsModel()

  return <ProductsView {...ProductsModel} />
}
