import React from "react"
import { Modal, ModalContent } from "@nextui-org/react"

// DOCS => https://nextui.org/docs/components/modal#sizes

interface ModalRootProps {
  children: React.ReactNode;
  isOpen: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: React.ReactElement;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "full" | undefined;
  backdrop?: "transparent" | "opaque" | "blur";
  placement?: "auto" | "top" | "center" | "bottom";
  shadow?: "sm" | "md" | "lg" | undefined;
  radius?: "sm" | "md" | "lg" | undefined;
}

const ModalRoot: React.FC<ModalRootProps> = ({
  isOpen,
  onOpenChange,
  triggerButton,
  children,
  size = "4xl",
  backdrop = "opaque",
  placement = "center",
  shadow = "sm",
  radius = "sm",
}) => {
  const handleOpenChange = (open: boolean) => {
    if (onOpenChange) return onOpenChange(open)
  }

  return (
    <>
      {triggerButton && React.cloneElement(triggerButton, { onClick: () => handleOpenChange(true) })}

      <Modal
        isOpen={isOpen}
        onOpenChange={handleOpenChange}
        size={size}
        backdrop={backdrop}
        placement={placement}
        radius={radius}
        shadow={shadow}
      >
        <ModalContent>{children}</ModalContent>
      </Modal>
    </>
  )
}

export default ModalRoot
