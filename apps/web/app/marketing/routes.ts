/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/
import router from '@adonisjs/core/services/router'

const MarketingController = () => import('#marketing/controllers/marketing_controller')
const HealthController = () => import('#core/controllers/health_controller')
const HelloController = () => import('#marketing/controllers/hello_controller')

router.get('/', [MarketingController]).as('marketing.show')
router.get('/health', [HealthController]).as('health.check')

router.get('api/hello', [HelloController]).as('api.hello')
