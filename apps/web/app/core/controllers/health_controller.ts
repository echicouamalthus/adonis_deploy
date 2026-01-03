import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class HealthController {
  async handle({ response }: HttpContext) {
    try {
      await db.rawQuery('SELECT 1')

      return response.ok({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      })
    } catch (error) {
      return response.serviceUnavailable({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      })
    }
  }
}
