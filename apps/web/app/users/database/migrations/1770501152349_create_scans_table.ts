import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'scans'

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
      table.string('original_image_path', 500).notNullable()
      table.string('detected_label', 255).notNullable()
      table.float('confidence').defaultTo(0)
      table.json('emoji_options').notNullable() // 3 propositions [{emoji, reason}]
      table.string('selected_emoji', 50).nullable() // Choix de l'utilisateur
      table.string('label_fr', 255).nullable() // Label en français
      table.json('ai_raw_response').nullable() // Réponse brute Gemini
      table.boolean('is_shared').defaultTo(false)
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      table.index(['user_id', 'created_at'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
