import vine from '@vinejs/vine'

export const createScanValidator = vine.compile(
  vine.object({
    image: vine.file({
      size: '10mb',
      extnames: ['png', 'jpg', 'jpeg', 'webp', 'heic'],
    }),
  })
)
