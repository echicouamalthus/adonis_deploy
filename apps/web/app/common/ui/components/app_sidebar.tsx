import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@workspace/ui/components/sidebar'
import type React from 'react'
import { AppLogo } from '#common/ui/components/app_logo'
import { NavSidebarMain } from '#common/ui/components/nav_sidebar_main'
import type { NavMainItem } from '#common/ui/types/navigation'

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  navMain: NavMainItem[]
}

export function AppSidebar({ navMain, ...props }: AppSidebarProps) {
  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <div>
                <AppLogo />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavSidebarMain items={navMain} />
      </SidebarContent>
    </Sidebar>
  )
}
