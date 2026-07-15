"use client"

import useStatisticModel from "./model"
import StatisticView from "./view"

export default function Statistic() {
  const StatisticModel = useStatisticModel()

  return <StatisticView {...StatisticModel} />
}
