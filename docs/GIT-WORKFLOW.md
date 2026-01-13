# Git Workflow - Branches et Déploiement

Ce document explique comment utiliser les branches Git pour développer sans affecter la production.

## Architecture des branches

```
main (production)     ← Déployé automatiquement sur Railway
  │
  └── dev (développement) ← Tests et nouvelles fonctionnalités
        │
        ├── feature/xxx   ← Fonctionnalités spécifiques (optionnel)
        └── fix/xxx       ← Corrections de bugs (optionnel)
```

## Règles importantes

| Branche | Déploiement | Usage |
|---------|-------------|-------|
| `main` | ✅ Automatique sur Railway | Code stable, prêt pour production |
| `dev` | ❌ Aucun | Tests, nouvelles fonctionnalités |
| `feature/*` | ❌ Aucun | Développement isolé d'une feature |

## Commandes de base

### 1. Créer la branche dev (première fois uniquement)

```bash
# Depuis main, créer et basculer sur dev
git checkout -b dev

# Pousser la branche sur le remote
git push -u origin dev
```

### 2. Workflow quotidien sur dev

```bash
# S'assurer d'être sur dev
git checkout dev

# Récupérer les dernières modifications
git pull origin dev

# Faire vos modifications...
# ... coder, tester, etc.

# Ajouter et commiter
git add .
git commit -m "feat: description de la fonctionnalité"

# Pousser sur dev (PAS de déploiement Railway)
git push origin dev
```

### 3. Déployer en production (merger dans main)

```bash
# 1. S'assurer que dev est à jour
git checkout dev
git pull origin dev

# 2. Basculer sur main
git checkout main
git pull origin main

# 3. Merger dev dans main
git merge dev

# 4. Pousser (déclenche le déploiement Railway)
git push origin main

# 5. Retourner sur dev pour continuer à développer
git checkout dev
```

## Workflow avec feature branches (optionnel)

Pour des fonctionnalités plus complexes :

```bash
# 1. Créer une branche feature depuis dev
git checkout dev
git checkout -b feature/nouvelle-fonctionnalite

# 2. Développer...
git add .
git commit -m "feat: ajouter nouvelle fonctionnalité"
git push -u origin feature/nouvelle-fonctionnalite

# 3. Quand terminé, merger dans dev
git checkout dev
git merge feature/nouvelle-fonctionnalite
git push origin dev

# 4. Supprimer la branche feature
git branch -d feature/nouvelle-fonctionnalite
git push origin --delete feature/nouvelle-fonctionnalite
```

## Commandes utiles

### Voir la branche actuelle
```bash
git branch
```

### Voir toutes les branches (locales et remote)
```bash
git branch -a
```

### Changer de branche
```bash
git checkout <nom-branche>
```

### Voir l'état des fichiers
```bash
git status
```

### Voir les différences avant de commiter
```bash
git diff
```

### Annuler les modifications non commitées
```bash
# Un seul fichier
git checkout -- <fichier>

# Tous les fichiers
git checkout -- .
```

## Résoudre les conflits de merge

Si un conflit survient lors du merge :

```bash
# 1. Git indique les fichiers en conflit
git status

# 2. Ouvrir les fichiers et résoudre manuellement
#    Chercher les marqueurs : <<<<<<< ======= >>>>>>>

# 3. Après résolution, ajouter les fichiers
git add <fichiers-resolus>

# 4. Terminer le merge
git commit -m "fix: résoudre conflits de merge"
```

## Bonnes pratiques

### Messages de commit

Utiliser des préfixes conventionnels :

| Préfixe | Usage |
|---------|-------|
| `feat:` | Nouvelle fonctionnalité |
| `fix:` | Correction de bug |
| `docs:` | Documentation |
| `style:` | Formatage (pas de changement de code) |
| `refactor:` | Refactoring du code |
| `test:` | Ajout/modification de tests |
| `chore:` | Maintenance (deps, config, etc.) |

### Exemples
```bash
git commit -m "feat: add user authentication"
git commit -m "fix: resolve login redirect issue"
git commit -m "docs: update API documentation"
git commit -m "chore: update dependencies"
```

## Schéma visuel du workflow

```
        dev                              main (Railway)
         │                                  │
         │  ← développer ici                │
         │                                  │
    [commit A]                              │
         │                                  │
    [commit B]                              │
         │                                  │
    [commit C]                              │
         │                                  │
         │──────── git merge ──────────────→│ ← Déploiement auto
         │                                  │
         │  ← continuer à développer        │
         │                                  │
    [commit D]                              │
         │                                  │
```

## Récapitulatif

1. **Développer sur `dev`** - Jamais directement sur `main`
2. **Tester sur `dev`** - Vérifier que tout fonctionne
3. **Merger dans `main`** - Uniquement quand le code est stable
4. **Le push sur `main` déclenche Railway** - Déploiement automatique

## En cas de problème en production

Si un bug est découvert en production :

```bash
# 1. Créer un hotfix depuis main
git checkout main
git checkout -b hotfix/description-bug

# 2. Corriger le bug
git add .
git commit -m "fix: description du fix"

# 3. Merger dans main ET dev
git checkout main
git merge hotfix/description-bug
git push origin main  # Déploie le fix

git checkout dev
git merge hotfix/description-bug
git push origin dev

# 4. Supprimer la branche hotfix
git branch -d hotfix/description-bug
```
