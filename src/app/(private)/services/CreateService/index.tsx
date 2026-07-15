"use client"

import useCreateServiceModel from "./model"
import CreateServiceView from "./view"

export default function CreateService() {
  const CreateServiceModel = useCreateServiceModel()

  return <CreateServiceView {...CreateServiceModel} />
}
