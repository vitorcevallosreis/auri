"use client"

import useCreateProductModel from "./model"
import CreateProductView from "./view"

export default function CreateProduct() {
  const CreateProductModel = useCreateProductModel()

  return <CreateProductView {...CreateProductModel} />
}
