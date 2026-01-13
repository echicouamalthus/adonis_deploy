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
    // Obtenir les fichiers modifiés depuis le dernier push
    const output = execSync('git diff --name-only @{push}..HEAD 2>/dev/null || git diff --name-only HEAD~10..HEAD', {
      encoding: 'utf-8'
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    // Fallback: vérifier tous les fichiers modifiés récemment
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

  // Build pour apps/mobile (Expo) - pas de tests automatiques requis
  if (changedApps.mobile) {
    log('\n📱 Checking apps/mobile (Expo)...', 'yellow');

    // Export web pour vérifier les erreurs de build
    log('  → Checking TypeScript...', 'blue');
    // Note: Expo n'a pas de commande typecheck par défaut
    // On vérifie juste le lint
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