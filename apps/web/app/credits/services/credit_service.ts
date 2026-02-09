import db from '@adonisjs/lucid/services/db'
import User from '#users/models/user'
import CreditTransaction from '#credits/models/credit_transactions'
import type { CreditType } from '#credits/models/credit_transactions'

/**
 * Erreur métier : crédits insuffisants.
 */
export class InsufficientCreditsError extends Error {
  constructor() {
    super('Crédits insuffisants')
    this.name = 'InsufficientCreditsError'
  }
}

export default class CreditService {
  // Crédits gratuits à l'inscription
  static SIGNUP_BONUS = 3

  // Bonus par action
  static SHARE_BONUS = 1
  static INVITE_BONUS = 3

  // Packs d'achat
  static PACKS = {
    small: { credits: 10, priceId: 'emoji_10_credits' },
    medium: { credits: 50, priceId: 'emoji_50_credits' },
    large: { credits: 150, priceId: 'emoji_150_credits' },
  }

  /**
   * Récupérer le solde actuel
   */
  async getBalance(userId: number): Promise<number> {
    const user = await User.findOrFail(userId)
    return user.credits
  }

  /**
   * Débiter des crédits (scan)
   * Utilise une transaction DB pour la cohérence
   */
  async debit(userId: number, amount: number, type: CreditType): Promise<number> {
    return await db.transaction(async (trx) => {
      const user = await User.query({ client: trx })
        .where('id', userId)
        .forUpdate() // Lock la ligne pour éviter les race conditions
        .firstOrFail()

      if (user.credits < amount) {
        throw new InsufficientCreditsError()
      }

      user.credits -= amount
      await user.useTransaction(trx).save()

      await CreditTransaction.create(
        {
          userId,
          amount: -amount,
          type,
          balanceAfter: user.credits,
          description: `Débit de ${amount} crédit(s) pour ${type}`,
        },
        { client: trx }
      )

      return user.credits
    })
  }

  /**
   * Créditer des points (achat, bonus)
   */
  async credit(
    userId: number,
    amount: number,
    type: CreditType,
    referenceId?: string
  ): Promise<number> {
    return await db.transaction(async (trx) => {
      const user = await User.query({ client: trx }).where('id', userId).forUpdate().firstOrFail()

      user.credits += amount
      await user.useTransaction(trx).save()

      await CreditTransaction.create(
        {
          userId,
          amount,
          type,
          balanceAfter: user.credits,
          referenceId,
          description: `Crédit de ${amount} point(s) pour ${type}`,
        },
        { client: trx }
      )

      return user.credits
    })
  }

  /**
   * Créditer le bonus d'inscription
   */
  async grantSignupBonus(userId: number): Promise<void> {
    await this.credit(userId, CreditService.SIGNUP_BONUS, 'bonus_signup')
  }

  /**
   * Historique des transactions
   */
  async getHistory(userId: number, page: number = 1, limit: number = 20) {
    return await CreditTransaction.query()
      .where('user_id', userId)
      .orderBy('created_at', 'desc')
      .paginate(page, limit)
  }
}
