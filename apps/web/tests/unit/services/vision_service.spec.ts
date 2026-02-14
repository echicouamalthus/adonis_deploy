import { test } from '@japa/runner'
import VisionService from '#scans/services/vision_service'

// Image PNG 1x1 pixel pour les tests
const TEST_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

test.group('VisionService', () => {
  test('analyzeImage - Doit retourner une analyse structurée (mocké)', async ({ assert }) => {
    // Arrange
    const visionService = new VisionService()

    // Act - Le service est mocké dans tests/bootstrap.ts
    const result = await visionService.analyzeImage(TEST_PNG_BUFFER)

    // Assert - Vérifier la structure de la réponse mockée
    assert.exists(result)
    assert.exists(result.label)
    assert.exists(result.labelFr)
    assert.exists(result.emojis)
    assert.exists(result.confidence)

    // Vérifier les types
    assert.isString(result.label)
    assert.isString(result.labelFr)
    assert.isArray(result.emojis)
    assert.isNumber(result.confidence)

    // Vérifier les contraintes
    assert.lengthOf(result.emojis, 3)
    assert.isAtLeast(result.confidence, 0)
    assert.isAtMost(result.confidence, 1)

    // Vérifier la structure des emojis
    for (const emojiOption of result.emojis) {
      assert.exists(emojiOption.emoji)
      assert.exists(emojiOption.reason)
      assert.isString(emojiOption.emoji)
      assert.isString(emojiOption.reason)
    }
  })

  test('analyzeImage - Doit retourner les valeurs mockées attendues', async ({ assert }) => {
    // Arrange
    const visionService = new VisionService()

    // Act
    const result = await visionService.analyzeImage(TEST_PNG_BUFFER)

    // Assert - Vérifier les valeurs mockées dans bootstrap.ts
    assert.equal(result.label, 'apple')
    assert.equal(result.labelFr, 'pomme')
    assert.equal(result.confidence, 0.95)
    assert.equal(result.emojis[0].emoji, '🍎')
    assert.equal(result.emojis[1].emoji, '🍏')
    assert.equal(result.emojis[2].emoji, '❤️')
  })
})
