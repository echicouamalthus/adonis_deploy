# Guide de Déploiement sur Railway

Ce document décrit toutes les étapes réalisées pour déployer ce projet AdonisJS monorepo sur Railway.

---

## Table des matières

1. [Architecture du projet](#architecture-du-projet)
2. [Fichiers de configuration créés](#fichiers-de-configuration-créés)
3. [Modifications du code](#modifications-du-code)
4. [Configuration Railway](#configuration-railway)
5. [Variables d'environnement](#variables-denvironnement)
6. [Commandes de déploiement](#commandes-de-déploiement)
7. [Dépannage](#dépannage)

---

## Architecture du projet

Ce projet est un **monorepo pnpm + Turborepo** avec la structure suivante :

```
first-deploy-adonis/
├── apps/
│   └── web/                    # Application AdonisJS principale
├── packages/
│   ├── eslint-config/          # Configuration ESLint partagée
│   ├── typescript-config/      # Configuration TypeScript partagée
│   └── ui/                     # Composants React partagés
├── railway.toml                # Configuration Railway
├── pnpm-workspace.yaml
└── turbo.json
```

### Stack technique

| Composant | Technologie |
|-----------|-------------|
| Backend | AdonisJS v6 |
| Frontend | React 19 + Inertia.js (SSR) |
| Base de données | PostgreSQL |
| Build | Vite + Turbo |
| Package Manager | pnpm v10.18.0 |
| Node.js | v20+ |

---

## Fichiers de configuration créés

### 1. `railway.toml` (racine du projet)

Configuration principale pour Railway :

```toml
[build]
builder = "nixpacks"
buildCommand = "corepack enable && pnpm install --frozen-lockfile && pnpm --filter web build"

[deploy]
startCommand = "cd apps/web/build && node ace migration:run --force && node ace db:seed && node bin/server.js"
healthcheckPath = "/health"
healthcheckTimeout = 600
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

**Explications :**
- `buildCommand` : Installe les dépendances et build l'application
- `startCommand` : Exécute les migrations, seeds, puis démarre le serveur
- `healthcheckPath` : Endpoint vérifié par Railway pour confirmer que l'app est prête
- `healthcheckTimeout` : 600 secondes (10 min) pour laisser le temps aux migrations

### 2. `apps/web/.env.production.example`

Template des variables d'environnement pour la production :

```env
# === APPLICATION ===
NODE_ENV=production
TZ=UTC
PORT=3333
HOST=0.0.0.0
LOG_LEVEL=info
SESSION_DRIVER=cookie
DRIVE_DISK=fs
LIMITER_STORE=database
APP_KEY=<générer-avec-node-ace-generate:key>

# === DATABASE (Railway References) ===
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_DATABASE=${{Postgres.PGDATABASE}}

# === EMAIL ===
EMAIL_FROM=noreply@yourdomain.com
RESEND_API_KEY=<votre-clé>

# === FRONTEND ===
VITE_API_URL=https://<votre-app>.railway.app

# === GOOGLE OAUTH (optionnel) ===
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## Modifications du code

### 1. Endpoint Healthcheck

**Fichier créé :** `apps/web/app/core/controllers/health_controller.ts`

```typescript
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'

export default class HealthController {
  async handle({ response }: HttpContext) {
    try {
      await db.rawQuery('SELECT 1')

      return response.ok({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
      })
    } catch (error) {
      return response.serviceUnavailable({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      })
    }
  }
}
```

**Route ajoutée dans** `apps/web/app/marketing/routes.ts` :

```typescript
const HealthController = () => import('#core/controllers/health_controller')
router.get('/health', [HealthController]).as('health.check')
```

### 2. Variables d'environnement optionnelles

**Fichier modifié :** `apps/web/start/env.ts`

Les variables suivantes ont été rendues optionnelles pour permettre le build sans erreur :

```typescript
VITE_API_URL: Env.schema.string.optional(),
RESEND_API_KEY: Env.schema.string.optional(),
EMAIL_FROM: Env.schema.string.optional(),
SMTP_HOST: Env.schema.string.optional(),
SMTP_PORT: Env.schema.number.optional(),
SMTP_USERNAME: Env.schema.string.optional(),
SMTP_PASSWORD: Env.schema.string.optional(),
SMTP_SECURE: Env.schema.boolean.optional(),
SMTP_REJECTUNAUTHORIZED: Env.schema.boolean.optional(),
GOOGLE_CLIENT_ID: Env.schema.string.optional(),
GOOGLE_CLIENT_SECRET: Env.schema.string.optional(),
```

### 3. Gestion des valeurs undefined dans les configs

**Fichier modifié :** `apps/web/config/ally.ts`

```typescript
const allyConfig = defineConfig({
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID') || '',
    clientSecret: env.get('GOOGLE_CLIENT_SECRET') || '',
    callbackUrl: (env.get('VITE_API_URL') || '') + '/google/callback',
  }),
})
```

**Fichier modifié :** `apps/web/config/mail.ts`

```typescript
mailers: {
  smtp: transports.smtp({
    host: env.get('SMTP_HOST') || 'localhost',
    port: env.get('SMTP_PORT') || 587,
    secure: env.get('SMTP_SECURE') ?? false,
    auth: {
      type: 'login',
      user: env.get('SMTP_USERNAME') || '',
      pass: env.get('SMTP_PASSWORD') || '',
    },
    tls: {
      rejectUnauthorized: env.get('SMTP_SECURE') ?? false,
    },
    // ...
  }),
  resend: transports.resend({
    key: env.get('RESEND_API_KEY') || '',
    baseUrl: 'https://api.resend.com',
  }),
}
```

---

## Configuration Railway

### Étape 1 : Créer le projet

1. Aller sur [railway.app](https://railway.app)
2. Cliquer **"New Project"**
3. Sélectionner **"Deploy from GitHub repo"**
4. Autoriser l'accès et sélectionner le repository

### Étape 2 : Ajouter PostgreSQL

1. Dans le projet, cliquer **"+ New"**
2. Sélectionner **"Database"** → **"Add PostgreSQL"**
3. Railway crée automatiquement les variables :
   - `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`

### Étape 3 : Configurer le service Web

Dans **Settings** du service :

| Paramètre | Valeur |
|-----------|--------|
| Root Directory | _(laisser vide, railway.toml à la racine)_ |
| Watch Paths | `/apps/web/**`, `/packages/**` |

### Étape 4 : Générer un domaine

1. Aller dans **Settings** → **Networking**
2. Cliquer **"Generate Domain"**
3. Noter l'URL générée (ex: `votre-app.railway.app`)

---

## Variables d'environnement

### Configuration dans Railway

Dans l'onglet **"Variables"** du service web :

#### Variables obligatoires

```env
NODE_ENV=production
TZ=UTC
PORT=3333
HOST=0.0.0.0
LOG_LEVEL=info
SESSION_DRIVER=cookie
DRIVE_DISK=fs
LIMITER_STORE=database
APP_KEY=<votre-clé-générée>
```

#### Variables Database (références Railway)

Utiliser **"Add Reference"** pour lier automatiquement :

```env
DB_HOST=${{Postgres.PGHOST}}
DB_PORT=${{Postgres.PGPORT}}
DB_USER=${{Postgres.PGUSER}}
DB_PASSWORD=${{Postgres.PGPASSWORD}}
DB_DATABASE=${{Postgres.PGDATABASE}}
```

#### Variables optionnelles

```env
VITE_API_URL=https://votre-app.railway.app
EMAIL_FROM=noreply@votredomaine.com
RESEND_API_KEY=<si-vous-utilisez-resend>
GOOGLE_CLIENT_ID=<si-vous-utilisez-google-oauth>
GOOGLE_CLIENT_SECRET=<si-vous-utilisez-google-oauth>
```

### Générer APP_KEY

Localement, exécuter :

```bash
cd apps/web && node ace generate:key
```

Copier la clé générée dans les variables Railway.

---

## Commandes de déploiement

### Déploiement automatique

Chaque push sur la branche principale déclenche un déploiement automatique.

### Déploiement manuel

```bash
# Ajouter les modifications
git add .

# Commit
git commit -m "Description des changements"

# Push (déclenche le déploiement)
git push origin main
```

### Vérifier le déploiement

1. Aller dans l'onglet **"Deployments"** sur Railway
2. Cliquer sur le déploiement en cours
3. Vérifier les **"Build Logs"** puis **"Deploy Logs"**

### Tester le healthcheck

```bash
curl https://votre-app.railway.app/health
```

Réponse attendue :

```json
{
  "status": "healthy",
  "timestamp": "2026-01-03T12:00:00.000Z",
  "database": "connected"
}
```

---

## Erreurs rencontrées et solutions

### Erreur 1 : "1/1 replicas never became healthy! Healthcheck failed!"

**Message complet :**
```
1/1 replicas never became healthy!
Healthcheck failed!
```

**Cause :** Le healthcheck échouait car les migrations étaient exécutées pendant le build, mais les variables de base de données n'étaient pas disponibles à ce moment.

**Solution :** Déplacer les migrations de `buildCommand` vers `startCommand` :

```toml
# Avant (incorrect)
[build]
buildCommand = "... && node ace migration:run --force"

# Après (correct)
[deploy]
startCommand = "cd apps/web/build && node ace migration:run --force && node bin/server.js"
```

---

### Erreur 2 : "Missing environment variable"

**Message complet :**
```
EnvValidationException: Validation failed for one or more environment variables

- Missing environment variable "VITE_API_URL"
- Missing environment variable "SMTP_HOST"
- Missing environment variable "SMTP_PORT"
- Missing environment variable "SMTP_USERNAME"
- Missing environment variable "SMTP_PASSWORD"
- Missing environment variable "SMTP_SECURE"
- Missing environment variable "SMTP_REJECTUNAUTHORIZED"
- Missing environment variable "GOOGLE_CLIENT_ID"
- Missing environment variable "GOOGLE_CLIENT_SECRET"
```

**Cause :** Ces variables étaient définies comme obligatoires dans `start/env.ts`, mais elles n'étaient pas disponibles pendant la phase de build sur Railway.

**Solution :** Rendre ces variables optionnelles dans `apps/web/start/env.ts` :

```typescript
// Avant
VITE_API_URL: Env.schema.string(),
SMTP_HOST: Env.schema.string({ format: 'host' }),
GOOGLE_CLIENT_ID: Env.schema.string(),

// Après
VITE_API_URL: Env.schema.string.optional(),
SMTP_HOST: Env.schema.string.optional(),
GOOGLE_CLIENT_ID: Env.schema.string.optional(),
```

---

### Erreur 3 : Erreurs TypeScript "Type 'undefined' is not assignable to type 'string'"

**Message complet :**
```
config/ally.ts(6,5): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
config/ally.ts(7,5): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
config/mail.ts(14,7): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
config/mail.ts(20,9): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
config/mail.ts(21,9): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.
config/mail.ts(37,7): error TS2322: Type 'string | undefined' is not assignable to type 'string'.
  Type 'undefined' is not assignable to type 'string'.

Cannot complete the build process as there are TypeScript errors.
```

**Cause :** Après avoir rendu les variables optionnelles dans `env.ts`, les fichiers de configuration (`ally.ts` et `mail.ts`) attendaient des valeurs `string`, mais recevaient `string | undefined`.

**Solution :** Ajouter des valeurs par défaut dans les fichiers de configuration :

**`config/ally.ts` :**
```typescript
// Avant
clientId: env.get('GOOGLE_CLIENT_ID'),
clientSecret: env.get('GOOGLE_CLIENT_SECRET'),
callbackUrl: env.get('VITE_API_URL') + '/google/callback',

// Après
clientId: env.get('GOOGLE_CLIENT_ID') || '',
clientSecret: env.get('GOOGLE_CLIENT_SECRET') || '',
callbackUrl: (env.get('VITE_API_URL') || '') + '/google/callback',
```

**`config/mail.ts` :**
```typescript
// Avant
host: env.get('SMTP_HOST'),
port: env.get('SMTP_PORT'),
user: env.get('SMTP_USERNAME'),
pass: env.get('SMTP_PASSWORD'),
key: env.get('RESEND_API_KEY'),

// Après
host: env.get('SMTP_HOST') || 'localhost',
port: env.get('SMTP_PORT') || 587,
secure: env.get('SMTP_SECURE') ?? false,
user: env.get('SMTP_USERNAME') || '',
pass: env.get('SMTP_PASSWORD') || '',
key: env.get('RESEND_API_KEY') || '',
```

---

### Erreur 4 : "Unknown flag --force" pour db:seed

**Message complet :**
```
ERROR   Unknown flag "--force". The mentioned flag is not accepted by the command
```

**Cause :** La commande `node ace db:seed` n'accepte pas le flag `--force` dans AdonisJS (contrairement à `migration:run`).

**Solution :** Retirer le flag `--force` de la commande `db:seed` dans `railway.toml` :

```toml
# Avant (incorrect)
startCommand = "cd apps/web/build && node ace migration:run --force && node ace db:seed --force && node bin/server.js"

# Après (correct)
startCommand = "cd apps/web/build && node ace migration:run --force && node ace db:seed && node bin/server.js"
```

---

## Autres problèmes potentiels

### Les migrations ne s'exécutent pas

**Cause :** Les variables DB ne sont pas disponibles pendant le build.

**Solution :** Exécuter les migrations dans `startCommand` (deploy phase), pas dans `buildCommand`.

### Timeout du healthcheck

**Cause :** Les migrations ou le démarrage prennent plus de temps que le timeout configuré.

**Solution :** Augmenter `healthcheckTimeout` dans `railway.toml` (max recommandé : 600 secondes).

---

## Résumé des fichiers modifiés

| Fichier | Action |
|---------|--------|
| `railway.toml` | Créé |
| `apps/web/.env.production.example` | Créé |
| `apps/web/app/core/controllers/health_controller.ts` | Créé |
| `apps/web/app/marketing/routes.ts` | Modifié (ajout route /health) |
| `apps/web/start/env.ts` | Modifié (variables optionnelles) |
| `apps/web/config/ally.ts` | Modifié (valeurs par défaut) |
| `apps/web/config/mail.ts` | Modifié (valeurs par défaut) |

---

## Ressources

- [Documentation Railway - Monorepo](https://docs.railway.com/guides/monorepo)
- [Documentation Railway - Healthchecks](https://docs.railway.com/guides/healthchecks)
- [Documentation AdonisJS - Deployment](https://docs.adonisjs.com/guides/deployment)
