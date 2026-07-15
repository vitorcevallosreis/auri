"use client"

import useRegisterPageModel from "./model"
import RegisterPageView from "./view"

export default function RegisterPage() {
  const registerPageModel = useRegisterPageModel()

  return <RegisterPageView {...registerPageModel} />
}
