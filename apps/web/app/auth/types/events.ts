import type { MailBasicTranslation } from '#common/models/mail_basic_translation'
import type User from '#users/models/user'

declare module '@adonisjs/core/types' {
  interface EventsList {
    'auth:forgot_password': { user: User; token: string; translations: MailBasicTranslation }
  }
}
