"use client"

import useSettingModel from "./model"
import SettingView from "./view"

export default function Setting() {
  const settingModel = useSettingModel()

  return <SettingView {...settingModel} />
}
