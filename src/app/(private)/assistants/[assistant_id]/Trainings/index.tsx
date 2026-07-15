"use client"

import useTrainingsModel from "./model"
import TrainingsView from "./view"

export default function Trainings() {
  const trainingsModel = useTrainingsModel()

  return <TrainingsView {...trainingsModel} />
}
