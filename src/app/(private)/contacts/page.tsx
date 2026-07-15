"use client"

import useContactsModel from "./model"
import ContactsView from "./view"

export default function Contacts() {
  const ContactsModel = useContactsModel()

  return <ContactsView {...ContactsModel} />
}
