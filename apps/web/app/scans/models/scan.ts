import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { DateTime } from 'luxon'
import BaseModel from '#common/models/base_model'
import User from '#users/models/user'

export default class Scan extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare originalImagePath: string

  @column()
  declare detectedLabel: string

  @column()
  declare confidence: number

  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare emojiOptions: Array<{ emoji: string; reason: string }>

  @column()
  declare selectedEmoji: string | null

  @column()
  declare labelFr: string | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare aiRawResponse: Record<string, any> | null

  @column()
  declare isShared: boolean

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
