import React from "react"
import { ModalBody } from "@nextui-org/react"

interface BodyProps {
  children: React.ReactNode;
}

const Body: React.FC<BodyProps> = ({ children }) => {
  return <ModalBody>{children}</ModalBody>
}

export default Body
