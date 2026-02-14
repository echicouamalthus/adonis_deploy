/*
|--------------------------------------------------------------------------
| HTTP kernel file
|--------------------------------------------------------------------------
|
| The HTTP kernel file is used to register the middleware with the server
| or the router.
|
*/

import app from '@adonisjs/core/services/app'
import router from '@adonisjs/core/services/router'
import server from '@adonisjs/core/services/server'

/**
 * The error handler is used to convert an exception
 * to a HTTP response.
 */
server.errorHandler(() => import('#core/exceptions/handler'))

/**
 * The server middleware stack runs middleware on all the HTTP
 * requests, even if there is no route registered for
 * the request URL.
 */
const serverMiddleware: any[] = [
  () => import('#core/middleware/container_bindings_middleware'),
  () => import('@adonisjs/static/static_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
]

// Exclure Vite et Inertia en environnement test
if (!app.inTest) {
  serverMiddleware.push(() => import('@adonisjs/vite/vite_middleware'))
  serverMiddleware.push(() => import('@adonisjs/inertia/inertia_middleware'))
}

server.use(serverMiddleware)

/**
 * The router middleware stack runs middleware on all the HTTP
 * requests with a registered route.
 */
router.use([
  () => import('@adonisjs/core/bodyparser_middleware'),
  () => import('@adonisjs/session/session_middleware'),
  () => import('@adonisjs/shield/shield_middleware'),
  () => import('@adonisjs/auth/initialize_auth_middleware'),
  () => import('#core/middleware/initialize_bouncer_middleware'),
  () => import('#core/middleware/detect_user_locale_middleware'),
])

/**
 * Named middleware collection must be explicitly assigned to
 * the routes or the routes group.
 */
export const middleware = router.named({
  guest: () => import('#auth/middleware/guest_middleware'),
  auth: () => import('#auth/middleware/auth_middleware'),
  switchLocale: () => import('#common/middlewares/switch_locale_middleware'),
})
