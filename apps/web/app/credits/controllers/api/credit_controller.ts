import type { HttpContext } from '@adonisjs/core/http'
import CreditService from '#credits/services/credit_service'
import CreditTransactionDto from '#credits/dtos/credit_transaction'

export default class CreditsController {
  private creditService: CreditService
  constructor() {
    this.creditService = new CreditService()
  }
  /**
   * GET /api/credits
   * Solde et packs disponibles
   */
  async show({ auth, response }: HttpContext) {
    const balance = await this.creditService.getBalance(auth.user!.id)

    return response.ok({
      credits: balance,
      packs: CreditService.PACKS,
    })
  }

  /**
   * GET /api/credits/history
   * Historique des transactions
   */
  async history({ auth, request, response }: HttpContext) {
    const page = request.input('page', 1)
    const transactions = await this.creditService.getHistory(auth.user!.id, page)

    return response.ok({
      ...transactions.toJSON(),
      data: transactions.all().map((t) => new CreditTransactionDto(t)),
    })
  }
}
