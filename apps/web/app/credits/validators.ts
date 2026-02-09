import vine from '@vinejs/vine'

/**
 * Validator pour les webhooks RevenueCat
 */
export const revenuecatWebhookValidator = vine.compile(
  vine.object({
    event: vine.object({
      type: vine.string(),
      app_user_id: vine.string(),
      product_id: vine.string(),
      id: vine.string(),
    }),
  })
)
