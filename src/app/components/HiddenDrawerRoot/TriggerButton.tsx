import { Button } from '@nextui-org/react'

export interface TriggerButtonProps {
  title?: string
  onOpen: () => void
  variant?:
    | 'solid'
    | 'bordered'
    | 'light'
    | 'flat'
    | 'faded'
    | 'shadow'
    | 'ghost'
    | undefined
  color?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'success'
    | 'warning'
    | 'danger'
    | undefined
}

const TriggerButton: React.FC<TriggerButtonProps> = ({
  title = 'Abrir Drawer',
  variant = 'solid',
  color = 'default',
  onOpen
}) => {
  return (
    <Button variant={variant} color={color} onPress={onOpen}>
      {title}
    </Button>
  )
}

export default TriggerButton
