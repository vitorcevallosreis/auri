import React from "react"
import { ModalFooter } from "@nextui-org/react"

interface FooterProps {
  children: React.ReactNode;
}

const Footer: React.FC<FooterProps> = ({ children }) => {
  return <ModalFooter>{children}</ModalFooter>
}

export default Footer
