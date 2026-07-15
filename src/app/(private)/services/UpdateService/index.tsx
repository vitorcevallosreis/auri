"use client"

import { Service } from "@/contexts/Services/interfaces"
import useUpdateServiceModel from "./model"
import UpdateServiceView from "./view"

export default function UpdateService({ service }: { service: Service }) {
  const UpdateServiceModel = useUpdateServiceModel(service)

  return <UpdateServiceView {...UpdateServiceModel} />
}
