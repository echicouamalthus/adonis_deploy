import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const SharesController = () => import('#shares/controllers/api/share_controller')

router
  .group(() => {
    router.post('/shares', [SharesController, 'store']).as('shares.store')
    router.get('/shares/stats', [SharesController, 'stats']).as('shares.stats')
  })
  .prefix('/api')
  .middleware(middleware.auth({ guards: ['api'] }))

// Route publique (pas d'auth) - page de partage
router.get('/s/:shareCode', [SharesController, 'show']).as('shares.public')
