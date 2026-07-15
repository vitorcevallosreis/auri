"use client"

import useLoginPageModel from "./model"
import LoginPageView from "./view"

export default function HomePage() {
  const loginPageModel = useLoginPageModel()

  return <LoginPageView {...loginPageModel} />
}
