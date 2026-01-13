# EAS Build - Configuration Monorepo Expo 54

Guide pour configurer EAS Build dans un monorepo pnpm avec Expo 54.

## Table des matières

1. [Prérequis](#prérequis)
2. [Configuration pas à pas](#configuration-pas-à-pas)
3. [GitHub Actions pour Monorepo](#github-actions-pour-monorepo)
4. [Mises à jour OTA](#mises-à-jour-ota)
5. [Erreurs courantes](#erreurs-courantes)

---

## Prérequis

- Compte [Expo](https://expo.dev)
- Compte [GitHub](https://github.com)
- Node.js >= 20
- pnpm 10.x
- Monorepo avec Expo dans `apps/mobile`

---

## Configuration pas à pas

### Étape 1 : Se connecter à Expo

```bash
# Depuis la racine du monorepo
pnpm --filter mobile exec pnpx eas-cli login
```

Vérifier la connexion :

```bash
pnpm --filter mobile exec pnpx eas-cli whoami
```

### Étape 2 : Initialiser EAS dans le projet mobile

```bash
cd apps/mobile
pnpx eas-cli init --force --non-interactive
```

Cela ajoute le `projectId` dans `app.json`.

### Étape 3 : Configurer app.json

Modifier `apps/mobile/app.json` :

```json
{
  "expo": {
    "name": "Mobile App",
    "slug": "mobile-app",
    "version": "1.0.0",
    "extra": {
      "eas": {
        "projectId": "votre-project-id-ici"
      }
    },
    "android": {
      "package": "com.votrecompte.mobileapp"
    },
    "ios": {
      "bundleIdentifier": "com.votrecompte.mobileapp"
    }
  }
}
```

### Étape 4 : Créer le fichier eas.json

Créer `apps/mobile/eas.json` :

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "base": {
      "node": "20.18.0",
      "pnpm": "10.18.0"
    },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "extends": "base",
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Étape 5 : Configurer pnpm pour EAS (IMPORTANT pour Monorepo)

EAS Build doit savoir comment installer les dépendances dans un monorepo.

Créer `apps/mobile/.easignore` :

```
# Ignorer les autres apps du monorepo pendant le build
../web
../../packages/ui
../../packages/eslint-config
../../packages/typescript-config
```

Créer `apps/mobile/eas-hooks/eas-build-pre-install.sh` :

```bash
#!/bin/bash
set -e

# Installer les dépendances du monorepo depuis la racine
cd ../..
pnpm install --frozen-lockfile

# Revenir dans le dossier mobile
cd apps/mobile
```

Rendre le script exécutable :

```bash
chmod +x apps/mobile/eas-hooks/eas-build-pre-install.sh
```

Mettre à jour `eas.json` pour utiliser le hook :

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "base": {
      "node": "20.18.0",
      "pnpm": "10.18.0",
      "env": {
        "CI": "1"
      }
    },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "extends": "base",
      "android": {
        "buildType": "apk"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Étape 6 : Configurer le Keystore Android

```bash
cd apps/mobile
pnpx eas-cli credentials
```

Sélections :
1. **Platform** → `Android`
2. **Build profile** → `preview`
3. **Action** → `Keystore: Manage everything needed to build your project`
4. **Action** → `Set up a new keystore`
5. **Generate automatically?** → `Yes`
6. **Name** → Appuyer sur Entrée (défaut)

### Étape 7 : Créer le token Expo

1. Aller sur [expo.dev/accounts/[username]/settings/access-tokens](https://expo.dev/settings/access-tokens)
2. Cliquer **Create Token**
3. Nom : `GitHub Actions Monorepo`
4. Copier le token

### Étape 8 : Ajouter le secret GitHub

1. Aller sur `https://github.com/USERNAME/REPO/settings/secrets/actions`
2. Cliquer **New repository secret**
3. Name : `EXPO_TOKEN`
4. Secret : coller le token
5. Cliquer **Add secret**

---

## GitHub Actions pour Monorepo

### Workflow complet

Créer `.github/workflows/eas-build.yml` :

```yaml
name: EAS Build Mobile

on:
  push:
    branches:
      - main
    paths:
      - 'apps/mobile/**'
      - 'packages/**'
      - 'pnpm-lock.yaml'
  workflow_dispatch:
    inputs:
      profile:
        description: 'Build profile'
        required: true
        default: 'preview'
        type: choice
        options:
          - development
          - preview
          - production

jobs:
  build:
    name: Build Android APK
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/mobile

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Get pnpm store directory
        shell: bash
        run: |
          echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Setup pnpm cache
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            ${{ runner.os }}-pnpm-store-

      - name: Install dependencies (root)
        run: pnpm install --frozen-lockfile
        working-directory: .

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build APK
        run: |
          PROFILE=${{ github.event.inputs.profile || 'preview' }}
          eas build --platform android --profile $PROFILE --non-interactive
```

### Workflow avec déclenchement conditionnel

Pour builder uniquement quand `apps/mobile` change :

```yaml
name: EAS Build on Mobile Changes

on:
  push:
    branches: [main]
    paths:
      - 'apps/mobile/**'
  pull_request:
    branches: [main]
    paths:
      - 'apps/mobile/**'

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      mobile: ${{ steps.filter.outputs.mobile }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            mobile:
              - 'apps/mobile/**'
              - 'packages/**'

  build:
    needs: detect-changes
    if: needs.detect-changes.outputs.mobile == 'true'
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/mobile

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: pnpm/action-setup@v4

      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        working-directory: .

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Build Preview APK
        run: eas build --platform android --profile preview --non-interactive
```

---

## Mises à jour OTA

Les mises à jour OTA permettent de déployer du code JS sans rebuild APK.

### Configurer les updates

Dans `apps/mobile/app.json`, ajouter :

```json
{
  "expo": {
    "updates": {
      "url": "https://u.expo.dev/votre-project-id",
      "enabled": true,
      "fallbackToCacheTimeout": 0
    },
    "runtimeVersion": {
      "policy": "sdkVersion"
    }
  }
}
```

### Publier une mise à jour

```bash
cd apps/mobile

# Update pour preview
pnpx eas-cli update --branch preview --message "Fix: correction du bug"

# Update pour production
pnpx eas-cli update --branch production --message "v1.0.1 hotfix"
```

### GitHub Actions pour OTA

Créer `.github/workflows/eas-update.yml` :

```yaml
name: EAS Update (OTA)

on:
  push:
    branches:
      - main
    paths:
      - 'apps/mobile/app/**'
      - 'apps/mobile/lib/**'
      - 'apps/mobile/components/**'
  workflow_dispatch:
    inputs:
      message:
        description: 'Update message'
        required: true
        default: 'Update'

jobs:
  update:
    name: Publish OTA Update
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/mobile

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - uses: pnpm/action-setup@v4

      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        working-directory: .

      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Publish update
        run: |
          MESSAGE="${{ github.event.inputs.message || github.event.head_commit.message }}"
          eas update --branch preview --message "$MESSAGE" --non-interactive
```

### Quand utiliser OTA vs Rebuild ?

| Type de changement | OTA | Rebuild APK |
|--------------------|-----|-------------|
| Code JS/TS | ✅ | ✅ |
| Textes, styles | ✅ | ✅ |
| Images, fonts | ✅ | ✅ |
| React Query, Zustand | ✅ | ✅ |
| **Nouvelle lib native** | ❌ | ✅ |
| **Nouvelles permissions** | ❌ | ✅ |
| **Changement SDK Expo** | ❌ | ✅ |
| **Modification app.json** | ❌ | ✅ |

---

## Commandes utiles

### Build local (cloud Expo)

```bash
cd apps/mobile

# Build development (avec dev client)
pnpx eas-cli build --platform android --profile development

# Build preview (APK de test)
pnpx eas-cli build --platform android --profile preview

# Build production
pnpx eas-cli build --platform android --profile production
```

### Gestion des builds

```bash
# Lister les builds
pnpx eas-cli build:list

# Voir le dernier build
pnpx eas-cli build:view

# Annuler un build en cours
pnpx eas-cli build:cancel
```

### Gestion des credentials

```bash
# Voir/modifier les credentials
pnpx eas-cli credentials

# Synchroniser les credentials
pnpx eas-cli credentials:sync
```

---

## Erreurs courantes

### Erreur 1 : "Cannot resolve workspace dependency"

```
ERR_PNPM_NO_MATCHING_VERSION: No matching version found for @workspace/...
```

**Solution** : EAS doit avoir accès au monorepo complet.

Vérifier que le `pnpm-workspace.yaml` est à la racine et que le build part de la racine.

### Erreur 2 : "Generating Keystore not supported in non-interactive"

**Solution** : Créer le keystore localement avant le CI.

```bash
cd apps/mobile
pnpx eas-cli credentials
```

### Erreur 3 : "EXPO_TOKEN secret not found"

**Solution** : Vérifier le secret dans GitHub Settings → Secrets and variables → Actions.

### Erreur 4 : "android.package required"

**Solution** : Ajouter dans `apps/mobile/app.json` :

```json
{
  "expo": {
    "android": {
      "package": "com.votrecompte.appname"
    }
  }
}
```

### Erreur 5 : Build échoue avec pnpm dans monorepo

**Solution** : Ajouter la config pnpm dans `eas.json` :

```json
{
  "build": {
    "base": {
      "node": "20.18.0",
      "pnpm": "10.18.0"
    }
  }
}
```

---

## Structure finale

```
first-deploy-adonis/
├── .github/
│   └── workflows/
│       ├── eas-build.yml      # Build APK
│       └── eas-update.yml     # OTA updates
├── apps/
│   ├── mobile/
│   │   ├── app.json           # Config Expo + projectId
│   │   ├── eas.json           # Config EAS Build
│   │   └── ...
│   └── web/
├── packages/
├── pnpm-workspace.yaml
└── package.json
```

---

## Ressources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Build for Monorepos](https://docs.expo.dev/build-reference/build-with-monorepos/)
- [EAS Update (OTA)](https://docs.expo.dev/eas-update/introduction/)
- [GitHub Actions for Expo](https://github.com/expo/expo-github-action)