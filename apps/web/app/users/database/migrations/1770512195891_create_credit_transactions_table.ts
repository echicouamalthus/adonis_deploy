import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'credit_transactions'

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
      table.integer('amount').notNullable() // positif = crédit, négatif = débit
      table
        .enum('type', ['scan', 'purchase', 'bonus_invite', 'bonus_share', 'bonus_signup'])
        .notNullable()
      table.string('description', 255).nullable()
      table.integer('balance_after').notNullable() // solde après transaction
      table.string('reference_id', 255).nullable() // ID externe (RevenueCat, etc.)
      table.timestamp('created_at').notNullable()

      table.index(['user_id', 'created_at'])
      table.index('type')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
