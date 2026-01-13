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