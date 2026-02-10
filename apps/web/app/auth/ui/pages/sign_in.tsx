import AuthLayout from '#auth/ui/components/layout'
import { LoginForm } from '#auth/ui/components/login_form'

export default function SignInPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  )
}
