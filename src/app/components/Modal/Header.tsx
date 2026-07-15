import React from "react"
import { ModalHeader } from "@nextui-org/react"

interface HeaderProps {
  children: React.ReactNode | string;
}

const Header: React.FC<HeaderProps> = ({ children }) => {
  return <ModalHeader className="flex flex-col gap-1">{children}</ModalHeader>
}

export default Header
