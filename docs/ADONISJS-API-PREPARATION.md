# Processus de Création d'une API/Fonctionnalité AdonisJS

Ce guide détaille les étapes pour construire une API ou fonctionnalité AdonisJS professionnelle et production-ready dans ce monorepo.

> **Règle d'or** : Une API réussie se joue à 70% dans la conception AVANT le code.

---

## Table des matières

1. [Clarification de la fonctionnalité](#1-clarification-de-la-fonctionnalité)
2. [Architecture du module](#2-architecture-du-module)
3. [Modélisation des données](#3-modélisation-des-données)
4. [Validation et DTOs](#4-validation-et-dtos)
5. [Logique métier (Services)](#5-logique-métier-services)
6. [Contrôleurs et routes](#6-contrôleurs-et-routes)
7. [Authentification et autorisation](#7-authentification-et-autorisation)
8. [Tests](#8-tests)
9. [Documentation API](#9-documentation-api)
10. [Checklist finale](#10-checklist-finale)

---

## 1. Clarification de la fonctionnalité

**Objectif** : Savoir exactement ce que vous construisez avant d'ouvrir l'IDE.

### A. Questions essentielles

| Question | Exemple Module Bakery |
|----------|-----------------------|
| Objectif du module | Gestion des produits et commandes boulangerie |
| Utilisateurs cibles | Clients B2B (restaurants, hôtels) |
| Type d'API | REST (consommée par app mobile) |
| Authentification requise | Oui (token API) |
| Autorisation | Rôles (admin, client) |
| Relations avec modules existants | Users (clients), Auth (tokens) |

### B. Endpoints à créer (MVP)

Lister les endpoints par priorité :

```
P0 (Must have)
├── GET    /api/products          → Liste des produits
├── GET    /api/products/:id      → Détail produit
├── POST   /api/orders            → Créer commande
├── GET    /api/orders            → Mes commandes
└── GET    /api/orders/:id        → Détail commande

P1 (Should have)
├── POST   /api/products          → Créer produit (admin)
├── PUT    /api/products/:id      → Modifier produit (admin)
├── DELETE /api/products/:id      → Supprimer produit (admin)
└── PUT    /api/orders/:id/status → Changer statut commande

P2 (Nice to have)
├── GET    /api/products/search   → Recherche produits
├── POST   /api/orders/:id/reorder → Recommander
└── GET    /api/stats/orders      → Statistiques (admin)
```

### C. Livrable

Créer un fichier `docs/API-SPEC-[MODULE].md` :

```markdown
# Spécifications API - [Nom Module]

## Vision
[Une phrase décrivant l'objectif]

## Endpoints MVP
| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | /api/products | Liste produits | Oui |

## Modèles de données
- Product: { id, name, price, category }
- Order: { id, items, deliveryDate, status }

## Règles métier
- Quantité minimum par produit
- Délai de livraison 24h minimum
```

---

## 2. Architecture du module

**Objectif** : Organiser le code de manière cohérente avec le reste du monorepo.

### A. Structure standard d'un module

```
apps/web/app/[module]/
├── controllers/           # Contrôleurs HTTP
│   ├── products_controller.ts
│   └── orders_controller.ts
├── database/
│   ├── migrations/        # Migrations SQL
│   │   ├── 001_create_products_table.ts
│   │   └── 002_create_orders_table.ts
│   ├── factories/         # Factories pour tests
│   │   └── product_factory.ts
│   └── seeders/           # Données initiales
│       └── product_seeder.ts
├── dtos/                  # Data Transfer Objects
│   ├── product_dto.ts
│   └── order_dto.ts
├── enums/                 # Énumérations
│   ├── category.ts
│   └── order_status.ts
├── mails/                 # Notifications email
│   └── order_confirmation.ts
├── middleware/            # Middleware spécifique
│   └── verify_order_owner.ts
├── models/                # Modèles Lucid ORM
│   ├── product.ts
│   ├── order.ts
│   └── order_item.ts
├── policies/              # Règles d'autorisation
│   ├── product_policy.ts
│   └── order_policy.ts
├── resources/
│   └── lang/              # Traductions i18n
│       ├── en/
│       │   └── messages.json
│       └── fr/
│           └── messages.json
├── services/              # Logique métier
│   ├── product_service.ts
│   └── order_service.ts
├── start/
│   └── events.ts          # Événements du module
├── types/                 # Types TypeScript
│   ├── index.ts
│   └── events.ts
├── validators.ts          # Validation VineJS
└── routes.ts              # Routes du module
```

### B. Conventions de nommage

| Élément | Convention | Exemple |
|---------|------------|---------|
| Module (dossier) | snake_case singulier | `bakery`, `user_management` |
| Contrôleur | PascalCase + Controller | `ProductsController` |
| Modèle | PascalCase singulier | `Product`, `OrderItem` |
| Service | PascalCase + Service | `ProductService` |
| DTO | PascalCase + Dto | `ProductDto` |
| Policy | PascalCase + Policy | `ProductPolicy` |
| Migration | timestamp_description | `1737139066_create_products_table` |
| Route | kebab-case pluriel | `/api/products`, `/api/order-items` |

### C. Enregistrement du module

#### 1. Ajouter l'alias dans `package.json`

```json
{
  "imports": {
    "#bakery/*": "./app/bakery/*.js",
    "#auth/*": "./app/auth/*.js",
    "#users/*": "./app/users/*.js"
  }
}
```

#### 2. Ajouter l'alias TypeScript dans `tsconfig.json`

```json
{
  "compilerOptions": {
    "paths": {
      "#bakery/*": ["./app/bakery/*.js"]
    }
  }
}
```

#### 3. Enregistrer les routes dans `adonisrc.ts`

```typescript
{
  preloads: [
    () => import('#auth/routes'),
    () => import('#users/routes'),
    () => import('#bakery/routes'),  // Nouveau module
  ]
}
```

#### 4. Enregistrer les migrations dans `adonisrc.ts`

```typescript
{
  directories: {
    migrations: [
      'app/users/database/migrations',
      'app/bakery/database/migrations',  // Nouveau module
    ],
    seeders: [
      'app/users/database/seeders',
      'app/bakery/database/seeders',  // Nouveau module
    ]
  }
}
```

---

## 3. Modélisation des données

**Objectif** : Définir les tables et relations avant d'écrire le code.

### A. Schéma visuel des relations

Dessiner un schéma (dbdiagram.io, papier, Mermaid) :

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │       │   orders    │       │  products   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │◄──┐   │ id (PK)     │   ┌──►│ id (PK)     │
│ email       │   │   │ user_id (FK)│───┘   │ name        │
│ role_id     │   │   │ delivery_date│      │ price       │
│ ...         │   │   │ status      │       │ category    │
└─────────────┘   │   │ total       │       │ min_qty     │
                  │   │ created_at  │       │ available   │
                  │   └──────┬──────┘       └─────────────┘
                  │          │                     ▲
                  │          │                     │
                  │   ┌──────▼──────┐              │
                  │   │ order_items │              │
                  │   ├─────────────┤              │
                  │   │ id (PK)     │              │
                  │   │ order_id(FK)│              │
                  │   │ product_id  │──────────────┘
                  │   │ quantity    │
                  │   │ unit_price  │
                  │   └─────────────┘
                  │
                  └─── belongsTo
```

### B. Créer les migrations

```bash
# Générer une migration
node ace make:migration create_products_table --path=app/bakery/database/migrations
```

```typescript
// app/bakery/database/migrations/XXXX_create_products_table.ts
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'products'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      // Clé primaire
      table.increments('id').notNullable()

      // Champs métier
      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.decimal('price', 10, 2).notNullable()
      table.enum('category', ['boulangerie', 'viennoiserie', 'burger']).notNullable()
      table.integer('min_quantity').unsigned().defaultTo(1)
      table.string('image_url', 500).nullable()
      table.boolean('available').defaultTo(true)

      // Timestamps
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Index pour les recherches fréquentes
      table.index(['category', 'available'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

### C. Créer les modèles

```typescript
// app/bakery/models/product.ts
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import BaseModel from '#common/models/base_model'
import OrderItem from '#bakery/models/order_item'

export default class Product extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare price: number

  @column()
  declare category: 'boulangerie' | 'viennoiserie' | 'burger'

  @column()
  declare minQuantity: number

  @column()
  declare imageUrl: string | null

  @column()
  declare available: boolean

  // Relations
  @hasMany(() => OrderItem)
  declare orderItems: HasMany<typeof OrderItem>

  // Scopes (requêtes réutilisables)
  static available() {
    return this.query().where('available', true)
  }

  static byCategory(category: string) {
    return this.query().where('category', category)
  }
}
```

### D. Créer les enums

```typescript
// app/bakery/enums/category.ts
export enum ProductCategory {
  BOULANGERIE = 'boulangerie',
  VIENNOISERIE = 'viennoiserie',
  BURGER = 'burger',
}

// app/bakery/enums/order_status.ts
export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  PREPARING = 'preparing',
  READY = 'ready',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}
```

### E. Checklist modélisation

- [ ] Schéma des relations dessiné
- [ ] Types de colonnes appropriés (decimal pour prix, enum pour statuts)
- [ ] Clés étrangères avec contraintes
- [ ] Index sur les colonnes de recherche fréquente
- [ ] Timestamps (created_at, updated_at)
- [ ] Valeurs par défaut définies
- [ ] Soft delete si nécessaire (deleted_at)

---

## 4. Validation et DTOs

**Objectif** : Valider les entrées et formater les sorties de manière cohérente.

### A. Créer les validators (VineJS)

```typescript
// app/bakery/validators.ts
import vine from '@vinejs/vine'
import { ProductCategory } from '#bakery/enums/category'

/**
 * Validator pour créer un produit
 */
export const createProductValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255),
    description: vine.string().trim().maxLength(2000).optional(),
    price: vine.number().positive().decimal(2),
    category: vine.enum(Object.values(ProductCategory)),
    minQuantity: vine.number().positive().optional(),
    imageUrl: vine.string().url().maxLength(500).optional(),
  })
)

/**
 * Validator pour modifier un produit
 */
export const updateProductValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).maxLength(255).optional(),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    price: vine.number().positive().decimal(2).optional(),
    category: vine.enum(Object.values(ProductCategory)).optional(),
    minQuantity: vine.number().positive().optional(),
    imageUrl: vine.string().url().maxLength(500).nullable().optional(),
    available: vine.boolean().optional(),
  })
)

/**
 * Validator pour créer une commande
 */
export const createOrderValidator = vine.compile(
  vine.object({
    items: vine
      .array(
        vine.object({
          productId: vine.number().positive(),
          quantity: vine.number().positive().min(1),
        })
      )
      .minLength(1)
      .maxLength(50),
    deliveryDate: vine.string().regex(/^\d{4}-\d{2}-\d{2}$/), // Format YYYY-MM-DD
    notes: vine.string().trim().maxLength(500).optional(),
  })
)

/**
 * Validator pour filtrer les produits
 */
export const listProductsValidator = vine.compile(
  vine.object({
    category: vine.enum(Object.values(ProductCategory)).optional(),
    available: vine.boolean().optional(),
    search: vine.string().trim().maxLength(100).optional(),
    page: vine.number().positive().optional(),
    limit: vine.number().positive().max(100).optional(),
  })
)
```

### B. Règles de validation personnalisées

```typescript
// app/bakery/validators.ts (suite)
import db from '@adonisjs/lucid/services/db'

/**
 * Règle personnalisée : vérifier que le produit existe
 */
const productExists = vine.createRule(async (value, _, field) => {
  const product = await db.from('products').where('id', value).first()
  if (!product) {
    field.report('Le produit {{ field }} n\'existe pas', 'productExists', field)
  }
})

/**
 * Règle personnalisée : vérifier la date de livraison (minimum 24h)
 */
const minDeliveryDate = vine.createRule((value, _, field) => {
  const deliveryDate = new Date(value as string)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(0, 0, 0, 0)

  if (deliveryDate < tomorrow) {
    field.report(
      'La date de livraison doit être au minimum demain',
      'minDeliveryDate',
      field
    )
  }
})

// Utilisation dans le validator
export const createOrderValidator = vine.compile(
  vine.object({
    items: vine.array(
      vine.object({
        productId: vine.number().positive().use(productExists()),
        quantity: vine.number().positive(),
      })
    ),
    deliveryDate: vine.string().use(minDeliveryDate()),
  })
)
```

### C. Créer les DTOs

```typescript
// app/bakery/dtos/product_dto.ts
import Product from '#bakery/models/product'

export default class ProductDto {
  declare id: number
  declare name: string
  declare description: string | null
  declare price: number
  declare category: string
  declare minQuantity: number
  declare imageUrl: string | null
  declare available: boolean

  constructor(product?: Product) {
    if (!product) return

    this.id = product.id
    this.name = product.name
    this.description = product.description
    this.price = product.price
    this.category = product.category
    this.minQuantity = product.minQuantity
    this.imageUrl = product.imageUrl
    this.available = product.available
  }

  /**
   * Version simplifiée pour les listes
   */
  static lite(product: Product) {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      category: product.category,
      imageUrl: product.imageUrl,
    }
  }
}
```

```typescript
// app/bakery/dtos/order_dto.ts
import Order from '#bakery/models/order'
import { OrderStatus } from '#bakery/enums/order_status'

export default class OrderDto {
  declare id: number
  declare deliveryDate: string
  declare status: OrderStatus
  declare total: number
  declare notes: string | null
  declare items: OrderItemDto[]
  declare createdAt: string

  constructor(order?: Order) {
    if (!order) return

    this.id = order.id
    this.deliveryDate = order.deliveryDate.toISODate()!
    this.status = order.status
    this.total = order.total
    this.notes = order.notes
    this.createdAt = order.createdAt.toISO()!

    if (order.items) {
      this.items = order.items.map((item) => new OrderItemDto(item))
    }
  }
}

class OrderItemDto {
  declare productId: number
  declare productName: string
  declare quantity: number
  declare unitPrice: number
  declare subtotal: number

  constructor(item: any) {
    this.productId = item.productId
    this.productName = item.product?.name ?? item.productName
    this.quantity = item.quantity
    this.unitPrice = item.unitPrice
    this.subtotal = item.quantity * item.unitPrice
  }
}
```

### D. Format de réponse API standard

```typescript
// Succès avec données
response.ok({
  data: new ProductDto(product),
})

// Succès avec liste paginée
response.ok({
  data: products.map((p) => ProductDto.lite(p)),
  meta: {
    total: products.total,
    page: products.currentPage,
    lastPage: products.lastPage,
    perPage: products.perPage,
  },
})

// Création réussie
response.created({
  data: new OrderDto(order),
  message: 'Commande créée avec succès',
})

// Erreur de validation (automatique via VineJS)
{
  "errors": [
    {
      "field": "email",
      "message": "Le champ email est requis",
      "rule": "required"
    }
  ]
}

// Erreur métier
response.unprocessableEntity({
  error: {
    code: 'INSUFFICIENT_STOCK',
    message: 'Stock insuffisant pour le produit Pain de campagne',
  },
})
```

---

## 5. Logique métier (Services)

**Objectif** : Isoler la logique métier des contrôleurs pour la réutilisabilité et la testabilité.

### A. Structure d'un service

```typescript
// app/bakery/services/product_service.ts
import Product from '#bakery/models/product'
import { ProductCategory } from '#bakery/enums/category'

interface ListProductsOptions {
  category?: ProductCategory
  available?: boolean
  search?: string
  page?: number
  limit?: number
}

interface CreateProductData {
  name: string
  description?: string | null
  price: number
  category: ProductCategory
  minQuantity?: number
  imageUrl?: string | null
}

export default class ProductService {
  /**
   * Liste les produits avec filtres et pagination
   */
  async list(options: ListProductsOptions = {}) {
    const { category, available = true, search, page = 1, limit = 20 } = options

    const query = Product.query().orderBy('name', 'asc')

    // Filtres
    if (available !== undefined) {
      query.where('available', available)
    }
    if (category) {
      query.where('category', category)
    }
    if (search) {
      query.where((builder) => {
        builder
          .whereILike('name', `%${search}%`)
          .orWhereILike('description', `%${search}%`)
      })
    }

    return query.paginate(page, limit)
  }

  /**
   * Récupère un produit par ID
   */
  async findById(id: number) {
    return Product.findOrFail(id)
  }

  /**
   * Crée un nouveau produit
   */
  async create(data: CreateProductData) {
    return Product.create({
      name: data.name,
      description: data.description ?? null,
      price: data.price,
      category: data.category,
      minQuantity: data.minQuantity ?? 1,
      imageUrl: data.imageUrl ?? null,
      available: true,
    })
  }

  /**
   * Met à jour un produit
   */
  async update(id: number, data: Partial<CreateProductData>) {
    const product = await Product.findOrFail(id)
    product.merge(data)
    await product.save()
    return product
  }

  /**
   * Supprime un produit (soft delete recommandé)
   */
  async delete(id: number) {
    const product = await Product.findOrFail(id)
    // Option 1: Soft delete (recommandé)
    product.available = false
    await product.save()
    // Option 2: Hard delete
    // await product.delete()
  }

  /**
   * Vérifie si les produits sont disponibles et retourne les prix
   */
  async validateOrderItems(items: { productId: number; quantity: number }[]) {
    const productIds = items.map((item) => item.productId)
    const products = await Product.query()
      .whereIn('id', productIds)
      .where('available', true)

    const productMap = new Map(products.map((p) => [p.id, p]))
    const errors: string[] = []
    let total = 0

    const validatedItems = items.map((item) => {
      const product = productMap.get(item.productId)

      if (!product) {
        errors.push(`Produit #${item.productId} non disponible`)
        return null
      }

      if (item.quantity < product.minQuantity) {
        errors.push(
          `${product.name}: quantité minimum ${product.minQuantity}`
        )
        return null
      }

      const subtotal = product.price * item.quantity
      total += subtotal

      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        subtotal,
      }
    })

    return {
      valid: errors.length === 0,
      errors,
      items: validatedItems.filter(Boolean),
      total,
    }
  }
}
```

### B. Service avec transactions

```typescript
// app/bakery/services/order_service.ts
import db from '@adonisjs/lucid/services/db'
import Order from '#bakery/models/order'
import OrderItem from '#bakery/models/order_item'
import ProductService from '#bakery/services/product_service'
import { OrderStatus } from '#bakery/enums/order_status'
import { DateTime } from 'luxon'

interface CreateOrderData {
  userId: number
  items: { productId: number; quantity: number }[]
  deliveryDate: string
  notes?: string
}

export default class OrderService {
  private productService = new ProductService()

  /**
   * Crée une commande avec transaction
   */
  async create(data: CreateOrderData) {
    // Valider les produits
    const validation = await this.productService.validateOrderItems(data.items)

    if (!validation.valid) {
      throw new Error(validation.errors.join(', '))
    }

    // Transaction pour garantir l'intégrité
    const order = await db.transaction(async (trx) => {
      // Créer la commande
      const newOrder = await Order.create(
        {
          userId: data.userId,
          deliveryDate: DateTime.fromISO(data.deliveryDate),
          status: OrderStatus.PENDING,
          total: validation.total,
          notes: data.notes ?? null,
        },
        { client: trx }
      )

      // Créer les items
      await OrderItem.createMany(
        validation.items.map((item) => ({
          orderId: newOrder.id,
          productId: item!.productId,
          productName: item!.productName,
          quantity: item!.quantity,
          unitPrice: item!.unitPrice,
        })),
        { client: trx }
      )

      return newOrder
    })

    // Charger les relations pour la réponse
    await order.load('items')
    return order
  }

  /**
   * Liste les commandes d'un utilisateur
   */
  async listByUser(userId: number, page = 1, limit = 20) {
    return Order.query()
      .where('userId', userId)
      .preload('items')
      .orderBy('createdAt', 'desc')
      .paginate(page, limit)
  }

  /**
   * Récupère une commande avec vérification du propriétaire
   */
  async findByIdForUser(orderId: number, userId: number) {
    return Order.query()
      .where('id', orderId)
      .where('userId', userId)
      .preload('items')
      .firstOrFail()
  }

  /**
   * Met à jour le statut d'une commande
   */
  async updateStatus(orderId: number, status: OrderStatus) {
    const order = await Order.findOrFail(orderId)

    // Validation des transitions de statut
    const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
      [OrderStatus.CONFIRMED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
      [OrderStatus.PREPARING]: [OrderStatus.READY],
      [OrderStatus.READY]: [OrderStatus.DELIVERED],
      [OrderStatus.DELIVERED]: [],
      [OrderStatus.CANCELLED]: [],
    }

    if (!allowedTransitions[order.status].includes(status)) {
      throw new Error(
        `Transition de ${order.status} vers ${status} non autorisée`
      )
    }

    order.status = status
    await order.save()
    return order
  }

  /**
   * Recommander une commande précédente
   */
  async reorder(orderId: number, userId: number, deliveryDate: string) {
    const originalOrder = await this.findByIdForUser(orderId, userId)

    const items = originalOrder.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }))

    return this.create({
      userId,
      items,
      deliveryDate,
    })
  }
}
```

### C. Bonnes pratiques services

| Principe | Application |
|----------|-------------|
| Single Responsibility | Un service = un domaine (Product, Order) |
| Dependency Injection | Injecter les dépendances via constructeur |
| Transaction | Utiliser `db.transaction()` pour les opérations multiples |
| Validation métier | Valider dans le service, pas le contrôleur |
| Réutilisabilité | Méthodes granulaires appelables depuis plusieurs contrôleurs |

---

## 6. Contrôleurs et routes

**Objectif** : Exposer les fonctionnalités via une API REST propre.

### A. Structure d'un contrôleur

```typescript
// app/bakery/controllers/products_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import ProductService from '#bakery/services/product_service'
import ProductDto from '#bakery/dtos/product_dto'
import {
  createProductValidator,
  updateProductValidator,
  listProductsValidator,
} from '#bakery/validators'
import ProductPolicy from '#bakery/policies/product_policy'

export default class ProductsController {
  private productService = new ProductService()

  /**
   * GET /api/products
   * Liste les produits avec filtres
   */
  async index({ request, response }: HttpContext) {
    const filters = await request.validateUsing(listProductsValidator)
    const products = await this.productService.list(filters)

    return response.ok({
      data: products.all().map((p) => ProductDto.lite(p)),
      meta: {
        total: products.total,
        page: products.currentPage,
        lastPage: products.lastPage,
        perPage: products.perPage,
      },
    })
  }

  /**
   * GET /api/products/:id
   * Détail d'un produit
   */
  async show({ params, response }: HttpContext) {
    const product = await this.productService.findById(params.id)

    return response.ok({
      data: new ProductDto(product),
    })
  }

  /**
   * POST /api/products
   * Créer un produit (admin uniquement)
   */
  async store({ bouncer, request, response }: HttpContext) {
    await bouncer.with(ProductPolicy).authorize('create')

    const data = await request.validateUsing(createProductValidator)
    const product = await this.productService.create(data)

    return response.created({
      data: new ProductDto(product),
      message: 'Produit créé avec succès',
    })
  }

  /**
   * PUT /api/products/:id
   * Modifier un produit (admin uniquement)
   */
  async update({ bouncer, params, request, response }: HttpContext) {
    await bouncer.with(ProductPolicy).authorize('update')

    const data = await request.validateUsing(updateProductValidator)
    const product = await this.productService.update(params.id, data)

    return response.ok({
      data: new ProductDto(product),
      message: 'Produit mis à jour',
    })
  }

  /**
   * DELETE /api/products/:id
   * Supprimer un produit (admin uniquement)
   */
  async destroy({ bouncer, params, response }: HttpContext) {
    await bouncer.with(ProductPolicy).authorize('delete')

    await this.productService.delete(params.id)

    return response.ok({
      message: 'Produit supprimé',
    })
  }
}
```

### B. Définir les routes

```typescript
// app/bakery/routes.ts
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Lazy-loading des contrôleurs
const ProductsController = () => import('#bakery/controllers/products_controller')
const OrdersController = () => import('#bakery/controllers/orders_controller')

/**
 * Routes API Bakery
 * Préfixe: /api
 * Auth: Token API (guard 'api')
 */
router
  .group(() => {
    // ============================================
    // PRODUITS
    // ============================================

    // Routes publiques (lecture seule, mais auth requise)
    router.get('/products', [ProductsController, 'index']).as('api.products.index')
    router.get('/products/:id', [ProductsController, 'show']).as('api.products.show')

    // Routes admin
    router.post('/products', [ProductsController, 'store']).as('api.products.store')
    router
      .put('/products/:id', [ProductsController, 'update'])
      .as('api.products.update')
    router
      .delete('/products/:id', [ProductsController, 'destroy'])
      .as('api.products.destroy')

    // ============================================
    // COMMANDES
    // ============================================

    router.get('/orders', [OrdersController, 'index']).as('api.orders.index')
    router.get('/orders/:id', [OrdersController, 'show']).as('api.orders.show')
    router.post('/orders', [OrdersController, 'store']).as('api.orders.store')
    router
      .post('/orders/:id/reorder', [OrdersController, 'reorder'])
      .as('api.orders.reorder')

    // Routes admin
    router
      .patch('/orders/:id/status', [OrdersController, 'updateStatus'])
      .as('api.orders.updateStatus')
  })
  .prefix('/api')
  .use(middleware.auth({ guards: ['api'] }))
```

### C. Conventions REST

| Action | Méthode HTTP | Route | Contrôleur |
|--------|--------------|-------|------------|
| Lister | GET | /api/resources | index |
| Créer | POST | /api/resources | store |
| Voir | GET | /api/resources/:id | show |
| Modifier | PUT/PATCH | /api/resources/:id | update |
| Supprimer | DELETE | /api/resources/:id | destroy |
| Action custom | POST | /api/resources/:id/action | actionName |

### D. Vérifier les routes

```bash
# Lister toutes les routes
node ace list:routes

# Filtrer par préfixe
node ace list:routes --filter=/api
```

---

## 7. Authentification et autorisation

**Objectif** : Sécuriser les endpoints et gérer les permissions.

### A. Guards disponibles

| Guard | Usage | Token |
|-------|-------|-------|
| `web` | Interface web (Inertia) | Session cookie |
| `api` | API REST (mobile, externe) | Bearer token |

```typescript
// Utilisation dans les routes
.use(middleware.auth())                    // Guard par défaut (web)
.use(middleware.auth({ guards: ['api'] })) // Guard API
```

### B. Créer une policy

```typescript
// app/bakery/policies/product_policy.ts
import User from '#users/models/user'
import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class ProductPolicy extends BasePolicy {
  /**
   * Tout utilisateur authentifié peut voir les produits
   */
  viewList(_user: User): AuthorizerResponse {
    return true
  }

  view(_user: User): AuthorizerResponse {
    return true
  }

  /**
   * Seuls les admins peuvent créer/modifier/supprimer
   */
  create(user: User): AuthorizerResponse {
    return user.isAdmin
  }

  update(user: User): AuthorizerResponse {
    return user.isAdmin
  }

  delete(user: User): AuthorizerResponse {
    return user.isAdmin
  }
}
```

```typescript
// app/bakery/policies/order_policy.ts
import User from '#users/models/user'
import Order from '#bakery/models/order'
import { BasePolicy } from '@adonisjs/bouncer'
import { AuthorizerResponse } from '@adonisjs/bouncer/types'

export default class OrderPolicy extends BasePolicy {
  /**
   * Un utilisateur ne peut voir que ses propres commandes
   * Les admins peuvent tout voir
   */
  view(user: User, order: Order): AuthorizerResponse {
    return user.isAdmin || user.id === order.userId
  }

  /**
   * Seul le propriétaire peut recommander
   */
  reorder(user: User, order: Order): AuthorizerResponse {
    return user.id === order.userId
  }

  /**
   * Seuls les admins peuvent changer le statut
   */
  updateStatus(user: User): AuthorizerResponse {
    return user.isAdmin
  }
}
```

### C. Utilisation dans les contrôleurs

```typescript
// Autorisation simple (basée sur le rôle)
await bouncer.with(ProductPolicy).authorize('create')

// Autorisation avec ressource
const order = await Order.findOrFail(params.id)
await bouncer.with(OrderPolicy).authorize('view', order)

// Vérification sans exception
if (await bouncer.with(ProductPolicy).allows('delete')) {
  // L'utilisateur peut supprimer
}
```

### D. Middleware personnalisé

```typescript
// app/bakery/middleware/verify_order_owner.ts
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import Order from '#bakery/models/order'

export default class VerifyOrderOwner {
  async handle({ auth, params, response }: HttpContext, next: NextFn) {
    const user = auth.user!
    const order = await Order.find(params.id)

    if (!order) {
      return response.notFound({ error: 'Commande non trouvée' })
    }

    if (!user.isAdmin && order.userId !== user.id) {
      return response.forbidden({ error: 'Accès non autorisé' })
    }

    return next()
  }
}
```

---

## 8. Tests

**Objectif** : Garantir le bon fonctionnement et prévenir les régressions.

### A. Structure des tests

```
apps/web/tests/
├── unit/
│   └── bakery/
│       ├── product_service.spec.ts
│       └── order_service.spec.ts
└── functional/
    └── bakery/
        ├── products.spec.ts
        └── orders.spec.ts
```

### B. Test fonctionnel (API)

```typescript
// tests/functional/bakery/products.spec.ts
import { test } from '@japa/runner'
import { UserFactory } from '#users/database/factories/user'
import Product from '#bakery/models/product'

test.group('Products API', (group) => {
  group.each.setup(async () => {
    // Reset la base de données avant chaque test
    await Product.query().delete()
  })

  test('liste les produits disponibles', async ({ client }) => {
    // Arrange
    const user = await UserFactory.create()
    await Product.createMany([
      { name: 'Pain', price: 2.5, category: 'boulangerie', available: true },
      { name: 'Croissant', price: 1.8, category: 'viennoiserie', available: true },
      { name: 'Ancien', price: 1.0, category: 'boulangerie', available: false },
    ])

    // Act
    const response = await client
      .get('/api/products')
      .loginAs(user, 'api')

    // Assert
    response.assertStatus(200)
    response.assertBodyContains({
      data: [
        { name: 'Croissant' },
        { name: 'Pain' },
      ],
    })
    // Le produit non disponible ne doit pas apparaître
    response.assertBodyNotContains({ name: 'Ancien' })
  })

  test('filtre par catégorie', async ({ client }) => {
    const user = await UserFactory.create()
    await Product.createMany([
      { name: 'Pain', price: 2.5, category: 'boulangerie', available: true },
      { name: 'Croissant', price: 1.8, category: 'viennoiserie', available: true },
    ])

    const response = await client
      .get('/api/products')
      .qs({ category: 'boulangerie' })
      .loginAs(user, 'api')

    response.assertStatus(200)
    response.assertBodyContains({ meta: { total: 1 } })
  })

  test('refuse la création sans auth admin', async ({ client }) => {
    const user = await UserFactory.create() // User normal, pas admin

    const response = await client
      .post('/api/products')
      .json({ name: 'Test', price: 1.0, category: 'boulangerie' })
      .loginAs(user, 'api')

    response.assertStatus(403)
  })

  test('admin peut créer un produit', async ({ client }) => {
    const admin = await UserFactory.merge({ roleId: 2 }).create() // Admin

    const response = await client
      .post('/api/products')
      .json({
        name: 'Nouveau Pain',
        price: 3.5,
        category: 'boulangerie',
        description: 'Pain frais du jour',
      })
      .loginAs(admin, 'api')

    response.assertStatus(201)
    response.assertBodyContains({
      data: { name: 'Nouveau Pain', price: 3.5 },
    })
  })
})
```

### C. Test unitaire (Service)

```typescript
// tests/unit/bakery/product_service.spec.ts
import { test } from '@japa/runner'
import ProductService from '#bakery/services/product_service'
import Product from '#bakery/models/product'

test.group('ProductService', (group) => {
  group.each.setup(async () => {
    await Product.query().delete()
  })

  test('validateOrderItems retourne erreur si produit inexistant', async ({
    assert,
  }) => {
    const service = new ProductService()

    const result = await service.validateOrderItems([
      { productId: 999, quantity: 10 },
    ])

    assert.isFalse(result.valid)
    assert.include(result.errors[0], 'non disponible')
  })

  test('validateOrderItems calcule le total correctement', async ({
    assert,
  }) => {
    await Product.create({
      name: 'Pain',
      price: 2.5,
      category: 'boulangerie',
      minQuantity: 1,
      available: true,
    })
    const product = await Product.firstOrFail()

    const service = new ProductService()
    const result = await service.validateOrderItems([
      { productId: product.id, quantity: 10 },
    ])

    assert.isTrue(result.valid)
    assert.equal(result.total, 25) // 2.5 * 10
  })
})
```

### D. Exécuter les tests

```bash
# Tous les tests
node ace test

# Tests fonctionnels uniquement
node ace test --suite=functional

# Tests unitaires uniquement
node ace test --suite=unit

# Un fichier spécifique
node ace test --files="tests/functional/bakery/products.spec.ts"

# Avec couverture
node ace test --coverage
```

---

## 9. Documentation API

**Objectif** : Permettre aux consommateurs de l'API de l'utiliser facilement.

### A. Génération avec Tuyau

Tuyau génère automatiquement les types TypeScript pour le client mobile :

```bash
# Générer les types API
node ace tuyau:generate
```

### B. Documentation manuelle (si nécessaire)

```markdown
# API Bakery

## Authentification

Toutes les routes nécessitent un token Bearer :

```
Authorization: Bearer <token>
```

## Endpoints

### Produits

#### GET /api/products

Liste les produits disponibles.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| category | string | Filtrer par catégorie |
| search | string | Recherche textuelle |
| page | number | Page (défaut: 1) |
| limit | number | Items par page (défaut: 20, max: 100) |

**Réponse 200:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Pain de campagne",
      "price": 2.50,
      "category": "boulangerie",
      "imageUrl": "https://..."
    }
  ],
  "meta": {
    "total": 42,
    "page": 1,
    "lastPage": 3,
    "perPage": 20
  }
}
```

### Commandes

#### POST /api/orders

Crée une nouvelle commande.

**Body:**
```json
{
  "items": [
    { "productId": 1, "quantity": 20 },
    { "productId": 3, "quantity": 50 }
  ],
  "deliveryDate": "2025-01-20",
  "notes": "Livraison avant 8h"
}
```

**Réponse 201:**
```json
{
  "data": {
    "id": 123,
    "status": "pending",
    "total": 140.00,
    "deliveryDate": "2025-01-20",
    "items": [...]
  },
  "message": "Commande créée avec succès"
}
```

**Erreurs:**
- `422`: Validation échouée
- `400`: Produit non disponible ou quantité insuffisante
```

---

## 10. Checklist finale

### Avant de commencer le code

#### Conception
- [ ] Objectif du module défini
- [ ] Endpoints MVP listés avec priorités
- [ ] Schéma des relations de données dessiné
- [ ] Règles métier documentées

#### Structure
- [ ] Dossier du module créé
- [ ] Alias ajouté dans package.json et tsconfig.json
- [ ] Routes enregistrées dans adonisrc.ts
- [ ] Migrations path enregistré

### Pendant le développement

#### Base de données
- [ ] Migrations créées et testées
- [ ] Index sur les colonnes de recherche
- [ ] Contraintes de clés étrangères
- [ ] Seeders pour les données de test

#### Code
- [ ] Modèles avec relations
- [ ] Validators avec règles personnalisées
- [ ] DTOs pour les réponses
- [ ] Services avec logique métier
- [ ] Contrôleurs REST
- [ ] Policies d'autorisation

#### Tests
- [ ] Tests fonctionnels API
- [ ] Tests unitaires services
- [ ] Cas d'erreur couverts

### Avant la mise en production

#### Sécurité
- [ ] Toutes les routes protégées par auth
- [ ] Policies appliquées
- [ ] Validation côté serveur complète
- [ ] Pas de données sensibles dans les logs

#### Performance
- [ ] Requêtes N+1 évitées (preload)
- [ ] Pagination sur les listes
- [ ] Index base de données

#### Documentation
- [ ] Types Tuyau générés
- [ ] README ou doc API mise à jour

---

## Commandes utiles

```bash
# Créer une migration
node ace make:migration create_products_table --path=app/bakery/database/migrations

# Exécuter les migrations
node ace migration:run

# Rollback
node ace migration:rollback

# Créer un seeder
node ace make:seeder product --path=app/bakery/database/seeders

# Exécuter les seeders
node ace db:seed

# Lister les routes
node ace list:routes

# Générer les types Tuyau (pour mobile)
node ace tuyau:generate

# Lancer les tests
node ace test

# Vérifier les types
pnpm typecheck
```

---

## Ressources

- [AdonisJS Documentation](https://docs.adonisjs.com/)
- [Lucid ORM](https://lucid.adonisjs.com/)
- [VineJS Validation](https://vinejs.dev/)
- [AdonisJS Bouncer](https://docs.adonisjs.com/guides/security/authorization)
- [Tuyau (Type-safe API)](https://tuyau.julr.dev/)