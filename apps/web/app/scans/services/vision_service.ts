import { generateText, Output } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

export const visionReponseSchema = z.object({
  label: z.string().describe("Nom de l'objet en anglais (1 mots)"),
  labelFr: z.string().describe("Nom de l'object en français (1 mots)"),
  emojis: z
    .array(
      z.object({
        emoji: z.string().describe("Emoji correspondant à l'objet"),
        reason: z.string().describe("Pourquoi cet emoji correspond à l'objet (court"),
      })
    )
    .length(3)
    .describe("3 propositions d'emoji differentes pour représenter l'objet"),
  confidence: z.number().min(0).max(1).describe('Score de confiance entre 0 et 1'),
})

export type VisionResponse = z.infer<typeof visionReponseSchema>

export default class VisionService {
  private google

  constructor() {
    const apiKey = env.get('GEMINI_VISION_API_KEY')

    if (!apiKey) {
      throw new Error('GEMINI_VISION_API_KEY manquante dans .env')
    }

    this.google = createGoogleGenerativeAI({ apiKey })
  }

  async analyzeImage(ImageBuffer: Buffer) {
    try {
      const { output, usage } = await generateText({
        model: this.google('gemini-2.5-flash'),
        output: Output.object({
          schema: visionReponseSchema,
        }),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                image: ImageBuffer,
              },
              {
                type: 'text',
                text: "Identifie l'objet ou produit principal dans cette image.",
              },
            ],
          },
        ],
      })

      if (!output) {
        throw new Error('Gemini na pas retourné de réponse structurée')
      }

      logger.info('Vision analysis: %s (%d tokens)', output.label, usage?.totalTokens)
      return output
    } catch (error) {
      logger.error('VisionService error: %o', error)

      throw error
    }
  }
}
