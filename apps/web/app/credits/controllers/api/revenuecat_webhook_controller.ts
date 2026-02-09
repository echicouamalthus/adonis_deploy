import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'
import CreditService from '#credits/services/credit_service'
import CreditTransaction from '#credits/models/credit_transactions'
import { revenuecatWebhookValidator } from '#credits/validators'

export default class RevenuecatWebhookController {
  private creditService: CreditService

  constructor() {
    this.creditService = new CreditService()
  }

  /**
   * POST /api/webhooks/revenuecat
   * Reçoit les événements d'achat RevenueCat
   */
  async handle({ request, response }: HttpContext) {
    // Vérifier le secret webhook
    const secret = env.get('REVENUECAT_WEBHOOK_SECRET')
    const authHeader = request.header('authorization')

    if (secret && authHeader !== `Bearer ${secret}`) {
      logger.warn('RevenueCat webhook: Invalid secret', { authHeader })
      return response.unauthorized({ error: 'Invalid webhook secret' })
    }

    // Valider le payload
    const payload = await request.validateUsing(revenuecatWebhookValidator)
    const event = payload.event

    logger.info('RevenueCat webhook received', {
      eventType: event.type,
      userId: event.app_user_id,
      productId: event.product_id,
      eventId: event.id,
    })

    // Traiter uniquement les achats initiaux (non-consumable credit packs)
    if (event.type !== 'INITIAL_PURCHASE' && event.type !== 'NON_RENEWING_PURCHASE') {
      return response.ok({ received: true, skipped: true })
    }

    const appUserId = event.app_user_id
    const productId = event.product_id
    const eventId = event.id

    if (!appUserId || !productId) {
      return response.badRequest({ error: 'Missing app_user_id or product_id' })
    }

    if (!eventId) {
      return response.badRequest({ error: 'Missing event.id for idempotency' })
    }

    // Trouver le pack correspondant au product_id
    const pack = Object.values(CreditService.PACKS).find((p) => p.priceId === productId)

    if (!pack) {
      logger.warn('RevenueCat webhook: Unknown product', { productId })
      return response.badRequest({ error: `Unknown product_id: ${productId}` })
    }

    // Créditer l'utilisateur
    const userId = Number.parseInt(appUserId, 10)

    if (Number.isNaN(userId)) {
      return response.badRequest({ error: 'Invalid app_user_id' })
    }

    // ✅ Vérifier si déjà traité (idempotence)
    const existingTransaction = await CreditTransaction.query()
      .where('reference_id', eventId)
      .first()

    if (existingTransaction) {
      logger.info('RevenueCat webhook: Already processed', { eventId, userId })
      return response.ok({
        received: true,
        alreadyProcessed: true,
        credits: pack.credits,
        userId,
      })
    }

    // Créditer avec le eventId comme referenceId
    await this.creditService.credit(userId, pack.credits, 'purchase', eventId)

    logger.info('RevenueCat webhook: Credits granted', {
      userId,
      credits: pack.credits,
      eventId,
    })

    return response.ok({
      received: true,
      credits: pack.credits,
      userId,
    })
  }
}
