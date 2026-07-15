"use client"

import usePersonalityModel from "./model"
import PersonalityView from "./view"

export default function Personality() {
  const personalityModel = usePersonalityModel()

  return <PersonalityView {...personalityModel} />
}
