"use client"

import useCallsModel from "./model"
import CallsView from "./view"

export default function Calls() {
  const CallsModel = useCallsModel()

  return <CallsView {...CallsModel} />
}
