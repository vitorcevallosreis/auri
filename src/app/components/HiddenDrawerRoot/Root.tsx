import { Drawer, DrawerContent, DrawerBody } from '@nextui-org/react'
import RootDrawerHeader from './Header'
import RootDrawerFooter, { FooterProps } from './Footer'

interface RootProps {
  isOpen: boolean
  onClose: () => void
  size?:
    | 'xs'
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | '3xl'
    | '4xl'
    | '5xl'
    | 'full'
    | undefined
  backdrop?: 'opaque' | 'blur' | 'transparent'
  children: React.ReactNode
  header_title?: string
  triggerButtonCloseProps: Omit<FooterProps, 'onClose'>
}

const Root: React.FC<RootProps> = ({
  isOpen,
  size = 'xl',
  backdrop = 'blur',
  header_title,
  children,
  triggerButtonCloseProps,
  onClose
}) => {
  return (
    <Drawer isOpen={isOpen} backdrop={backdrop} size={size} onClose={onClose}>
      <DrawerContent>
        <RootDrawerHeader title={header_title} />
        <DrawerBody>{children}</DrawerBody>

        <RootDrawerFooter {...triggerButtonCloseProps} onClose={onClose} />
      </DrawerContent>
    </Drawer>
  )
}

export default Root
