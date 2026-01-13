# Configuration Husky - Monorepo Pre-commit Hooks

Ce guide détaille l'implémentation de Husky dans le monorepo pour automatiser les vérifications avant chaque commit et push.

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Prérequis](#prérequis)
3. [Installation pas à pas](#installation-pas-à-pas)
4. [Fichiers de configuration](#fichiers-de-configuration)
5. [Commandes pour push le projet](#commandes-pour-push-le-projet)
6. [Erreurs rencontrées et solutions](#erreurs-rencontrées-et-solutions)
7. [Règles par application](#règles-par-application)

---

## Vue d'ensemble

### Architecture des hooks

```
┌─────────────────────────────────────────────────────────────┐
│                        Git Hooks                             │
├─────────────────────────────────────────────────────────────┤
│  pre-commit          │  Avant chaque commit                 │
│  ├── lint-staged     │  Lint/format des fichiers stagés     │
│  └── precommit.mjs   │  TypeScript + ESLint par app         │
├─────────────────────────────────────────────────────────────┤
│  pre-push            │  Avant chaque push                   │
│  └── prepush.mjs     │  Build + Tests                       │
└─────────────────────────────────────────────────────────────┘
```

### Flux de travail

```
git add . → git commit → pre-commit hook
                              ↓
                    lint-staged (format)
                              ↓
                    precommit.mjs (typecheck + lint)
                              ↓
                         Commit créé
                              ↓
git push → pre-push hook → prepush.mjs (build + test) → Push effectué
```

---

## Prérequis

- Node.js >= 20
- pnpm 10.x
- Git

---

## Installation pas à pas

### Étape 1 : Installer les dépendances

```bash
pnpm add -D husky lint-staged -w
```

### Étape 2 : Initialiser Husky

```bash
pnpm exec husky init
```

Cela crée le dossier `.husky/` avec un fichier `pre-commit` par défaut.

### Étape 3 : Créer le dossier scripts

```bash
mkdir -p scripts
```

### Étape 4 : Configurer le fichier `.husky/pre-commit`

Remplacer le contenu par :

```bash
#!/bin/sh

echo "🔍 Running pre-commit checks..."

# Exécuter lint-staged sur les fichiers modifiés
pnpm exec lint-staged

# Exécuter le script de vérification personnalisé
pnpm run precommit
```

### Étape 5 : Créer le fichier `.husky/pre-push`

```bash
#!/bin/sh

echo "🚀 Running pre-push checks..."

# Exécuter le script de vérification avant push
pnpm run prepush
```

### Étape 6 : Réinstaller les dépendances

**IMPORTANT** : Pour que les commandes `tsc` et `eslint` fonctionnent dans chaque app, réinstallez les dépendances :

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

### Étape 7 : Tester les hooks

```bash
# Tester le script precommit manuellement
pnpm run precommit

# Tester lint-staged (nécessite des fichiers stagés)
git add .
pnpm exec lint-staged
```

---

## Fichiers de configuration

### Structure des fichiers

```
first-deploy-adonis/
├── .husky/
│   ├── pre-commit          # Hook pre-commit
│   └── pre-push            # Hook pre-push
├── scripts/
│   ├── precommit.mjs       # Vérifications pre-commit
│   └── prepush.mjs         # Vérifications pre-push
└── package.json            # Config lint-staged
```

---

### 1. package.json (racine) - Configuration actuelle

```json
{
  "name": "first-deploy-adonis",
  "version": "0.0.2",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "format": "prettier --write \"**/*.{ts,tsx,md}\"",
    "typecheck": "turbo typecheck",
    "docker:prod": "docker compose -f docker-compose.yaml -f docker-compose.prod.yaml up -d",
    "prepare": "husky",
    "precommit": "node scripts/precommit.mjs",
    "prepush": "node scripts/prepush.mjs"
  },
  "devDependencies": {
    "@workspace/eslint-config": "workspace:*",
    "@workspace/typescript-config": "workspace:*",
    "husky": "^9.1.7",
    "lint-staged": "^16.2.7",
    "prettier": "^3.6.2",
    "turbo": "^2.5.8",
    "typescript": "~5.9.3"
  },
  "lint-staged": {
    "apps/web/**/*.{ts,tsx}": [
      "eslint --fix --config apps/web/eslint.config.js",
      "prettier --write"
    ],
    "apps/mobile/**/*.{ts,tsx}": [
      "eslint --fix --config apps/mobile/eslint.config.js",
      "prettier --write"
    ],
    "packages/**/*.{ts,tsx}": [
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

**Note importante** : La config `lint-staged` utilise `--config` pour pointer vers le fichier ESLint de chaque app car ESLint v9+ ne trouve pas automatiquement la config depuis la racine du monorepo.

---

### 2. .husky/pre-commit

```bash
#!/bin/sh

echo "🔍 Running pre-commit checks..."

# Exécuter lint-staged sur les fichiers modifiés
pnpm exec lint-staged

# Exécuter le script de vérification personnalisé
pnpm run precommit
```

---

### 3. .husky/pre-push

```bash
#!/bin/sh

echo "🚀 Running pre-push checks..."

# Exécuter le script de vérification avant push
pnpm run prepush
```

---

### 4. scripts/precommit.mjs

```javascript
#!/usr/bin/env node

/**
 * Script de pre-commit pour monorepo
 * Détecte les fichiers modifiés et exécute les vérifications appropriées
 */

import { execSync } from 'node:child_process';

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    return false;
  }
}

function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function detectChangedApps(files) {
  const apps = {
    web: false,
    mobile: false,
    packages: false,
  };

  for (const file of files) {
    if (file.startsWith('apps/web/')) apps.web = true;
    if (file.startsWith('apps/mobile/')) apps.mobile = true;
    if (file.startsWith('packages/')) apps.packages = true;
  }

  return apps;
}

async function main() {
  log('\n📋 Pre-commit Hook - Monorepo\n', 'cyan');

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    log('✅ No staged files to check', 'green');
    process.exit(0);
  }

  log(`📁 Staged files: ${stagedFiles.length}`, 'blue');

  const changedApps = detectChangedApps(stagedFiles);

  let hasErrors = false;

  // Vérifications pour apps/web (AdonisJS)
  if (changedApps.web) {
    log('\n🌐 Checking apps/web (AdonisJS)...', 'yellow');

    // TypeScript check
    log('  → TypeScript check...', 'blue');
    if (!exec('pnpm --filter web run typecheck')) {
      log('  ❌ TypeScript errors in apps/web', 'red');
      hasErrors = true;
    } else {
      log('  ✅ TypeScript OK', 'green');
    }

    // ESLint check
    log('  → ESLint check...', 'blue');
    if (!exec('pnpm --filter web run lint')) {
      log('  ❌ ESLint errors in apps/web', 'red');
      hasErrors = true;
    } else {
      log('  ✅ ESLint OK', 'green');
    }
  }

  // Vérifications pour apps/mobile (Expo)
  if (changedApps.mobile) {
    log('\n📱 Checking apps/mobile (Expo)...', 'yellow');

    // ESLint check
    log('  → ESLint check...', 'blue');
    if (!exec('pnpm --filter mobile run lint')) {
      log('  ❌ ESLint errors in apps/mobile', 'red');
      hasErrors = true;
    } else {
      log('  ✅ ESLint OK', 'green');
    }
  }

  // Vérifications pour packages
  if (changedApps.packages) {
    log('\n📦 Checking packages...', 'yellow');

    // Build packages pour vérifier les erreurs
    log('  → Building packages...', 'blue');
    if (!exec('pnpm --filter "./packages/*" run build')) {
      log('  ❌ Build errors in packages', 'red');
      hasErrors = true;
    } else {
      log('  ✅ Packages build OK', 'green');
    }
  }

  // Résultat final
  console.log('\n' + '─'.repeat(50) + '\n');

  if (hasErrors) {
    log('❌ Pre-commit checks failed. Please fix the errors above.', 'red');
    process.exit(1);
  } else {
    log('✅ All pre-commit checks passed!', 'green');
    process.exit(0);
  }
}

main().catch((error) => {
  log(`❌ Error: ${error.message}`, 'red');
  process.exit(1);
});
```

---

### 5. scripts/prepush.mjs

```javascript
#!/usr/bin/env node

/**
 * Script de pre-push pour monorepo
 * Exécute les builds et tests avant le push
 */

import { execSync } from 'node:child_process';

// Couleurs pour le terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    return false;
  }
}

function getChangedFilesSinceRemote() {
  try {
    const output = execSync('git diff --name-only @{push}..HEAD 2>/dev/null || git diff --name-only HEAD~10..HEAD', {
      encoding: 'utf-8'
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    try {
      const output = execSync('git diff --name-only HEAD~5..HEAD', { encoding: 'utf-8' });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

function detectChangedApps(files) {
  const apps = {
    web: false,
    mobile: false,
    packages: false,
  };

  for (const file of files) {
    if (file.startsWith('apps/web/')) apps.web = true;
    if (file.startsWith('apps/mobile/')) apps.mobile = true;
    if (file.startsWith('packages/')) apps.packages = true;
  }

  return apps;
}

async function main() {
  log('\n🚀 Pre-push Hook - Monorepo\n', 'cyan');

  const changedFiles = getChangedFilesSinceRemote();

  if (changedFiles.length === 0) {
    log('✅ No changes to verify', 'green');
    process.exit(0);
  }

  log(`📁 Changed files since last push: ${changedFiles.length}`, 'blue');

  const changedApps = detectChangedApps(changedFiles);

  let hasErrors = false;

  // Build et tests pour apps/web (AdonisJS)
  if (changedApps.web) {
    log('\n🌐 Building and testing apps/web (AdonisJS)...', 'yellow');

    // Build
    log('  → Building...', 'blue');
    if (!exec('pnpm --filter web run build')) {
      log('  ❌ Build failed for apps/web', 'red');
      hasErrors = true;
    } else {
      log('  ✅ Build OK', 'green');
    }

    // Tests (si disponibles)
    log('  → Running tests...', 'blue');
    if (!exec('pnpm --filter web run test')) {
      log('  ❌ Tests failed for apps/web', 'red');
      hasErrors = true;
    } else {
      log('  ✅ Tests OK', 'green');
    }
  }

  // Build pour apps/mobile (Expo)
  if (changedApps.mobile) {
    log('\n📱 Checking apps/mobile (Expo)...', 'yellow');

    log('  → Checking TypeScript...', 'blue');
    if (!exec('pnpm --filter mobile run lint')) {
      log('  ❌ Lint failed for apps/mobile', 'red');
      hasErrors = true;
    } else {
      log('  ✅ Lint OK', 'green');
    }
  }

  // Build des packages
  if (changedApps.packages) {
    log('\n📦 Building packages...', 'yellow');

    if (!exec('pnpm --filter "./packages/*" run build')) {
      log('  ❌ Build failed for packages', 'red');
      hasErrors = true;
    } else {
      log('  ✅ Packages build OK', 'green');
    }
  }

  // Résultat final
  console.log('\n' + '─'.repeat(50) + '\n');

  if (hasErrors) {
    log('❌ Pre-push checks failed. Push aborted.', 'red');
    log('   Fix the errors above and try again.', 'yellow');
    process.exit(1);
  } else {
    log('✅ All pre-push checks passed! Pushing...', 'green');
    process.exit(0);
  }
}

main().catch((error) => {
  log(`❌ Error: ${error.message}`, 'red');
  process.exit(1);
});
```

---

## Commandes pour push le projet

### Push normal (avec hooks Husky)

```bash
# 1. Stager tous les fichiers modifiés
git add .

# 2. Commiter (déclenche automatiquement pre-commit)
git commit -m "feat: description du changement"

# 3. Pusher (déclenche automatiquement pre-push)
git push
```

### Push en urgence (bypass des hooks)

```bash
# Bypass pre-commit uniquement
git commit --no-verify -m "hotfix: correction urgente"

# Bypass pre-push uniquement
git push --no-verify

# Bypass les deux
git commit --no-verify -m "hotfix: urgent"
git push --no-verify
```

### Désactiver temporairement Husky

```bash
HUSKY=0 git commit -m "skip all hooks"
HUSKY=0 git push
```

---

## Erreurs rencontrées et solutions

### Erreur 1 : "Cannot find module typescript/bin/tsc"

```
Error: Cannot find module 'D:\...\apps\web\node_modules\typescript\bin\tsc'
```

**Cause** : Les dépendances ne sont pas correctement liées dans le monorepo avec `nodeLinker: hoisted`.

**Solution** :
```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

---

### Erreur 2 : "ESLint couldn't find an eslint.config.js file"

```
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

**Cause** : lint-staged exécute ESLint depuis la racine du monorepo, mais chaque app a sa propre config ESLint.

**Solution** : Spécifier le chemin de la config dans lint-staged :
```json
"lint-staged": {
  "apps/web/**/*.{ts,tsx}": [
    "eslint --fix --config apps/web/eslint.config.js",
    "prettier --write"
  ],
  "apps/mobile/**/*.{ts,tsx}": [
    "eslint --fix --config apps/mobile/eslint.config.js",
    "prettier --write"
  ]
}
```

---

### Erreur 3 : "lint-staged could not find any staged files"

```
→ lint-staged could not find any staged files.
```

**Cause** : Aucun fichier n'a été ajouté avec `git add` avant d'exécuter lint-staged.

**Solution** :
```bash
git add .
pnpm exec lint-staged
```

---

### Erreur 4 : "Identifier 'execSync' has already been declared"

```
SyntaxError: Identifier 'execSync' has already been declared
```

**Cause** : Le code de `prepush.mjs` a été accidentellement copié dans `precommit.mjs`, créant des imports dupliqués.

**Solution** : S'assurer que chaque fichier (`precommit.mjs` et `prepush.mjs`) est un fichier séparé avec son propre contenu.

---

### Erreur 5 : Les hooks ne s'exécutent pas

**Cause** : Husky n'est pas initialisé ou les fichiers hooks sont mal configurés.

**Solution** :
```bash
# Vérifier que .husky existe
ls -la .husky/

# Réinitialiser si nécessaire
rm -rf .husky
pnpm exec husky init

# Recréer les fichiers pre-commit et pre-push manuellement
```

---

## Règles par application

| Application | Pre-commit | Pre-push |
|-------------|------------|----------|
| `apps/web` | typecheck, lint, format | build, test |
| `apps/mobile` | lint, format | lint |
| `packages/*` | format | build |

---

## Ressources

- [Husky Documentation](https://typicode.github.io/husky/)
- [lint-staged](https://github.com/lint-staged/lint-staged)
- [Article original](https://93days.me/monorepo-pre-commit-hooks-with-husky)