# Guide d'intégration Expo 54 dans un Monorepo AdonisJS

> Documentation technique complète pour l'intégration d'une application Expo dans un monorepo pnpm + TurboRepo

---

## Table des matières

1. [Contexte et problématique](#1-contexte-et-problématique)
2. [Prérequis](#2-prérequis)
3. [Étapes d'installation](#3-étapes-dinstallation)
4. [Résolution des erreurs](#4-résolution-des-erreurs-courantes)
5. [Vérification finale](#5-vérification-finale)
6. [Commandes utiles](#6-commandes-utiles)
7. [Récapitulatif](#7-récapitulatif)

---

## 1. Contexte et problématique

### 1.1 Structure du monorepo

Le monorepo AdonisJS utilise la structure suivante :

```
adonis_deploy/
├── apps/
│   ├── web/          # AdonisJS + Inertia.js (React)
│   └── mobile/       # Expo 54 (à ajouter)
├── packages/         # Packages partagés
├── node_modules/     # Dépendances hoistées (UNIQUE)
├── .npmrc            # Configuration pnpm
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### 1.2 Le problème principal

> ⚠️ **Erreur typique** : `"Cannot read property useId"` ou `"Invalid hook call"`

Cette erreur survient quand **plusieurs versions de React** sont installées dans le monorepo :

- Une version dans `node_modules` racine (utilisée par AdonisJS/Inertia)
- Une autre version dans `apps/mobile/node_modules` (installée par Expo)

**Pourquoi ?** React utilise des hooks internes (comme `useId`) qui ne fonctionnent que si **UNE SEULE instance de React** est présente. Quand Metro (bundler Expo) résout les dépendances, il peut trouver le "mauvais" React.

---

## 2. Prérequis

### 2.1 Environnement requis

| Outil | Version minimale |
|-------|------------------|
| Node.js | v20.x ou supérieur |
| pnpm | v8.x ou supérieur |
| Expo CLI | Dernière version (`npx create-expo-app`) |
| Expo SDK | 54.x (détection automatique monorepo depuis SDK 52) |

### 2.2 Vérification

```bash
node --version   # v20.x+
pnpm --version   # v8.x+
```

---

## 3. Étapes d'installation

### Étape 1 : Créer l'application Expo

Depuis la racine du monorepo, exécute :

```bash
cd apps
pnpx create-expo-app@latest mobile && cd mobile && pnpm reset-project
```

#### ⚠️ Message attendu

Expo va détecter le monorepo pnpm et afficher :

```
Creating an Expo project using the default template.
> pnpm config --location project set node-linker hoisted
> pnpm install
√ The modules directory at "D:\...\node_modules" will be removed and reinstalled from scratch. Proceed? (Y/n)
```

#### ✅ Action requise

**Réponds `Y` (Yes)** pour accepter la réinstallation.

**Ce qui se passe :**
1. Expo ajoute `node-linker=hoisted` à la configuration pnpm
2. Le `node_modules` racine est supprimé
3. Toutes les dépendances sont réinstallées avec la nouvelle configuration
4. L'app Expo est créée dans `apps/mobile`

---

### Étape 2 : Vérifier le fichier .npmrc

Après l'installation, vérifie que le fichier `.npmrc` **à la racine** contient :

```ini
# .npmrc (à la racine du monorepo)
node-linker=hoisted
shamefully-hoist=true
```

**Pourquoi ?** Cette configuration force pnpm à créer un `node_modules` plat (comme npm/yarn) au lieu de la structure symlink isolée par défaut. C'est **obligatoire** pour Expo/React Native.

---

### Étape 3 : Vérifier les versions de React

Exécute cette commande pour vérifier qu'une seule version de React est installée :

```bash
pnpm why react --recursive
```

#### ✅ Résultat attendu (BON)

```
mobile@1.0.0 → react 19.1.0 peer
web@0.0.0 → react 19.1.0 peer
@workspace/ui → react 19.1.0 peer
```

→ **Même version partout = OK** ✅

#### ❌ Résultat problématique (MAUVAIS)

```
mobile@1.0.0 → react 19.1.0 peer
web@0.0.0 → react 19.2.3 peer
```

→ **Versions différentes = Erreur `useId`** ❌

---

### Étape 4 : Forcer une version unique de React (si nécessaire)

Si les versions sont différentes, ajoute les `overrides` dans le `package.json` **RACINE** :

```json
{
  "name": "adonis_deploy",
  "private": true,
  "pnpm": {
    "overrides": {
      "react": "19.1.0",
      "react-dom": "19.1.0",
      "@types/react": "~19.1.0"
    }
  }
}
```

> 💡 **Note** : Utilise la version requise par Expo (19.1.0 pour Expo SDK 54). L'app web s'adaptera.

Puis réinstalle les dépendances :

```bash
pnpm install
```

---

## 4. Résolution des erreurs courantes

### 4.1 Erreur : "Cannot read property useId"

| | |
|---|---|
| **Cause** | Plusieurs versions de React sont chargées |
| **Solution** | Suivre l'Étape 4 pour forcer une version unique via `overrides` |

---

### 4.2 Erreur : node_modules créé dans apps/mobile

| | |
|---|---|
| **Cause** | Installation sans `node-linker=hoisted` |
| **Solution** | Voir ci-dessous |

```bash
# Supprimer le node_modules local
rm -rf apps/mobile/node_modules
rm -f apps/mobile/package-lock.json
rm -f apps/mobile/.npmrc  # Supprimer si existe

# Vérifier/ajouter dans .npmrc à la racine
echo "node-linker=hoisted" >> .npmrc

# Réinstaller
pnpm install
```

---

### 4.3 Warnings : Peer dependencies Vite

```
WARN apps/web
└─┬ @adonisjs/vite 4.0.0
  └── ✕ unmet peer vite@^6.0.0: found 7.3.0
```

| | |
|---|---|
| **Impact** | Ce warning concerne l'app web AdonisJS, **pas Expo** |
| **Action** | **Ignorer** pour l'instant. Si l'app web fonctionne, c'est OK |

---

### 4.4 Warnings : Deprecated subdependencies

```
WARN 6 deprecated subdependencies found: @types/minimatch@6.0.0, glob@7.2.3...
```

| | |
|---|---|
| **Impact** | Aucun impact sur le fonctionnement |
| **Action** | **Ignorer**. Ce sont des dépendances transitives obsolètes |

---

## 5. Vérification finale

### Checklist

- [ ] Le fichier `.npmrc` contient `node-linker=hoisted`
- [ ] Il n'y a **PAS** de `node_modules` dans `apps/mobile/`
- [ ] `pnpm why react --recursive` montre une seule version partout
- [ ] L'app Expo démarre sans erreur `useId`

### Test de lancement

```bash
# Depuis apps/mobile
cd apps/mobile
pnpm start

# Ou depuis la racine
pnpm --filter mobile start
```

---

## 6. Commandes utiles

### 6.1 Développement

| Commande | Description |
|----------|-------------|
| `pnpm --filter web dev` | Lancer l'app AdonisJS |
| `pnpm --filter mobile start` | Lancer l'app Expo |
| `pnpm dev` | Lancer toutes les apps (si configuré dans turbo.json) |

### 6.2 Diagnostic

| Commande | Description |
|----------|-------------|
| `pnpm why react --recursive` | Vérifier les versions de React |
| `pnpm ls --depth=0` | Lister les dépendances directes |
| `cat .npmrc` | Vérifier la config pnpm |

### 6.3 Réinitialisation complète

En cas de problème majeur :

```bash
# Supprimer tous les node_modules
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
rm -f pnpm-lock.yaml

# Réinstaller proprement
pnpm install
```

---

## 7. Récapitulatif

### ✅ Points clés à retenir

1. **`node-linker=hoisted`** est **obligatoire** dans `.npmrc` pour Expo + pnpm

2. Une **seule version de React** doit être présente dans tout le monorepo

3. Les **overrides pnpm** permettent de forcer une version unique

4. Expo SDK 52+ **détecte automatiquement** les monorepos et configure Metro

5. Les warnings de peer dependencies Vite sont **ignorables** si l'app web fonctionne

---

### Structure finale attendue

```
adonis_deploy/
├── .npmrc                    # node-linker=hoisted ✅
├── package.json              # overrides pour React ✅
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── turbo.json
├── node_modules/             # UNIQUE node_modules (hoisted) ✅
├── apps/
│   ├── web/                  # AdonisJS + Inertia
│   │   ├── package.json
│   │   └── (PAS de node_modules ici)
│   └── mobile/               # Expo 54
│       ├── package.json
│       ├── metro.config.js   # Généré automatiquement par Expo
│       ├── app.json
│       └── (PAS de node_modules ici)
└── packages/
    └── ...
```