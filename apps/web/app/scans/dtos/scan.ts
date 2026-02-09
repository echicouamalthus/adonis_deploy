import { BaseModelDto } from '@adocasts.com/dto/base'
import Scan from '#scans/models/scan'

export default class ScanDto extends BaseModelDto {
  declare id: number
  declare userId: number
  declare detectedLabel: string
  declare labelFr: string | null
  declare confidence: number
  declare emojiOptions: Array<{ emoji: string; reason: string }>
  declare selectedEmoji: string | null
  declare isShared: boolean
  declare createdAt: string

  constructor(scan?: Scan) {
    super()

    if (!scan) return

    this.id = scan.id
    this.userId = scan.userId
    this.detectedLabel = scan.detectedLabel
    this.labelFr = scan.labelFr
    this.confidence = scan.confidence
    this.emojiOptions = scan.emojiOptions
    this.selectedEmoji = scan.selectedEmoji
    this.isShared = scan.isShared
    this.createdAt = scan.createdAt.toISO()!
  }
}
