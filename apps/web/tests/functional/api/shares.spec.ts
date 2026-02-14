import { test } from '@japa/runner'
import Scan from '#scans/models/scan'
import Share from '#shares/models/share'
import User from '#users/models/user'
import { loginAsUser } from '../../helpers/auth_helper.js'
import { createUser } from '../../helpers/user_factory.js'

test.group('API Shares', (group) => {
  let user: User
  let scan: Scan

  group.setup(async () => {
    user = await createUser({ credits: 5 })

    scan = await Scan.create({
      userId: user.id,
      detectedLabel: 'apple',
      labelFr: 'pomme',
      emojiOptions: [
        { emoji: '🍎', reason: 'Pomme rouge' },
        { emoji: '🍏', reason: 'Fruit sain' },
        { emoji: '❤️', reason: 'Rouge' },
      ],
      confidence: 0.95,
      originalImagePath: 'scans/test.jpg',
      isShared: false,
    })
  })

  group.teardown(async () => {
    await Share.query().delete()
    await Scan.query().delete()
    await User.query().delete()
  })

  test('POST /api/shares - Doit créer partage et créditer 1 bonus', async ({ client, assert }) => {
    // Arrange
    const authClient = await loginAsUser(client, user)

    // Act
    const response = await authClient.post('/api/shares').json({
      scanId: scan.id,
      platform: 'whatsapp',
    })

    // Assert
    response.assertStatus(201)
    const body = response.body()

    assert.lengthOf(body.shareCode, 12) // 6 bytes hex = 12 chars
    assert.include(body.shareUrl, '/s/')
    assert.equal(body.bonusCredits, 1)
    assert.equal(body.totalCredits, 6) // 5 + 1

    // Vérifier scan marqué comme partagé
    await scan.refresh()
    assert.isTrue(scan.isShared)
  })

  test('POST /api/shares - Doit échouer si scan inexistant', async ({ client }) => {
    const authClient = await loginAsUser(client, user)

    const response = await authClient.post('/api/shares').json({
      scanId: 99999,
      platform: 'instagram',
    })

    response.assertStatus(404)
  })

  test("POST /api/shares - Doit échouer si scan d'un autre user", async ({ client }) => {
    // Arrange: Créer un autre user avec son scan
    const otherUser = await createUser({ email: 'other@test.com' })
    const otherScan = await Scan.create({
      userId: otherUser.id,
      detectedLabel: 'banana',
      labelFr: 'banane',
      emojiOptions: [],
      confidence: 0.8,
      originalImagePath: 'scans/banana.jpg',
      isShared: false,
    })

    const authClient = await loginAsUser(client, user)

    // Act
    const response = await authClient.post('/api/shares').json({
      scanId: otherScan.id,
      platform: 'facebook',
    })

    // Assert
    response.assertStatus(404)

    // Cleanup
    await otherScan.delete()
    await otherUser.delete()
  })

  test('GET /s/:shareCode - Route publique retourne scan partagé', async ({ client }) => {
    // Arrange
    const share = await Share.create({
      userId: user.id,
      scanId: scan.id,
      platform: 'whatsapp',
      shareCode: 'abc123def456',
      clickCount: 0,
      bonusCredited: true,
    })

    // Act - PAS d'auth (route publique)
    const response = await client.get(`/s/${share.shareCode}`)

    // Assert
    response.assertStatus(200)
    response.assertBodyContains({
      scan: { detectedLabel: 'apple' },
      shareBy: user.fullName,
      platform: 'whatsapp',
      clickCount: 1, // Incrémenté automatiquement
    })
  })

  test('GET /s/:shareCode - Doit incrémenter clickCount', async ({ client, assert }) => {
    // Arrange
    const share = await Share.create({
      userId: user.id,
      scanId: scan.id,
      platform: 'instagram',
      shareCode: 'xyz789abc',
      clickCount: 0,
      bonusCredited: true,
    })

    // Act: Accéder 3 fois
    await client.get(`/s/${share.shareCode}`)
    await client.get(`/s/${share.shareCode}`)
    const response = await client.get(`/s/${share.shareCode}`)

    // Assert
    response.assertBodyContains({ clickCount: 3 })

    await share.refresh()
    assert.equal(share.clickCount, 3)
  })

  test('GET /api/shares/stats - Doit retourner les stats', async ({ client }) => {
    // Arrange: Créer 2 partages avec clics
    const authClient = await loginAsUser(client, user)

    await Share.createMany([
      {
        userId: user.id,
        scanId: scan.id,
        platform: 'whatsapp',
        shareCode: 'aaa111',
        clickCount: 5,
        bonusCredited: true,
      },
      {
        userId: user.id,
        scanId: scan.id,
        platform: 'instagram',
        shareCode: 'bbb222',
        clickCount: 3,
        bonusCredited: true,
      },
    ])

    // Act
    const response = await authClient.get('/api/shares/stats')

    // Assert
    response.assertStatus(200)
    response.assertBodyContains({
      totalShares: 2,
      totalClicks: 8, // 5 + 3
    })
  })

  test('GET /api/shares/stats - Requiert authentification', async ({ client }) => {
    const response = await client.get('/api/shares/stats')
    response.assertStatus(401)
  })
})
