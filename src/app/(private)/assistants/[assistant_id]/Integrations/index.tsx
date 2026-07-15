"use client"

import useIntegrationsModel from "./model"
import IntegrationsView from "./view"

export default function Integrations() {
  const integrationsModel = useIntegrationsModel()

  return <IntegrationsView {...integrationsModel} />
}
