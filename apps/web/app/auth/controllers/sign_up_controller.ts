import type { HttpContext } from '@adonisjs/core/http'
import { signUpValidator } from '#auth/validators'
import { afterAuthRedirectRoute } from '#config/auth'
import User from '#users/models/user'

export default class SignUpController {
  async show({ inertia }: HttpContext) {
    return inertia.render('auth/sign_up')
  }

  async handle({ auth, request, response }: HttpContext) {
    const { email, password, fullName } = await request.validateUsing(signUpValidator)

    const user = await User.create({ fullName, email, password })

    await auth.use('web').login(user)

    return response.redirect().toRoute(afterAuthRedirectRoute)
  }
}
