import { Button, DrawerFooter } from '@nextui-org/react'

export interface FooterProps {
  title: string
  color?:
    | 'danger'
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | undefined
  variant?:
    | 'light'
    | 'solid'
    | 'bordered'
    | 'flat'
    | 'faded'
    | 'shadow'
    | 'ghost'
    | undefined
  onClose: () => void
}

const Footer: React.FC<FooterProps> = ({
  title = 'Fechar',
  color = 'danger',
  variant = 'light',
  onClose
}) => {
  return (
    <DrawerFooter>
      <Button color={color} variant={variant} onPress={onClose}>
        {title}
      </Button>
    </DrawerFooter>
  )
}

export default Footer
