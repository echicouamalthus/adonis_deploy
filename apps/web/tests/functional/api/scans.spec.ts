import { test } from '@japa/runner'
import Scan from '#scans/models/scan'
import User from '#users/models/user'
import { createUser } from '../../helpers/user_factory.js'

test.group('API Scans', (group) => {
  let user: User

  group.setup(async () => {
    user = await createUser({ credits: 5 })
  })

  group.each.teardown(async () => {
    await Scan.query().where('user_id', user.id).delete()
  })

  group.teardown(async () => {
    await User.query().delete()
  })

  test('POST /api/scans - Doit créer un scan et débiter 1 crédit', async ({ client, assert }) => {
    // Arrange: Créer un buffer d'image minimal (1x1 pixel PNG)
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )

    // Act
    const response = await client
      .post('/api/scans')
      .file('image', pngBuffer, { filename: 'test.png' })
      .withGuard('api')
      .loginAs(user)

    // Assert
    response.assertStatus(201)
    const body = response.body()

    assert.exists(body.id)
    assert.equal(body.detectedLabel, 'apple')
    assert.equal(body.labelFr, 'pomme')
    assert.lengthOf(body.emojiOptions, 3)
    assert.equal(body.emojiOptions[0].emoji, '🍎')
    assert.equal(body.credits, 4) // 5 - 1

    // Vérifier que le scan est créé en DB
    const scan = await Scan.query().where('user_id', user.id).firstOrFail()
    assert.equal(scan.detectedLabel, 'apple')
    assert.lengthOf(scan.emojiOptions, 3)
  })

  test('POST /api/scans - Doit échouer si pas de crédits', async ({ client }) => {
    // Arrange: User avec 0 crédit
    const poorUser = await createUser({ email: 'poor@test.com', credits: 0 })
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )

    // Act
    const response = await client
      .post('/api/scans')
      .file('image', pngBuffer, { filename: 'test.png' })
      .withGuard('api')
      .loginAs(poorUser)

    // Assert
    response.assertStatus(402) // Payment Required
    response.assertBodyContains({
      error: 'Crédits insuffisants',
      code: 'INSUFFICIENT_CREDITS',
    })

    // Cleanup
    await poorUser.delete()
  })

  test('POST /api/scans - Requiert authentification', async ({ client }) => {
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )

    const response = await client
      .post('/api/scans')
      .file('image', pngBuffer, { filename: 'test.png' })

    response.assertStatus(401)
  })

  test('GET /api/scans - Doit retourner historique paginé', async ({ client, assert }) => {
    // Arrange: Créer 3 scans
    await Scan.createMany([
      {
        userId: user.id,
        detectedLabel: 'apple',
        labelFr: 'pomme',
        emojiOptions: [{ emoji: '🍎', reason: 'test' }],
        confidence: 0.9,
        originalImagePath: 'scans/test1.jpg',
        isShared: false,
      },
      {
        userId: user.id,
        detectedLabel: 'banana',
        labelFr: 'banane',
        emojiOptions: [{ emoji: '🍌', reason: 'test' }],
        confidence: 0.85,
        originalImagePath: 'scans/test2.jpg',
        isShared: false,
      },
      {
        userId: user.id,
        detectedLabel: 'orange',
        labelFr: 'orange',
        emojiOptions: [{ emoji: '🍊', reason: 'test' }],
        confidence: 0.88,
        originalImagePath: 'scans/test3.jpg',
        isShared: true,
      },
    ])

    // Act
    const response = await client.get('/api/scans').withGuard('api').loginAs(user)

    // Assert
    response.assertStatus(200)
    response.assertBodyContains({
      meta: { total: 3 },
    })
    const data = response.body().data
    assert.lengthOf(data, 3)

    // Vérifier DTOs (pas de champs sensibles)
    assert.notProperty(data[0], 'aiRawResponse')
    assert.notProperty(data[0], 'originalImagePath')
  })

  test('GET /api/scans/:id - Doit retourner un scan', async ({ client, assert }) => {
    // Arrange
    const scan = await Scan.create({
      userId: user.id,
      detectedLabel: 'apple',
      labelFr: 'pomme',
      emojiOptions: [
        { emoji: '🍎', reason: 'Pomme rouge' },
        { emoji: '🍏', reason: 'Fruit' },
      ],
      confidence: 0.95,
      originalImagePath: 'scans/test.jpg',
      isShared: false,
    })

    // Act
    const response = await client.get(`/api/scans/${scan.id}`).withGuard('api').loginAs(user)

    // Assert
    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.detectedLabel, 'apple')
    assert.lengthOf(body.emojiOptions, 2)
  })

  test("GET /api/scans/:id - Doit échouer si scan d'un autre user", async ({ client }) => {
    // Arrange: Créer un autre user avec son scan
    const otherUser = await createUser({ email: 'other@test.com' })
    const scan = await Scan.create({
      userId: otherUser.id,
      detectedLabel: 'banana',
      labelFr: 'banane',
      emojiOptions: [],
      confidence: 0.8,
      originalImagePath: 'scans/banana.jpg',
      isShared: false,
    })

    // Act
    const response = await client.get(`/api/scans/${scan.id}`).withGuard('api').loginAs(user)

    // Assert
    response.assertStatus(404)

    // Cleanup
    await scan.delete()
    await otherUser.delete()
  })

  test('GET /api/scans - Requiert authentification', async ({ client }) => {
    const response = await client.get('/api/scans')
    response.assertStatus(401)
  })
})
