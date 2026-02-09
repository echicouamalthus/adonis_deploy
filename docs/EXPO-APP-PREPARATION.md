# Processus de Préparation d'une App Expo

Ce guide détaille les étapes **AVANT d'écrire le code** pour construire une application Expo professionnelle et production-ready.

> **Règle d'or** : Une app Expo réussie se joue à 70% AVANT le code.

---

## Table des matières

1. [Clarification du produit](#1-clarification-du-produit)
2. [Architecture de navigation](#2-architecture-de-navigation)
3. [Branding et identité visuelle](#3-branding-et-identité-visuelle)
4. [Configuration Expo](#4-configuration-expo)
5. [Splash screen et loading UX](#5-splash-screen-et-loading-ux)
6. [Choix techniques](#6-choix-techniques)
7. [Environnement et outils](#7-environnement-et-outils)
8. [Stratégie de build et déploiement](#8-stratégie-de-build-et-déploiement)
9. [Sécurité et conformité](#9-sécurité-et-conformité)
10. [Checklist finale](#10-checklist-finale)

---

## 1. Clarification du produit

**Objectif** : Savoir exactement ce que vous construisez avant d'ouvrir l'IDE.

### A. Questions essentielles

| Question | Exemple La Fabrique Bakery |
|----------|----------------------------|
| Objectif de l'app | Commandes B2B boulangerie artisanale |
| Utilisateurs cibles | Gérants restaurants, hôtels, détaillants |
| Plateformes | iOS, Android (pas web) |
| Mode offline requis ? | Non pour MVP (online-first) |
| Authentification | Email/mot de passe via AdonisJS |
| Backend | API REST AdonisJS (monorepo) |

### B. Fonctionnalités principales (MVP)

Lister les fonctionnalités par priorité :

```
P0 (Must have)
├── Connexion / Déconnexion compte pro
├── Catalogue produits par catégorie
├── Panier avec sélection date de livraison
├── Passer une commande
├── Historique des commandes
└── Recommander une commande précédente

P1 (Should have)
├── Notifications push (commande confirmée)
├── Mode offline (consultation catalogue)
├── Produits favoris
└── Recherche produits

P2 (Nice to have)
├── Chat avec le service client
├── Demande de produit sur mesure
└── Scanner code-barres produit
```

### C. Livrable

Créer un fichier `docs/PRODUCT-SPEC.md` :

```markdown
# Spécifications Produit - [Nom App]

## Vision
[Une phrase décrivant l'objectif]

## Utilisateurs
- Persona 1: [Description]
- Persona 2: [Description]

## Fonctionnalités MVP
1. [Feature 1]
2. [Feature 2]

## Contraintes techniques
- Offline-first: Oui/Non
- Notifications: Oui/Non
- Géolocalisation: Oui/Non
```

---

## 2. Architecture de navigation

Expo Router utilise le **filesystem routing** - la structure de fichiers = la navigation.

### A. Patterns de navigation

#### Stack (écrans empilés)
```
app/
├── index.tsx        → Écran d'accueil
├── details.tsx      → Écran de détails
└── _layout.tsx      → Configuration Stack
```

#### Tabs (onglets en bas)
```
app/
├── (tabs)/
│   ├── _layout.tsx  → Configuration Tabs
│   ├── home.tsx     → Onglet Accueil
│   ├── search.tsx   → Onglet Recherche
│   └── profile.tsx  → Onglet Profil
└── _layout.tsx
```

#### Groupes avec authentification
```
app/
├── (auth)/          → Routes publiques
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── (app)/           → Routes protégées
│   ├── _layout.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   └── profile.tsx
│   └── settings.tsx
└── _layout.tsx      → Root avec AuthProvider
```

### B. Exemple concret : La Fabrique Bakery

```
app/
├── _layout.tsx                 # Root: providers + auth check
├── (auth)/
│   ├── _layout.tsx             # Stack simple
│   └── login.tsx               # Connexion compte pro
├── (app)/
│   ├── _layout.tsx             # Protected layout
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Bottom tabs config (3 onglets)
│   │   ├── index.tsx           # Catalogue produits
│   │   ├── orders.tsx          # Mes commandes
│   │   └── profile.tsx         # Mon compte
│   ├── product/
│   │   └── [id].tsx            # Détail produit
│   ├── cart.tsx                # Panier + date livraison
│   └── order/
│       └── [id].tsx            # Détail commande
└── +not-found.tsx              # 404
```

### C. Schéma visuel

Créer un schéma (Figma, Whimsical, papier) :

```
┌─────────────────────────────────────────┐
│              ROOT LAYOUT                │
│         (AuthProvider, Theme)           │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
   ┌────▼────┐        ┌─────▼─────┐
   │ (auth)  │        │   (app)   │
   │  Stack  │        │ Protected │
   └────┬────┘        └─────┬─────┘
        │                   │
   ┌────┴────┐        ┌─────┴─────┐
   │ login   │        │  (tabs)   │
   │register │        │  ┌─────┐  │
   └─────────┘        │  │home │  │
                      │  │hist │  │
                      │  │prof │  │
                      │  └─────┘  │
                      └───────────┘
```

### D. Décisions à prendre

| Question | Options | Choix |
|----------|---------|-------|
| Navigation principale | Tabs / Drawer / Stack | Tabs |
| Modals | Native / Custom | Native |
| Deep linking | Oui / Non | Oui |
| Routes protégées | Redirect / Guard | Redirect |

---

## 3. Branding et identité visuelle

### A. Assets obligatoires

| Asset | Dimensions | Format | Usage |
|-------|------------|--------|-------|
| App Icon | 1024 x 1024 | PNG | Store + appareil |
| Adaptive Icon (Android) | 432 x 432 | PNG | Android 8+ |
| Splash Image | 200 x 200 (min) | PNG | Écran de chargement |
| Favicon | 48 x 48 | PNG | Web |

### B. Structure des assets

```
assets/
├── images/
│   ├── icon.png                 # 1024x1024 - Icône principale
│   ├── adaptive-icon.png        # 432x432 - Foreground Android
│   ├── splash-icon.png          # Logo pour splash
│   └── favicon.png              # 48x48 - Web
├── fonts/
│   ├── Inter-Regular.ttf
│   ├── Inter-Medium.ttf
│   └── Inter-Bold.ttf
└── images/
    ├── logo.png
    └── empty-state.png
```

### C. Design tokens

Définir avant le code :

```typescript
// constants/theme.ts

export const colors = {
  // Couleurs principales - Boulangerie artisanale
  primary: {
    50: '#FDF8F3',
    100: '#F9EDE0',
    500: '#8B5A2B',    // Marron pain/bois
    600: '#6F4720',
    700: '#553615',
  },
  // Couleurs secondaires - Croûte dorée
  secondary: {
    500: '#D4A574',    // Beige doré
  },
  // Neutres
  gray: {
    50: '#FAFAFA',
    100: '#F5F5F5',
    500: '#9E9E9E',
    900: '#212121',
  },
  // Sémantiques
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 16,
  full: 9999,
};

export const typography = {
  fontFamily: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    bold: 'Inter-Bold',
  },
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
  },
};
```

### D. Checklist branding

- [ ] Logo en plusieurs tailles
- [ ] Palette de couleurs définie
- [ ] Typographies choisies et téléchargées
- [ ] Icônes (pack choisi : Lucide, Phosphor, etc.)
- [ ] Illustrations pour états vides
- [ ] Design system documenté

---

## 4. Configuration Expo

### A. app.json complet

```json
{
  "expo": {
    "name": "La Fabrique",
    "slug": "la-fabrique",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/images/icon.png",
    "scheme": "lafabrique",
    "userInterfaceStyle": "light",

    "newArchEnabled": true,

    "ios": {
      "bundleIdentifier": "com.lafabrique.app",
      "supportsTablet": true
    },

    "android": {
      "package": "com.lafabrique.app",
      "adaptiveIcon": {
        "foregroundImage": "./assets/images/adaptive-icon.png",
        "backgroundColor": "#8B5A2B"
      }
    },

    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/images/favicon.png"
    },

    "plugins": [
      "expo-router",
      "expo-font",
      "expo-secure-store",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "backgroundColor": "#FAFAF9",
          "dark": {
            "image": "./assets/images/splash-icon.png",
            "backgroundColor": "#1C1917"
          }
        }
      ]
    ],

    "experiments": {
      "typedRoutes": true
    },

    "extra": {
      "router": {
        "origin": false
      },
      "eas": {
        "projectId": "votre-project-id-eas"
      }
    }
  }
}
```

### B. Identifiants de bundle

| Plateforme | Format | Exemple |
|------------|--------|---------|
| iOS | Reverse domain | `com.entreprise.nomapp` |
| Android | Reverse domain | `com.entreprise.nomapp` |

**Règles** :
- Minuscules uniquement
- Pas de tirets (utiliser des points)
- Unique sur les stores
- Ne peut PAS être changé après publication

### C. Permissions courantes

| Permission | iOS (Info.plist) | Android |
|------------|------------------|---------|
| Caméra | `NSCameraUsageDescription` | `CAMERA` |
| Galerie | `NSPhotoLibraryUsageDescription` | `READ_EXTERNAL_STORAGE` |
| Localisation | `NSLocationWhenInUseUsageDescription` | `ACCESS_FINE_LOCATION` |
| Notifications | (via APNs) | `POST_NOTIFICATIONS` |
| Microphone | `NSMicrophoneUsageDescription` | `RECORD_AUDIO` |

---

## 5. Splash screen et loading UX

### A. Objectif

**Zéro écran blanc** - L'utilisateur doit toujours voir quelque chose.

### B. Flux de chargement

```
App démarre
    │
    ▼
┌─────────────────┐
│  Splash Screen  │  ← Natif (expo-splash-screen)
│  (logo centré)  │
└────────┬────────┘
         │
    ▼────┴────▼
┌─────────────────┐
│ Chargement :    │
│ - Fonts         │
│ - Auth state    │
│ - Config        │
└────────┬────────┘
         │
    ▼────┴────▼
┌─────────────────┐
│  Hide Splash    │  ← SplashScreen.hideAsync()
│  Show App       │
└─────────────────┘
```

### C. Implémentation

```typescript
// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Font from 'expo-font';
import { useAuth } from '@/contexts/auth';

// Garder le splash visible
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appReady, setAppReady] = useState(false);
  const { isLoading: authLoading } = useAuth();

  useEffect(() => {
    async function prepare() {
      try {
        // Charger les fonts
        await Font.loadAsync({
          'Inter-Regular': require('../assets/fonts/Inter-Regular.ttf'),
          'Inter-Bold': require('../assets/fonts/Inter-Bold.ttf'),
        });

        // Autres initialisations...

      } catch (e) {
        console.warn(e);
      } finally {
        setAppReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    // Cacher le splash quand tout est prêt
    if (appReady && !authLoading) {
      SplashScreen.hideAsync();
    }
  }, [appReady, authLoading]);

  if (!appReady || authLoading) {
    return null; // Splash screen toujours visible
  }

  return <Stack />;
}
```

---

## 6. Choix techniques

### A. Matrice de décision

| Domaine | Options | Recommandé (ce monorepo) |
|---------|---------|--------------------------|
| **State global** | Zustand / Redux / Context | Zustand (simple) |
| **State serveur** | React Query / SWR | TanStack Query |
| **Formulaires** | React Hook Form / TanStack Form | TanStack Form |
| **Validation** | Zod / Yup | Zod |
| **Styling** | NativeWind / Tamagui / StyleSheet | Tailwind + Uniwind |
| **UI Components** | HeroUI / Gluestack / Custom | HeroUI Native |
| **HTTP Client** | Fetch / Axios / Tuyau | Tuyau (type-safe) |
| **Auth storage** | AsyncStorage / SecureStore | expo-secure-store |
| **Offline** | WatermelonDB / Drizzle+SQLite | Drizzle + expo-sqlite |

### B. Stack recommandé pour ce monorepo

```json
{
  "dependencies": {
    // Navigation
    "expo-router": "~6.0.0",

    // State & Data
    "@tanstack/react-query": "^5.0.0",
    "@tanstack/react-form": "^1.0.0",
    "zustand": "^4.0.0",

    // Validation
    "zod": "^3.0.0",
    "@tanstack/zod-form-adapter": "^0.0.0",

    // API (type-safe avec AdonisJS)
    "@tuyau/client": "^0.2.0",

    // UI
    "heroui-native": "^1.0.0",
    "tailwindcss": "^4.0.0",
    "uniwind": "^1.0.0",

    // Utilitaires
    "@react-native-community/netinfo": "^11.0.0",
    "expo-secure-store": "~13.0.0",

    // Offline (optionnel)
    "drizzle-orm": "~0.44.0",
    "expo-sqlite": "~15.0.0"
  }
}
```

### C. Architecture des dossiers

```
apps/mobile/
├── app/                    # Routes (Expo Router)
├── components/
│   ├── ui/                 # Composants réutilisables
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   ├── forms/              # Composants de formulaire
│   │   └── LoginForm.tsx
│   └── layout/             # Composants de mise en page
│       ├── Header.tsx
│       └── TabBar.tsx
├── contexts/               # React Contexts
│   ├── auth.tsx
│   └── theme.tsx
├── hooks/                  # Custom hooks
│   ├── useAuth.ts
│   ├── useProducts.ts
│   ├── useOrders.ts
│   └── useCart.ts
├── lib/                    # Utilitaires
│   ├── tuyau.ts            # Client API
│   ├── storage.ts          # Secure storage
│   └── utils.ts
├── data/                   # Couche données
│   ├── local/              # SQLite/Drizzle
│   ├── remote/             # React Query hooks
│   └── sync/               # Synchronisation
├── constants/              # Constantes
│   ├── theme.ts
│   └── config.ts
├── types/                  # Types TypeScript
│   └── index.ts
└── assets/                 # Images, fonts
```

---

## 7. Environnement et outils

### A. Prérequis développement

| Outil | Version | Installation |
|-------|---------|--------------|
| Node.js | >= 20 LTS | `nvm install 20` |
| pnpm | >= 10.18.0 | `npm i -g pnpm` |
| Expo CLI | Latest | Via npx |
| Android Studio | Latest | Pour émulateur |
| Xcode | Latest | Pour simulateur iOS (Mac) |

### B. Configuration ESLint

```javascript
// apps/mobile/eslint.config.js
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
    rules: {
      // Règles personnalisées
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]);
```

### C. Configuration TypeScript

```json
// apps/mobile/tsconfig.json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

### D. Scripts package.json

```json
{
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "expo lint",
    "lint:fix": "expo lint --fix",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "build:preview": "eas build --profile preview",
    "build:prod": "eas build --profile production",
    "submit:ios": "eas submit --platform ios",
    "submit:android": "eas submit --platform android"
  }
}
```

---

## 8. Stratégie de build et déploiement

### A. Fichier eas.json

```json
{
  "cli": {
    "version": ">= 5.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "channel": "production",
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "votre@email.com",
        "ascAppId": "123456789"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

### B. Environnements

| Environnement | Fichier | API URL | Usage |
|---------------|---------|---------|-------|
| Development | `.env` | `http://localhost:3333` | Dev local |
| Preview | `.env.preview` | `https://staging-api.example.com` | Tests internes |
| Production | `.env.production` | `https://api.example.com` | Store |

```bash
# .env (development)
EXPO_PUBLIC_API_URL=http://localhost:3333
EXPO_PUBLIC_ENV=development

# .env.preview
EXPO_PUBLIC_API_URL=https://staging.votre-app.railway.app
EXPO_PUBLIC_ENV=preview

# .env.production
EXPO_PUBLIC_API_URL=https://api.votre-app.com
EXPO_PUBLIC_ENV=production
```

### C. Workflow de release

```
Feature branch
      │
      ▼
   PR Review
      │
      ▼
  Merge → main
      │
      ├──────────────────┐
      ▼                  ▼
 eas build            eas build
 --profile preview    --profile production
      │                  │
      ▼                  ▼
 TestFlight /         App Store /
 Internal Testing     Play Store
```

---

## 9. Sécurité et conformité

### A. Stockage sécurisé

```typescript
// lib/storage.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';

export async function saveToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(TOKEN_KEY);
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken(): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}
```

### B. Variables d'environnement

**Ne JAMAIS commiter** :
- Clés API privées
- Secrets d'authentification
- Credentials de services tiers

```bash
# .gitignore
.env.local
.env.production
*.p8                    # Apple push keys
*.json                  # Service account keys
```

### C. Checklist sécurité

- [ ] Tokens stockés dans SecureStore (pas AsyncStorage)
- [ ] HTTPS uniquement en production
- [ ] Validation des inputs côté client ET serveur
- [ ] Pas de secrets dans le code source
- [ ] Certificate pinning (optionnel, avancé)
- [ ] Obfuscation du code (EAS Build le fait)

### D. Conformité RGPD

Si utilisateurs européens :
- [ ] Écran de consentement cookies/tracking
- [ ] Politique de confidentialité accessible
- [ ] Droit à l'effacement des données
- [ ] Export des données utilisateur

---

## 10. Checklist finale

### Avant `expo init` / `create-expo-app`

#### Produit
- [ ] Objectif de l'app défini
- [ ] Utilisateurs cibles identifiés
- [ ] Fonctionnalités MVP listées
- [ ] Contraintes techniques documentées

#### Navigation
- [ ] Arbre de navigation dessiné
- [ ] Type de navigation choisi (Tabs/Stack/Drawer)
- [ ] Routes protégées identifiées
- [ ] Deep linking planifié

#### Branding
- [ ] App icon (1024x1024)
- [ ] Adaptive icon Android
- [ ] Splash screen
- [ ] Palette de couleurs
- [ ] Typographies choisies

#### Configuration
- [ ] Bundle identifier iOS choisi
- [ ] Package name Android choisi
- [ ] Permissions listées
- [ ] Scheme URL défini

#### Technique
- [ ] Stack technique validé
- [ ] Architecture des dossiers définie
- [ ] Conventions de code établies

#### Déploiement
- [ ] Compte Apple Developer
- [ ] Compte Google Play Console
- [ ] EAS project créé
- [ ] Environnements définis

---

## Commencer le code

Une fois toute la checklist validée :

```bash
# Depuis la racine du monorepo
cd apps/mobile

# Si nouveau projet
npx create-expo-app@latest . --template expo-router

# Installer les dépendances
pnpm install

# Lancer le dev
pnpm start
```

---

## Ressources

- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [App Store Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policies](https://play.google.com/console/about/guides/app-content/)
