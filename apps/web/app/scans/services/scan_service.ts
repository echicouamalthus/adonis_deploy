import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'

import Scan from '#scans/models/scan'
import VisionService from '#scans/services/vision_service'
import CreditService, { InsufficientCreditsError } from '#credits/services/credit_service'
import ImageService from '#scans/services/image_service'

export default class ScanService {
  private creditService: CreditService
  private visionService: VisionService
  private imageService: ImageService

  constructor() {
    this.creditService = new CreditService()
    this.visionService = new VisionService()
    this.imageService = new ImageService()
  }

  /**
   * Vérifie les crédits, sauvegarde l'image, analyse via Gemini,
   * débite 1 crédit, et crée le scan en DB.
   */
  async createScan(userId: number, image: { extname?: string; move: Function }) {
    // Vérifier les crédits
    const balance = await this.creditService.getBalance(userId)
    if (balance <= 0) {
      throw new InsufficientCreditsError()
    }

    // Sauvegarder l'image
    const fileName = `${cuid()}.${image.extname}`
    await image.move(app.makePath('tmp/scans'), { name: fileName })

    // Lire le fichier pour l'envoyer à Gemini
    const filePath = app.makePath('tmp/scans', fileName)
    const readImage = await readFile(filePath)
    const imageBuffer = await this.imageService.compress(readImage)

    // Analyser via AI SDK + Gemini
    const result = await this.visionService.analyzeImage(imageBuffer)

    // Débiter 1 crédit
    await this.creditService.debit(userId, 1, 'scan')

    // Créer le scan en DB
    const scan = await Scan.create({
      userId,
      originalImagePath: `scans/${fileName}`,
      detectedLabel: result.label,
      confidence: result.confidence,
      emojiOptions: result.emojis,
      labelFr: result.labelFr,
      aiRawResponse: result,
    })

    const newBalance = await this.creditService.getBalance(userId)

    return { scan, credits: newBalance }
  }

  /**
   * Historique paginé des scans d'un utilisateur.
   */
  async listByUser(userId: number, page: number = 1, limit: number = 20) {
    return Scan.query().where('user_id', userId).orderBy('created_at', 'desc').paginate(page, limit)
  }

  /**
   * Récupère un scan par ID, vérifie qu'il appartient à l'utilisateur.
   */
  async findByIdForUser(scanId: number, userId: number) {
    return Scan.query().where('id', scanId).where('user_id', userId).firstOrFail()
  }
}
