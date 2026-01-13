# Configuration CORS - AdonisJS

Ce guide explique comment configurer CORS (Cross-Origin Resource Sharing) dans AdonisJS pour permettre les requêtes depuis des applications frontend externes (Expo, React, etc.).

## Table des matières

1. [Qu'est-ce que CORS ?](#quest-ce-que-cors-)
2. [Configuration](#configuration)
3. [Origines autorisées](#origines-autorisées)
4. [Troubleshooting](#troubleshooting)

---

## Qu'est-ce que CORS ?

CORS est un mécanisme de sécurité des navigateurs qui bloque les requêtes HTTP entre différentes origines (domaines, ports, protocoles).

### Exemple de blocage

```
App Expo (http://localhost:8081)
        ↓ requête API
API AdonisJS (http://localhost:3333)
        ↓
❌ BLOQUÉ par le navigateur (origines différentes)
```

### Avec CORS configuré

```
App Expo (http://localhost:8081)
        ↓ requête API
API AdonisJS (http://localhost:3333)
        ↓ Header: Access-Control-Allow-Origin: http://localhost:8081
✅ AUTORISÉ
```

---

## Configuration

### Fichier : `apps/web/config/cors.ts`

```typescript
import { defineConfig } from '@adonisjs/cors'

const corsConfig = defineConfig({
  enabled: true,

  /**
   * Fonction pour valider les origines autorisées
   */
  origin: (requestOrigin) => {
    // Liste des origines autorisées en développement
    const allowedOrigins = [
      'http://localhost:8081',    // Expo web
      'http://localhost:19006',   // Expo web (ancien port)
      'http://localhost:3000',    // Next.js ou autre frontend
      'http://10.0.2.2:8081',     // Android Emulator
    ]

    // En production, ajouter vos domaines
    if (process.env.NODE_ENV === 'production') {
      allowedOrigins.push('https://votre-app.com')
      allowedOrigins.push('https://api.votre-app.com')
    }

    return allowedOrigins.includes(requestOrigin)
  },

  /**
   * Méthodes HTTP autorisées
   */
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],

  /**
   * Autoriser tous les headers de la requête
   */
  headers: true,

  /**
   * Headers exposés au client
   */
  exposeHeaders: [],

  /**
   * Autoriser l'envoi de cookies/credentials
   */
  credentials: true,

  /**
   * Durée de cache des preflight requests (en secondes)
   */
  maxAge: 90,
})

export default corsConfig
```

---

## Origines autorisées

### Tableau récapitulatif

| Environnement | Origine | Port | Usage |
|---------------|---------|------|-------|
| Expo Web (dev) | `http://localhost:8081` | 8081 | Metro bundler web |
| Expo Web (ancien) | `http://localhost:19006` | 19006 | Ancien port Expo |
| Android Emulator | `http://10.0.2.2:8081` | 8081 | Emulateur Android |
| Next.js | `http://localhost:3000` | 3000 | Frontend Next.js |
| Production | `https://votre-app.com` | 443 | App en production |

### Configuration dynamique par environnement

```typescript
origin: (requestOrigin) => {
  // Développement : autoriser toutes les origines localhost
  if (process.env.NODE_ENV === 'development') {
    if (requestOrigin?.startsWith('http://localhost:')) {
      return true
    }
    if (requestOrigin?.startsWith('http://10.0.2.2:')) {
      return true
    }
    if (requestOrigin?.startsWith('http://192.168.')) {
      return true // Device physique sur réseau local
    }
  }

  // Production : liste stricte
  const productionOrigins = [
    'https://votre-app.com',
    'https://www.votre-app.com',
  ]

  return productionOrigins.includes(requestOrigin)
}
```

### Autoriser toutes les origines (développement uniquement)

```typescript
// ⚠️ NE PAS UTILISER EN PRODUCTION
origin: true
```

---

## Troubleshooting

### Erreur : "No 'Access-Control-Allow-Origin' header"

**Cause** : L'origine de la requête n'est pas dans la liste autorisée.

**Solution** :
1. Vérifier l'origine exacte dans la console du navigateur
2. Ajouter cette origine dans `allowedOrigins`
3. Redémarrer le serveur AdonisJS

### Erreur : "Preflight request doesn't pass"

**Cause** : La méthode HTTP ou les headers ne sont pas autorisés.

**Solution** :
1. Vérifier que la méthode est dans `methods`
2. S'assurer que `headers: true` est configuré
3. Ajouter `OPTIONS` dans les méthodes

### Erreur : "Credentials not supported"

**Cause** : `credentials: true` mais l'origine est `*`.

**Solution** :
- Ne pas utiliser `origin: true` avec `credentials: true`
- Spécifier les origines explicitement

### Debug : Voir les headers CORS

Dans le navigateur (F12 → Network), vérifiez les headers de réponse :

```
Access-Control-Allow-Origin: http://localhost:8081
Access-Control-Allow-Methods: GET, HEAD, POST, PUT, DELETE, PATCH, OPTIONS
Access-Control-Allow-Headers: content-type
Access-Control-Allow-Credentials: true
```

### Vérifier la configuration

```bash
# Dans le terminal, tester une requête OPTIONS
curl -X OPTIONS http://localhost:3333/api/hello \
  -H "Origin: http://localhost:8081" \
  -H "Access-Control-Request-Method: GET" \
  -v
```

---

## Bonnes pratiques

1. **Ne jamais utiliser `origin: true` en production**
2. **Lister explicitement les origines autorisées**
3. **Utiliser des variables d'environnement** pour les domaines de production
4. **Redémarrer le serveur** après modification de la config CORS
5. **Tester avec différents clients** (navigateur, Postman, app mobile)

---

## Configuration avec variables d'environnement

### `apps/web/.env`

```bash
# Origines CORS autorisées (séparées par des virgules)
CORS_ORIGINS=http://localhost:8081,http://localhost:3000
```

### `apps/web/config/cors.ts`

```typescript
origin: (requestOrigin) => {
  const envOrigins = process.env.CORS_ORIGINS?.split(',') || []

  const allowedOrigins = [
    ...envOrigins,
    'http://localhost:8081',
    'http://10.0.2.2:8081',
  ]

  return allowedOrigins.includes(requestOrigin)
}
```
