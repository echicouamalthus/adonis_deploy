import { mkdir, unlink, writeFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { test } from '@japa/runner'
import { InsufficientCreditsError } from '#credits/services/credit_service'
import Scan from '#scans/models/scan'
import ScanService from '#scans/services/scan_service'
import User from '#users/models/user'
import { createUser } from '../../helpers/user_factory.js'

// Image PNG 1x1 pixel pour les tests
const TEST_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

test.group('ScanService', (group) => {
  let scanService: ScanService
  let user: User

  group.setup(async () => {
    scanService = new ScanService()
    user = await createUser({ credits: 5 })

    // Créer le dossier tmp/scans s'il n'existe pas
    try {
      await mkdir(app.makePath('tmp/scans'), { recursive: true })
    } catch {
      // Dossier existe déjà
    }
  })

  group.each.setup(async () => {
    // Réinitialiser les crédits avant chaque test via update direct
    await User.query().where('id', user.id).update({ credits: 5 })
    await user.refresh()
  })

  group.each.teardown(async () => {
    // Nettoyer les scans et fichiers temporaires
    const scans = await Scan.query().where('user_id', user.id)
    for (const scan of scans) {
      const filePath = app.makePath('tmp', scan.originalImagePath)
      try {
        await unlink(filePath)
      } catch {
        // Fichier n'existe pas, ignorer
      }
    }
    await Scan.query().where('user_id', user.id).delete()
  })

  group.teardown(async () => {
    await User.query().delete()
  })

  test('createScan - Doit créer un scan avec succès', async ({ assert }) => {
    // Arrange: Mock d'un fichier image avec écriture réelle
    const mockImage = {
      extname: 'png',
      move: async (path: string, options: any) => {
        // Écrire le fichier de test
        const filePath = `${path}/${options.name}`
        await writeFile(filePath, TEST_PNG_BUFFER)
      },
    }

    // Act
    const result = await scanService.createScan(user.id, mockImage as any)

    // Assert
    assert.exists(result.scan)
    assert.exists(result.scan.id)
    assert.equal(result.scan.userId, user.id)
    assert.equal(result.scan.detectedLabel, 'apple')
    assert.equal(result.scan.labelFr, 'pomme')
    assert.lengthOf(result.scan.emojiOptions, 3)
    assert.equal(result.credits, 4) // 5 - 1

    // Vérifier en DB
    const scan = await Scan.query().where('user_id', user.id).firstOrFail()
    assert.equal(scan.detectedLabel, 'apple')
    assert.equal(scan.confidence, 0.95)
  })

  test('createScan - Doit échouer si crédits insuffisants', async ({ assert }) => {
    // Arrange: User avec 0 crédit
    const poorUser = await createUser({ email: 'poor@test.com', credits: 0 })

    const mockImage = {
      extname: 'png',
      move: async () => {},
    }

    // Act & Assert
    await assert.rejects(
      () => scanService.createScan(poorUser.id, mockImage as any),
      InsufficientCreditsError
    )

    // Vérifier qu'aucun scan n'a été créé
    const scans = await Scan.query().where('user_id', poorUser.id)
    assert.lengthOf(scans, 0)

    // Vérifier que les crédits n'ont pas changé
    await poorUser.refresh()
    assert.equal(poorUser.credits, 0)

    // Cleanup
    await poorUser.delete()
  })

  test('createScan - Doit débiter 1 crédit', async ({ assert }) => {
    // Arrange
    const mockImage = {
      extname: 'jpg',
      move: async (path: string, options: any) => {
        const filePath = `${path}/${options.name}`
        await writeFile(filePath, TEST_PNG_BUFFER)
      },
    }

    const initialCredits = user.credits

    // Act
    const result = await scanService.createScan(user.id, mockImage as any)

    // Assert
    assert.equal(result.credits, initialCredits - 1)

    await user.refresh()
    assert.equal(user.credits, initialCredits - 1)
  })

  test('listByUser - Doit retourner les scans paginés', async ({ assert }) => {
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
    const scans = await scanService.listByUser(user.id, 1, 20)

    // Assert
    assert.equal(scans.total, 3)
    assert.lengthOf(scans.all(), 3)

    // Vérifier l'ordre (DESC par created_at)
    const data = scans.all()
    assert.equal(data[0].detectedLabel, 'orange') // Plus récent
    assert.equal(data[2].detectedLabel, 'apple') // Plus ancien
  })

  test('listByUser - Doit supporter la pagination', async ({ assert }) => {
    // Arrange: Créer 5 scans
    for (let i = 0; i < 5; i++) {
      await Scan.create({
        userId: user.id,
        detectedLabel: `item${i}`,
        labelFr: `item${i}`,
        emojiOptions: [],
        confidence: 0.8,
        originalImagePath: `scans/test${i}.jpg`,
        isShared: false,
      })
    }

    // Act: Page 1 avec limit 3
    const page1 = await scanService.listByUser(user.id, 1, 3)

    // Assert
    assert.equal(page1.total, 5)
    assert.lengthOf(page1.all(), 3)
    assert.equal(page1.currentPage, 1)
    assert.equal(page1.lastPage, 2)

    // Act: Page 2
    const page2 = await scanService.listByUser(user.id, 2, 3)

    // Assert
    assert.lengthOf(page2.all(), 2)
    assert.equal(page2.currentPage, 2)
  })

  test("listByUser - Doit retourner uniquement les scans de l'utilisateur", async ({ assert }) => {
    // Arrange: Créer un autre user avec ses scans
    const otherUser = await createUser({ email: 'other@test.com' })
    await Scan.create({
      userId: otherUser.id,
      detectedLabel: 'other_item',
      labelFr: 'autre',
      emojiOptions: [],
      confidence: 0.8,
      originalImagePath: 'scans/other.jpg',
      isShared: false,
    })

    await Scan.create({
      userId: user.id,
      detectedLabel: 'my_item',
      labelFr: 'mon_item',
      emojiOptions: [],
      confidence: 0.8,
      originalImagePath: 'scans/mine.jpg',
      isShared: false,
    })

    // Act
    const scans = await scanService.listByUser(user.id, 1, 20)

    // Assert
    assert.equal(scans.total, 1)
    assert.equal(scans.all()[0].detectedLabel, 'my_item')

    // Cleanup
    await Scan.query().where('user_id', otherUser.id).delete()
    await otherUser.delete()
  })

  test("findByIdForUser - Doit retourner le scan de l'utilisateur", async ({ assert }) => {
    // Arrange
    const scan = await Scan.create({
      userId: user.id,
      detectedLabel: 'apple',
      labelFr: 'pomme',
      emojiOptions: [{ emoji: '🍎', reason: 'test' }],
      confidence: 0.95,
      originalImagePath: 'scans/test.jpg',
      isShared: false,
    })

    // Act
    const foundScan = await scanService.findByIdForUser(scan.id, user.id)

    // Assert
    assert.equal(foundScan.id, scan.id)
    assert.equal(foundScan.detectedLabel, 'apple')
  })

  test('findByIdForUser - Doit échouer si le scan appartient à un autre user', async ({
    assert,
  }) => {
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

    // Act & Assert
    await assert.rejects(() => scanService.findByIdForUser(scan.id, user.id))

    // Cleanup
    await Scan.query().where('user_id', otherUser.id).delete()
    await otherUser.delete()
  })

  test("findByIdForUser - Doit échouer si le scan n'existe pas", async ({ assert }) => {
    // Act & Assert
    await assert.rejects(() => scanService.findByIdForUser(999999, user.id))
  })
})
