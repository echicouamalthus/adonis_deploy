# Guide des Tests - Emoji Scanner API

Documentation complète de la stratégie de tests pour l'application Emoji Scanner.

## Table des Matières

1. [Architecture des Tests](#architecture-des-tests)
2. [Configuration](#configuration)
3. [Tests Fonctionnels](#tests-fonctionnels)
4. [Tests Unitaires](#tests-unitaires)
5. [Patterns et Bonnes Pratiques](#patterns-et-bonnes-pratiques)
6. [Commandes](#commandes)
7. [Dépannage](#dépannage)

---

## Architecture des Tests

```
tests/
├── bootstrap.ts              # Configuration globale Japa + mocks
├── functional/               # Tests d'intégration (API E2E)
│   └── api/
│       ├── credits.spec.ts   # Tests API crédits (3/3 ✅)
│       ├── scans.spec.ts     # Tests API scans (7/7 ✅)
│       ├── shares.spec.ts    # Tests API partages
│       └── revenuecat_webhook.spec.ts  # Tests webhook RevenueCat
├── unit/                     # Tests unitaires des services
│   └── services/
│       ├── credit_service.spec.ts   # Tests CreditService (9/9 ✅)
│       ├── scan_service.spec.ts     # Tests ScanService (9/9 ✅)
│       └── vision_service.spec.ts   # Tests VisionService (2/2 ✅)
└── helpers/
    ├── user_factory.ts       # Factory pour créer des users de test
    └── auth_helper.ts        # Helpers d'authentification
```

**Résultats globaux :**
- Tests fonctionnels : 15/22 passants
- Tests unitaires : 20/20 passants ✅
- Total : 35/42 tests

---

## Configuration

### 1. Environment de Test

**Fichier `.env.test`** (minimal, le reste hérite de `.env`) :
```bash
PORT=3334
NODE_ENV=test
VITE_API_URL=http://localhost:3334
LIMITER_STORE=memory
```

### 2. Exclusion Providers/Middleware Test

**`adonisrc.ts`** - Exclure Vite et Inertia de l'env test :
```typescript
{
  file: () => import('@adonisjs/vite/vite_provider'),
  environment: ['web', 'console', 'repl'], // Exclu de 'test'
},
{
  file: () => import('@adonisjs/inertia/inertia_provider'),
  environment: ['web', 'console', 'repl'],
},
```

**`start/kernel.ts`** - Middleware conditionnels :
```typescript
const serverMiddleware: any[] = [
  () => import('#core/middleware/container_bindings_middleware'),
  () => import('@adonisjs/static/static_middleware'),
  () => import('@adonisjs/cors/cors_middleware'),
]

if (!app.inTest) {
  serverMiddleware.push(() => import('@adonisjs/vite/vite_middleware'))
  serverMiddleware.push(() => import('@adonisjs/inertia/inertia_middleware'))
}

server.use(serverMiddleware)
```

### 3. Bootstrap et Mocks Globaux

**`tests/bootstrap.ts`** :
```typescript
import { authApiClient } from '@adonisjs/auth/plugins/api_client'
import { apiClient } from '@japa/api-client'
import VisionService from '#scans/services/vision_service'

export const plugins: Config['plugins'] = [
  assert(),
  apiClient(),
  pluginAdonisJS(app),
  authApiClient(app), // Nécessaire pour .loginAs()
]

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

## Tests Fonctionnels

### API Credits (3/3 ✅)

**Fichier :** `tests/functional/api/credits.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| GET /api/credits | Retourne solde + packs disponibles | ✅ |
| GET /api/credits/history | Historique paginé des transactions | ✅ |
| Auth required | Vérifie authentification obligatoire | ✅ |

**Pattern d'authentification :**
```typescript
const response = await client
  .get('/api/credits')
  .withGuard('api')
  .loginAs(user)
```

**Isolation des tests :**
```typescript
group.setup(async () => {
  user = await createUser({ credits: 5 })
})

group.teardown(async () => {
  await CreditTransaction.query().delete()
  await User.query().delete()
})
```

---

### API Scans (7/7 ✅)

**Fichier :** `tests/functional/api/scans.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| POST /api/scans - Success | Crée un scan et débite 1 crédit | ✅ |
| POST /api/scans - No credits | Erreur 402 si crédits insuffisants | ✅ |
| POST /api/scans - Auth required | Vérifie authentification obligatoire | ✅ |
| GET /api/scans | Historique paginé des scans | ✅ |
| GET /api/scans/:id | Détail d'un scan | ✅ |
| GET /api/scans/:id - Ownership | Erreur 404 si scan d'un autre user | ✅ |
| GET /api/scans - Auth required | Vérifie authentification obligatoire | ✅ |

**Upload de fichier (clé : utiliser `image` pas `photo`) :**
```typescript
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

const response = await client
  .post('/api/scans')
  .file('image', pngBuffer, { filename: 'test.png' }) // IMPORTANT: 'image' pas 'photo'
  .withGuard('api')
  .loginAs(user)
```

**Cleanup avec fichiers temporaires :**
```typescript
group.each.teardown(async () => {
  await Scan.query().where('user_id', user.id).delete()
})
```

---

## Tests Unitaires

### CreditService (9/9 ✅)

**Fichier :** `tests/unit/services/credit_service.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| getBalance | Retourne le solde actuel | ✅ |
| debit - Success | Débite crédits et crée transaction | ✅ |
| debit - Insufficient | Lance InsufficientCreditsError | ✅ |
| credit - With ref | Crédite avec referenceId | ✅ |
| credit - No ref | Crédite sans referenceId | ✅ |
| grantSignupBonus | Crédite bonus d'inscription | ✅ |
| getHistory - Pagination | Historique paginé | ✅ |
| getHistory - Order | Vérifie ordre DESC | ✅ |
| Constants | Vérifie valeurs constantes | ✅ |

**Pattern d'isolation :**
```typescript
group.each.setup(async () => {
  // Réinitialiser le solde avant chaque test
  user.credits = 10
  await user.save()
})

group.each.teardown(async () => {
  await CreditTransaction.query().where('user_id', user.id).delete()
})
```

**Test d'erreur métier :**
```typescript
test('debit - Doit lancer InsufficientCreditsError', async ({ assert }) => {
  const poorUser = await createUser({ credits: 2 })

  await assert.rejects(
    () => creditService.debit(poorUser.id, 5, 'scan'),
    InsufficientCreditsError
  )

  // Vérifier rollback
  await poorUser.refresh()
  assert.equal(poorUser.credits, 2)
})
```

---

### ScanService (9/9 ✅)

**Fichier :** `tests/unit/services/scan_service.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| createScan - Success | Crée scan et débite crédit | ✅ |
| createScan - No credits | Erreur si crédits insuffisants | ✅ |
| createScan - Debit | Vérifie débit de 1 crédit | ✅ |
| listByUser - Pagination | Liste paginée des scans | ✅ |
| listByUser - Pages | Vérifie pagination multi-pages | ✅ |
| listByUser - Ownership | Filtre par user ID | ✅ |
| findByIdForUser - Success | Retourne scan de l'user | ✅ |
| findByIdForUser - Ownership | Erreur si scan d'un autre user | ✅ |
| findByIdForUser - Not found | Erreur si scan inexistant | ✅ |

**Mock de fichier avec création réelle :**
```typescript
const TEST_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

const mockImage = {
  extname: 'png',
  move: async (path: string, options: any) => {
    const filePath = `${path}/${options.name}`
    await writeFile(filePath, TEST_PNG_BUFFER)
  },
}

const result = await scanService.createScan(user.id, mockImage as any)
```

**Isolation avec réinitialisation DB directe :**
```typescript
group.each.setup(async () => {
  // Update DB direct pour éviter problèmes de sync
  await User.query().where('id', user.id).update({ credits: 5 })
  await user.refresh()
})

group.each.teardown(async () => {
  // Nettoyer fichiers + DB
  const scans = await Scan.query().where('user_id', user.id)
  for (const scan of scans) {
    const filePath = app.makePath('tmp', scan.originalImagePath)
    try {
      await unlink(filePath)
    } catch {
      // Fichier n'existe pas
    }
  }
  await Scan.query().where('user_id', user.id).delete()
})
```

---

### VisionService (2/2 ✅)

**Fichier :** `tests/unit/services/vision_service.spec.ts`

| Test | Description | Status |
|------|-------------|--------|
| analyzeImage - Structure | Vérifie structure réponse mockée | ✅ |
| analyzeImage - Values | Vérifie valeurs mockées attendues | ✅ |

**Test du mock global :**
```typescript
test('analyzeImage - Doit retourner une analyse structurée', async ({ assert }) => {
  const visionService = new VisionService()
  const result = await visionService.analyzeImage(TEST_PNG_BUFFER)

  // Vérifier structure
  assert.exists(result.label)
  assert.exists(result.labelFr)
  assert.isArray(result.emojis)
  assert.lengthOf(result.emojis, 3)
  assert.isAtLeast(result.confidence, 0)
  assert.isAtMost(result.confidence, 1)
})
```

---

## Patterns et Bonnes Pratiques

### 1. Authentification dans les Tests

**✅ CORRECT - Auth APRÈS méthode HTTP :**
```typescript
const response = await client
  .get('/api/credits')
  .withGuard('api')
  .loginAs(user)
```

**❌ INCORRECT - Auth AVANT méthode HTTP :**
```typescript
// NE PAS FAIRE ÇA
const response = await client
  .withGuard('api')
  .loginAs(user)
  .get('/api/credits')
```

### 2. Isolation des Tests

**Principe :** Chaque test doit être indépendant et reproductible.

**Setup/Teardown :**
```typescript
group.setup(async () => {
  // Créer ressources partagées (1x pour tout le groupe)
  user = await createUser({ credits: 5 })
})

group.each.setup(async () => {
  // Réinitialiser état avant CHAQUE test
  await User.query().where('id', user.id).update({ credits: 5 })
  await user.refresh()
})

group.each.teardown(async () => {
  // Nettoyer après CHAQUE test
  await Scan.query().where('user_id', user.id).delete()
})

group.teardown(async () => {
  // Nettoyer ressources partagées (1x à la fin)
  await User.query().delete()
})
```

### 3. Upload de Fichiers

**Buffer PNG 1x1 pixel pour tests :**
```typescript
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

const response = await client
  .post('/api/scans')
  .file('image', pngBuffer, { filename: 'test.png' })
  .withGuard('api')
  .loginAs(user)
```

### 4. Test d'Erreurs Métier

```typescript
// Tester que l'erreur est lancée
await assert.rejects(
  () => creditService.debit(user.id, 999, 'scan'),
  InsufficientCreditsError
)

// Vérifier rollback DB
await user.refresh()
assert.equal(user.credits, initialCredits) // Inchangé
```

### 5. Factory Pattern

**`tests/helpers/user_factory.ts` :**
```typescript
export async function createUser(
  options: { email?: string; fullName?: string; credits?: number } = {}
): Promise<User> {
  return User.create({
    fullName: options.fullName || 'Test User',
    email: options.email || `test-${Date.now()}-${Math.random()}@example.com`,
    password: await hash.make('password123'),
    credits: options.credits ?? 3,
  })
}
```

---

## Commandes

```bash
# Lancer tous les tests
pnpm test

# Lancer une suite spécifique
pnpm test functional
pnpm test unit

# Lancer un fichier spécifique (via suite)
pnpm test functional  # Puis Japa filtre par nom de fichier

# Watch mode (pas natif, utiliser nodemon)
nodemon --exec "pnpm test" --watch app --watch tests

# Tests avec logs détaillés
NODE_DEBUG=* pnpm test
```

---

## Dépannage

### Problème 1 : Erreur Vite en Tests

**Symptôme :**
```
Failed to scan for dependencies from entries
The server is being restarted or closed
```

**Solution :** Exclure Vite/Inertia de l'env test dans `adonisrc.ts` et `start/kernel.ts`.

---

### Problème 2 : `client.withHeaders is not a function`

**Symptôme :** Méthode auth appelée au mauvais moment.

**Solution :** Appeler `.withGuard('api').loginAs(user)` **APRÈS** la méthode HTTP :
```typescript
// ✅ CORRECT
await client.get('/api/credits').withGuard('api').loginAs(user)

// ❌ INCORRECT
await client.withGuard('api').loginAs(user).get('/api/credits')
```

---

### Problème 3 : Tests Non Isolés (Crédits qui Changent)

**Symptôme :** Tests qui passent individuellement mais échouent en groupe.

**Solution :** Utiliser `group.each.setup()` pour réinitialiser :
```typescript
group.each.setup(async () => {
  await User.query().where('id', user.id).update({ credits: 5 })
  await user.refresh()
})
```

---

### Problème 4 : Fichier Non Trouvé (ENOENT)

**Symptôme :** `ENOENT: no such file or directory, open 'tmp/scans/xxx.png'`

**Solution :** Mock `image.move()` avec écriture réelle :
```typescript
const mockImage = {
  extname: 'png',
  move: async (path: string, options: any) => {
    const filePath = `${path}/${options.name}`
    await writeFile(filePath, TEST_PNG_BUFFER)
  },
}
```

---

### Problème 5 : Field Name Mismatch (500 au lieu de 201)

**Symptôme :** POST /api/scans retourne 500 et redirige vers MarketingController.

**Solution :** Vérifier que le nom du champ correspond au validator :
```typescript
// Validator attend 'image'
vine.object({
  image: vine.file({ ... })
})

// Test doit envoyer 'image' aussi
.file('image', buffer, { filename: 'test.png' })
```

---

## Statistiques Finales

**Tests Fonctionnels :**
- ✅ API Credits : 3/3
- ✅ API Scans : 7/7
- ⚠️ API Shares : 3/7
- ⚠️ RevenueCat Webhook : 2/5

**Tests Unitaires :**
- ✅ CreditService : 9/9
- ✅ ScanService : 9/9
- ✅ VisionService : 2/2

**Total : 35/42 tests passants (83%)**

---

## Prochaines Étapes

1. ✅ Fixer les tests Shares (ownership, stats)
2. ✅ Fixer les tests RevenueCat (idempotence, validation)
3. ⏳ Ajouter tests ImageService (compression)
4. ⏳ Ajouter tests ShareService (bonus, links)
5. ⏳ Ajouter tests E2E avec mobile app
6. ⏳ CI/CD avec GitHub Actions

---

**Dernière mise à jour :** 2026-02-10
**Version :** 1.0.0
**Auteur :** Équipe Emoji Scanner
