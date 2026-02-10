import type { HttpContext } from '@adonisjs/core/http'
import CreditService from '#credits/services/credit_service'
import ScanDto from '#scans/dtos/scan'
import ShareDto from '#shares/dtos/share'
import ShareService from '#shares/services/share_service'
import { createShareValidator } from '#shares/validators'
import env from '#start/env'

export default class SharesController {
  private shareService: ShareService

  constructor() {
    this.shareService = new ShareService()
  }

  /**
   * POST /api/shares
   * Enregistrer un partage et créditer le bonus
   */
  async store({ request, response, auth }: HttpContext) {
    const { scanId, platform } = await request.validateUsing(createShareValidator)

    const { share, credits } = await this.shareService.createShare(auth.user!.id, scanId, platform)

    return response.created({
      ...new ShareDto(share),
      shareUrl: `${env.get('VITE_API_URL', 'http://localhost:3333')}/s/${share.shareCode}`,
      bonusCredits: CreditService.SHARE_BONUS,
      totalCredits: credits,
    })
  }

  /**
   * GET /api/shares/show
   * Détail d'un partage
   */
  async show({ params, response }: HttpContext) {
    const share = await this.shareService.findByShareCode(params.shareCode)

    return response.ok({
      scan: new ScanDto(share.scan),
      shareBy: share.user.fullName,
      platform: share.platform,
      clickCount: share.clickCount,
    })
  }

  /**
   * GET /api/shares/stats
   * Statistiques de partage de l'utilisateur
   */
  async stats({ auth, response }: HttpContext) {
    const stats = await this.shareService.getStats(auth.user!.id)

    return response.ok(stats)
  }
}
