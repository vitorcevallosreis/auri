import { Dispatch, SetStateAction } from "react"
import useContactInfoModel from "./model"
import ContactInfoView from "./view"

interface ContactInfoProps {
  is_open: boolean
  set_is_open: Dispatch<SetStateAction<boolean>>
}

export default function ContactInfo({
  is_open,
  set_is_open,
}: ContactInfoProps) {
  const ContactInfoModel = useContactInfoModel(is_open, set_is_open)

  return <ContactInfoView {...ContactInfoModel} />
}
