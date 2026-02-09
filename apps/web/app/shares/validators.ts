import vine from '@vinejs/vine'

export const createShareValidator = vine.compile(
  vine.object({
    scanId: vine.number().positive(),
    platform: vine.enum(['instagram', 'whatsapp', 'twitter', 'facebook', 'tiktok', 'other']),
  })
)
