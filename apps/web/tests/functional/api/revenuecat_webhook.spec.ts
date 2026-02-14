import { test } from '@japa/runner'
import CreditTransaction from '#credits/models/credit_transactions'
import User from '#users/models/user'
import { createUser } from '../../helpers/user_factory.js'

test.group('Webhook RevenueCat', (group) => {
  let user: User

  group.setup(async () => {
    user = await createUser({ credits: 3 })
  })

  group.teardown(async () => {
    await CreditTransaction.query().delete()
    await User.query().delete()
  })

  test('POST /api/webhooks/revenuecat - Doit créditer sur INITIAL_PURCHASE', async ({
    client,
    assert,
  }) => {
    // Act - Pas de Authorization header car secret non configuré en test
    const response = await client.post('/api/webhooks/revenuecat').json({
      event: {
        type: 'INITIAL_PURCHASE',
        app_user_id: String(user.id),
        product_id: 'emoji_10_credits',
        id: 'evt_test_001',
      },
    })

    // Assert
    response.assertStatus(200)
    response.assertBodyContains({
      received: true,
      credits: 10,
      userId: user.id,
    })

    await user.refresh()
    assert.equal(user.credits, 13) // 3 + 10

    const transaction = await CreditTransaction.query()
      .where('reference_id', 'evt_test_001')
      .firstOrFail()

    assert.equal(transaction.amount, 10)
    assert.equal(transaction.type, 'purchase')
  })

  test('POST /api/webhooks/revenuecat - Doit être idempotent (même event 2x)', async ({
    client,
    assert,
  }) => {
    const payload = {
      event: {
        type: 'INITIAL_PURCHASE',
        app_user_id: String(user.id),
        product_id: 'emoji_10_credits',
        id: 'evt_idempotent',
      },
    }

    // 1ère fois
    const response1 = await client.post('/api/webhooks/revenuecat').json(payload)

    response1.assertStatus(200)
    response1.assertBodyContains({ received: true, credits: 10 })

    // 2ème fois (même event)
    const response2 = await client.post('/api/webhooks/revenuecat').json(payload)

    response2.assertStatus(200)
    response2.assertBodyContains({
      received: true,
      alreadyProcessed: true,
    })

    await user.refresh()
    assert.equal(user.credits, 13) // Pas 23 !
  })

  test('POST /api/webhooks/revenuecat - Doit skip les RENEWAL', async ({ client, assert }) => {
    const response = await client.post('/api/webhooks/revenuecat').json({
      event: {
        type: 'RENEWAL',
        app_user_id: String(user.id),
        product_id: 'emoji_10_credits',
      },
    })

    response.assertStatus(200)
    response.assertBodyContains({
      received: true,
      skipped: true,
    })

    await user.refresh()
    assert.equal(user.credits, 3) // Inchangé
  })

  test('POST /api/webhooks/revenuecat - Doit échouer si product_id inconnu', async ({ client }) => {
    const response = await client.post('/api/webhooks/revenuecat').json({
      event: {
        type: 'INITIAL_PURCHASE',
        app_user_id: String(user.id),
        product_id: 'unknown_product',
        id: 'evt_003',
      },
    })

    response.assertStatus(400)
    response.assertBodyContains({ error: 'Unknown product_id: unknown_product' })
  })

  test('POST /api/webhooks/revenuecat - Doit valider le payload', async ({ client }) => {
    // Payload invalide sans event
    const response = await client.post('/api/webhooks/revenuecat').json({})

    response.assertStatus(422) // Validation error
  })
})
