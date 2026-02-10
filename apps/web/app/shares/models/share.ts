import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BaseModel from '#common/models/base_model'
import Scan from '#scans/models/scan'
import User from '#users/models/user'

export default class Share extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare scanId: number

  @column()
  declare platform: string

  @column()
  declare shareCode: string

  @column()
  declare clickCount: number

  @column()
  declare bonusCredited: boolean

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Scan)
  declare scan: BelongsTo<typeof Scan>
}
