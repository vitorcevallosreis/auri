"use client"

import useServicesModel from "./model"
import ServicesView from "./view"

export default function Services() {
  const ServicesModel = useServicesModel()

  return <ServicesView {...ServicesModel} />
}
