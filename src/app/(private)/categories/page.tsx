"use client"

import useCategoriesModel from "./model"
import CategoriesView from "./view"

export default function Categories() {
  const CategoriesModel = useCategoriesModel()

  return <CategoriesView {...CategoriesModel} />
}
