"use client"

import useResetPasswordModel from "./model"
import ResetPasswordView from "./view"

export default function ResetPassword() {
  const ResetPasswordModel = useResetPasswordModel()

  return <ResetPasswordView {...ResetPasswordModel} />
}
