import { BaseModelDto } from '@adocasts.com/dto/base'
import type Share from '#shares/models/share'

export default class ShareDto extends BaseModelDto {
  declare id: number
  declare scanId: number
  declare platform: string
  declare shareCode: string
  declare clickCount: number
  declare bonusCredited: boolean
  declare createdAt: string

  constructor(share?: Share) {
    super()

    if (!share) return

    this.id = share.id
    this.scanId = share.scanId
    this.platform = share.platform
    this.shareCode = share.shareCode
    this.clickCount = share.clickCount
    this.bonusCredited = share.bonusCredited
    this.createdAt = share.createdAt.toISO()!
  }
}
