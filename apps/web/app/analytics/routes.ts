/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const DashboardController = () => import('#analytics/controllers/dashboard_controller')

router.get('/dashboard', [DashboardController]).middleware(middleware.auth()).as('dashboard.show')
