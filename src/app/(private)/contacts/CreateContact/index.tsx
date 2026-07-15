"use client"

import useCreateContactModel from "./model"
import CreateContactView from "./view"

export default function CreateContact() {
  const CreateContactModel = useCreateContactModel()

  return <CreateContactView {...CreateContactModel} />
}
