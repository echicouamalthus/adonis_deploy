import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { scanThrottle } from '#start/limiter'

const ScansController = () => import('#scans/controllers/api/scans_controller')

router
  .group(() => {
    router.post('/scans', [ScansController, 'store']).as('scans.store').use(scanThrottle)
    router.get('/scans', [ScansController, 'index']).as('scans.index')
    router.get('/scans/:id', [ScansController, 'show']).as('scans.show')
  })
  .prefix('/api')
  .middleware(middleware.auth({ guards: ['api'] }))
