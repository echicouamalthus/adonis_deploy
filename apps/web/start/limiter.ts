/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. Feel free to define as many
| throttle middleware as needed.
|
*/

import limiter from '@adonisjs/limiter/services/main'

export const throttle = limiter.define('global', () => {
  return limiter
    .allowRequests(10)
    .every('1 minute')
    .blockFor('10 mins')
    .limitExceeded((error) => {
      error.t('errors.rate_limited', {
        limit: error.response.limit,
        remaining: error.response.remaining,
      })
    })
})

/**
 * Limiter pour les scans (appel Gemini = coûteux).
 * 5 scans par minute par utilisateur.
 */
export const scanThrottle = limiter.define('scan', (ctx) => {
  return limiter
    .allowRequests(5)
    .every('1 minute')
    .blockFor('1 min')
    .usingKey(`scan_${ctx.auth?.user?.id ?? ctx.request.ip()}`)
})
