import { randomBytes } from 'node:crypto'
import Share from '#shares/models/share'
import Scan from '#scans/models/scan'
import CreditService from '#credits/services/credit_service'

export default class ShareService {
  private creditService: CreditService

  constructor() {
    this.creditService = new CreditService()
  }

  /**
   * Crée un partage : vérifie le scan, génère le code, crédite le bonus.
   */
  async createShare(userId: number, scanId: number, platform: string) {
    // Vérifier que le scan appartient à l'utilisateur
    const scan = await Scan.query().where('id', scanId).where('user_id', userId).firstOrFail()

    // Générer un code unique
    const shareCode = randomBytes(6).toString('hex')

    // Créer le partage
    const share = await Share.create({
      userId,
      scanId: scan.id,
      platform,
      shareCode,
      bonusCredited: true,
    })

    // Créditer le bonus partage (1 point)
    const newBalance = await this.creditService.credit(
      userId,
      CreditService.SHARE_BONUS,
      'bonus_share'
    )

    // Marquer le scan comme partagé
    scan.isShared = true
    await scan.save()

    return { share, credits: newBalance }
  }

  /**
   * Trouver un partage par son code.
   */
  async findByShareCode(shareCode: string) {
    const share = await Share.query()
      .where('share_code', shareCode)
      .preload('scan')
      .preload('user')
      .firstOrFail()

    //incrémenter le compter de clics
    share.clickCount += 1
    await share.save()

    return share
  }

  /**
   * Statistiques de partage d'un utilisateur.
   */
  async getStats(userId: number) {
    const totalShares = await Share.query().where('user_id', userId).count('* as total')

    const totalClicks = await Share.query().where('user_id', userId).sum('click_count as total')

    return {
      totalShares: Number(totalShares[0].$extras.total),
      totalClicks: Number(totalClicks[0].$extras.total || 0),
    }
  }
}
