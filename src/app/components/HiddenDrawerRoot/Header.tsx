import { DrawerHeader } from '@nextui-org/react'

interface HeaderProps {
  title?: string
}

const Header: React.FC<HeaderProps> = ({ title = 'Drawer' }) => {
  return <DrawerHeader className="flex flex-col gap-1">{title}</DrawerHeader>
}

export default Header
