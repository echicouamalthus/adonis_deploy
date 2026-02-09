import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#users/models/user'

export type CreditType = 'scan' | 'purchase' | 'bonus_invite' | 'bonus_share' | 'bonus_signup'

export default class CreditTransaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare amount: number

  @column()
  declare type: CreditType

  @column()
  declare description: string | null

  @column()
  declare balanceAfter: number

  @column()
  declare referenceId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
