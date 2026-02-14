import { test } from '@japa/runner'
import CreditTransaction from '#credits/models/credit_transactions'
import CreditService, { InsufficientCreditsError } from '#credits/services/credit_service'
import User from '#users/models/user'
import { createUser } from '../../helpers/user_factory.js'

test.group('CreditService', (group) => {
  let creditService: CreditService
  let user: User

  group.setup(async () => {
    creditService = new CreditService()
    user = await createUser({ credits: 10 })
  })

  group.each.setup(async () => {
    // Réinitialiser le solde avant chaque test
    user.credits = 10
    await user.save()
  })

  group.each.teardown(async () => {
    await CreditTransaction.query().where('user_id', user.id).delete()
  })

  group.teardown(async () => {
    await User.query().delete()
  })

  test('getBalance - Doit retourner le solde actuel', async ({ assert }) => {
    const balance = await creditService.getBalance(user.id)
    assert.equal(balance, 10)
  })

  test('debit - Doit débiter des crédits et créer une transaction', async ({ assert }) => {
    // Act
    const newBalance = await creditService.debit(user.id, 3, 'scan')

    // Assert
    assert.equal(newBalance, 7)

    await user.refresh()
    assert.equal(user.credits, 7)

    // Vérifier la transaction
    const transaction = await CreditTransaction.query()
      .where('user_id', user.id)
      .where('type', 'scan')
      .firstOrFail()

    assert.equal(transaction.amount, -3)
    assert.equal(transaction.balanceAfter, 7)
    assert.equal(transaction.type, 'scan')
  })

  test('debit - Doit lancer InsufficientCreditsError si crédits insuffisants', async ({
    assert,
  }) => {
    // Arrange: User avec 2 crédits
    const poorUser = await createUser({ email: 'poor@test.com', credits: 2 })

    // Act & Assert
    await assert.rejects(
      () => creditService.debit(poorUser.id, 5, 'scan'),
      InsufficientCreditsError
    )

    // Vérifier que le solde n'a pas changé
    await poorUser.refresh()
    assert.equal(poorUser.credits, 2)

    // Vérifier qu'aucune transaction n'a été créée
    const transactions = await CreditTransaction.query().where('user_id', poorUser.id)
    assert.lengthOf(transactions, 0)

    // Cleanup
    await poorUser.delete()
  })

  test('credit - Doit créditer des points et créer une transaction', async ({ assert }) => {
    // Act
    const newBalance = await creditService.credit(user.id, 5, 'purchase', 'evt_001')

    // Assert
    assert.equal(newBalance, 15)

    await user.refresh()
    assert.equal(user.credits, 15)

    // Vérifier la transaction
    const transaction = await CreditTransaction.query()
      .where('user_id', user.id)
      .where('type', 'purchase')
      .firstOrFail()

    assert.equal(transaction.amount, 5)
    assert.equal(transaction.balanceAfter, 15)
    assert.equal(transaction.referenceId, 'evt_001')
  })

  test('credit - Doit fonctionner sans referenceId', async ({ assert }) => {
    // Act
    const newBalance = await creditService.credit(user.id, 1, 'bonus_share')

    // Assert
    assert.equal(newBalance, 11)

    const transaction = await CreditTransaction.query()
      .where('user_id', user.id)
      .where('type', 'bonus_share')
      .firstOrFail()

    assert.equal(transaction.amount, 1)
    assert.isNull(transaction.referenceId)
  })

  test("grantSignupBonus - Doit créditer le bonus d'inscription", async ({ assert }) => {
    // Arrange: Nouveau user avec 0 crédit
    const newUser = await createUser({ email: 'new@test.com', credits: 0 })

    // Act
    await creditService.grantSignupBonus(newUser.id)

    // Assert
    await newUser.refresh()
    assert.equal(newUser.credits, CreditService.SIGNUP_BONUS)

    const transaction = await CreditTransaction.query()
      .where('user_id', newUser.id)
      .where('type', 'bonus_signup')
      .firstOrFail()

    assert.equal(transaction.amount, CreditService.SIGNUP_BONUS)

    // Cleanup
    await CreditTransaction.query().where('user_id', newUser.id).delete()
    await newUser.delete()
  })

  test("getHistory - Doit retourner l'historique paginé", async ({ assert }) => {
    // Arrange: Créer plusieurs transactions
    await creditService.debit(user.id, 1, 'scan')
    await creditService.credit(user.id, 5, 'purchase', 'evt_002')
    await creditService.credit(user.id, 1, 'bonus_share')

    // Act
    const history = await creditService.getHistory(user.id, 1, 10)

    // Assert
    assert.equal(history.total, 3)
    assert.lengthOf(history.all(), 3)

    // Vérifier l'ordre (DESC par created_at)
    const data = history.all()
    assert.equal(data[0].type, 'bonus_share')
    assert.equal(data[1].type, 'purchase')
    assert.equal(data[2].type, 'scan')
  })

  test('getHistory - Doit supporter la pagination', async ({ assert }) => {
    // Arrange: Créer 5 transactions
    for (let i = 0; i < 5; i++) {
      await creditService.debit(user.id, 1, 'scan')
    }

    // Act: Page 1 avec limit 3
    const page1 = await creditService.getHistory(user.id, 1, 3)

    // Assert
    assert.equal(page1.total, 5)
    assert.lengthOf(page1.all(), 3)
    assert.equal(page1.currentPage, 1)
    assert.equal(page1.lastPage, 2)

    // Act: Page 2
    const page2 = await creditService.getHistory(user.id, 2, 3)

    // Assert
    assert.lengthOf(page2.all(), 2)
    assert.equal(page2.currentPage, 2)
  })

  test('Constants - Doit avoir les bonnes valeurs', ({ assert }) => {
    assert.equal(CreditService.SIGNUP_BONUS, 3)
    assert.equal(CreditService.SHARE_BONUS, 1)
    assert.equal(CreditService.INVITE_BONUS, 3)

    assert.deepEqual(CreditService.PACKS, {
      small: { credits: 10, priceId: 'emoji_10_credits' },
      medium: { credits: 50, priceId: 'emoji_50_credits' },
      large: { credits: 150, priceId: 'emoji_150_credits' },
    })
  })
})
