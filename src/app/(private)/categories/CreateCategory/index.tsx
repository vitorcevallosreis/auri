"use client"

import useCreateCategoryModel from "./model"
import CreateCategoryView from "./view"

export default function CreateCategory() {
  const CreateCategoryModel = useCreateCategoryModel()

  return <CreateCategoryView {...CreateCategoryModel} />
}
