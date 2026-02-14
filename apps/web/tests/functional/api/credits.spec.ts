import { test } from '@japa/runner'
import CreditTransaction from '#credits/models/credit_transactions'
import CreditService from '#credits/services/credit_service'
import User from '#users/models/user'
import { createUser } from '../../helpers/user_factory.js'

test.group('API Credits', (group) => {
  let user: User

  group.setup(async () => {
    user = await createUser({ credits: 5 })
  })

  group.teardown(async () => {
    await CreditTransaction.query().delete()
    await User.query().delete()
  })

  test('GET /api/credits - Doit retourner le solde et les packs', async ({ client }) => {
    const response = await client.get('/api/credits').withGuard('api').loginAs(user)

    response.assertStatus(200)
    response.assertBodyContains({
      credits: 5,
      packs: {
        small: { credits: 10, priceId: 'emoji_10_credits' },
        medium: { credits: 50, priceId: 'emoji_50_credits' },
        large: { credits: 150, priceId: 'emoji_150_credits' },
      },
    })
  })

  test('GET /api/credits - Requiert authentification', async ({ client }) => {
    const response = await client.get('/api/credits')
    response.assertStatus(401)
  })

  test('GET /api/credits/history - Doit retourner historique paginé', async ({
    client,
    assert,
  }) => {
    // Arrange: Créer 3 transactions
    const creditService = new CreditService()
    await creditService.debit(user.id, 1, 'scan')
    await creditService.credit(user.id, 5, 'purchase', 'evt_001')
    await creditService.credit(user.id, 1, 'bonus_share')

    // Act
    const response = await client.get('/api/credits/history').withGuard('api').loginAs(user)

    // Assert
    response.assertStatus(200)
    response.assertBodyContains({
      meta: { total: 3 },
    })
    const data = response.body().data
    assert.lengthOf(data, 3)
    // Vérifier ordre DESC (plus récent en premier)
    assert.equal(data[0].type, 'bonus_share')
    assert.equal(data[1].type, 'purchase')
    assert.equal(data[2].type, 'scan')
  })
})
