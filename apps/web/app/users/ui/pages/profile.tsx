import type { InferPageProps } from '@adonisjs/inertia/types'
import AppLayout from '#common/ui/components/app_layout'
import HeadingSmall from '#common/ui/components/heading_small'
import { useTranslation } from '#common/ui/hooks/use_translation'
import type ProfileController from '#users/controllers/profile_controller'
import { ProfileForm } from '#users/ui/components/profile_form'
import SettingsLayout from '#users/ui/components/settings_layout'

export default function ProfilePage({ profile }: InferPageProps<ProfileController, 'show'>) {
  const { t } = useTranslation()
  const currentPath = '/settings/profile'

  return (
    <AppLayout breadcrumbs={[{ label: t('users.profile.breadcrumbs.settings') }]}>
      <SettingsLayout currentPath={currentPath}>
        <div className="flex h-full w-full flex-1 flex-col overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <HeadingSmall
              title={t('users.profile.title')}
              description={t('users.profile.description')}
            />

            <ProfileForm user={profile} />
          </div>
        </div>
      </SettingsLayout>
    </AppLayout>
  )
}
