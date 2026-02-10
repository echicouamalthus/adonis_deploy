import usePageProps from '#common/ui/hooks/use_page_props'

import type UserDto from '#users/dtos/user'

export default function useUser() {
  const { user } = usePageProps<{ user: UserDto }>()
  return user
}
