"use client"

import useProfileModel from "./model"
import ProfileView from "./view"

export default function Profile() {
  const profileModel = useProfileModel()

  return <ProfileView {...profileModel} />
}
