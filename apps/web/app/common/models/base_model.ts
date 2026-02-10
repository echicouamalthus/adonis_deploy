import { BaseModel as AdonisBaseModel, column } from '@adonisjs/lucid/orm'
import type { DateTime } from 'luxon'

export default class BaseModel extends AdonisBaseModel {
  /**
   * Timestamps.
   */
  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null
}
