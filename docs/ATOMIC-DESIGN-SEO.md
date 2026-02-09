# Atomic Design & SEO dans le Monorepo

Guide pour structurer les composants avec l'Atomic Design et optimiser le SEO avec Schema.org.

> **Stack UI** : Shadcn (web) + HeroUI Native (mobile), tous deux basés sur Tailwind CSS v4 avec variables CSS en `oklch`.

---

## Table des matières

1. [Atomic Design - Principes](#1-atomic-design---principes)
2. [Theming unifié (CSS Variables)](#2-theming-unifié-css-variables)
3. [Structure Monorepo](#3-structure-monorepo)
4. [Composants par niveau](#4-composants-par-niveau)
5. [SEO et Structured Data](#5-seo-et-structured-data)
6. [Implémentation Schema.org](#6-implémentation-schemaorg)
7. [Exemple complet : La Fabrique Bakery](#7-exemple-complet--la-fabrique-bakery)
8. [Checklist](#8-checklist)

---

## 1. Atomic Design - Principes

Méthodologie créée par Brad Frost pour construire des design systems modulaires.

### Hiérarchie

```
┌─────────────────────────────────────────────────────────────┐
│                         PAGES                               │
│        Instances de templates avec données réelles          │
├─────────────────────────────────────────────────────────────┤
│                       TEMPLATES                             │
│           Layouts structurels sans contenu                  │
├─────────────────────────────────────────────────────────────┤
│                       ORGANISMS                             │
│         Sections UI complètes et autonomes                  │
├─────────────────────────────────────────────────────────────┤
│                       MOLECULES                             │
│          Groupes d'atoms avec fonction unique               │
├─────────────────────────────────────────────────────────────┤
│                         ATOMS                               │
│           Éléments UI indivisibles                          │
└─────────────────────────────────────────────────────────────┘
```

### Analogie Schema.org

Schema.org suit une hiérarchie similaire :

```
Thing (Atom de base)
  └── Intangible
        └── Service
              └── FinancialProduct
                    └── InvestmentOrDeposit
                          └── InvestmentFund (Spécialisation)
```

**Parallèle** :
- **Atoms** = Types de base (`Thing`, `name`, `description`)
- **Molecules** = Types intermédiaires (`MonetaryAmount`, `PostalAddress`)
- **Organisms** = Types complets (`Product`, `LocalBusiness`, `Event`)
- **Pages** = Instance JSON-LD complète avec contexte

---

## 2. Theming unifié (CSS Variables)

Les deux librairies UI (Shadcn pour web, HeroUI Native pour mobile) utilisent **Tailwind CSS v4** avec des **CSS variables en `oklch`**. Le theme est centralisé dans `packages/ui/src/styles/globals.css`.

### A. Architecture du theming

```
┌─────────────────────────────────────────────────────────────────┐
│           packages/ui/src/styles/globals.css                    │
│                  (Source de vérité)                             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  :root { --primary: oklch(...); --accent: oklch(...); }   │  │
│  │  .dark { --primary: oklch(...); --accent: oklch(...); }   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                    │                         │
          ┌─────────┴─────────┐     ┌─────────┴─────────┐
          ▼                   ▼     ▼                   ▼
┌─────────────────────┐ ┌─────────────────────────────────────┐
│    apps/web         │ │           apps/mobile               │
│    (Shadcn)         │ │        (HeroUI Native)              │
├─────────────────────┤ ├─────────────────────────────────────┤
│ @import globals.css │ │ @import globals.css                 │
│ Composants Shadcn   │ │ Uniwind + HeroUI Native             │
│ class="bg-primary"  │ │ className="bg-accent"               │
└─────────────────────┘ └─────────────────────────────────────┘
```

### B. Structure du fichier globals.css

```css
/* packages/ui/src/styles/globals.css */

@import "tailwindcss";

/* Sources pour Tailwind (scan des classes) */
@source "../../../apps/**/*.{ts,tsx}";
@source "../../../apps/**/*.{edge}";
@source "../components/**/*.{ts,tsx}";

/* Dark mode via classe .dark */
@custom-variant dark (&:is(.dark *));

/* ============================================
   LIGHT THEME (défaut)
   ============================================ */
:root {
  /* Couleurs de base */
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);

  /* Surfaces */
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);

  /* Couleurs principales - LA FABRIQUE */
  --primary: oklch(0.45 0.12 55);           /* Marron pain #8B5A2B */
  --primary-foreground: oklch(0.985 0 0);   /* Blanc */

  /* Couleurs secondaires */
  --secondary: oklch(0.75 0.08 70);         /* Beige doré #D4A574 */
  --secondary-foreground: oklch(0.205 0 0);

  /* Accent (actions) */
  --accent: oklch(0.45 0.12 55);            /* = primary pour cohérence */
  --accent-foreground: oklch(0.985 0 0);

  /* États */
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);

  /* Bordures et inputs */
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.45 0.12 55);              /* Focus ring = primary */

  /* Radius */
  --radius: 0.625rem;

  /* Sidebar (si applicable) */
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
}

/* ============================================
   DARK THEME
   ============================================ */
.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);

  --card: oklch(0.18 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.18 0 0);
  --popover-foreground: oklch(0.985 0 0);

  /* Primary plus clair en dark mode */
  --primary: oklch(0.65 0.12 55);
  --primary-foreground: oklch(0.145 0 0);

  --secondary: oklch(0.35 0.08 70);
  --secondary-foreground: oklch(0.985 0 0);

  --accent: oklch(0.65 0.12 55);
  --accent-foreground: oklch(0.145 0 0);

  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.985 0 0);

  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.65 0.12 55);
}

/* ============================================
   MAPPING TAILWIND v4
   ============================================ */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

/* ============================================
   STYLES DE BASE
   ============================================ */
@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

### C. Variables HeroUI Native (mobile)

HeroUI Native utilise des variables similaires avec `@layer theme` :

```css
/* apps/mobile/global.css */

@import "tailwindcss";
@import "@repo/ui/styles/globals.css";  /* Import du theme partagé */

/* Surcharges spécifiques mobile si nécessaire */
@layer theme {
  @variant light {
    /* HeroUI Native semantic colors */
    --accent: var(--primary);
    --accent-foreground: var(--primary-foreground);
    --success: oklch(0.65 0.15 155);
    --warning: oklch(0.75 0.15 85);
    --danger: oklch(0.55 0.2 25);

    /* Champs de formulaire */
    --field-background: var(--input);
    --field-foreground: var(--foreground);
    --field-placeholder: var(--muted-foreground);
    --field-border: var(--border);
  }

  @variant dark {
    --accent: var(--primary);
    --accent-foreground: var(--primary-foreground);
    --success: oklch(0.75 0.12 155);
    --warning: oklch(0.80 0.12 85);
    --danger: oklch(0.65 0.18 25);

    --field-background: var(--input);
    --field-foreground: var(--foreground);
    --field-placeholder: var(--muted-foreground);
    --field-border: var(--border);
  }
}
```

### D. Palette La Fabrique en oklch

| Couleur | Usage | oklch | Hex approximatif |
|---------|-------|-------|------------------|
| **Primary** | Actions principales, CTA | `oklch(0.45 0.12 55)` | #8B5A2B |
| **Primary (dark)** | Primary en dark mode | `oklch(0.65 0.12 55)` | #C4956B |
| **Secondary** | Actions secondaires | `oklch(0.75 0.08 70)` | #D4A574 |
| **Accent** | Éléments interactifs | = Primary | #8B5A2B |
| **Success** | Confirmations | `oklch(0.65 0.15 155)` | #4CAF50 |
| **Warning** | Alertes | `oklch(0.75 0.15 85)` | #FF9800 |
| **Destructive** | Erreurs, suppression | `oklch(0.577 0.245 27)` | #F44336 |

> **Outil** : Utilisez [oklch.com](https://oklch.com) pour convertir et visualiser les couleurs.

### E. Utilisation dans les composants

**Shadcn (web)** - Les composants utilisent directement les variables :

```tsx
// apps/web/resources/components/ui/button.tsx (généré par Shadcn)
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Commander
</button>
```

**HeroUI Native (mobile)** - Idem via Uniwind :

```tsx
// apps/mobile/components/ui/Button.tsx
<Pressable className="bg-accent items-center justify-center rounded-lg py-3">
  <Text className="text-accent-foreground font-medium">Commander</Text>
</Pressable>
```

### F. Dark mode

**Web (Shadcn)** : Toggle la classe `.dark` sur `<html>` :

```tsx
// apps/web/resources/components/ThemeToggle.tsx
function toggleTheme() {
  document.documentElement.classList.toggle('dark');
}
```

**Mobile (HeroUI Native)** : Via Uniwind :

```tsx
// apps/mobile/components/ThemeToggle.tsx
import { Uniwind, useUniwind } from 'uniwind';

function ThemeToggle() {
  const { theme } = useUniwind();

  const toggle = () => {
    Uniwind.setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return <Button onPress={toggle}>Toggle Theme</Button>;
}
```

---

## 3. Structure Monorepo

### Architecture globale

```
monorepo/
├── packages/
│   └── ui/                      # Partagé web + mobile
│       └── src/
│           ├── styles/
│           │   └── globals.css  # Theme CSS (source de vérité)
│           ├── types/           # Types métier partagés
│           │   ├── product.ts
│           │   ├── order.ts
│           │   └── index.ts
│           └── seo/             # Utilitaires SEO (web only)
│               ├── schemas/     # Générateurs JSON-LD
│               └── components/  # JsonLd, MetaTags
│
├── apps/
│   ├── web/                     # AdonisJS + Landing
│   │   ├── app/                 # API backend
│   │   │   └── bakery/          # Module métier
│   │   └── resources/
│   │       ├── components/
│   │       │   ├── ui/          # Shadcn (généré par CLI)
│   │       │   ├── organisms/   # Composants métier
│   │       │   └── templates/   # Layouts
│   │       └── pages/
│   │
│   └── mobile/                  # Expo React Native
│       ├── components/
│       │   ├── ui/              # HeroUI Native
│       │   ├── organisms/       # Composants métier
│       │   └── templates/       # Layouts
│       ├── app/                 # Routes Expo Router
│       └── global.css           # Import du theme partagé
```

### Répartition Atomic Design avec Shadcn + HeroUI Native

```
┌─────────────────────────────────────────────────────────────────┐
│                    FOURNIS PAR LES LIBS                         │
├─────────────────────────────────────────────────────────────────┤
│  ATOMS        │  Shadcn (web)      │  HeroUI Native (mobile)    │
│               │  Button, Input     │  Button, Input             │
│               │  Badge, Avatar     │  Badge, Avatar             │
│               │  Card, Label       │  Card, Text                │
├───────────────┼────────────────────┼────────────────────────────┤
│  MOLECULES    │  Dialog, Dropdown  │  Modal, ActionSheet        │
│               │  Form, Select      │  Select, Checkbox          │
│               │  Tabs, Toast       │  Tabs, Toast               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    TU CRÉES (métier)                            │
├─────────────────────────────────────────────────────────────────┤
│  ORGANISMS    │  ProductCard, CartItem, OrderSummary            │
│               │  Hero, Features, FAQ, Header, Footer            │
├───────────────┼─────────────────────────────────────────────────┤
│  TEMPLATES    │  LandingLayout, AppLayout, AuthLayout           │
├───────────────┼─────────────────────────────────────────────────┤
│  PAGES        │  Landing, ProductDetail, Cart, Orders           │
└─────────────────────────────────────────────────────────────────┘
```

### Partage de code

| Couche | Web | Mobile | Partagé |
|--------|-----|--------|---------|
| **CSS Variables (theme)** | ✓ | ✓ | `packages/ui/src/styles/globals.css` |
| **Types métier** | ✓ | ✓ | `packages/ui/src/types/` |
| **Schemas SEO** | ✓ | - | `packages/ui/src/seo/` |
| **Atoms/Molecules** | Shadcn | HeroUI Native | Non (libs séparées) |
| **Organisms métier** | Web-specific | Mobile-specific | Non* |

*Les organisms ont la même structure mais des implémentations différentes (React DOM vs React Native).

---

## 4. Composants par niveau

Avec Shadcn et HeroUI Native, les **Atoms** et **Molecules** sont fournis par les librairies. Tu te concentres sur :
- **Organisms** : Composants métier (ProductCard, CartItem, Hero...)
- **Templates** : Layouts de pages
- **Pages** : Instances avec données réelles

### A. Organisms (ton code métier)

```
apps/web/resources/components/organisms/
├── ProductCard.tsx              # Carte produit (utilise Card, Badge, Button de Shadcn)
├── ProductGrid.tsx              # Grille de ProductCards
├── CartItem.tsx                 # Ligne panier
├── OrderSummary.tsx             # Récap commande
├── Hero.tsx                     # Section hero landing
├── Features.tsx                 # Liste fonctionnalités
├── Testimonials.tsx             # Témoignages clients
├── FAQ.tsx                      # Questions fréquentes
├── Header.tsx                   # Navigation header
└── Footer.tsx                   # Pied de page

apps/mobile/components/organisms/
├── ProductCard.tsx              # Version mobile (utilise Card, Badge, Button de HeroUI)
├── ProductGrid.tsx
├── CartItem.tsx
├── OrderSummary.tsx
└── OrderHistoryItem.tsx
```

### B. Exemple : ProductCard avec Shadcn (web)

```typescript
// apps/web/resources/components/organisms/ProductCard.tsx
import { Link } from '@inertiajs/react';
// Atoms/Molecules de Shadcn
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// Types partagés
import type { Product } from '@repo/ui/types';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string, quantity: number) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <Link href={`/produits/${product.slug}`}>
        <div className="relative aspect-square">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="object-cover w-full h-full"
          />
          {product.isNew && (
            <Badge className="absolute top-2 left-2" variant="secondary">
              Nouveau
            </Badge>
          )}
        </div>
      </Link>

      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{product.category}</p>
        <h3 className="font-semibold mt-1">{product.name}</h3>

        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-lg font-bold text-primary">
            {product.price.toFixed(2)} $
          </span>
          <span className="text-sm text-muted-foreground">
            / {product.unit}
          </span>
        </div>

        <Button
          className="w-full mt-4"
          onClick={() => onAddToCart?.(product.id, 1)}
        >
          Ajouter au panier
        </Button>
      </CardContent>
    </Card>
  );
}
```

### C. Exemple : ProductCard avec HeroUI Native (mobile)

```typescript
// apps/mobile/components/organisms/ProductCard.tsx
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
// Atoms/Molecules de HeroUI Native
import { Card, Text, Badge, Button } from '@heroui/react-native';
// Types partagés
import type { Product } from '@repo/ui/types';

interface ProductCardProps {
  product: Product;
  onAddToCart?: (productId: string, quantity: number) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const router = useRouter();

  return (
    <Card className="overflow-hidden">
      <Pressable onPress={() => router.push(`/product/${product.id}`)}>
        <View className="relative aspect-square">
          <Image
            source={{ uri: product.imageUrl }}
            className="w-full h-full"
            contentFit="cover"
          />
          {product.isNew && (
            <Badge className="absolute top-2 left-2" color="success">
              Nouveau
            </Badge>
          )}
        </View>
      </Pressable>

      <View className="p-4">
        <Text className="text-sm text-muted-foreground">{product.category}</Text>
        <Text className="font-semibold mt-1">{product.name}</Text>

        <View className="flex-row items-baseline gap-2 mt-2">
          <Text className="text-lg font-bold text-primary">
            {product.price.toFixed(2)} $
          </Text>
          <Text className="text-sm text-muted-foreground">/ {product.unit}</Text>
        </View>

        <Button
          className="w-full mt-4"
          onPress={() => onAddToCart?.(product.id, 1)}
        >
          Ajouter au panier
        </Button>
      </View>
    </Card>
  );
}
```

### D. Types partagés (packages/ui)

```typescript
// packages/ui/src/types/product.ts
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  originalPrice?: number;
  unit: string;               // "pièce", "kg", "douzaine"
  category: string;
  categorySlug: string;
  imageUrl: string;
  images?: string[];
  sku?: string;
  inStock: boolean;
  isNew?: boolean;
  minOrder?: number;
  maxOrder?: number;
  rating?: {
    average: number;
    count: number;
  };
}

// packages/ui/src/types/order.ts
export interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryDate: string;
  deliveryAddress: Address;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  province: string;
}

// packages/ui/src/types/index.ts
export * from './product';
export * from './order';
```

### E. Templates

```
apps/web/resources/components/templates/
├── LandingLayout.tsx            # Layout landing page (Header + Footer + SEO)
├── AppLayout.tsx                # Layout app authentifiée
└── AuthLayout.tsx               # Layout pages auth (login, register)

apps/mobile/components/templates/
├── ScreenLayout.tsx             # SafeArea + StatusBar
├── TabLayout.tsx                # Bottom tabs wrapper
└── AuthLayout.tsx               # Layout auth mobile
```

**Exemple : LandingLayout (web, SEO-ready)**

```typescript
// apps/web/resources/components/templates/LandingLayout.tsx
import { Head } from '@inertiajs/react';
import { Header } from '@/components/organisms/Header';
import { Footer } from '@/components/organisms/Footer';

interface LandingLayoutProps {
  children: React.ReactNode;
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
  schema?: object | object[];
}

export function LandingLayout({
  children,
  title,
  description,
  canonicalUrl,
  ogImage = '/images/og-default.jpg',
  schema,
}: LandingLayoutProps) {
  const fullTitle = `${title} | La Fabrique`;

  return (
    <>
      <Head>
        <title>{fullTitle}</title>
        <meta name="description" content={description} />
        {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

        {/* Open Graph */}
        <meta property="og:title" content={fullTitle} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:type" content="website" />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />

        {/* Schema.org JSON-LD */}
        {schema && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(Array.isArray(schema) ? schema : [schema])
            }}
          />
        )}
      </Head>

      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </>
  );
}
```

---

## 5. SEO et Structured Data

### A. Qu'est-ce que Schema.org ?

Vocabulaire standardisé pour décrire le contenu web aux moteurs de recherche.

**Formats supportés** :
- **JSON-LD** (recommandé) - Script dans `<head>`
- **Microdata** - Attributs HTML (`itemscope`, `itemtype`, `itemprop`)
- **RDFa** - Attributs HTML alternatifs

### B. Hiérarchie Schema.org

```
Thing (Base de tout)
├── CreativeWork
│   ├── Article
│   ├── Recipe
│   └── WebPage
├── Event
├── Organization
│   ├── LocalBusiness
│   │   ├── FoodEstablishment
│   │   │   ├── Bakery        ← Notre cas !
│   │   │   └── Restaurant
│   │   └── Store
│   └── Corporation
├── Person
├── Place
│   └── LocalBusiness (aussi ici)
├── Product                    ← Nos produits
│   └── ProductGroup
├── Intangible
│   ├── Service
│   │   └── FinancialProduct
│   │       └── InvestmentFund ← Exemple analysé
│   ├── Offer                  ← Prix produits
│   └── Order                  ← Commandes
└── Action
    └── OrderAction
```

### C. Types pertinents pour La Fabrique

| Type Schema.org | Usage | Propriétés clés |
|-----------------|-------|-----------------|
| `Bakery` | Page établissement | `name`, `address`, `openingHours`, `telephone` |
| `Product` | Fiches produits | `name`, `image`, `description`, `offers` |
| `Offer` | Prix/disponibilité | `price`, `priceCurrency`, `availability` |
| `Order` | Confirmation commande | `orderNumber`, `orderStatus`, `orderedItem` |
| `BreadcrumbList` | Navigation | `itemListElement` |
| `Organization` | Info entreprise | `logo`, `contactPoint`, `sameAs` |
| `WebPage` | Pages génériques | `name`, `description`, `mainEntity` |
| `FAQPage` | Page FAQ | `mainEntity` (Question/Answer) |

---

## 5. Implémentation Schema.org

### A. Générateurs de schemas

```
packages/ui/seo/
├── schemas/
│   ├── organization.ts          # Schema Organization
│   ├── localBusiness.ts         # Schema Bakery/LocalBusiness
│   ├── product.ts               # Schema Product
│   ├── offer.ts                 # Schema Offer
│   ├── breadcrumb.ts            # Schema BreadcrumbList
│   ├── faq.ts                   # Schema FAQPage
│   └── webpage.ts               # Schema WebPage
├── components/
│   ├── JsonLd.tsx               # Composant injection JSON-LD
│   └── MetaTags.tsx             # Composant meta tags
└── index.ts
```

### B. Générateur Organization/Bakery

```typescript
// packages/ui/seo/schemas/organization.ts

export interface OrganizationSchemaInput {
  name: string;
  description: string;
  url: string;
  logo: string;
  telephone?: string;
  email?: string;
  address?: {
    street: string;
    city: string;
    postalCode: string;
    province: string;
    country: string;
  };
  openingHours?: string[];
  socialLinks?: string[];
  geo?: {
    latitude: number;
    longitude: number;
  };
}

export function generateBakerySchema(input: OrganizationSchemaInput) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Bakery',
    name: input.name,
    description: input.description,
    url: input.url,
    logo: input.logo,
  };

  if (input.telephone) {
    schema.telephone = input.telephone;
  }

  if (input.email) {
    schema.email = input.email;
  }

  if (input.address) {
    schema.address = {
      '@type': 'PostalAddress',
      streetAddress: input.address.street,
      addressLocality: input.address.city,
      postalCode: input.address.postalCode,
      addressRegion: input.address.province,
      addressCountry: input.address.country,
    };
  }

  if (input.openingHours) {
    schema.openingHoursSpecification = input.openingHours.map((hours) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: hours.split(' ')[0],
      opens: hours.split(' ')[1]?.split('-')[0],
      closes: hours.split(' ')[1]?.split('-')[1],
    }));
  }

  if (input.geo) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude: input.geo.latitude,
      longitude: input.geo.longitude,
    };
  }

  if (input.socialLinks?.length) {
    schema.sameAs = input.socialLinks;
  }

  return schema;
}
```

### C. Générateur Product

```typescript
// packages/ui/seo/schemas/product.ts

export interface ProductSchemaInput {
  name: string;
  description: string;
  image: string | string[];
  sku?: string;
  brand?: string;
  category?: string;
  price: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  url?: string;
  rating?: {
    value: number;
    count: number;
  };
}

export function generateProductSchema(input: ProductSchemaInput) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: input.image,
  };

  if (input.sku) {
    schema.sku = input.sku;
  }

  if (input.brand) {
    schema.brand = {
      '@type': 'Brand',
      name: input.brand,
    };
  }

  if (input.category) {
    schema.category = input.category;
  }

  // Offer (prix)
  schema.offers = {
    '@type': 'Offer',
    price: input.price,
    priceCurrency: input.currency || 'CAD',
    availability: `https://schema.org/${input.availability || 'InStock'}`,
    url: input.url,
  };

  // Avis
  if (input.rating) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.rating.value,
      reviewCount: input.rating.count,
    };
  }

  return schema;
}
```

### D. Générateur BreadcrumbList

```typescript
// packages/ui/seo/schemas/breadcrumb.ts

export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
```

### E. Générateur FAQPage

```typescript
// packages/ui/seo/schemas/faq.ts

export interface FAQItem {
  question: string;
  answer: string;
}

export function generateFAQSchema(items: FAQItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
```

### F. Composant JsonLd

```typescript
// packages/ui/seo/components/JsonLd.tsx

interface JsonLdProps {
  schema: object | object[];
}

export function JsonLd({ schema }: JsonLdProps) {
  const schemas = Array.isArray(schema) ? schema : [schema];

  return (
    <>
      {schemas.map((s, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(s) }}
        />
      ))}
    </>
  );
}
```

---

## 6. Exemple complet : La Fabrique Bakery

### A. Landing Page avec SEO

```typescript
// apps/web/resources/pages/landing/index.tsx
import { Head } from '@inertiajs/react';
import { LandingLayout } from '@/components/templates/LandingLayout';
import { Hero } from '@/components/organisms/Hero';
import { Features } from '@/components/organisms/Features';
import { HowItWorks } from '@/components/organisms/HowItWorks';
import { Testimonials } from '@/components/organisms/Testimonials';
import { FAQ } from '@/components/organisms/FAQ';
import { JsonLd } from '@repo/ui/seo';
import {
  generateBakerySchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from '@repo/ui/seo/schemas';

const BAKERY_INFO = {
  name: 'La Fabrique - Boulangerie Artisanale',
  description: 'Boulangerie artisanale québécoise. Pains au levain, viennoiseries et pâtisseries pour professionnels de la restauration.',
  url: 'https://lafabrique.ca',
  logo: 'https://lafabrique.ca/images/logo.png',
  telephone: '+1-418-555-0123',
  email: 'commandes@lafabrique.ca',
  address: {
    street: '123 Rue du Pain',
    city: 'Québec',
    postalCode: 'G1K 1A1',
    province: 'QC',
    country: 'CA',
  },
  openingHours: [
    'Monday 05:00-18:00',
    'Tuesday 05:00-18:00',
    'Wednesday 05:00-18:00',
    'Thursday 05:00-18:00',
    'Friday 05:00-18:00',
    'Saturday 06:00-16:00',
  ],
  geo: {
    latitude: 46.8139,
    longitude: -71.2082,
  },
  socialLinks: [
    'https://facebook.com/lafabriquequebec',
    'https://instagram.com/lafabriquequebec',
  ],
};

const FAQ_ITEMS = [
  {
    question: 'Comment passer une commande ?',
    answer: 'Téléchargez notre application mobile, créez votre compte professionnel et passez commande en quelques clics. Vous pouvez aussi nous appeler au 418-555-0123.',
  },
  {
    question: 'Quels sont les délais de livraison ?',
    answer: 'Les commandes passées avant 14h sont livrées le lendemain matin entre 5h et 8h. Commandes minimum de 50$ pour la livraison gratuite.',
  },
  {
    question: 'Proposez-vous des produits sans gluten ?',
    answer: 'Oui, nous avons une gamme de pains et pâtisseries sans gluten préparés dans un espace dédié pour éviter la contamination croisée.',
  },
];

export default function LandingPage() {
  // Générer les schemas
  const bakerySchema = generateBakerySchema(BAKERY_INFO);
  const faqSchema = generateFAQSchema(FAQ_ITEMS);
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: 'https://lafabrique.ca' },
  ]);

  return (
    <LandingLayout
      title="Commandes B2B Boulangerie"
      description="Application de commande pour professionnels. Pains artisanaux, viennoiseries et pâtisseries livrés à votre établissement à Québec."
      canonicalUrl="https://lafabrique.ca"
      ogImage="https://lafabrique.ca/images/og-landing.jpg"
    >
      {/* Injection des schemas JSON-LD */}
      <JsonLd schema={[bakerySchema, faqSchema, breadcrumbSchema]} />

      <Hero
        title="Vos commandes boulangerie, simplifiées"
        subtitle="L'application pour les professionnels de la restauration à Québec"
        ctaText="Télécharger l'app"
        ctaHref="#download"
        secondaryCtaText="Voir le catalogue"
        secondaryCtaHref="/catalogue"
        screenshotUrl="/images/app-screenshot.png"
      />

      <Features
        id="features"
        title="Pourquoi choisir La Fabrique ?"
        items={[
          {
            icon: 'bread',
            title: 'Artisanat authentique',
            description: 'Pains au levain naturel, fermentation longue de 24h',
          },
          {
            icon: 'clock',
            title: 'Commande en 2 minutes',
            description: 'Recommandez vos favoris en un seul tap',
          },
          {
            icon: 'truck',
            title: 'Livraison à l\'aube',
            description: 'Produits frais livrés avant l\'ouverture de votre établissement',
          },
          {
            icon: 'repeat',
            title: 'Commandes récurrentes',
            description: 'Programmez vos commandes hebdomadaires',
          },
        ]}
      />

      <HowItWorks
        title="Comment ça marche ?"
        steps={[
          {
            number: 1,
            title: 'Téléchargez l\'app',
            description: 'Disponible sur iOS et Android',
          },
          {
            number: 2,
            title: 'Créez votre compte pro',
            description: 'Validation sous 24h',
          },
          {
            number: 3,
            title: 'Passez commande',
            description: 'Choisissez vos produits et la date de livraison',
          },
        ]}
      />

      <Testimonials
        title="Ils nous font confiance"
        items={[
          {
            quote: 'La qualité des pains est exceptionnelle. Nos clients adorent !',
            author: 'Marie Tremblay',
            role: 'Gérante, Café du Vieux-Port',
            avatar: '/images/testimonials/marie.jpg',
          },
          {
            quote: 'L\'app nous fait gagner un temps fou chaque semaine.',
            author: 'Jean-François Roy',
            role: 'Chef, Restaurant L\'Initiale',
            avatar: '/images/testimonials/jf.jpg',
          },
        ]}
      />

      <FAQ title="Questions fréquentes" items={FAQ_ITEMS} />

      {/* Section téléchargement */}
      <section id="download" className="py-20 bg-primary-50">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            Prêt à simplifier vos commandes ?
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Téléchargez l'app gratuitement
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <a href="https://apps.apple.com/app/lafabrique" aria-label="Télécharger sur l'App Store">
              <img src="/images/app-store-badge.svg" alt="App Store" className="h-12" />
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.lafabrique.app" aria-label="Télécharger sur Google Play">
              <img src="/images/google-play-badge.svg" alt="Google Play" className="h-12" />
            </a>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
```

### B. Page Produit avec SEO

```typescript
// apps/web/resources/pages/produits/[slug].tsx
import { Head } from '@inertiajs/react';
import { LandingLayout } from '@/components/templates/LandingLayout';
import { ProductDetail } from '@/components/organisms/ProductDetail';
import { RelatedProducts } from '@/components/organisms/RelatedProducts';
import { Breadcrumb } from '@/components/molecules/Breadcrumb';
import { JsonLd } from '@repo/ui/seo';
import {
  generateProductSchema,
  generateBreadcrumbSchema,
} from '@repo/ui/seo/schemas';
import type { Product } from '@/types';

interface ProductPageProps {
  product: Product;
  relatedProducts: Product[];
}

export default function ProductPage({ product, relatedProducts }: ProductPageProps) {
  // Schema produit
  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.images,
    sku: product.sku,
    brand: 'La Fabrique',
    category: product.category.name,
    price: product.price,
    currency: 'CAD',
    availability: product.inStock ? 'InStock' : 'OutOfStock',
    url: `https://lafabrique.ca/produits/${product.slug}`,
    rating: product.rating
      ? { value: product.rating.average, count: product.rating.count }
      : undefined,
  });

  // Breadcrumb
  const breadcrumbItems = [
    { name: 'Accueil', url: 'https://lafabrique.ca' },
    { name: 'Catalogue', url: 'https://lafabrique.ca/catalogue' },
    { name: product.category.name, url: `https://lafabrique.ca/catalogue/${product.category.slug}` },
    { name: product.name, url: `https://lafabrique.ca/produits/${product.slug}` },
  ];
  const breadcrumbSchema = generateBreadcrumbSchema(breadcrumbItems);

  return (
    <LandingLayout
      title={product.name}
      description={product.shortDescription || product.description.slice(0, 160)}
      canonicalUrl={`https://lafabrique.ca/produits/${product.slug}`}
      ogImage={product.images[0]}
    >
      <JsonLd schema={[productSchema, breadcrumbSchema]} />

      <div className="container mx-auto px-4 py-8">
        {/* Fil d'Ariane */}
        <Breadcrumb items={breadcrumbItems} />

        {/* Détail produit */}
        <ProductDetail product={product} />

        {/* Produits associés */}
        {relatedProducts.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-8">Vous aimerez aussi</h2>
            <RelatedProducts products={relatedProducts} />
          </section>
        )}
      </div>
    </LandingLayout>
  );
}
```

### C. Rendu HTML final (exemple)

```html
<!DOCTYPE html>
<html lang="fr-CA">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- SEO Essentiels -->
  <title>Pain au Levain Traditionnel | La Fabrique</title>
  <meta name="description" content="Pain au levain naturel, fermentation 24h. Croûte croustillante, mie alvéolée. Idéal pour restaurants et hôtels. Livraison à Québec.">
  <link rel="canonical" href="https://lafabrique.ca/produits/pain-levain-traditionnel">

  <!-- Open Graph -->
  <meta property="og:title" content="Pain au Levain Traditionnel | La Fabrique">
  <meta property="og:description" content="Pain au levain naturel, fermentation 24h...">
  <meta property="og:image" content="https://lafabrique.ca/images/produits/pain-levain.jpg">
  <meta property="og:type" content="product">
  <meta property="og:url" content="https://lafabrique.ca/produits/pain-levain-traditionnel">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">

  <!-- Schema.org JSON-LD -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "Pain au Levain Traditionnel",
    "description": "Pain au levain naturel avec une fermentation longue de 24 heures...",
    "image": [
      "https://lafabrique.ca/images/produits/pain-levain-1.jpg",
      "https://lafabrique.ca/images/produits/pain-levain-2.jpg"
    ],
    "sku": "PLT-001",
    "brand": {
      "@type": "Brand",
      "name": "La Fabrique"
    },
    "category": "Pains",
    "offers": {
      "@type": "Offer",
      "price": 8.50,
      "priceCurrency": "CAD",
      "availability": "https://schema.org/InStock",
      "url": "https://lafabrique.ca/produits/pain-levain-traditionnel"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": 4.8,
      "reviewCount": 124
    }
  }
  </script>

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://lafabrique.ca" },
      { "@type": "ListItem", "position": 2, "name": "Catalogue", "item": "https://lafabrique.ca/catalogue" },
      { "@type": "ListItem", "position": 3, "name": "Pains", "item": "https://lafabrique.ca/catalogue/pains" },
      { "@type": "ListItem", "position": 4, "name": "Pain au Levain Traditionnel", "item": "https://lafabrique.ca/produits/pain-levain-traditionnel" }
    ]
  }
  </script>
</head>
<body>
  <!-- Contenu... -->
</body>
</html>
```

---

## 7. Checklist

### Atomic Design

- [ ] Hiérarchie Atoms → Molecules → Organisms → Templates → Pages
- [ ] Types partagés dans `packages/ui/*/types.ts`
- [ ] Hooks headless dans `packages/ui/*/hooks.ts`
- [ ] Implémentations séparées web/mobile
- [ ] Theme centralisé (colors, spacing, typography)
- [ ] Composants documentés avec Storybook (optionnel)

### SEO Technique

- [ ] Balises `<title>` uniques par page (50-60 caractères)
- [ ] Meta `description` uniques (150-160 caractères)
- [ ] URLs canoniques sur toutes les pages
- [ ] Structure Hn hiérarchique (un seul H1)
- [ ] Images avec attributs `alt` descriptifs
- [ ] Sitemap XML généré
- [ ] robots.txt configuré

### Schema.org

- [ ] Schema `Organization` / `LocalBusiness` sur la page d'accueil
- [ ] Schema `Product` + `Offer` sur les fiches produits
- [ ] Schema `BreadcrumbList` pour la navigation
- [ ] Schema `FAQPage` sur la page FAQ
- [ ] Validation avec [Google Rich Results Test](https://search.google.com/test/rich-results)
- [ ] Validation avec [Schema.org Validator](https://validator.schema.org/)

### Performance (Core Web Vitals)

- [ ] LCP < 2.5s (Largest Contentful Paint)
- [ ] FID < 100ms (First Input Delay)
- [ ] CLS < 0.1 (Cumulative Layout Shift)
- [ ] Images optimisées (WebP, lazy loading)
- [ ] Fonts préchargées

---

## Ressources

- [Atomic Design - Brad Frost](https://atomicdesign.bradfrost.com/)
- [Schema.org Documentation](https://schema.org/docs/documents.html)
- [Google Search Central - Structured Data](https://developers.google.com/search/docs/appearance/structured-data)
- [Rich Results Test](https://search.google.com/test/rich-results)
- [Web.dev - Core Web Vitals](https://web.dev/vitals/)