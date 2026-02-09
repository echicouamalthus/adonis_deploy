import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const CreditsController = () => import('#credits/controllers/api/credit_controller')
const RevenuecatWebhookController = () =>
  import('#credits/controllers/api/revenuecat_webhook_controller')

router
  .group(() => {
    router.get('/credits', [CreditsController, 'show']).as('credits.show')
    router.get('/credits/history', [CreditsController, 'history']).as('credits.history')
  })
  .prefix('/api')
  .middleware(middleware.auth({ guards: ['api'] }))

// Webhook RevenueCat (pas d'auth utilisateur, vérifié par secret)
router
  .post('/api/webhooks/revenuecat', [RevenuecatWebhookController, 'handle'])
  .as('webhooks.revenuecat')
