import { type LucideIcon, Shield, User } from 'lucide-react'
import type { SimpleTFunction } from '#common/ui/hooks/use_translation'
import Roles from '#users/enums/role'

export type Role = {
  label: string
  value: string
  icon?: LucideIcon
}

export function userRoles(t: SimpleTFunction): Role[] {
  return [
    {
      value: String(Roles.ADMIN),
      label: t(`users.roles.${Roles.ADMIN}.name`),
      icon: Shield,
    },
    {
      value: String(Roles.USER),
      label: t(`users.roles.${Roles.USER}.name`),
      icon: User,
    },
  ] as const
}
