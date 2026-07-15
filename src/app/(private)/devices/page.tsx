"use client"

import useDevicesModel from "./model"
import DevicesView from "./view"

export default function Devices() {
  const DevicesModel = useDevicesModel()

  return <DevicesView {...DevicesModel} />
}
