import { Dispatch, SetStateAction } from "react"
import useContactLabelsModel from "./model"
import ContactLabelsView from "./view"

interface ContactLabelsProps {
  is_open: boolean
  set_is_open: Dispatch<SetStateAction<boolean>>
}

export default function ContactLabels({
  is_open,
  set_is_open,
}: ContactLabelsProps) {
  const ContactLabelsModel = useContactLabelsModel(is_open, set_is_open)

  return <ContactLabelsView {...ContactLabelsModel} />
}
