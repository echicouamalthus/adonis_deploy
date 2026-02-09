# MVP Emoji Scanner - Guide d'implémentation

> **Version 4.0.0** - Reflète l'état réel du code implémenté
>
> Scan photo d'un produit -> analyse IA (Gemini) -> 3 propositions d'emojis -> partage -> système de points

---

## Table des matières

- [Avancement](#avancement)
- [Décisions techniques](#décisions-techniques)
- [Architecture](#architecture)
- [Module Scans](#module-scans)
- [Module Credits](#module-credits)
- [Module Shares](#module-shares)
- [Enregistrement des modules](#enregistrement-des-modules)
- [Tuyau - Communication type-safe](#tuyau---communication-type-safe)
- [API Endpoints](#api-endpoints)
- [Flux de données](#flux-de-données)
- [Test Postman](#test-postman)
- [Erreurs rencontrées et solutions](#erreurs-rencontrées-et-solutions)
- [Prochaines étapes](#prochaines-étapes)

---

## Avancement

| Composant | Statut | Détails |
|-----------|--------|---------|
| VisionService (AI SDK + Gemini) | ✅ Done | `generateText` + `Output.object()` + Zod |
| Module Scans (model, service, controller, dto, validator, routes) | ✅ Done | CRUD complet avec rate limiting |
| Module Credits (model, service, controller, dto, routes) | ✅ Done | debit/credit avec transaction DB + `forUpdate()` |
| Module Shares (model, service, controller, dto, validator, routes) | ✅ Done | Partage + bonus crédit |
| Migrations (scans, credits, shares) | ✅ Done | Exécutées (batch 2) |
| Rate limiting scan | ✅ Done | 5 req/min par user |
| Tuyau - Types API auto-générés | ✅ Done | `api.ts` contient scans, credits, shares |
| Tuyau - Client mobile configuré | ✅ Done | `createTuyau` + React Query |
| Page publique `/s/:shareCode` | ❌ TODO | Route GET pour les liens de partage |
| Mobile - Auth | ❌ TODO | Login/Signup + SecureStore |
| Mobile - Camera + Scan | ❌ TODO | CameraView + upload |
| Mobile - Écrans (5) | ❌ TODO | scan, result, history, profile, auth |
| Mobile - Hooks Tuyau (scans, credits, shares) | ❌ TODO | useScan, useCredits, useShare |
| RevenueCat (IAP) | ❌ TODO | Webhook + intégration mobile |
| Analytics (PostHog + Sentry) | ❌ TODO | Monitoring production |

---

## Décisions techniques

| Question | Réponse | Raison |
|----------|---------|--------|
| IA pour la vision ? | AI SDK v6 + Gemini 2.5 Flash | Gratuit (15 req/min), multimodal natif |
| Pourquoi `generateText` + `Output.object()` ? | Pattern AI SDK v6 | `generateObject` est déprécié |
| Structured output ? | Zod (pas VineJS) | AI SDK exige Zod pour le JSON Schema |
| Validation HTTP ? | VineJS | Standard AdonisJS pour les requêtes entrantes |
| Auth mobile ? | Bearer token via guard `api` | `DbAccessTokensProvider` + SecureStore |
| Communication mobile-backend ? | Tuyau (`@tuyau/client`) | Type-safe end-to-end, auto-généré depuis AdonisJS |
| Data fetching mobile ? | React Query via Tuyau | Cache, retry, staleTime, refetch automatique |
| Colonnes JSON PostgreSQL ? | `prepare`/`consume` sur `@column()` | Lucid ne sérialise pas automatiquement les objets JS |
| Transaction crédits ? | `db.transaction()` + `forUpdate()` | Pessimistic locking contre les race conditions |
| Rate limiting scans ? | 5 req/min par user (`scanThrottle`) | Protège les appels Gemini (coûteux) |
| DTOs ? | `@adocasts.com/dto` (`BaseModelDto`) | Contrôle précis des champs exposés au mobile |
| Architecture services ? | Controller -> Service -> Model | Separation of concerns, controller = HTTP only |
| Où sont les migrations ? | `app/users/database/migrations/` | Toutes centralisées, un seul path dans `config/database.ts` |
| URL de partage ? | `VITE_API_URL` + `/s/:shareCode` | Variable d'environnement, change en production |

---

## Architecture

### Arbre des fichiers implémentés

```
apps/web/app/
├── scans/                                  # Module Scans
│   ├── controllers/
│   │   └── api/
│   │       └── scans_controller.ts         # POST/GET scans (HTTP only)
│   ├── models/
│   │   └── scan.ts                         # Model Lucid (prepare/consume JSON)
│   ├── dtos/
│   │   └── scan.ts                         # ScanDto (exclut aiRawResponse, originalImagePath)
│   ├── services/
│   │   ├── scan_service.ts                 # Logique métier (createScan, listByUser...)
│   │   └── vision_service.ts               # AI SDK + Gemini 2.5 Flash
│   ├── validators.ts                       # createScanValidator (VineJS)
│   └── routes.ts                           # 3 routes /api/scans
│
├── credits/                                # Module Credits
│   ├── controller/
│   │   └── api/
│   │       └── credit_controller.ts        # GET solde + historique
│   ├── models/
│   │   └── credit_transactions.ts          # Model + CreditType enum
│   ├── dtos/
│   │   └── credit_transaction.ts           # CreditTransactionDto (exclut userId, referenceId)
│   ├── services/
│   │   └── credit_service.ts               # debit/credit avec DB transaction + InsufficientCreditsError
│   └── routes.ts                           # 2 routes /api/credits
│
├── shares/                                 # Module Shares
│   ├── controller/
│   │   └── api/
│   │       └── share_controller.ts         # POST partage + GET stats
│   ├── model/
│   │   └── share.ts                        # Model avec relations User + Scan
│   ├── dtos/
│   │   └── share.ts                        # ShareDto
│   ├── services/
│   │   └── share_service.ts                # createShare + getStats
│   ├── validators.ts                       # createShareValidator (VineJS)
│   └── routes.ts                           # 2 routes /api/shares
│
├── users/database/migrations/              # Toutes les migrations MVP
│   ├── 1770501152349_create_scans_table.ts
│   ├── 1770510723627_add_credits_to_users.ts
│   ├── 1770512195891_create_credit_transactions_table.ts
│   └── 1770514153447_create_shares_table.ts
│
└── users/models/user.ts                    # +colonne credits (default: 3)

apps/web/.adonisjs/
└── api.ts                                  # Types Tuyau auto-générés (scans, credits, shares)

apps/mobile/
├── lib/
│   ├── tuyau.ts                            # Client Tuyau + React Query config
│   └── hooks/
│       └── useHello.ts                     # Hook exemple (pattern à suivre pour MVP)
```

> **Note** : Les dossiers ne sont pas uniformes (`controllers/` vs `controller/`, `models/` vs `model/`).
> C'est un artefact de l'implémentation progressive. Le code fonctionne grâce aux imports explicites.

### Dépendances inter-modules

```
Scans ──uses──> Credits (debit 1 crédit par scan)
Scans ──uses──> VisionService (analyse Gemini)
Shares ──uses──> Credits (credit 1 bonus par partage)
Shares ──uses──> Scans (vérifie propriété du scan, marque isShared)

Mobile ──tuyau──> Backend (type-safe, auto-généré depuis les routes AdonisJS)
```

---

## Module Scans

### Migration : `create_scans_table`

```typescript
// apps/web/app/users/database/migrations/1770501152349_create_scans_table.ts
this.schema.createTable('scans', (table) => {
  table.increments('id').primary()
  table.integer('user_id').unsigned().notNullable()
    .references('id').inTable('users').onDelete('CASCADE')
  table.string('original_image_path', 500).notNullable()
  table.string('detected_label', 255).notNullable()
  table.float('confidence').defaultTo(0)
  table.json('emoji_options').notNullable()       // [{emoji, reason}] x3
  table.string('selected_emoji', 50).nullable()
  table.string('label_fr', 255).nullable()
  table.json('ai_raw_response').nullable()        // Réponse brute Gemini
  table.boolean('is_shared').defaultTo(false)
  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').notNullable()
  table.index(['user_id', 'created_at'])
})
```

### Model Scan

```typescript
// apps/web/app/scans/models/scan.ts
import { column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import BaseModel from '#common/models/base_model'
import User from '#users/models/user'

export default class Scan extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare originalImagePath: string

  @column()
  declare detectedLabel: string

  @column()
  declare confidence: number

  // IMPORTANT : prepare/consume obligatoires pour les colonnes JSON PostgreSQL
  @column({
    prepare: (value: any) => JSON.stringify(value),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare emojiOptions: Array<{ emoji: string; reason: string }>

  @column()
  declare selectedEmoji: string | null

  @column()
  declare labelFr: string | null

  @column({
    prepare: (value: any) => (value ? JSON.stringify(value) : null),
    consume: (value: any) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare aiRawResponse: Record<string, any> | null

  @column()
  declare isShared: boolean

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
```

> **Piège rencontré** : Sans `prepare`/`consume`, PostgreSQL reçoit `[object Object]` au lieu
> de JSON valide et retourne `syntaxe en entrée invalide pour le type json`.

### VisionService (AI SDK + Gemini)

```typescript
// apps/web/app/scans/services/vision_service.ts
import { generateText, Output } from 'ai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { z } from 'zod'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

// Schéma Zod pour la réponse structurée de Gemini
export const visionReponseSchema = z.object({
  label: z.string().describe("Nom de l'objet en anglais (1 mots)"),
  labelFr: z.string().describe("Nom de l'object en français (1 mots)"),
  emojis: z.array(z.object({
    emoji: z.string().describe("Emoji correspondant à l'objet"),
    reason: z.string().describe("Pourquoi cet emoji correspond à l'objet (court"),
  })).length(3).describe("3 propositions d'emoji differentes"),
  confidence: z.number().min(0).max(1).describe('Score de confiance entre 0 et 1'),
})

export type VisionResponse = z.infer<typeof visionReponseSchema>

export default class VisionService {
  private google

  constructor() {
    const apiKey = env.get('GEMINI_VISION_API_KEY')
    if (!apiKey) throw new Error('GEMINI_VISION_API_KEY manquante dans .env')
    this.google = createGoogleGenerativeAI({ apiKey })
  }

  async analyzeImage(ImageBuffer: Buffer) {
    const { output, usage } = await generateText({
      model: this.google('gemini-2.5-flash'),
      output: Output.object({ schema: visionReponseSchema }),
      messages: [{
        role: 'user',
        content: [
          { type: 'image', image: ImageBuffer },         // Buffer direct, pas de mediaType
          { type: 'text', text: "Identifie l'objet ou produit principal dans cette image." },
        ],
      }],
    })

    if (!output) throw new Error('Gemini na pas retourné de réponse structurée')
    logger.info('Vision analysis: %s (%d tokens)', output.label, usage?.totalTokens)
    return output
  }
}
```

**Points clés :**
- `generateText` + `Output.object()` (PAS `generateObject` qui est déprécié)
- `image: ImageBuffer` passe le Buffer directement (pas de base64, pas de `mediaType`)
- Zod pour le structured output (VineJS ne fonctionne pas avec AI SDK)
- Clé API depuis `aistudio.google.com/apikey` (PAS Google Cloud Console)

### ScanService (logique métier)

```typescript
// apps/web/app/scans/services/scan_service.ts
import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { cuid } from '@adonisjs/core/helpers'
import Scan from '#scans/models/scan'
import VisionService from '#scans/services/vision_service'
import CreditService, { InsufficientCreditsError } from '#credits/services/credit_service'

export default class ScanService {
  private creditService: CreditService
  private visionService: VisionService

  constructor() {
    this.creditService = new CreditService()
    this.visionService = new VisionService()
  }

  async createScan(userId: number, image: { extname?: string; tmpPath?: string; move: Function }) {
    // 1. Vérifier les crédits
    const balance = await this.creditService.getBalance(userId)
    if (balance <= 0) throw new InsufficientCreditsError()

    // 2. Sauvegarder l'image
    const fileName = `${cuid()}.${image.extname}`
    await image.move(app.makePath('tmp/scans'), { name: fileName })

    // 3. Lire et analyser via Gemini
    const filePath = app.makePath('tmp/scans', fileName)
    const imageBuffer = await readFile(filePath)
    const result = await this.visionService.analyzeImage(imageBuffer)

    // 4. Débiter 1 crédit
    await this.creditService.debit(userId, 1, 'scan')

    // 5. Créer le scan en DB
    const scan = await Scan.create({
      userId,
      originalImagePath: `scans/${fileName}`,
      detectedLabel: result.label,
      confidence: result.confidence,
      emojiOptions: result.emojis,
      labelFr: result.labelFr,
      aiRawResponse: result,
    })

    const newBalance = await this.creditService.getBalance(userId)
    return { scan, credits: newBalance }
  }

  async listByUser(userId: number, page: number = 1, limit: number = 20) {
    return Scan.query().where('user_id', userId).orderBy('created_at', 'desc').paginate(page, limit)
  }

  async findByIdForUser(scanId: number, userId: number) {
    return Scan.query().where('id', scanId).where('user_id', userId).firstOrFail()
  }
}
```

### ScansController (HTTP only)

```typescript
// apps/web/app/scans/controllers/api/scans_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import ScanDto from '#scans/dtos/scan'
import ScanService from '#scans/services/scan_service'
import { InsufficientCreditsError } from '#credits/services/credit_service'
import { createScanValidator } from '#scans/validators'

export default class ScansController {
  private scanService: ScanService
  constructor() { this.scanService = new ScanService() }

  // POST /api/scans - Upload + analyse Gemini
  async store({ request, response, auth }: HttpContext) {
    const { image } = await request.validateUsing(createScanValidator)
    try {
      const { scan, credits } = await this.scanService.createScan(auth.user!.id, image)
      return response.created({ ...new ScanDto(scan), credits })
    } catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return response.paymentRequired({ message: error.message, credits: 0 })
      }
      throw error
    }
  }

  // GET /api/scans - Historique paginé
  async index({ auth, request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const scans = await this.scanService.listByUser(auth.user!.id, page, limit)
    return response.ok({ ...scans.toJSON(), data: scans.all().map((scan) => new ScanDto(scan)) })
  }

  // GET /api/scans/:id - Détail
  async show({ auth, params, response }: HttpContext) {
    const scan = await this.scanService.findByIdForUser(params.id, auth.user!.id)
    return response.ok(new ScanDto(scan))
  }
}
```

### ScanDto

```typescript
// apps/web/app/scans/dtos/scan.ts
import { BaseModelDto } from '@adocasts.com/dto/base'
import Scan from '#scans/models/scan'

export default class ScanDto extends BaseModelDto {
  declare id: number
  declare userId: number
  declare detectedLabel: string
  declare labelFr: string | null
  declare confidence: number
  declare emojiOptions: Array<{ emoji: string; reason: string }>
  declare selectedEmoji: string | null
  declare isShared: boolean
  declare createdAt: string                     // ISO string (pas DateTime)

  constructor(scan?: Scan) {
    super()
    if (!scan) return
    this.id = scan.id
    this.userId = scan.userId
    this.detectedLabel = scan.detectedLabel
    this.labelFr = scan.labelFr
    this.confidence = scan.confidence
    this.emojiOptions = scan.emojiOptions
    this.selectedEmoji = scan.selectedEmoji
    this.isShared = scan.isShared
    this.createdAt = scan.createdAt.toISO()!
  }
}
```

**Champs exclus du DTO** (non exposés au mobile) :
- `originalImagePath` - chemin serveur interne
- `aiRawResponse` - réponse brute Gemini (debug only)
- `updatedAt` - pas utile côté mobile

### Validator

```typescript
// apps/web/app/scans/validators.ts
import vine from '@vinejs/vine'

export const createScanValidator = vine.compile(
  vine.object({
    image: vine.file({ size: '10mb', extnames: ['png', 'jpg', 'jpeg', 'webp', 'heic'] }),
  })
)
```

### Routes Scans

```typescript
// apps/web/app/scans/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'
import { scanThrottle } from '#start/limiter'

const ScansController = () => import('#scans/controllers/api/scans_controller')

router.group(() => {
  router.post('/scans', [ScansController, 'store']).as('scans.store').use(scanThrottle)
  router.get('/scans', [ScansController, 'index']).as('scans.index')
  router.get('/scans/:id', [ScansController, 'show']).as('scans.show')
}).prefix('/api').middleware(middleware.auth({ guards: ['api'] }))
```

---

## Module Credits

### Migrations

```typescript
// Migration 1 : Ajouter credits au User
// apps/web/app/users/database/migrations/1770510723627_add_credits_to_users.ts
this.schema.alterTable('users', (table) => {
  table.integer('credits').unsigned().defaultTo(3).notNullable()  // 3 crédits gratuits
})

// Migration 2 : Table credit_transactions
// apps/web/app/users/database/migrations/1770512195891_create_credit_transactions_table.ts
this.schema.createTable('credit_transactions', (table) => {
  table.increments('id').primary()
  table.integer('user_id').unsigned().notNullable()
    .references('id').inTable('users').onDelete('CASCADE')
  table.integer('amount').notNullable()               // positif = crédit, négatif = débit
  table.enum('type', ['scan', 'purchase', 'bonus_invite', 'bonus_share', 'bonus_signup']).notNullable()
  table.string('description', 255).nullable()
  table.integer('balance_after').notNullable()         // snapshot du solde après transaction
  table.string('reference_id', 255).nullable()         // ID externe (RevenueCat, etc.)
  table.timestamp('created_at').notNullable()
  table.index(['user_id', 'created_at'])
  table.index('type')
})
```

### Model CreditTransaction

```typescript
// apps/web/app/credits/models/credit_transactions.ts
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#users/models/user'

export type CreditType = 'scan' | 'purchase' | 'bonus_invite' | 'bonus_share' | 'bonus_signup'

export default class CreditTransaction extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare amount: number              // +positif / -négatif

  @column()
  declare type: CreditType

  @column()
  declare description: string | null

  @column()
  declare balanceAfter: number

  @column()
  declare referenceId: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
```

> **Note** : Ce model importe `BaseModel` directement de `@adonisjs/lucid/orm` (pas de `#common/models/base_model`).
> Pas de `updatedAt` : les transactions sont immuables.

### CreditService

```typescript
// apps/web/app/credits/services/credit_service.ts
import db from '@adonisjs/lucid/services/db'
import User from '#users/models/user'
import CreditTransaction from '#credits/models/credit_transactions'
import type { CreditType } from '#credits/models/credit_transactions'

// Erreur métier exportée (utilisée par ScansController pour le catch)
export class InsufficientCreditsError extends Error {
  constructor() {
    super('Crédits insuffisants')
    this.name = 'InsufficientCreditsError'
  }
}

export default class CreditService {
  static SIGNUP_BONUS = 3
  static SHARE_BONUS = 1
  static INVITE_BONUS = 3
  static PACKS = {
    small:  { credits: 10,  priceId: 'emoji_10_credits' },
    medium: { credits: 50,  priceId: 'emoji_50_credits' },
    large:  { credits: 150, priceId: 'emoji_150_credits' },
  }

  async getBalance(userId: number): Promise<number> {
    const user = await User.findOrFail(userId)
    return user.credits
  }

  // Débiter avec pessimistic locking (forUpdate)
  async debit(userId: number, amount: number, type: CreditType): Promise<number> {
    return await db.transaction(async (trx) => {
      const user = await User.query({ client: trx })
        .where('id', userId).forUpdate().firstOrFail()

      if (user.credits < amount) throw new InsufficientCreditsError()

      user.credits -= amount
      await user.useTransaction(trx).save()

      await CreditTransaction.create({
        userId, amount: -amount, type, balanceAfter: user.credits,
        description: `Débit de ${amount} crédit(s) pour ${type}`,
      }, { client: trx })

      return user.credits
    })
  }

  // Créditer (bonus, achat)
  async credit(userId: number, amount: number, type: CreditType, referenceId?: string): Promise<number> {
    return await db.transaction(async (trx) => {
      const user = await User.query({ client: trx })
        .where('id', userId).forUpdate().firstOrFail()

      user.credits += amount
      await user.useTransaction(trx).save()

      await CreditTransaction.create({
        userId, amount, type, balanceAfter: user.credits, referenceId,
        description: `Crédit de ${amount} point(s) pour ${type}`,
      }, { client: trx })

      return user.credits
    })
  }

  async grantSignupBonus(userId: number): Promise<void> {
    await this.credit(userId, CreditService.SIGNUP_BONUS, 'bonus_signup')
  }

  async getHistory(userId: number, page: number = 1, limit: number = 20) {
    return await CreditTransaction.query()
      .where('user_id', userId).orderBy('created_at', 'desc').paginate(page, limit)
  }
}
```

**Points clés :**
- `forUpdate()` verrouille la ligne user pendant la transaction (empêche les race conditions)
- `amount` négatif pour les débits, positif pour les crédits
- `balanceAfter` sauvegarde le solde après chaque opération (audit trail)
- `InsufficientCreditsError` est exportée et catchée dans `ScansController`

### CreditsController

```typescript
// apps/web/app/credits/controller/api/credit_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import CreditService from '#credits/services/credit_service'
import CreditTransactionDto from '#credits/dtos/credit_transaction'

export default class CreditsController {
  private creditService: CreditService
  constructor() { this.creditService = new CreditService() }

  // GET /api/credits - Solde et packs disponibles
  async show({ auth, response }: HttpContext) {
    const balance = await this.creditService.getBalance(auth.user!.id)
    return response.ok({ credits: balance, packs: CreditService.PACKS })
  }

  // GET /api/credits/history - Historique transactions
  async history({ auth, request, response }: HttpContext) {
    const page = request.input('page', 1)
    const transactions = await this.creditService.getHistory(auth.user!.id, page)
    return response.ok({
      ...transactions.toJSON(),
      data: transactions.all().map((t) => new CreditTransactionDto(t)),
    })
  }
}
```

### CreditTransactionDto

```typescript
// apps/web/app/credits/dtos/credit_transaction.ts
import { BaseModelDto } from '@adocasts.com/dto/base'
import CreditTransaction from '#credits/models/credit_transactions'

export default class CreditTransactionDto extends BaseModelDto {
  declare id: number
  declare amount: number
  declare type: string
  declare description: string | null
  declare balanceAfter: number
  declare createdAt: string

  constructor(transaction?: CreditTransaction) {
    super()
    if (!transaction) return
    this.id = transaction.id
    this.amount = transaction.amount
    this.type = transaction.type
    this.description = transaction.description
    this.balanceAfter = transaction.balanceAfter
    this.createdAt = transaction.createdAt.toISO()!
  }
}
```

**Champs exclus** : `userId`, `referenceId`

### Routes Credits

```typescript
// apps/web/app/credits/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const CreditsController = () => import('#credits/controller/api/credit_controller')

router.group(() => {
  router.get('/credits', [CreditsController, 'show']).as('credits.show')
  router.get('/credits/history', [CreditsController, 'history']).as('credits.history')
}).prefix('/api').middleware(middleware.auth({ guards: ['api'] }))
```

---

## Module Shares

### Migration : `create_shares_table`

```typescript
// apps/web/app/users/database/migrations/1770514153447_create_shares_table.ts
this.schema.createTable('shares', (table) => {
  table.increments('id').primary()
  table.integer('user_id').unsigned().notNullable()
    .references('id').inTable('users').onDelete('CASCADE')
  table.integer('scan_id').unsigned().notNullable()
    .references('id').inTable('scans').onDelete('CASCADE')
  table.enum('platform', ['instagram', 'tiktok', 'twitter', 'facebook', 'whatsapp', 'other']).notNullable()
  table.string('share_code', 20).unique().notNullable()
  table.integer('click_count').defaultTo(0)
  table.boolean('bonus_credited').defaultTo(false)
  table.timestamp('created_at').notNullable()
  table.timestamp('updated_at').notNullable()
  table.index(['user_id', 'created_at'])
  table.index('share_code')
})
```

### Model Share

```typescript
// apps/web/app/shares/model/share.ts
import { column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import BaseModel from '#common/models/base_model'
import User from '#users/models/user'
import Scan from '#scans/models/scan'

export default class Share extends BaseModel {
  @column({ isPrimary: true }) declare id: number
  @column() declare userId: number
  @column() declare scanId: number
  @column() declare platform: string
  @column() declare shareCode: string
  @column() declare clickCount: number
  @column() declare bonusCredited: boolean

  @belongsTo(() => User) declare user: BelongsTo<typeof User>
  @belongsTo(() => Scan) declare scan: BelongsTo<typeof Scan>
}
```

### ShareService

```typescript
// apps/web/app/shares/services/share_service.ts
import { randomBytes } from 'node:crypto'
import Share from '#shares/model/share'
import Scan from '#scans/models/scan'
import CreditService from '#credits/services/credit_service'

export default class ShareService {
  private creditService: CreditService
  constructor() { this.creditService = new CreditService() }

  async createShare(userId: number, scanId: number, platform: string) {
    // Vérifier propriété du scan
    const scan = await Scan.query().where('id', scanId).where('user_id', userId).firstOrFail()

    // Générer code unique (12 chars hex)
    const shareCode = randomBytes(6).toString('hex')

    // Créer le partage
    const share = await Share.create({
      userId, scanId: scan.id, platform, shareCode, bonusCredited: true,
    })

    // Créditer bonus (1 point)
    const newBalance = await this.creditService.credit(userId, CreditService.SHARE_BONUS, 'bonus_share')

    // Marquer le scan comme partagé
    scan.isShared = true
    await scan.save()

    return { share, credits: newBalance }
  }

  async getStats(userId: number) {
    const totalShares = await Share.query().where('user_id', userId).count('* as total')
    const totalClicks = await Share.query().where('user_id', userId).sum('click_count as total')
    return {
      totalShares: Number(totalShares[0].$extras.total),
      totalClicks: Number(totalClicks[0].$extras.total || 0),
    }
  }
}
```

### SharesController

```typescript
// apps/web/app/shares/controller/api/share_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import ShareService from '#shares/services/share_service'
import ShareDto from '#shares/dtos/share'
import CreditService from '#credits/services/credit_service'
import { createShareValidator } from '#shares/validators'

export default class SharesController {
  private shareService: ShareService
  constructor() { this.shareService = new ShareService() }

  // POST /api/shares - Enregistrer un partage
  async store({ request, response, auth }: HttpContext) {
    const { scanId, platform } = await request.validateUsing(createShareValidator)
    const { share, credits } = await this.shareService.createShare(auth.user!.id, scanId, platform)
    return response.created({
      ...new ShareDto(share),
      shareUrl: `${env.get('VITE_API_URL', 'http://localhost:3333')}/s/${share.shareCode}`,
      bonusCredits: CreditService.SHARE_BONUS,
      totalCredits: credits,
    })
  }

  // GET /api/shares/stats - Statistiques
  async stats({ auth, response }: HttpContext) {
    const stats = await this.shareService.getStats(auth.user!.id)
    return response.ok(stats)
  }
}
```

### ShareDto

```typescript
// apps/web/app/shares/dtos/share.ts
import { BaseModelDto } from '@adocasts.com/dto/base'
import Share from '#shares/model/share'

export default class ShareDto extends BaseModelDto {
  declare id: number
  declare scanId: number
  declare platform: string
  declare shareCode: string
  declare clickCount: number
  declare bonusCredited: boolean
  declare createdAt: string

  constructor(share?: Share) {
    super()
    if (!share) return
    this.id = share.id
    this.scanId = share.scanId
    this.platform = share.platform
    this.shareCode = share.shareCode
    this.clickCount = share.clickCount
    this.bonusCredited = share.bonusCredited
    this.createdAt = share.createdAt.toISO()!
  }
}
```

### Validator

```typescript
// apps/web/app/shares/validators.ts
import vine from '@vinejs/vine'

export const createShareValidator = vine.compile(
  vine.object({
    scanId: vine.number().positive(),
    platform: vine.enum(['instagram', 'whatsapp', 'twitter', 'facebook', 'tiktok', 'other']),
  })
)
```

### Routes Shares

```typescript
// apps/web/app/shares/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

const SharesController = () => import('#shares/controller/api/share_controller')

router.group(() => {
  router.post('/shares', [SharesController, 'store']).as('shares.store')
  router.get('/shares/stats', [SharesController, 'stats']).as('shares.stats')
}).prefix('/api').middleware(middleware.auth({ guards: ['api'] }))
```

---

## Enregistrement des modules

### 1. `package.json` - Subpath imports

```json
{
  "imports": {
    "#scans/*":   "./app/scans/*.js",
    "#credits/*": "./app/credits/*.js",
    "#shares/*":  "./app/shares/*.js"
  }
}
```

> Pas besoin de `tsconfig.json` paths. TypeScript 5.4+ résout les subpath imports
> du `package.json` nativement.

### 2. `adonisrc.ts` - Preloads

```typescript
preloads: [
  () => import('#start/kernel'),
  () => import('#marketing/routes'),
  () => import('#auth/routes'),
  // ...existants...
  () => import('#scans/routes'),     // ← ajouté
  () => import('#credits/routes'),   // ← ajouté
  () => import('#shares/routes'),    // ← ajouté
]
```

### 3. `config/database.ts` - Chemin migrations

```typescript
migrations: {
  paths: ['app/users/database/migrations']  // Toutes les migrations sont ici
}
```

### 4. `start/env.ts` - Variables d'environnement

```typescript
GEMINI_VISION_API_KEY: Env.schema.string.optional(),
VITE_API_URL: Env.schema.string.optional(),
LIMITER_STORE: Env.schema.enum(['database', 'memory'] as const),
```

### 5. `start/limiter.ts` - Rate limiting

```typescript
// Global : 10 req/min
export const throttle = limiter.define('global', () => {
  return limiter.allowRequests(10).every('1 minute').blockFor('10 mins')
})

// Scans : 5 req/min par user (protège Gemini)
export const scanThrottle = limiter.define('scan', (ctx) => {
  return limiter.allowRequests(5).every('1 minute').blockFor('1 min')
    .usingKey(`scan_${ctx.auth?.user?.id ?? ctx.request.ip()}`)
})
```

### 6. `config/auth.ts` - Guard API

```typescript
guards: {
  web: sessionGuard({ ... }),          // Sessions web (Inertia)
  api: tokensGuard({                   // Tokens API (mobile)
    provider: tokensUserProvider({
      tokens: 'accessTokens',
      model: () => import('#users/models/user'),
    }),
  }),
}
```

---

## Tuyau - Communication type-safe

Tuyau assure la communication **type-safe** entre le backend AdonisJS et l'app mobile Expo.
Les types sont **auto-générés** depuis les routes et validators du backend.

### Comment ça fonctionne

```
Backend (AdonisJS)                    Mobile (Expo)
──────────────────                    ─────────────
routes.ts + validators.ts
        │
        ▼
@tuyau/core (codegen)
        │
        ▼
.adonisjs/api.ts (auto-généré)  ──import──>  @tuyau/client (createTuyau)
  - ApiScansPost                                    │
  - ApiScansGetHead                                 ▼
  - ApiCreditsGetHead                         tuyau.api.scans.$post()
  - ApiSharesPost                             tuyau.api.credits.$get()
  - ...                                       tuyau.api.shares.$post()
```

### Config backend (`config/tuyau.ts`)

```typescript
// apps/web/config/tuyau.ts
import { defineConfig } from '@tuyau/core'

const tuyauConfig = defineConfig({
  codegen: {
    // Filtre optionnel des routes à générer
  },
})

export default tuyauConfig
```

Le provider `@tuyau/core/tuyau_provider` est déjà enregistré dans `adonisrc.ts`.
La commande `@tuyau/core/commands` génère automatiquement `apps/web/.adonisjs/api.ts`.

### Types auto-générés (`api.ts`)

Tuyau a déjà généré les types pour les 3 modules MVP :

```typescript
// apps/web/.adonisjs/api.ts (auto-généré, ne pas modifier)

// Scans
type ApiScansPost = {
  request: MakeTuyauRequest<InferInput<typeof import('../app/scans/validators.ts')['createScanValidator']>>
  response: MakeTuyauResponse<import('../app/scans/controllers/api/scans_controller.ts').default['store'], true>
}
type ApiScansGetHead = {
  request: unknown
  response: MakeTuyauResponse<...ScansController['index'], false>
}
type ApiScansIdGetHead = { ... }

// Credits
type ApiCreditsGetHead = {
  request: unknown
  response: MakeTuyauResponse<...CreditsController['show'], false>
}
type ApiCreditsHistoryGetHead = { ... }

// Shares
type ApiSharesPost = {
  request: MakeTuyauRequest<InferInput<typeof import('../app/shares/validators.ts')['createShareValidator']>>
  response: MakeTuyauResponse<...SharesController['store'], true>
}
type ApiSharesStatsGetHead = { ... }

// Structure de l'API
export interface ApiDefinition {
  'api': {
    'scans': {
      '$post': ApiScansPost;
      '$get': ApiScansGetHead;
      ':id': { '$get': ApiScansIdGetHead; };
    };
    'credits': {
      '$get': ApiCreditsGetHead;
      'history': { '$get': ApiCreditsHistoryGetHead; };
    };
    'shares': {
      '$post': ApiSharesPost;
      'stats': { '$get': ApiSharesStatsGetHead; };
    };
  };
}
```

### Client mobile (`lib/tuyau.ts`)

```typescript
// apps/mobile/lib/tuyau.ts
import { createTuyau } from "@tuyau/client";
import { api } from "../../web/.adonisjs/api";       // Import cross-workspace (monorepo)
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // Cache 5 minutes
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * attempt, 5000),
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

export const tuyau = createTuyau({
  api,
  baseUrl: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3333",
  headers: {
    Accept: "application/json",
    "Content-type": "application/json",
  },
});
```

> **Important** : Le header `Authorization: Bearer <token>` devra être ajouté dynamiquement
> via un intercepteur ou en passant les headers dans chaque appel.

### Pattern hook existant (référence)

```typescript
// apps/mobile/lib/hooks/useHello.ts - Pattern existant à suivre
import { useQuery } from "@tanstack/react-query";
import { tuyau } from "../tuyau";

export const useHello = () => {
  return useQuery({
    queryKey: ["hello"],
    queryFn: async () => {
      const response = await tuyau.api.hello.$get();
      if (response.error) throw new Error(response.error.value as string);
      return response.data;
    },
  });
};
```

### Hooks MVP à créer (TODO)

En suivant le pattern `useHello`, voici les hooks à implémenter :

```typescript
// apps/mobile/lib/hooks/useCredits.ts
import { useQuery } from "@tanstack/react-query";
import { tuyau } from "../tuyau";

export const useCredits = () => {
  return useQuery({
    queryKey: ["credits"],
    queryFn: async () => {
      const response = await tuyau.api.credits.$get();
      if (response.error) throw new Error(response.error.value as string);
      return response.data;     // { credits: number, packs: {...} }
    },
  });
};
```

```typescript
// apps/mobile/lib/hooks/useScans.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tuyau } from "../tuyau";

// Liste des scans
export const useScans = (page = 1) => {
  return useQuery({
    queryKey: ["scans", page],
    queryFn: async () => {
      const response = await tuyau.api.scans.$get({ query: { page } });
      if (response.error) throw new Error(response.error.value as string);
      return response.data;
    },
  });
};

// Mutation pour scanner une image
export const useScanMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await tuyau.api.scans.$post(formData);
      if (response.error) throw new Error(response.error.value as string);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scans"] });
      queryClient.invalidateQueries({ queryKey: ["credits"] });
    },
  });
};
```

```typescript
// apps/mobile/lib/hooks/useShare.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tuyau } from "../tuyau";

export const useShareMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ scanId, platform }: { scanId: number; platform: string }) => {
      const response = await tuyau.api.shares.$post({ scanId, platform });
      if (response.error) throw new Error(response.error.value as string);
      return response.data;     // { ...ShareDto, shareUrl, bonusCredits, totalCredits }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credits"] });
      queryClient.invalidateQueries({ queryKey: ["scans"] });
    },
  });
};
```

### Appels Tuyau disponibles (résumé)

| Appel Tuyau | Route backend | Type |
|-------------|---------------|------|
| `tuyau.api.scans.$post(formData)` | `POST /api/scans` | mutation |
| `tuyau.api.scans.$get()` | `GET /api/scans` | query |
| `tuyau.api.scans({ id: 1 }).$get()` | `GET /api/scans/1` | query |
| `tuyau.api.credits.$get()` | `GET /api/credits` | query |
| `tuyau.api.credits.history.$get()` | `GET /api/credits/history` | query |
| `tuyau.api.shares.$post({ scanId, platform })` | `POST /api/shares` | mutation |
| `tuyau.api.shares.stats.$get()` | `GET /api/shares/stats` | query |

---

## API Endpoints

| Méthode | URL | Auth | Body | Description | HTTP |
|---------|-----|------|------|-------------|------|
| `POST` | `/api/scans` | Bearer | form-data: `image` (file) | Scanner une image | 201 / 402 |
| `GET` | `/api/scans` | Bearer | query: `page`, `limit` | Historique paginé | 200 |
| `GET` | `/api/scans/:id` | Bearer | - | Détail d'un scan | 200 |
| `GET` | `/api/credits` | Bearer | - | Solde + packs | 200 |
| `GET` | `/api/credits/history` | Bearer | query: `page`, `limit` | Transactions | 200 |
| `POST` | `/api/shares` | Bearer | JSON: `{scanId, platform}` | Partager un scan | 201 |
| `GET` | `/api/shares/stats` | Bearer | - | Stats partage | 200 |

### Réponses types

**POST /api/scans (201)**
```json
{
  "id": 1,
  "userId": 1,
  "detectedLabel": "Banana",
  "labelFr": "Banane",
  "confidence": 0.98,
  "emojiOptions": [
    { "emoji": "🍌", "reason": "Représente directement une banane." },
    { "emoji": "💛", "reason": "Couleur typique des bananes mûres." },
    { "emoji": "🌿", "reason": "Les feuilles de bananier sont souvent associées." }
  ],
  "selectedEmoji": null,
  "isShared": false,
  "createdAt": "2026-02-08T13:11:25.769+00:00",
  "credits": 2
}
```

**POST /api/scans (402 - plus de crédits)**
```json
{ "message": "Crédits insuffisants", "credits": 0 }
```

**GET /api/credits (200)**
```json
{
  "credits": 3,
  "packs": {
    "small":  { "credits": 10,  "priceId": "emoji_10_credits" },
    "medium": { "credits": 50,  "priceId": "emoji_50_credits" },
    "large":  { "credits": 150, "priceId": "emoji_150_credits" }
  }
}
```

**GET /api/credits/history (200)**
```json
{
  "meta": { "total": 2, "perPage": 20, "currentPage": 1, "lastPage": 1 },
  "data": [
    { "id": 2, "amount": 1, "type": "bonus_share", "description": "Crédit de 1 point(s) pour bonus_share", "balanceAfter": 3, "createdAt": "2026-02-08T..." },
    { "id": 1, "amount": -1, "type": "scan", "description": "Débit de 1 crédit(s) pour scan", "balanceAfter": 2, "createdAt": "2026-02-08T..." }
  ]
}
```

**POST /api/shares (201)**
```json
{
  "id": 1,
  "scanId": 1,
  "platform": "instagram",
  "shareCode": "a1b2c3d4e5f6",
  "clickCount": 0,
  "bonusCredited": true,
  "createdAt": "2026-02-08T...",
  "shareUrl": "http://localhost:3333/s/a1b2c3d4e5f6",
  "bonusCredits": 1,
  "totalCredits": 3
}
```

**GET /api/shares/stats (200)**
```json
{ "totalShares": 1, "totalClicks": 0 }
```

---

## Flux de données

```
MOBILE (Expo)                       BACKEND (AdonisJS)                   EXTERNE
─────────────                       ──────────────────                   ────────

[Camera]
  │ photo (jpg/png/webp/heic, max 10MB)
  ▼
[useScanMutation]
  │ tuyau.api.scans.$post(formData)
  │ Bearer token (SecureStore)
  ▼
POST /api/scans ────────────────▶ [ScansController.store]
                                       │ validateUsing(createScanValidator)
                                       ▼
                                  [ScanService.createScan]
                                       │
                                       ├── creditService.getBalance()     → check > 0
                                       ├── image.move(tmp/scans/)         → save file
                                       ├── readFile(filePath)             → get Buffer
                                       ├── visionService.analyzeImage()──▶ [Gemini 2.5 Flash]
                                       │                                      │
                                       │   ◀── {label, labelFr, emojis, confidence}
                                       ├── creditService.debit(1, 'scan') → -1 crédit (forUpdate)
                                       └── Scan.create({...})             → save to DB
                                       │
                                       ▼
[Afficher résultat] ◀── 201 ───── { ScanDto + credits }
  │ invalidateQueries(["scans", "credits"])
  ▼
[EmojiCard x3] (choix utilisateur)

[useShareMutation]
  │ tuyau.api.shares.$post({ scanId, platform })
  ▼
POST /api/shares ───────────────▶ [SharesController.store]
                                       │ validateUsing(createShareValidator)
                                       ▼
                                  [ShareService.createShare]
                                       ├── Scan.where(id, user_id)        → check ownership
                                       ├── randomBytes(6).toString('hex') → shareCode
                                       ├── Share.create({...})
                                       ├── creditService.credit(1)        → +1 crédit
                                       └── scan.isShared = true
                                       │
                                       ▼
[Toast: +1 crédit] ◀── 201 ───── { ShareDto + shareUrl + totalCredits }
  │ invalidateQueries(["credits", "scans"])
```

---

## Test Postman

### Prérequis : Obtenir un Bearer Token

L'API utilise le guard `api` (access tokens via `DbAccessTokensProvider`).

**Option rapide via REPL :**
```bash
cd apps/web && node ace repl
```
```javascript
const User = (await import('#users/models/user')).default
const user = await User.findOrFail(1)
const token = await User.accessTokens.create(user)
console.log(token.value.release())  // Copier cette valeur
```

### Flux de test complet

Header commun : `Authorization: Bearer oat_XXXX...`

| # | Méthode | URL | Body | Résultat attendu |
|---|---------|-----|------|------------------|
| 1 | `GET` | `/api/credits` | - | `credits: 3` (solde initial) |
| 2 | `POST` | `/api/scans` | form-data: `image` = fichier | `201` + scan avec 3 emojis, `credits: 2` |
| 3 | `GET` | `/api/scans` | - | Liste avec le scan créé |
| 4 | `GET` | `/api/scans/1` | - | Détail du scan |
| 5 | `POST` | `/api/shares` | `{ "scanId": 1, "platform": "instagram" }` | `201` + shareUrl, `totalCredits: 3` |
| 6 | `GET` | `/api/credits` | - | `credits: 3` (2 restant + 1 bonus partage) |
| 7 | `GET` | `/api/credits/history` | - | 2 transactions (scan debit + bonus_share credit) |
| 8 | `GET` | `/api/shares/stats` | - | `{ totalShares: 1, totalClicks: 0 }` |

---

## Erreurs rencontrées et solutions

| Erreur | Cause | Solution |
|--------|-------|----------|
| `syntaxe en entrée invalide pour le type json` | Lucid envoie un objet JS brut à PostgreSQL | Ajouter `prepare: (v) => JSON.stringify(v)` et `consume` sur `@column()` |
| `import('')` vide dans routes.ts | Controller pas lié après création | Mettre le bon chemin : `import('#scans/controllers/api/scans_controller')` |
| `InsufficientCreditsError` dupliquée | Définie dans scan_service ET credit_service | Garder uniquement dans `credit_service.ts`, importer depuis là |
| `generateObject is deprecated` | AI SDK v6 a changé l'API | Utiliser `generateText` + `Output.object({ schema })` |
| Gemini quota exceeded (2.0-flash) | Limites gratuites atteintes | Passer à `gemini-2.5-flash` |
| Clé API Gemini "not found" | Clé Google Cloud au lieu d'AI Studio | Créer la clé sur `aistudio.google.com/apikey` |

---

## Prochaines étapes

### Backend

- [ ] Route publique `GET /s/:shareCode` - Page de partage (incrémente `clickCount`)
- [ ] Webhook RevenueCat `POST /api/webhooks/revenuecat` - Créditer les achats IAP
- [ ] `grantSignupBonus()` appelé lors de l'inscription (event listener)
- [ ] Tests Japa (unit + functional) pour les 3 modules

### Mobile (Tuyau + React Query)

- [ ] Auth flow (login/signup + expo-secure-store pour le token Bearer)
- [ ] Intercepteur Tuyau pour injecter le token dans chaque requête
- [ ] `useCredits()` hook - Solde + packs (query)
- [ ] `useScans()` hook - Historique paginé (query)
- [ ] `useScanMutation()` hook - Upload image (mutation + invalidate)
- [ ] `useShareMutation()` hook - Partager scan (mutation + invalidate)
- [ ] Écran Scanner (CameraView + useScanMutation)
- [ ] Écran Résultat (3 EmojiCards + useShareMutation)
- [ ] Écran Historique (FlatList + useScans)
- [ ] Écran Profil (useCredits + stats)
- [ ] Composants (EmojiCard, PointsBadge, ShareButton, ScanButton)
- [ ] RevenueCat SDK (achats crédits in-app)
- [ ] PostHog + Sentry (analytics + monitoring)
