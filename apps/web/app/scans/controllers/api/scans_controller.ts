import type { HttpContext } from '@adonisjs/core/http'

import ScanDto from '#scans/dtos/scan'
import ScanService from '#scans/services/scan_service'
import { createScanValidator } from '#scans/validators'

export default class ScansController {
  private scanService: ScanService

  constructor() {
    this.scanService = new ScanService()
  }

  /**
   * POST /api/scans
   * Upload une image, analyse via AI SDK + Gemini, retourne les emojis
   * Note: InsufficientCreditsError est géré par le handler global (HTTP 402)
   */
  async store({ request, response, auth }: HttpContext) {
    const { image } = await request.validateUsing(createScanValidator)

    const { scan, credits } = await this.scanService.createScan(auth.user!.id, image)

    return response.created({
      ...new ScanDto(scan),
      credits,
    })
  }

  /**
   * GET /api/scans
   * Historique des scans de l'utilisateur
   */
  async index({ auth, request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)

    const scans = await this.scanService.listByUser(auth.user!.id, page, limit)

    return response.ok({
      ...scans.toJSON(),
      data: scans.all().map((scan) => new ScanDto(scan)),
    })
  }

  /**
   * GET /api/scans/:id
   * Détail d'un scan
   */
  async show({ auth, params, response }: HttpContext) {
    const scan = await this.scanService.findByIdForUser(params.id, auth.user!.id)

    return response.ok(new ScanDto(scan))
  }
}
