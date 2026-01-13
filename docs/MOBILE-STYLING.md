# Guide de Style - Application Mobile Expo

Ce guide détaille les bibliothèques de style utilisées dans le projet mobile et leur configuration.

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Bibliothèques installées](#bibliothèques-installées)
3. [Configuration Uniwind](#configuration-uniwind)
4. [Configuration Metro](#configuration-metro)
5. [HeroUI Native](#heroui-native)
6. [Tailwind Variants](#tailwind-variants)
7. [Tailwind Merge](#tailwind-merge)
8. [Exemples d'utilisation](#exemples-dutilisation)
9. [Bonnes pratiques](#bonnes-pratiques)

---

## Vue d'ensemble

L'application mobile utilise une stack de styling moderne basée sur Tailwind CSS adaptée pour React Native :

```
┌─────────────────────────────────────────────────────────┐
│                    Application Expo                      │
├─────────────────────────────────────────────────────────┤
│  HeroUI Native     │  Composants UI pré-stylés          │
├─────────────────────────────────────────────────────────┤
│  tailwind-variants │  Variants de composants            │
├─────────────────────────────────────────────────────────┤
│  tailwind-merge    │  Fusion intelligente de classes    │
├─────────────────────────────────────────────────────────┤
│  Uniwind           │  Tailwind CSS pour React Native    │
├─────────────────────────────────────────────────────────┤
│  Tailwind CSS v4   │  Moteur de styles                  │
└─────────────────────────────────────────────────────────┘
```

---

## Bibliothèques installées

| Bibliothèque | Version | Description |
|--------------|---------|-------------|
| `tailwindcss` | ^4.1.18 | Framework CSS utilitaire |
| `uniwind` | ^1.2.3 | Adaptateur Tailwind pour React Native |
| `heroui-native` | 1.0.0-beta.11 | Bibliothèque de composants UI |
| `tailwind-variants` | ^3.2.2 | Gestion des variants de composants |
| `tailwind-merge` | ^3.4.0 | Fusion intelligente de classes Tailwind |
| `react-native-svg` | 15.12.1 | Support SVG pour les icônes |
| `react-native-reanimated` | ~4.1.1 | Animations fluides |

---

## Configuration Uniwind

### Étape 1 : Installation

```bash
pnpm add tailwindcss uniwind --filter mobile
```

### Étape 2 : Fichier CSS global

Créez le fichier `apps/mobile/app/global.css` :

```css
@import 'tailwindcss';
@import 'uniwind';

@import 'heroui-native/styles';
@source "../../../node_modules/heroui-native/lib";
```

**Explications :**
- `@import 'tailwindcss'` : Importe les utilitaires Tailwind CSS v4
- `@import 'uniwind'` : Active le support React Native
- `@import 'heroui-native/styles'` : Importe les styles HeroUI
- `@source` : Indique à Tailwind où scanner pour les classes utilisées

### Étape 3 : Import dans le layout

Dans `apps/mobile/app/_layout.tsx`, importez le CSS en premier :

```typescript
import './global.css';

import { Stack } from 'expo-router';
// ... autres imports
```

---

## Configuration Metro

### Fichier : `apps/mobile/metro.config.js`

```javascript
const { FileStore } = require('@expo/metro/metro-cache');
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const { withUniwindConfig } = require('uniwind/metro');

// Créer la config Metro par défaut
const config = getDefaultConfig(__dirname);

// Cache Turborepo pour les builds monorepo
config.cacheStores = [
  new FileStore({
    root: path.join(__dirname, 'node_modules', '.cache', 'metro'),
  }),
];

// Wrapper Uniwind avec les options
module.exports = withUniwindConfig(config, {
  cssEntryFile: './app/global.css',  // Fichier CSS principal
  dtsFile: './uniwind.d.ts',         // Fichier de types généré
});
```

**Options de configuration :**

| Option | Description |
|--------|-------------|
| `cssEntryFile` | Chemin vers le fichier CSS global |
| `dtsFile` | Fichier TypeScript de définition des classes |

### Fichier généré : `uniwind.d.ts`

Uniwind génère automatiquement un fichier de types pour l'autocomplétion :

```typescript
// Ce fichier est auto-généré par Uniwind
declare module 'uniwind' {
  // Définitions des classes disponibles
}
```

---

## HeroUI Native

### Étape 1 : Installation

```bash
pnpm add heroui-native react-native-gesture-handler react-native-reanimated react-native-svg --filter mobile
```

### Étape 2 : Configuration du Provider

Dans `apps/mobile/app/_layout.tsx` :

```typescript
import './global.css';

import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/tuyau';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <QueryClientProvider client={queryClient}>
          <Stack />
        </QueryClientProvider>
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
```

**Ordre des Providers (important) :**
1. `GestureHandlerRootView` - Gestion des gestes (requis par HeroUI)
2. `HeroUINativeProvider` - Thème et contexte HeroUI
3. `QueryClientProvider` - React Query pour les données

### Étape 3 : Utilisation des composants

```typescript
import { Button, Input, Card } from 'heroui-native';

export function LoginForm() {
  return (
    <Card className="p-4 m-4">
      <Input
        label="Email"
        placeholder="votre@email.com"
        className="mb-4"
      />
      <Input
        label="Mot de passe"
        type="password"
        className="mb-4"
      />
      <Button color="primary" className="w-full">
        Se connecter
      </Button>
    </Card>
  );
}
```

### Composants HeroUI disponibles

| Composant | Description |
|-----------|-------------|
| `Button` | Boutons avec variants (solid, bordered, light, flat, ghost) |
| `Input` | Champs de saisie avec labels et validation |
| `Card` | Conteneurs avec ombres et bordures |
| `Modal` | Fenêtres modales |
| `Avatar` | Images de profil circulaires |
| `Badge` | Badges de notification |
| `Chip` | Tags/étiquettes |
| `Spinner` | Indicateurs de chargement |
| `Switch` | Interrupteurs on/off |
| `Checkbox` | Cases à cocher |

---

## Tailwind Variants

### Installation

```bash
pnpm add tailwind-variants --filter mobile
```

### Utilisation basique

```typescript
import { tv } from 'tailwind-variants';

const button = tv({
  base: 'font-medium rounded-full active:opacity-80',
  variants: {
    color: {
      primary: 'bg-blue-500 text-white',
      secondary: 'bg-purple-500 text-white',
      danger: 'bg-red-500 text-white',
    },
    size: {
      sm: 'text-sm py-1 px-3',
      md: 'text-base py-2 px-4',
      lg: 'text-lg py-3 px-6',
    },
  },
  defaultVariants: {
    color: 'primary',
    size: 'md',
  },
});

// Utilisation
<View className={button({ color: 'primary', size: 'lg' })}>
  <Text>Mon bouton</Text>
</View>
```

### Variants composés

```typescript
const card = tv({
  slots: {
    base: 'rounded-xl shadow-md',
    header: 'p-4 border-b',
    body: 'p-4',
    footer: 'p-4 border-t',
  },
  variants: {
    color: {
      default: {
        base: 'bg-white',
        header: 'border-gray-200',
        footer: 'border-gray-200',
      },
      dark: {
        base: 'bg-gray-800',
        header: 'border-gray-700',
        footer: 'border-gray-700',
      },
    },
  },
});

// Utilisation
const { base, header, body, footer } = card({ color: 'default' });

<View className={base()}>
  <View className={header()}>
    <Text>Titre</Text>
  </View>
  <View className={body()}>
    <Text>Contenu</Text>
  </View>
</View>
```

---

## Tailwind Merge

### Installation

```bash
pnpm add tailwind-merge --filter mobile
```

### Problème résolu

Sans `tailwind-merge` :
```typescript
// Classes conflictuelles = résultat imprévisible
<View className="p-4 p-8" />
// Résultat: p-4 ET p-8 sont appliqués (conflit!)
```

Avec `tailwind-merge` :
```typescript
import { twMerge } from 'tailwind-merge';

<View className={twMerge('p-4', 'p-8')} />
// Résultat: seulement p-8 est appliqué
```

### Utilisation avec des composants

```typescript
import { twMerge } from 'tailwind-merge';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

export function Card({ className, children }: CardProps) {
  return (
    <View className={twMerge(
      'bg-white rounded-xl p-4 shadow-md', // Classes par défaut
      className // Classes personnalisées (override)
    )}>
      {children}
    </View>
  );
}

// Utilisation
<Card className="bg-blue-500 p-8">
  {/* bg-blue-500 remplace bg-white, p-8 remplace p-4 */}
</Card>
```

### Combiner avec tailwind-variants

```typescript
import { tv } from 'tailwind-variants';
import { twMerge } from 'tailwind-merge';

const button = tv({
  base: 'rounded-lg py-2 px-4',
  variants: {
    color: {
      primary: 'bg-blue-500',
      danger: 'bg-red-500',
    },
  },
});

interface ButtonProps {
  color?: 'primary' | 'danger';
  className?: string;
}

export function Button({ color = 'primary', className }: ButtonProps) {
  return (
    <Pressable className={twMerge(button({ color }), className)}>
      {/* ... */}
    </Pressable>
  );
}
```

---

## Exemples d'utilisation

### Composant complet avec tous les outils

```typescript
// components/ProductCard.tsx
import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { tv } from 'tailwind-variants';
import { twMerge } from 'tailwind-merge';
import { Button, Badge } from 'heroui-native';

const productCard = tv({
  slots: {
    container: 'bg-white rounded-2xl overflow-hidden shadow-lg',
    imageWrapper: 'relative aspect-square',
    image: 'w-full h-full',
    badge: 'absolute top-2 right-2',
    content: 'p-4',
    title: 'text-lg font-bold text-gray-900',
    price: 'text-xl font-bold text-blue-600 mt-1',
    description: 'text-sm text-gray-500 mt-2',
  },
  variants: {
    featured: {
      true: {
        container: 'border-2 border-yellow-400',
        badge: 'bg-yellow-400',
      },
    },
  },
});

interface ProductCardProps {
  title: string;
  price: number;
  image: string;
  description?: string;
  featured?: boolean;
  className?: string;
  onPress?: () => void;
}

export function ProductCard({
  title,
  price,
  image,
  description,
  featured = false,
  className,
  onPress,
}: ProductCardProps) {
  const styles = productCard({ featured });

  return (
    <Pressable
      onPress={onPress}
      className={twMerge(styles.container(), className)}
    >
      <View className={styles.imageWrapper()}>
        <Image
          source={{ uri: image }}
          className={styles.image()}
          contentFit="cover"
        />
        {featured && (
          <Badge className={styles.badge()} color="warning">
            Vedette
          </Badge>
        )}
      </View>

      <View className={styles.content()}>
        <Text className={styles.title()}>{title}</Text>
        <Text className={styles.price()}>{price.toFixed(2)} €</Text>
        {description && (
          <Text className={styles.description()} numberOfLines={2}>
            {description}
          </Text>
        )}
        <Button color="primary" className="mt-4 w-full">
          Ajouter au panier
        </Button>
      </View>
    </Pressable>
  );
}
```

### Page avec layout responsive

```typescript
// app/products/index.tsx
import { View, ScrollView, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { tuyau } from '@/lib/tuyau';
import { Spinner } from 'heroui-native';
import { ProductCard } from '@/components/ProductCard';

export default function ProductsScreen() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['products'],
    queryFn: () => tuyau.api.products.$get(),
  });

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50">
        <Spinner size="lg" />
        <Text className="mt-4 text-gray-500">Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-50 p-4">
        <Text className="text-red-500 text-center">
          Erreur lors du chargement des produits
        </Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <Text className="text-2xl font-bold text-gray-900 mb-4">
          Nos Produits
        </Text>

        <View className="gap-4">
          {data?.data?.map((product) => (
            <ProductCard
              key={product.id}
              title={product.name}
              price={product.price}
              image={product.imageUrl}
              description={product.description}
              featured={product.featured}
            />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
```

---

## Bonnes pratiques

### 1. Organisation des styles

```
apps/mobile/
├── app/
│   ├── global.css          # Styles globaux et imports
│   └── _layout.tsx         # Providers
├── components/
│   ├── ui/                 # Composants UI réutilisables
│   │   ├── Button.tsx
│   │   └── Card.tsx
│   └── variants/           # Définitions tailwind-variants
│       └── index.ts
└── styles/
    └── theme.ts            # Couleurs et tokens personnalisés
```

### 2. Créer un fichier de variants centralisé

```typescript
// components/variants/index.ts
import { tv } from 'tailwind-variants';

export const buttonVariants = tv({
  base: 'rounded-lg font-medium transition-colors',
  variants: {
    // ...
  },
});

export const cardVariants = tv({
  // ...
});

export const inputVariants = tv({
  // ...
});
```

### 3. Utiliser des utilitaires de classe

```typescript
// lib/cn.ts
import { twMerge } from 'tailwind-merge';
import { type ClassValue, clsx } from 'clsx';

/**
 * Combine clsx et tailwind-merge pour une gestion optimale des classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utilisation
import { cn } from '@/lib/cn';

<View className={cn(
  'p-4 rounded-lg',
  isActive && 'bg-blue-500',
  isDisabled && 'opacity-50',
  className
)} />
```

### 4. Éviter les styles inline

```typescript
// ❌ Mauvais
<View style={{ padding: 16, backgroundColor: 'white' }}>

// ✅ Bon
<View className="p-4 bg-white">
```

### 5. Utiliser les classes sémantiques

```typescript
// ❌ Éviter les valeurs arbitraires
<Text className="text-[#1a73e8]">

// ✅ Utiliser les classes Tailwind
<Text className="text-blue-600">
```

---

## Dépendances peer requises

Assurez-vous que ces dépendances sont installées :

```bash
pnpm add react-native-gesture-handler react-native-reanimated react-native-svg --filter mobile
```

Ces packages sont requis par HeroUI Native pour les animations et les gestes.

---

## Ressources

- [Uniwind Documentation](https://uniwind.dev)
- [HeroUI Native](https://heroui.com/native)
- [Tailwind CSS v4](https://tailwindcss.com)
- [Tailwind Variants](https://www.tailwind-variants.org)
- [Tailwind Merge](https://github.com/dcastil/tailwind-merge)
