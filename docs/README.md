# 📋 Guide Complet des Tests Japa - MVP Emoji Scanner

> Documentation complète pour tester le backend AdonisJS v6 du projet MVP Emoji Scanner

---

## Table des matières

- [Éléments nécessaires](#éléments-nécessaires)
- [Configuration](#configuration)
- [Architecture des tests](#architecture-des-tests)
- [Tests à implémenter](#tests-à-implémenter)
- [Helpers et utilitaires](#helpers-et-utilitaires)
- [Erreurs courantes et solutions](#erreurs-courantes-et-solutions)
- [Commandes de test](#commandes-de-test)
- [Bonnes pratiques](#bonnes-pratiques)

---

## 🔧 Éléments Nécessaires

### 1. Dépendances NPM

Les packages suivants sont déjà installés dans `apps/web` :

```json
{
  "devDependencies": {
    "@japa/runner": "^4.4.0",          // Framework de test
    "@japa/assert": "^4.1.1",          // Assertions
    "@japa/api-client": "^3.2.1",      // Client HTTP pour tests
    "@japa/expect-type": "^2.0.4",     // Tests de types TypeScript
    "@japa/plugin-adonisjs": "^4.0.0"  // Plugin AdonisJS
  }
}
```

### 2. Configuration de Base

**Fichier: `adonisrc.ts`**

Deux suites de tests configurées :

```typescript
tests: {
  suites: [
    {
      files: ['tests/unit/**/*.spec(.ts|.js)'],
      name: 'unit',
      timeout: 2000,       // 2 secondes
    },
    {
      files: ['tests/functional/**/*.spec(.ts|.js)'],
      name: 'functional',
      timeout: 30000,      // 30 secondes
    },
  ],
  forceExit: false,
}
```

**Fichier: `tests/bootstrap.ts`**

Configuration des plugins Japa :

```typescript
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import { expectTypeOf } from '@japa/expect-type'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import testUtils from '@adonisjs/core/services/test_utils'

export const plugins: Config['plugins'] = [
  assert(),              // Assertions classiques
  apiClient(),           // Client HTTP
  expectTypeOf(),        // Tests de types
  pluginAdonisJS(app),   // Intégration AdonisJS
  authApiClient(app),    // Support auth (loginAs)
]

export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['functional', 'e2e'].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start())
  }
}
```

**Fichier: `.env.test`**

Variables d'environnement spécifiques aux tests :

```bash
PORT=3334
NODE_ENV=test
VITE_API_URL=http://localhost:3334
DB_DATABASE=app_test
LIMITER_STORE=memory
GEMINI_VISION_API_KEY=test_key
REVENUECAT_WEBHOOK_SECRET=test_secret
```

---

## 🏗️ Architecture des Tests

### Structure des Répertoires

```
apps/web/tests/
├── bootstrap.ts                           # Configuration Japa
├── helpers/                               # Utilitaires
│   ├── user_factory.ts                   # Factory pour créer users
│   ├── auth_helper.ts                    # Helper auth avec tokens
│   └── scan_factory.ts                   # Factory pour créer scans
├── unit/                                  # Tests unitaires (2s timeout)
│   └── services/
│       ├── credit_service.spec.ts        # Test service crédits
│       └── vision_service.spec.ts        # Test service AI (mocké)
└── functional/                            # Tests fonctionnels (30s timeout)
    └── api/
        ├── credits.spec.ts               # Tests API crédits
        ├── scans.spec.ts                 # Tests API scans
        ├── shares.spec.ts                # Tests API partages
        └── revenuecat_webhook.spec.ts    # Tests webhook RevenueCat
```

### Types de Tests

| Type | Dossier | Timeout | Utilisation |
|------|---------|---------|-------------|
| Unit | `tests/unit/` | 2s | Services, modèles, logique métier isolée |
| Functional | `tests/functional/` | 30s | Tests API, endpoints, intégration HTTP |

---

## 📝 Tests à Implémenter

### 1. Tests Credits - `tests/functional/api/credits.spec.ts`

```typescript
import { test } from '@japa/runner'
import { createUser, loginAsUser } from '../../helpers/auth_helper.ts'
import CreditTransaction from '#credits/models/credit_transactions'
import CreditService from '#credits/services/credit_service'

test.group('API Credits', (group) => {
  let user: User
  let authClient: any

  group.setup(async () => {
    user = await createUser({ credits: 5 })
    authClient = await loginAsUser(user)
  })

  group.teardown(async () => {
    await CreditTransaction.query().delete()
    await User.query().delete()
  })

  test('GET /api/credits - Doit retourner le solde et les packs', async ({ client, assert }) => {
    const response = await authClient.get('/api/credits')

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

  test('GET /api/credits/history - Doit retourner historique paginé', async ({ client }) => {
    // Arrange: Créer 3 transactions
    const creditService = new CreditService()
    await creditService.debit(user.id, 1, 'scan')
    await creditService.credit(user.id, 5, 'purchase', 'evt_001')
    await creditService.credit(user.id, 1, 'bonus_share')

    // Act
    const response = await authClient.get('/api/credits/history')

    // Assert
    response.assertStatus(200)
    response.assertBodyContains({
      meta: { total: 3 },
    })
    const data = response.body().data
    assert.lengthOf(data, 3)
    assert.equal(data[0].type, 'bonus_share') // Plus récent en premier
  })

  test('GET /api/credits - Requiert authentification', async ({ client }) => {
    const response = await client.get('/api/credits')
    response.assertStatus(401)
  })
})
```

**Tests unitaires du service :**

```typescript
// tests/unit/services/credit_service.spec.ts
import { test } from '@japa/runner'
import CreditService, { InsufficientCreditsError } from '#credits/services/credit_service'
import { createUser } from '../../helpers/user_factory.ts'
import CreditTransaction from '#credits/models/credit_transactions'

test.group('CreditService', (group) => {
  const creditService = new CreditService()
  let user: User

  group.setup(async () => {
    user = await createUser({ credits: 5 })
  })

  group.teardown(async () => {
    await CreditTransaction.query().delete()
    await User.query().delete()
  })

  test('debit() - Doit débiter avec transaction DB', async ({ assert }) => {
    // Act
    const newBalance = await creditService.debit(user.id, 2, 'scan')

    // Assert
    assert.equal(newBalance, 3)

    const transaction = await CreditTransaction.query()
      .where('user_id', user.id)
      .firstOrFail()

    assert.equal(transaction.amount, -2)
    assert.equal(transaction.type, 'scan')
    assert.equal(transaction.balanceAfter, 3)
  })

  test('debit() - Doit throw si crédits insuffisants', async ({ assert }) => {
    await assert.rejects(
      async () => await creditService.debit(user.id, 10, 'scan'),
      InsufficientCreditsError
    )
  })

  test('credit() - Doit créditer avec transaction', async ({ assert }) => {
    const newBalance = await creditService.credit(user.id, 10, 'purchase', 'evt_001')

    assert.equal(newBalance, 15)

    const transaction = await CreditTransaction.query()
      .where('reference_id', 'evt_001')
      .firstOrFail()

    assert.equal(transaction.amount, 10)
    assert.equal(transaction.type, 'purchase')
  })
})
```

---

### 2. Tests Scans - `tests/functional/api/scans.spec.ts`

```typescript
import { test } from '@japa/runner'
import { createUser, loginAsUser } from '../../helpers/auth_helper.ts'
import Scan from '#scans/models/scan'
import VisionService from '#scans/services/vision_service'
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'

test.group('API Scans', (group) => {
  let user: User
  let authClient: any

  group.setup(async () => {
    user = await createUser({ credits: 5 })
    authClient = await loginAsUser(user)

    // Mock VisionService pour éviter les appels Gemini réels
    VisionService.prototype.analyzeImage = async () => ({
      label: 'apple',
      labelFr: 'pomme',
      confidence: 0.95,
      emojis: [
        { emoji: '🍎', reason: 'Pomme rouge bien mûre' },
        { emoji: '🍏', reason: 'Fruit sain et naturel' },
        { emoji: '❤️', reason: 'Couleur rouge vif' },
      ],
    })
  })

  group.teardown(async () => {
    await Scan.query().delete()
    await User.query().delete()
  })

  test('POST /api/scans - Doit créer un scan et débiter 1 crédit', async ({ assert }) => {
    // Arrange: Créer une image de test
    const imageBuffer = await readFile(app.makePath('tests/fixtures/apple.jpg'))

    // Act
    const response = await authClient
      .post('/api/scans')
      .file('photo', imageBuffer, { filename: 'apple.jpg' })

    // Assert
    response.assertStatus(201)
    response.assertBodyContains({
      emojiOptions: [
        { emoji: '🍎', reason: 'Pomme rouge bien mûre' },
      ],
      credits: 4, // 5 - 1
    })

    const scan = await Scan.query().where('user_id', user.id).firstOrFail()
    assert.equal(scan.detectedLabel, 'apple')
    assert.lengthOf(scan.emojiOptions, 3)
  })

  test('POST /api/scans - Doit échouer si pas de crédits', async () => {
    // Arrange: User avec 0 crédit
    await user.merge({ credits: 0 }).save()
    const imageBuffer = await readFile(app.makePath('tests/fixtures/apple.jpg'))

    // Act
    const response = await authClient
      .post('/api/scans')
      .file('photo', imageBuffer, { filename: 'apple.jpg' })

    // Assert
    response.assertStatus(402) // Payment Required
    response.assertBodyContains({
      error: 'Crédits insuffisants',
      code: 'INSUFFICIENT_CREDITS',
    })
  })

  test('POST /api/scans - Doit respecter le rate limit (5/min)', async () => {
    const imageBuffer = await readFile(app.makePath('tests/fixtures/apple.jpg'))

    // Act: Faire 6 requêtes rapides
    const promises = Array.from({ length: 6 }, () =>
      authClient.post('/api/scans').file('photo', imageBuffer, { filename: 'apple.jpg' })
    )
    const responses = await Promise.all(promises)

    // Assert: 5 premières OK, 6ème rate limited
    const statuses = responses.map((r) => r.status())
    const successCount = statuses.filter((s) => s === 201).length
    const rateLimitedCount = statuses.filter((s) => s === 429).length

    assert.equal(successCount, 5)
    assert.equal(rateLimitedCount, 1)
  })

  test('GET /api/scans - Doit retourner historique paginé', async ({ assert }) => {
    // Arrange: Créer 3 scans
    await Scan.createMany([
      { userId: user.id, detectedLabel: 'apple', emojiOptions: [], confidence: 0.9 },
      { userId: user.id, detectedLabel: 'banana', emojiOptions: [], confidence: 0.8 },
      { userId: user.id, detectedLabel: 'orange', emojiOptions: [], confidence: 0.85 },
    ])

    // Act
    const response = await authClient.get('/api/scans')

    // Assert
    response.assertStatus(200)
    response.assertBodyContains({
      meta: { total: 3 },
    })
    const data = response.body().data
    assert.lengthOf(data, 3)
    // Vérifier que les DTOs n'exposent pas les champs sensibles
    assert.notProperty(data[0], 'aiRawResponse')
    assert.notProperty(data[0], 'originalImagePath')
  })

  test('GET /api/scans/:id - Doit retourner un scan', async ({ assert }) => {
    const scan = await Scan.create({
      userId: user.id,
      detectedLabel: 'apple',
      emojiOptions: [{ emoji: '🍎', reason: 'test' }],
      confidence: 0.9,
    })

    const response = await authClient.get(`/api/scans/${scan.id}`)

    response.assertStatus(200)
    assert.equal(response.body().detectedLabel, 'apple')
  })

  test('GET /api/scans/:id - Doit échouer si scan d\'un autre user', async () => {
    const otherUser = await createUser({ email: 'other@test.com' })
    const scan = await Scan.create({
      userId: otherUser.id,
      detectedLabel: 'apple',
      emojiOptions: [],
      confidence: 0.9,
    })

    const response = await authClient.get(`/api/scans/${scan.id}`)
    response.assertStatus(404)
  })
})
```

---

### 3. Tests Shares - `tests/functional/api/shares.spec.ts`

```typescript
import { test } from '@japa/runner'
import { createUser, loginAsUser } from '../../helpers/auth_helper.ts'
import Share from '#shares/models/share'
import Scan from '#scans/models/scan'

test.group('API Shares', (group) => {
  let user: User
  let authClient: any
  let scan: Scan

  group.setup(async () => {
    user = await createUser({ credits: 5 })
    authClient = await loginAsUser(user)

    scan = await Scan.create({
      userId: user.id,
      detectedLabel: 'apple',
      emojiOptions: [{ emoji: '🍎', reason: 'test' }],
      confidence: 0.9,
    })
  })

  group.teardown(async () => {
    await Share.query().delete()
    await Scan.query().delete()
    await User.query().delete()
  })

  test('POST /api/shares - Doit créer partage et créditer 1 bonus', async ({ assert }) => {
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

  test('POST /api/shares - Doit échouer si scan inexistant', async () => {
    const response = await authClient.post('/api/shares').json({
      scanId: 99999,
      platform: 'instagram',
    })

    response.assertStatus(404)
  })

  test('POST /api/shares - Doit échouer si scan d\'un autre user', async () => {
    const otherUser = await createUser({ email: 'other@test.com' })
    const otherScan = await Scan.create({
      userId: otherUser.id,
      detectedLabel: 'banana',
      emojiOptions: [],
      confidence: 0.8,
    })

    const response = await authClient.post('/api/shares').json({
      scanId: otherScan.id,
      platform: 'facebook',
    })

    response.assertStatus(404)
  })

  test('GET /s/:shareCode - Route publique retourne scan partagé', async ({ client, assert }) => {
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
    const share = await Share.create({
      userId: user.id,
      scanId: scan.id,
      platform: 'instagram',
      shareCode: 'xyz789',
      clickCount: 0,
      bonusCredited: true,
    })

    // Accéder 3 fois
    await client.get(`/s/${share.shareCode}`)
    await client.get(`/s/${share.shareCode}`)
    const response = await client.get(`/s/${share.shareCode}`)

    response.assertBodyContains({ clickCount: 3 })

    await share.refresh()
    assert.equal(share.clickCount, 3)
  })

  test('GET /api/shares/stats - Doit retourner les stats', async ({ assert }) => {
    // Arrange: Créer 2 partages avec clics
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
})
```

---

### 4. Tests Webhook RevenueCat - `tests/functional/api/revenuecat_webhook.spec.ts`

```typescript
import { test } from '@japa/runner'
import { createUser } from '../../helpers/user_factory.ts'
import CreditTransaction from '#credits/models/credit_transactions'

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
    // Act
    const response = await client
      .post('/api/webhooks/revenuecat')
      .header('Authorization', 'Bearer test_secret')
      .json({
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

  test('POST /api/webhooks/revenuecat - Doit être idempotent', async ({ assert }) => {
    const payload = {
      event: {
        type: 'INITIAL_PURCHASE',
        app_user_id: String(user.id),
        product_id: 'emoji_10_credits',
        id: 'evt_idempotent',
      },
    }

    // 1ère fois
    const response1 = await client
      .post('/api/webhooks/revenuecat')
      .header('Authorization', 'Bearer test_secret')
      .json(payload)

    response1.assertStatus(200)
    response1.assertBodyContains({ received: true, credits: 10 })

    // 2ème fois (même event)
    const response2 = await client
      .post('/api/webhooks/revenuecat')
      .header('Authorization', 'Bearer test_secret')
      .json(payload)

    response2.assertStatus(200)
    response2.assertBodyContains({
      received: true,
      alreadyProcessed: true,
    })

    await user.refresh()
    assert.equal(user.credits, 13) // Pas 23 !
  })

  test('POST /api/webhooks/revenuecat - Doit skip les RENEWAL', async ({ client, assert }) => {
    const response = await client
      .post('/api/webhooks/revenuecat')
      .header('Authorization', 'Bearer test_secret')
      .json({
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

  test('POST /api/webhooks/revenuecat - Doit échouer si secret invalide', async ({ client }) => {
    const response = await client
      .post('/api/webhooks/revenuecat')
      .header('Authorization', 'Bearer wrong_secret')
      .json({
        event: {
          type: 'INITIAL_PURCHASE',
          app_user_id: String(user.id),
          product_id: 'emoji_10_credits',
          id: 'evt_002',
        },
      })

    response.assertStatus(401)
    response.assertBodyContains({ error: 'Invalid webhook secret' })
  })

  test('POST /api/webhooks/revenuecat - Doit échouer si product inconnu', async ({ client }) => {
    const response = await client
      .post('/api/webhooks/revenuecat')
      .header('Authorization', 'Bearer test_secret')
      .json({
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

  test('POST /api/webhooks/revenuecat - Doit respecter rate limit (100/min)', async ({
    client,
    assert,
  }) => {
    // Act: Faire 101 requêtes rapides
    const promises = Array.from({ length: 101 }, (_, i) =>
      client
        .post('/api/webhooks/revenuecat')
        .header('Authorization', 'Bearer test_secret')
        .json({
          event: {
            type: 'INITIAL_PURCHASE',
            app_user_id: String(user.id),
            product_id: 'emoji_10_credits',
            id: `evt_rate_${i}`,
          },
        })
    )

    const responses = await Promise.all(promises)
    const statuses = responses.map((r) => r.status())

    const successCount = statuses.filter((s) => s === 200).length
    const rateLimitedCount = statuses.filter((s) => s === 429).length

    assert.equal(successCount, 100)
    assert.equal(rateLimitedCount, 1)
  })
})
```

---

## 🛠️ Helpers et Utilitaires

### 1. User Factory - `tests/helpers/user_factory.ts`

```typescript
import User from '#users/models/user'
import hash from '@adonisjs/core/services/hash'

export async function createUser(options: {
  email?: string
  fullName?: string
  credits?: number
} = {}): Promise<User> {
  return User.create({
    fullName: options.fullName || 'Test User',
    email: options.email || `test-${Date.now()}@example.com`,
    password: await hash.make('password123'),
    credits: options.credits ?? 3,
  })
}
```

### 2. Auth Helper - `tests/helpers/auth_helper.ts`

```typescript
import { ApiClient } from '@japa/api-client'
import User from '#users/models/user'

/**
 * Login avec le guard 'api' (Bearer token)
 * Retourne un client authentifié prêt à l'emploi
 */
export async function loginAsUser(user: User): Promise<ApiClient> {
  const token = await User.accessTokens.create(user)

  return client
    .header('Authorization', `Bearer ${token.value!.release()}`)
    .withGuard('api')
}

/**
 * Créer un user et le login en une seule fois
 */
export async function createAndLoginUser(options = {}): Promise<{ user: User; client: ApiClient }> {
  const user = await createUser(options)
  const authClient = await loginAsUser(user)
  return { user, authClient }
}
```

### 3. Scan Factory - `tests/helpers/scan_factory.ts`

```typescript
import Scan from '#scans/models/scan'

export async function createScan(userId: number, options = {}): Promise<Scan> {
  return Scan.create({
    userId,
    detectedLabel: options.label || 'apple',
    labelFr: options.labelFr || 'pomme',
    confidence: options.confidence || 0.9,
    emojiOptions: options.emojis || [
      { emoji: '🍎', reason: 'Pomme rouge' },
      { emoji: '🍏', reason: 'Fruit sain' },
      { emoji: '❤️', reason: 'Rouge' },
    ],
    originalImagePath: options.imagePath || 'scans/test.jpg',
    isShared: false,
    ...options,
  })
}
```

### 4. Mock VisionService - `tests/bootstrap.ts`

Ajouter dans le fichier bootstrap :

```typescript
import VisionService from '#scans/services/vision_service'

export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: [
    async () => {
      // Mock VisionService pour éviter les appels Gemini réels
      VisionService.prototype.analyzeImage = async () => ({
        label: 'apple',
        labelFr: 'pomme',
        confidence: 0.95,
        emojis: [
          { emoji: '🍎', reason: 'Pomme rouge bien mûre' },
          { emoji: '🍏', reason: 'Fruit sain et naturel' },
          { emoji: '❤️', reason: 'Couleur rouge vif' },
        ],
      })
    },
  ],
  teardown: [],
}
```

---

## ⚙️ Configuration Critique

### 1. Providers Conditionnels

**`adonisrc.ts`** - Exclure Vite et Inertia de l'environnement test :

```typescript
providers: [
  // ... autres providers
  {
    file: () => import('@adonisjs/vite/vite_provider'),
    environment: ['web', 'console', 'repl'], // PAS 'test'
  },
  {
    file: () => import('@adonisjs/inertia/inertia_provider'),
    environment: ['web', 'console', 'repl'], // PAS 'test'
  },
]
```

### 2. Middlewares Conditionnels

**`start/kernel.ts`** - Charger Vite/Inertia UNIQUEMENT hors tests :

```typescript
const serverMiddleware: (() => Promise<{ default: unknown }>)[] = [
  () => import('#core/middleware/container_bindings_middleware'),
  () => import('@adonisjs/static/static_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
]

// ✅ Vite et Inertia chargés UNIQUEMENT hors tests
if (!app.inTest) {
  serverMiddleware.push(() => import('@adonisjs/vite/vite_middleware'))
  serverMiddleware.push(() => import('@adonisjs/inertia/inertia_middleware'))
}
```

### 3. Handler d'Erreurs JSON

**`app/core/exceptions/handler.ts`** - Retourner JSON pour les tests :

```typescript
async handle(error: unknown, ctx: HttpContext) {
  // ✅ InsufficientCreditsError déjà géré (retourne JSON 402)
  if (error instanceof InsufficientCreditsError) {
    return ctx.response.status(402).json({
      error: 'Crédits insuffisants',
      code: 'INSUFFICIENT_CREDITS',
      message: 'Vous devez acheter des crédits pour continuer à scanner',
    })
  }

  // Retourner JSON pour API/Tests au lieu de HTML
  const isApiRequest =
    ctx.request.accepts(['html', 'json']) === 'json' ||
    ctx.request.url().startsWith('/api/') ||
    app.inTest  // 🔑 Clé pour les tests

  if (error instanceof authErrors.E_UNAUTHORIZED_ACCESS && isApiRequest) {
    return ctx.response.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required',
    })
  }

  return super.handle(error, ctx)
}
```

### 4. Routes Multi-Guards

**Toutes les routes API** - Accepter les 2 guards :

```typescript
// ❌ Mauvais - accepte uniquement 'api'
router
  .group(() => {
    // routes...
  })
  .middleware(middleware.auth({ guards: ['api'] }))

// ✅ Bon - accepte 'web' ET 'api' (compatibilité tests)
router
  .group(() => {
    // routes...
  })
  .middleware(middleware.auth({ guards: ['web', 'api'] }))
```

---

## 🚨 Erreurs Courantes et Solutions

### ❌ Erreur 1: Vite Dependency Scan

**Erreur:**
```
Failed to scan for dependencies from entries
[ERROR] The server is being restarted or closed
```

**Cause:** Provider Vite chargé pendant les tests

**Solution:** Exclure Vite de l'environnement `test` dans `adonisrc.ts` (voir Configuration)

---

### ❌ Erreur 2: Cannot Construct ViteMiddleware

**Erreur:**
```
Cannot construct "[class ViteMiddleware]" class
```

**Cause:** Middleware Vite chargé sans provider

**Solution:** Conditionner les middlewares dans `start/kernel.ts` avec `!app.inTest`

---

### ❌ Erreur 3: loginAs is Not a Function

**Erreur:**
```typescript
TypeError: client.get(...).loginAs is not a function
```

**Cause:** Plugin `authApiClient` manquant

**Solution:** Ajouter `authApiClient(app)` dans `tests/bootstrap.ts` :

```typescript
import { authApiClient } from '@adonisjs/auth/plugins/api_client'

export const plugins: Config['plugins'] = [
  // ...
  authApiClient(app),  // 🔑 Nécessaire pour .loginAs()
]
```

---

### ❌ Erreur 4: loginAs Retourne Toujours 401

**Erreur:** Test avec `.loginAs(user)` retourne 401

**Cause:** Guard `web` (session) ne fonctionne pas dans les tests API

**Solution:** Utiliser `.withGuard('api')` :

```typescript
// ❌ Mauvais - utilise le guard 'web' par défaut (session)
const response = await client.get('/api/credits').loginAs(user)

// ✅ Bon - spécifie explicitement le guard 'api' (Bearer token)
const response = await client
  .get('/api/credits')
  .withGuard('api')  // 🔑 Critique !
  .loginAs(user)
```

---

### ❌ Erreur 5: Port EADDRINUSE

**Erreur:**
```
Error: listen EADDRINUSE: address already in use ::1:3333
```

**Cause:** Serveur dev utilise le même port

**Solution:** Créer `.env.test` avec `PORT=3334`

---

### ❌ Erreur 6: GEMINI_VISION_API_KEY Required

**Erreur:**
```
E_MISSING_ENV_VALUE: Missing environment variable "GEMINI_VISION_API_KEY"
```

**Cause:** VisionService tente d'appeler l'API Gemini en test

**Solution:**
1. Ajouter `GEMINI_VISION_API_KEY=test_key` dans `.env.test`
2. **Mieux:** Mocker `VisionService.analyzeImage()` dans `tests/bootstrap.ts` (voir Helpers)

---

### ❌ Erreur 7: Rate Limiter en Memory Mode

**Erreur:** Rate limiting ne fonctionne pas entre les tests

**Cause:** Limiter en mode `database` conserve l'état

**Solution:** Utiliser `LIMITER_STORE=memory` dans `.env.test` pour réinitialiser entre chaque test

---

## 📊 Commandes de Test

```bash
# Depuis la racine du monorepo
cd apps/web

# Tous les tests
node ace test

# Tests unitaires uniquement (rapides)
node ace test --suite=unit

# Tests fonctionnels uniquement
node ace test --suite=functional

# Un fichier spécifique
node ace test --files="tests/functional/api/credits.spec.ts"

# Avec filtre par nom de test
node ace test --tests="Doit créer un scan"

# Mode watch (redémarre à chaque changement)
node ace test --watch

# Avec coverage (nécessite c8)
node ace test --coverage
```

**Depuis la racine avec pnpm :**

```bash
# Tous les tests de l'app web
pnpm --filter web test

# Tests unitaires seulement
pnpm --filter web test --suite=unit

# Tests fonctionnels seulement
pnpm --filter web test --suite=functional
```

---

## 🎓 Bonnes Pratiques

| Pratique | Description |
|----------|-------------|
| ✅ **Guard API** | Toujours utiliser `.withGuard('api').loginAs(user)` dans les tests fonctionnels |
| ✅ **Pattern AAA** | Arrange-Act-Assert pour structurer chaque test |
| ✅ **Cleanup** | `group.teardown()` pour nettoyer les données après tous les tests |
| ✅ **Setup unique** | `group.setup()` pour créer l'utilisateur une fois par groupe |
| ✅ **Tests auth** | Toujours tester routes protégées sans auth → doit retourner 401 |
| ✅ **Tests d'erreurs** | Vérifier les cas d'erreur (404, 403, 402, 400, 429) |
| ✅ **Isolation** | Chaque test doit être indépendant (pas de dépendance entre tests) |
| ✅ **Mock AI** | Toujours mocker VisionService pour éviter les appels Gemini réels |
| ✅ **Fixtures** | Créer des images de test dans `tests/fixtures/` |
| ✅ **DTOs** | Vérifier que les DTOs n'exposent pas de champs sensibles |
| ✅ **Rate Limiting** | Tester les limiters avec des boucles parallèles |
| ✅ **Idempotence** | Tester que les webhooks sont idempotents (même payload 2x) |
| ✅ **Transactions** | Vérifier que les opérations critiques utilisent des transactions DB |

---

## 📋 Résumé des Fichiers à Créer

### Tests Fonctionnels

| Fichier | Tests | Couvre |
|---------|-------|--------|
| `tests/functional/api/credits.spec.ts` | 3 tests | Solde, historique, auth |
| `tests/functional/api/scans.spec.ts` | 6 tests | Upload, AI, rate limit, DTOs |
| `tests/functional/api/shares.spec.ts` | 6 tests | Partage, bonus, route publique, stats |
| `tests/functional/api/revenuecat_webhook.spec.ts` | 6 tests | Webhook, idempotence, validation |

### Tests Unitaires

| Fichier | Tests | Couvre |
|---------|-------|--------|
| `tests/unit/services/credit_service.spec.ts` | 3 tests | Debit, credit, erreurs |

### Helpers

| Fichier | Utilité |
|---------|---------|
| `tests/helpers/user_factory.ts` | Factory pour créer users de test |
| `tests/helpers/auth_helper.ts` | Helper auth avec tokens API |
| `tests/helpers/scan_factory.ts` | Factory pour créer scans |

### Configuration

| Fichier | Modification |
|---------|--------------|
| `tests/bootstrap.ts` | Plugins + Mock VisionService |
| `.env.test` | Variables env pour tests |
| `adonisrc.ts` | Providers conditionnels |
| `start/kernel.ts` | Middlewares conditionnels |

**Total: 24 tests couvrant l'intégralité du MVP backend** 🚀

---

## ✅ Checklist de Démarrage

- [ ] Créer `.env.test` avec les variables nécessaires
- [ ] Modifier `adonisrc.ts` pour exclure Vite/Inertia de 'test'
- [ ] Modifier `start/kernel.ts` pour conditionner les middlewares
- [ ] Ajouter `authApiClient(app)` dans `tests/bootstrap.ts`
- [ ] Créer les helpers (`user_factory.ts`, `auth_helper.ts`)
- [ ] Mocker `VisionService` dans `tests/bootstrap.ts`
- [ ] Créer une image de test dans `tests/fixtures/apple.jpg`
- [ ] Implémenter les tests fonctionnels (credits, scans, shares, webhook)
- [ ] Implémenter les tests unitaires (services)
- [ ] Lancer `node ace test` et vérifier que tout passe ✅

Bon test ! 🧪
