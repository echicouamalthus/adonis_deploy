# Stratégie de Test pour App Expo

Ce guide détaille la stratégie de test complète pour une application Expo + Expo Router, avec focus sur **Maestro** pour les tests E2E.

> **Règle d'or** : 60% tests manuels, 25% tests E2E (Maestro), 15% tests unitaires

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Tests manuels](#2-tests-manuels)
3. [Tests unitaires](#3-tests-unitaires)
4. [Tests d'intégration](#4-tests-dintégration)
5. [Tests E2E avec Maestro](#5-tests-e2e-avec-maestro)
6. [Intégration CI/CD](#6-intégration-cicd)
7. [Checklist avant release](#7-checklist-avant-release)

---

## 1. Vue d'ensemble

### Les 4 niveaux de test

| Niveau | Objectif | Outils | Quand |
|--------|----------|--------|-------|
| Tests manuels | Vérifier l'UX | Expo Go / Simulateur | Continu |
| Tests unitaires | Logique métier | Jest | Après chaque feature |
| Tests d'intégration | Navigation / Composants | Jest + RNTL | Avant PR |
| Tests E2E | Parcours utilisateur | **Maestro** | Avant release |

### Pyramide de test adaptée au mobile

```
          ┌─────────┐
          │  E2E    │  ← Maestro (parcours critiques)
          │  25%    │
       ┌──┴─────────┴──┐
       │  Intégration  │  ← Jest + RNTL
       │     15%       │
    ┌──┴───────────────┴──┐
    │    Tests manuels    │  ← Expo Go / Simulateurs
    │        60%          │
    └─────────────────────┘
```

### Pertinence pour ce projet (OCPV AgriConnect)

| Aspect | Importance des tests | Raison |
|--------|---------------------|--------|
| Authentification | Critique | Sécurité des données agents |
| Mode offline | Haute | Zones rurales sans réseau |
| Sync données | Haute | Intégrité des convoyages |
| Navigation | Moyenne | UX fluide |
| Formulaires | Moyenne | Validation des saisies |

---

## 2. Tests manuels

### Quand les utiliser

- Développement initial de chaque écran
- Vérification UX/UI
- Tests exploratoires
- Debug de problèmes visuels

### Checklist tests manuels

#### Navigation
- [ ] Toutes les routes accessibles
- [ ] Back button fonctionne
- [ ] Deep links fonctionnent
- [ ] Tabs navigation fluide

#### États d'écran
- [ ] États vides (pas de données)
- [ ] États de chargement
- [ ] États d'erreur
- [ ] Listes longues (scroll)

#### Responsive
- [ ] Portrait / Paysage
- [ ] Différentes tailles d'écran
- [ ] Notch / Dynamic Island
- [ ] Safe areas

#### Modes
- [ ] Mode clair
- [ ] Mode sombre
- [ ] Mode offline
- [ ] Faible connectivité

#### Plateformes
- [ ] iOS Simulator
- [ ] Android Emulator
- [ ] Device physique iOS
- [ ] Device physique Android

### Outils

```bash
# Lancer sur iOS Simulator
pnpm --filter mobile run ios

# Lancer sur Android Emulator
pnpm --filter mobile run android

# Expo Go (device physique)
pnpm --filter mobile run start
# Scanner le QR code
```

---

## 3. Tests unitaires

### Ce qu'on teste

- Fonctions utilitaires pures
- Validation Zod
- Formatage de données
- Calculs métier
- Helpers

### Installation

```bash
pnpm --filter mobile add -D jest @types/jest ts-jest
```

### Configuration

```javascript
// apps/mobile/jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
```

```javascript
// apps/mobile/jest.setup.js
import '@testing-library/jest-native/extend-expect';
```

### Exemples de tests

#### Test de fonction utilitaire

```typescript
// lib/__tests__/utils.test.ts
import { guardAsync, generateLocalId } from '../utils';

describe('guardAsync', () => {
  it('returns [result, null] on success', async () => {
    const promise = Promise.resolve('success');
    const [result, error] = await guardAsync(promise);

    expect(result).toBe('success');
    expect(error).toBeNull();
  });

  it('returns [null, error] on failure', async () => {
    const promise = Promise.reject(new Error('failed'));
    const [result, error] = await guardAsync(promise);

    expect(result).toBeNull();
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('failed');
  });
});

describe('generateLocalId', () => {
  it('generates unique IDs', () => {
    const id1 = generateLocalId();
    const id2 = generateLocalId();

    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^local_\d+_[a-z0-9]+$/);
  });
});
```

#### Test de validation Zod

```typescript
// lib/__tests__/validators.test.ts
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Minimum 8 caractères'),
});

describe('loginSchema', () => {
  it('validates correct input', () => {
    const result = loginSchema.safeParse({
      email: 'agent@ocpv.com',
      password: 'password123',
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid-email',
      password: 'password123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Email invalide');
    }
  });

  it('rejects short password', () => {
    const result = loginSchema.safeParse({
      email: 'agent@ocpv.com',
      password: '123',
    });

    expect(result.success).toBe(false);
  });
});
```

#### Test de formatage

```typescript
// lib/__tests__/formatters.test.ts
import { formatDate, formatWeight, formatConvoyageId } from '../formatters';

describe('formatDate', () => {
  it('formats ISO date to FR locale', () => {
    const result = formatDate('2026-01-14T00:00:00.000Z');
    expect(result).toBe('14/01/2026');
  });

  it('handles invalid date', () => {
    const result = formatDate('invalid');
    expect(result).toBe('Date invalide');
  });
});

describe('formatWeight', () => {
  it('formats weight with unit', () => {
    expect(formatWeight(500)).toBe('500.00 kg');
    expect(formatWeight(1500)).toBe('1.50 t');
  });
});

describe('formatConvoyageId', () => {
  it('truncates long IDs', () => {
    const longId = 'CNVZONE_S-MAR_CENT-20260114-003';
    expect(formatConvoyageId(longId, 20)).toBe('CNVZONE_S-MAR_CEN...');
  });
});
```

### Script package.json

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

---

## 4. Tests d'intégration

### Ce qu'on teste

- Rendu des composants
- Interactions utilisateur
- Navigation entre écrans
- États de chargement/erreur
- Formulaires

### Installation

```bash
pnpm --filter mobile add -D @testing-library/react-native @testing-library/jest-native
```

### Exemples de tests

#### Test de composant

```typescript
// components/__tests__/ConvoyageCard.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ConvoyageCard } from '../ConvoyageCard';

const mockConvoyage = {
  id: 'CNV-001',
  title: 'CNVZONE_S-MAR_CENT-20260114-003',
  origin: 'Zone Sud',
  destination: 'Marché Central',
  status: 'pending',
  weight: 500,
  date: '2026-01-14T00:00:00.000Z',
};

describe('ConvoyageCard', () => {
  it('renders convoyage information', () => {
    render(<ConvoyageCard convoyage={mockConvoyage} />);

    expect(screen.getByText(/Zone Sud/)).toBeTruthy();
    expect(screen.getByText(/Marché Central/)).toBeTruthy();
    expect(screen.getByText(/500/)).toBeTruthy();
  });

  it('shows pending badge for pending status', () => {
    render(<ConvoyageCard convoyage={mockConvoyage} />);

    expect(screen.getByText(/En attente/i)).toBeTruthy();
  });

  it('shows arrived badge for completed status', () => {
    render(
      <ConvoyageCard
        convoyage={{ ...mockConvoyage, status: 'completed' }}
      />
    );

    expect(screen.getByText(/Arrivé/i)).toBeTruthy();
  });
});
```

#### Test de formulaire

```typescript
// components/__tests__/LoginForm.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { LoginForm } from '../LoginForm';

describe('LoginForm', () => {
  const mockOnSubmit = jest.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders email and password inputs', () => {
    render(<LoginForm onSubmit={mockOnSubmit} />);

    expect(screen.getByPlaceholderText(/email/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/mot de passe/i)).toBeTruthy();
  });

  it('shows validation errors for empty fields', async () => {
    render(<LoginForm onSubmit={mockOnSubmit} />);

    fireEvent.press(screen.getByText(/se connecter/i));

    await waitFor(() => {
      expect(screen.getByText(/email requis/i)).toBeTruthy();
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('submits with valid data', async () => {
    render(<LoginForm onSubmit={mockOnSubmit} />);

    fireEvent.changeText(
      screen.getByPlaceholderText(/email/i),
      'agent@ocpv.com'
    );
    fireEvent.changeText(
      screen.getByPlaceholderText(/mot de passe/i),
      'password123'
    );
    fireEvent.press(screen.getByText(/se connecter/i));

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        email: 'agent@ocpv.com',
        password: 'password123',
      });
    });
  });
});
```

#### Test avec React Query

```typescript
// hooks/__tests__/useConvoyages.test.tsx
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useConvoyages } from '../useConvoyages';

// Mock Tuyau
jest.mock('@/lib/tuyau', () => ({
  tuyau: {
    api: {
      convoyages: {
        $get: jest.fn(),
      },
    },
  },
}));

import { tuyau } from '@/lib/tuyau';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useConvoyages', () => {
  it('returns convoyages on success', async () => {
    const mockData = {
      data: {
        convoyages: [
          { id: '1', title: 'Convoyage 1' },
          { id: '2', title: 'Convoyage 2' },
        ],
      },
      error: null,
    };

    (tuyau.api.convoyages.$get as jest.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useConvoyages(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
  });
});
```

---

## 5. Tests E2E avec Maestro

### Pourquoi Maestro ?

| Avantage | Description |
|----------|-------------|
| Simple | Syntaxe YAML intuitive |
| Rapide | Pas de compilation complexe |
| Compatible Expo | Fonctionne avec Expo Go et builds |
| CI-ready | Facile à intégrer en CI/CD |
| Visuel | Enregistrement vidéo des tests |

### Installation

```bash
# macOS
brew install maestro

# Linux / WSL
curl -fsSL https://get.maestro.mobile.dev | bash

# Vérifier l'installation
maestro --version
```

### Structure des fichiers

```
apps/mobile/
├── .maestro/
│   ├── config.yaml           # Configuration globale
│   ├── flows/
│   │   ├── auth/
│   │   │   ├── login.yaml
│   │   │   ├── logout.yaml
│   │   │   └── forgot-password.yaml
│   │   ├── convoyages/
│   │   │   ├── view-list.yaml
│   │   │   ├── view-detail.yaml
│   │   │   └── mark-arrived.yaml
│   │   └── navigation/
│   │       ├── tabs.yaml
│   │       └── deep-links.yaml
│   └── utils/
│       └── login-helper.yaml
```

### Configuration globale

```yaml
# apps/mobile/.maestro/config.yaml
appId: com.ocpv.agriconnect
name: OCPV AgriConnect E2E Tests

# Variables d'environnement pour les tests
env:
  TEST_EMAIL: agent.test@ocpv.com
  TEST_PASSWORD: TestPassword123!
  API_URL: http://localhost:3333
```

### Flows de test

#### Test de login

```yaml
# .maestro/flows/auth/login.yaml
appId: com.ocpv.agriconnect
name: Login Flow
---
# Lancer l'app
- launchApp:
    clearState: true

# Attendre l'écran de login
- assertVisible: "Se connecter"

# Remplir le formulaire
- tapOn: "Email"
- inputText: ${TEST_EMAIL}

- tapOn: "Mot de passe"
- inputText: ${TEST_PASSWORD}

# Soumettre
- tapOn: "Se connecter"

# Vérifier la redirection vers l'accueil
- assertVisible:
    text: "Mes convoyages"
    timeout: 10000

# Vérifier que le header affiche le bon rôle
- assertVisible: "Agent de Convoyage"
```

#### Test de logout

```yaml
# .maestro/flows/auth/logout.yaml
appId: com.ocpv.agriconnect
name: Logout Flow
---
# Pré-requis : être connecté
- runFlow: ../utils/login-helper.yaml

# Aller sur le profil
- tapOn: "Profil"

# Attendre le chargement
- assertVisible: "Mon profil"

# Défiler vers le bas si nécessaire
- scroll:
    direction: DOWN

# Taper sur déconnexion
- tapOn: "Se déconnecter"

# Confirmer dans la modal
- tapOn: "Confirmer"

# Vérifier le retour à l'écran de login
- assertVisible: "Se connecter"
```

#### Test de navigation tabs

```yaml
# .maestro/flows/navigation/tabs.yaml
appId: com.ocpv.agriconnect
name: Tabs Navigation
---
- runFlow: ../utils/login-helper.yaml

# Tab Accueil (par défaut)
- assertVisible: "Mes convoyages"

# Tab Historique
- tapOn:
    id: "tab-history"
- assertVisible: "Historique des convoyages"

# Tab Profil
- tapOn:
    id: "tab-profile"
- assertVisible: "Mon profil"

# Retour Accueil
- tapOn:
    id: "tab-home"
- assertVisible: "Mes convoyages"
```

#### Test parcours convoyage complet

```yaml
# .maestro/flows/convoyages/mark-arrived.yaml
appId: com.ocpv.agriconnect
name: Mark Convoyage as Arrived
---
- runFlow: ../utils/login-helper.yaml

# Vérifier qu'il y a des convoyages assignés
- assertVisible: "Convoyages assignés"

# Taper sur le premier convoyage
- tapOn:
    text: "CNVZONE.*"
    index: 0

# Attendre l'écran de détail
- assertVisible: "Détail du convoyage"

# Vérifier les informations
- assertVisible: "Zone Sud"
- assertVisible: "Marché Central"

# Taper sur "Marquer arrivé"
- tapOn: "Marquer arrivé"

# Confirmer
- tapOn: "Confirmer l'arrivée"

# Attendre la confirmation
- assertVisible:
    text: "Convoyage terminé"
    timeout: 5000

# Vérifier le badge mis à jour
- assertVisible: "Arrivé"
```

#### Test mode offline

```yaml
# .maestro/flows/offline/offline-mode.yaml
appId: com.ocpv.agriconnect
name: Offline Mode Test
---
- runFlow: ../utils/login-helper.yaml

# Désactiver le réseau
- toggleAirplaneMode

# L'app doit afficher l'indicateur offline
- assertVisible:
    text: "Mode hors ligne"
    timeout: 3000

# Les données en cache doivent être visibles
- assertVisible: "Mes convoyages"

# Tenter une action
- tapOn:
    text: "CNVZONE.*"
    index: 0

# L'action doit être mise en queue
- tapOn: "Marquer arrivé"
- tapOn: "Confirmer"

# Message de sync en attente
- assertVisible: "Synchronisation en attente"

# Réactiver le réseau
- toggleAirplaneMode

# Attendre la sync
- assertVisible:
    text: "Synchronisé"
    timeout: 10000
```

#### Helper réutilisable

```yaml
# .maestro/utils/login-helper.yaml
appId: com.ocpv.agriconnect
name: Login Helper
---
- launchApp:
    clearState: true

- tapOn: "Email"
- inputText: ${TEST_EMAIL}

- tapOn: "Mot de passe"
- inputText: ${TEST_PASSWORD}

- tapOn: "Se connecter"

- assertVisible:
    text: "Mes convoyages"
    timeout: 10000
```

### Rendre l'app testable

#### Ajouter des accessibilityLabel

```tsx
// components/ui/Button.tsx
import { Pressable, Text } from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  testID?: string;
}

export function Button({ title, onPress, testID }: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={testID || title}
      accessibilityRole="button"
    >
      <Text>{title}</Text>
    </Pressable>
  );
}
```

#### Ajouter des testID sur les tabs

```tsx
// app/(app)/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarTestID: 'tab-home',
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Historique',
          tabBarTestID: 'tab-history',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarTestID: 'tab-profile',
        }}
      />
    </Tabs>
  );
}
```

### Exécuter les tests

```bash
# Lancer un test spécifique
maestro test .maestro/flows/auth/login.yaml

# Lancer tous les tests
maestro test .maestro/flows/

# Lancer avec enregistrement vidéo
maestro test --format junit --output results.xml .maestro/flows/

# Mode studio (debug interactif)
maestro studio
```

### Variables d'environnement

```bash
# Définir les variables pour les tests
export TEST_EMAIL="agent.test@ocpv.com"
export TEST_PASSWORD="TestPassword123!"

# Ou via fichier .env.maestro
maestro test --env .env.maestro .maestro/flows/
```

---

## 6. Intégration CI/CD

### GitHub Actions

```yaml
# .github/workflows/mobile-e2e.yml
name: Mobile E2E Tests

on:
  pull_request:
    paths:
      - 'apps/mobile/**'
  push:
    branches: [main]
    paths:
      - 'apps/mobile/**'

jobs:
  maestro-tests:
    runs-on: macos-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install

      - name: Install Maestro
        run: |
          curl -fsSL https://get.maestro.mobile.dev | bash
          echo "$HOME/.maestro/bin" >> $GITHUB_PATH

      - name: Start iOS Simulator
        run: |
          xcrun simctl boot "iPhone 15"
          xcrun simctl bootstatus "iPhone 15"

      - name: Build Expo app
        run: |
          cd apps/mobile
          npx expo prebuild --platform ios
          npx expo run:ios --configuration Release

      - name: Run Maestro tests
        env:
          TEST_EMAIL: ${{ secrets.TEST_EMAIL }}
          TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
        run: |
          maestro test apps/mobile/.maestro/flows/ \
            --format junit \
            --output test-results.xml

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: maestro-results
          path: test-results.xml
```

### EAS Build avec tests

```json
// eas.json
{
  "build": {
    "test": {
      "ios": {
        "simulator": true,
        "buildType": "release"
      },
      "env": {
        "EXPO_PUBLIC_ENV": "test"
      }
    }
  }
}
```

---

## 7. Checklist avant release

### Tests manuels obligatoires

- [ ] Login / Logout fonctionne
- [ ] Navigation tabs fluide
- [ ] Affichage liste convoyages
- [ ] Détail convoyage accessible
- [ ] Action "Marquer arrivé" fonctionne
- [ ] Mode offline (données en cache)
- [ ] Retour online (sync)
- [ ] Permissions (caméra, localisation)
- [ ] Mode sombre
- [ ] Rotation écran (si supporté)

### Tests E2E Maestro

- [ ] `login.yaml` : Connexion réussie
- [ ] `logout.yaml` : Déconnexion + retour login
- [ ] `tabs.yaml` : Navigation entre onglets
- [ ] `view-list.yaml` : Liste des convoyages visible
- [ ] `view-detail.yaml` : Détail d'un convoyage
- [ ] `mark-arrived.yaml` : Parcours complet arrivée
- [ ] `offline-mode.yaml` : Mode hors ligne

### Tests unitaires

- [ ] Validation Zod (schemas)
- [ ] Formatters (dates, poids, IDs)
- [ ] Helpers (guardAsync, generateId)
- [ ] Hooks critiques

### Métriques de couverture

| Type | Objectif minimum |
|------|------------------|
| Unitaires | 70% des utils/helpers |
| Intégration | Composants critiques |
| E2E | 100% des parcours critiques |

---

## Alternatives à Maestro

| Outil | Quand l'utiliser |
|-------|------------------|
| **Detox** | App très complexe, besoin de contrôle fin |
| **Appium** | Tests cross-platform avec même code |
| **Playwright** | Expo Web uniquement |
| **Cypress** | Backend AdonisJS / API tests |

Pour ce projet, **Maestro est recommandé** car :
- Syntaxe simple (YAML)
- Rapide à mettre en place
- Compatible Expo Router
- Parfait pour CI/CD avec EAS

---

## Ressources

- [Maestro Documentation](https://maestro.mobile.dev/)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Jest Expo](https://docs.expo.dev/develop/unit-testing/)
- [EAS Build](https://docs.expo.dev/build/introduction/)