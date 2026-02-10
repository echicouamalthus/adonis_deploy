import type { HttpContext } from '@adonisjs/core/http'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import env from '#start/env'

export default class VisionTestController {
  /**
   * POST /api/vision-test
   *
   * Upload une image, Gemini détecte l'objet et génère des emojis
   * Test avec Postman : POST form-data avec champ "image" (type File)
   */
  async handle({ request, response }: HttpContext) {
    const apiKey = env.get('GEMINI_VISION_API_KEY')

    if (!apiKey) {
      return response.badRequest({
        error: 'GEMINI_VISION_API_KEY manquante dans .env',
      })
    }

    const image = request.file('image', {
      size: '10mb',
      extnames: ['jpg', 'jpeg', 'png', 'webp'],
    })

    if (!image) {
      return response.badRequest({
        error: 'Envoie un fichier dans le champ "image" (form-data)',
      })
    }

    if (!image.isValid) {
      return response.badRequest({ error: 'Image invalide', details: image.errors })
    }

    const { readFile } = await import('node:fs/promises')
    const imageBuffer = await readFile(image.tmpPath!)

    const google = createGoogleGenerativeAI({ apiKey })

    try {
      const { output, usage } = await generateText({
        model: google('gemini-2.5-flash'),
        output: Output.object({
          schema: z.object({
            label: z.string().describe("Nom de l'objet en anglais (1 mot)"),
            labelFr: z.string().describe("Nom de l'objet en français"),
            emojis: z
              .array(
                z.object({
                  emoji: z.string().describe('1 seul emoji'),
                  reason: z.string().describe("Pourquoi cet emoji correspond à l'objet (court)"),
                })
              )
              .length(3)
              .describe("3 propositions d'emoji différentes pour représenter l'objet"),
            confidence: z.number().min(0).max(1).describe('Score de confiance entre 0 et 1'),
          }),
        }),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: imageBuffer,
              },
              {
                type: 'text',
                text: "Identifie l'objet ou produit principal dans cette image.",
              },
            ],
          },
        ],
      })

      return response.ok({
        success: true,
        ...output,
        tokensUsed: usage?.totalTokens,
      })
    } catch (error: any) {
      return response.internalServerError({
        error: 'Erreur Gemini',
        message: error.message,
      })
    }
  }
}
