import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'shares'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table
        .integer('user_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table
        .integer('scan_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('scans')
        .onDelete('CASCADE')
      table
        .enum('platform', ['instagram', 'tiktok', 'twitter', 'facebook', 'whatsapp', 'other'])
        .notNullable()
      table.string('share_code', 20).unique().notNullable()
      table.integer('click_count').defaultTo(0)
      table.boolean('bonus_credited').defaultTo(false)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['user_id', 'created_at'])
      table.index('share_code')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
