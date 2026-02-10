import type { InferPageProps } from '@adonisjs/inertia/types'
import type ResetPasswordController from '#auth/controllers/reset_password_controller'
import AuthLayout from '#auth/ui/components/layout'
import { ResetPasswordForm } from '#auth/ui/components/reset_password_form'

export default function ResetPasswordPage(props: InferPageProps<ResetPasswordController, 'show'>) {
  return (
    <AuthLayout>
      <ResetPasswordForm token={props.token} />
    </AuthLayout>
  )
}
