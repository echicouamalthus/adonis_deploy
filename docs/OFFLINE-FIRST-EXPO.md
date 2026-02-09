# Architecture Offline-First avec Expo, Drizzle ORM et AdonisJS

Ce guide explique comment implémenter une architecture **offline-first** dans le monorepo, permettant à l'app mobile de fonctionner sans connexion et de synchroniser les données avec le backend AdonisJS quand la connexion revient.

## Table des matières

1. [Pourquoi Offline-First ?](#pourquoi-offline-first-)
2. [Architecture globale](#architecture-globale)
3. [Installation des dépendances](#installation-des-dépendances)
4. [Configuration de la base de données locale](#configuration-de-la-base-de-données-locale)
5. [Schéma et migrations](#schéma-et-migrations)
6. [Providers et contextes](#providers-et-contextes)
7. [Opérations de données locales](#opérations-de-données-locales)
8. [Synchronisation avec AdonisJS](#synchronisation-avec-adonisjs)
9. [Gestion de la connectivité](#gestion-de-la-connectivité)
10. [Patterns avancés](#patterns-avancés)

---

## Pourquoi Offline-First ?

La connectivité réseau est imprévisible. Une architecture offline-first garantit que :

- Les données sont **écrites localement d'abord**, puis synchronisées
- L'application reste **fonctionnelle sans réseau**
- **Aucune donnée n'est perdue** lors de déconnexions
- L'**expérience utilisateur reste fluide**

### Flux de données

```
┌─────────────────────────────────────────────────────────────┐
│                     APP MOBILE (Expo)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Utilisateur → Action (créer/modifier)                     │
│        ↓                                                    │
│   SQLite local (status: 'pending')                          │
│        ↓                                                    │
│   UI mise à jour instantanément                             │
│        ↓                                                    │
│   [Quand online] → Sync vers AdonisJS                       │
│        ↓                                                    │
│   SQLite local (status: 'synced')                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          ↕ API
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND (AdonisJS)                        │
├─────────────────────────────────────────────────────────────┤
│   PostgreSQL (source de vérité)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Architecture globale

### Structure des fichiers (apps/mobile)

```
apps/mobile/
├── app/
│   ├── _layout.tsx              # Root layout avec providers
│   └── ...
├── components/
│   ├── database-provider.tsx    # Provider SQLite + Drizzle
│   ├── connectivity-provider.tsx # Contexte connectivité
│   ├── sync-manager.tsx         # Gestionnaire de sync
│   └── common-providers.tsx     # Wrapper de tous les providers
├── db/
│   ├── schema.ts                # Schéma Drizzle
│   └── migrations.ts            # Migrations générées
├── data/
│   ├── local/
│   │   ├── queries.ts           # Requêtes SQLite
│   │   └── use-items-local.ts   # Hooks de lecture locale
│   ├── remote/
│   │   └── use-get-items.ts     # Hooks React Query
│   └── sync/
│       └── sync-pending.ts      # Logique de synchronisation
├── lib/
│   ├── tuyau.ts                 # Client API type-safe (existant)
│   ├── Query.ts                 # Config React Query (existant)
│   └── utils.ts                 # Utilitaires (guardAsync)
└── drizzle/
    └── migrations/              # Fichiers de migration
```

---

## Installation des dépendances

```bash
# Depuis la racine du monorepo
pnpm --filter mobile add drizzle-orm expo-sqlite

# Dépendances de développement
pnpm --filter mobile add -D drizzle-kit
```

### Versions recommandées (Expo 54)

```json
{
  "drizzle-orm": "~0.44.2",
  "expo-sqlite": "~15.2.14"
}
```

---

## Configuration de la base de données locale

### `apps/mobile/components/database-provider.tsx`

```typescript
import {
  createContext,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import type { SQLiteDatabase } from "expo-sqlite";
import { SQLiteProvider, useSQLiteContext } from "expo-sqlite";
import { drizzle, type ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { migrate } from "drizzle-orm/expo-sqlite/migrator";
import migrations from "../drizzle/migrations";

const DATABASE_NAME = "app-offline.db";

// Contexte Drizzle
const DrizzleContext = createContext<ExpoSQLiteDatabase | null>(null);

/**
 * Hook pour accéder à la base de données Drizzle
 */
export function useDrizzle() {
  const context = useContext(DrizzleContext);
  if (!context) {
    throw new Error("useDrizzle must be used within a DatabaseProvider");
  }
  return context;
}

/**
 * Provider interne Drizzle
 */
function DrizzleProvider({ children }: PropsWithChildren) {
  const sqliteDb = useSQLiteContext();

  const db = useMemo(() => {
    console.log("[DB] Creating Drizzle instance");
    return drizzle(sqliteDb);
  }, [sqliteDb]);

  return (
    <DrizzleContext.Provider value={db}>{children}</DrizzleContext.Provider>
  );
}

/**
 * Fonction de migration automatique au démarrage
 */
async function migrateAsync(db: SQLiteDatabase) {
  console.log("[DB] Running migrations...");
  const drizzleDb = drizzle(db);
  await migrate(drizzleDb, migrations);
  console.log("[DB] Migrations completed");
}

/**
 * Provider principal de la base de données
 * - Initialise SQLite
 * - Exécute les migrations
 * - Expose Drizzle via contexte
 */
export function DatabaseProvider({ children }: PropsWithChildren) {
  return (
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onError={(error) => console.error("[DB] Error:", error)}
      onInit={migrateAsync}
      options={{ enableChangeListener: true }}
    >
      <DrizzleProvider>{children}</DrizzleProvider>
    </SQLiteProvider>
  );
}
```

### Options importantes

| Option                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `enableChangeListener` | Permet à `useLiveQuery` de détecter les changements |
| `onInit`               | Exécute les migrations au démarrage             |

---

## Schéma et migrations

### `apps/mobile/db/schema.ts`

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Statuts de synchronisation
 */
export type SyncStatus = "pending" | "synced" | "failed";

/**
 * Table des items (exemple)
 * Adapter selon vos besoins métier
 */
export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  syncStatus: text("sync_status").$type<SyncStatus>().notNull().default("pending"),
  serverId: text("server_id"), // ID côté AdonisJS après sync
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Types inférés
export type ItemEntity = typeof items.$inferSelect;
export type NewItemEntity = typeof items.$inferInsert;

/**
 * Table de queue de synchronisation
 * Pour les opérations complexes (update, delete)
 */
export const syncQueue = sqliteTable("sync_queue", {
  id: text("id").primaryKey(),
  operation: text("operation").$type<"create" | "update" | "delete">().notNull(),
  tableName: text("table_name").notNull(),
  recordId: text("record_id").notNull(),
  payload: text("payload"), // JSON stringifié
  attempts: integer("attempts").notNull().default(0),
  lastAttempt: integer("last_attempt", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type SyncQueueEntity = typeof syncQueue.$inferSelect;
```

### Configuration Drizzle Kit

Créer `apps/mobile/drizzle.config.ts` :

```typescript
import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  driver: "expo",
} satisfies Config;
```

### Générer les migrations

```bash
# Depuis apps/mobile
cd apps/mobile
npx drizzle-kit generate
```

### `apps/mobile/drizzle/migrations.ts`

```typescript
// Fichier généré automatiquement par drizzle-kit
// Importer les migrations SQL générées

import journal from "./migrations/meta/_journal.json";
import m0000 from "./migrations/0000_initial.sql";

export default {
  journal,
  migrations: {
    m0000,
  },
};
```

---

## Providers et contextes

### `apps/mobile/components/connectivity-provider.tsx`

```typescript
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import NetInfo from "@react-native-community/netinfo";

interface ConnectivityContextType {
  isOnline: boolean;
  isChecking: boolean;
}

const ConnectivityContext = createContext<ConnectivityContextType | null>(null);

export function useConnectivity() {
  const context = useContext(ConnectivityContext);
  if (!context) {
    throw new Error("useConnectivity must be used within ConnectivityProvider");
  }
  return context;
}

export function ConnectivityProvider({ children }: PropsWithChildren) {
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Vérification initiale
    NetInfo.fetch().then((state) => {
      setIsOnline(!!state.isConnected);
      setIsChecking(false);
    });

    // Écouter les changements
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });

    return unsubscribe;
  }, []);

  return (
    <ConnectivityContext.Provider value={{ isOnline, isChecking }}>
      {children}
    </ConnectivityContext.Provider>
  );
}
```

### `apps/mobile/components/sync-manager.tsx`

```typescript
import { useEffect, useRef } from "react";
import { useConnectivity } from "./connectivity-provider";
import { syncPendingItems } from "../data/sync/sync-pending";
import { useDrizzle } from "./database-provider";

/**
 * Composant invisible qui gère la synchronisation automatique
 * - Déclenche la sync quand la connexion revient
 * - Retry périodique des items en échec
 */
export function SyncManager() {
  const { isOnline } = useConnectivity();
  const db = useDrizzle();
  const isSyncing = useRef(false);

  useEffect(() => {
    if (isOnline && !isSyncing.current) {
      isSyncing.current = true;
      console.log("[Sync] Connection restored, starting sync...");

      syncPendingItems(db)
        .then((result) => {
          console.log("[Sync] Completed:", result);
        })
        .catch((error) => {
          console.error("[Sync] Error:", error);
        })
        .finally(() => {
          isSyncing.current = false;
        });
    }
  }, [isOnline, db]);

  return null;
}
```

### `apps/mobile/components/common-providers.tsx`

```typescript
import { type PropsWithChildren } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { QueryClientProvider } from "@tanstack/react-query";
import { HeroUINativeProvider } from "heroui-native";
import { queryClient } from "../lib/tuyau";
import { DatabaseProvider } from "./database-provider";
import { ConnectivityProvider } from "./connectivity-provider";
import { SyncManager } from "./sync-manager";

export function CommonProviders({ children }: PropsWithChildren) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <HeroUINativeProvider>
          <DatabaseProvider>
            <ConnectivityProvider>
              <QueryClientProvider client={queryClient}>
                <SyncManager />
                {children}
              </QueryClientProvider>
            </ConnectivityProvider>
          </DatabaseProvider>
        </HeroUINativeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
```

### Mise à jour de `apps/mobile/app/_layout.tsx`

```typescript
import "./global.css";
import { Stack } from "expo-router";
import { CommonProviders } from "../components/common-providers";

export default function RootLayout() {
  return (
    <CommonProviders>
      <Stack />
    </CommonProviders>
  );
}
```

---

## Opérations de données locales

### `apps/mobile/lib/utils.ts`

```typescript
/**
 * Wrapper async qui retourne un tuple [result, error]
 * Évite les try/catch verbeux
 */
export async function guardAsync<T, E = Error>(
  promise: Promise<T>
): Promise<[T, null] | [null, E]> {
  try {
    return [await promise, null];
  } catch (error) {
    return [null, error as E];
  }
}

/**
 * Génère un ID unique pour les enregistrements locaux
 */
export function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
```

### `apps/mobile/data/local/queries.ts`

```typescript
import { eq } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { items, type NewItemEntity, type SyncStatus } from "../../db/schema";

/**
 * Créer un item localement (status: pending)
 */
export async function createItemLocal(
  db: ExpoSQLiteDatabase,
  data: Omit<NewItemEntity, "syncStatus" | "createdAt" | "updatedAt">
) {
  const now = new Date();
  return db.insert(items).values({
    ...data,
    syncStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Lire tous les items
 */
export function selectAllItems(db: ExpoSQLiteDatabase) {
  return db.select().from(items).all();
}

/**
 * Lire les items par statut de sync
 */
export function selectItemsByStatus(
  db: ExpoSQLiteDatabase,
  status: SyncStatus
) {
  return db.select().from(items).where(eq(items.syncStatus, status)).all();
}

/**
 * Mettre à jour le statut de sync
 */
export async function updateSyncStatus(
  db: ExpoSQLiteDatabase,
  id: string,
  status: SyncStatus,
  serverId?: string
) {
  return db
    .update(items)
    .set({
      syncStatus: status,
      serverId: serverId,
      updatedAt: new Date(),
    })
    .where(eq(items.id, id));
}

/**
 * Remplacer tous les items (après fetch serveur)
 */
export async function replaceAllItems(
  db: ExpoSQLiteDatabase,
  rows: NewItemEntity[]
) {
  return db.transaction((tx) => {
    // Supprimer les items déjà synchronisés
    tx.delete(items).where(eq(items.syncStatus, "synced")).run();
    // Insérer les nouveaux
    rows.forEach((row) => tx.insert(items).values(row).run());
  });
}
```

### `apps/mobile/data/local/use-items-local.ts`

```typescript
import { useLiveQuery } from "drizzle-orm/expo-sqlite";
import { useDrizzle } from "../../components/database-provider";
import { items } from "../../db/schema";

/**
 * Hook réactif pour lire les items locaux
 * Se met à jour automatiquement quand la DB change
 */
export function useItemsLocal() {
  const db = useDrizzle();
  return useLiveQuery(db.select().from(items));
}

/**
 * Hook pour compter les items en attente de sync
 */
export function usePendingCount() {
  const db = useDrizzle();
  const { data } = useLiveQuery(
    db.select().from(items).where(eq(items.syncStatus, "pending"))
  );
  return data?.length ?? 0;
}
```

---

## Synchronisation avec AdonisJS

### `apps/mobile/data/sync/sync-pending.ts`

```typescript
import { eq } from "drizzle-orm";
import type { ExpoSQLiteDatabase } from "drizzle-orm/expo-sqlite";
import { items, type ItemEntity } from "../../db/schema";
import { tuyau, queryClient } from "../../lib/tuyau";
import { guardAsync } from "../../lib/utils";

interface SyncResult {
  synced: number;
  failed: number;
  errors: string[];
}

/**
 * Synchronise tous les items pending vers AdonisJS
 */
export async function syncPendingItems(
  db: ExpoSQLiteDatabase
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, errors: [] };

  // 1. Récupérer les items en attente
  const pendingItems = db
    .select()
    .from(items)
    .where(eq(items.syncStatus, "pending"))
    .all();

  if (pendingItems.length === 0) {
    console.log("[Sync] No pending items");
    return result;
  }

  console.log(`[Sync] Found ${pendingItems.length} pending items`);

  // 2. Synchroniser chaque item
  for (const item of pendingItems) {
    const [response, error] = await guardAsync(sendItemToServer(item));

    if (error) {
      result.failed++;
      result.errors.push(`${item.id}: ${error.message}`);

      // Marquer comme failed
      await db
        .update(items)
        .set({ syncStatus: "failed", updatedAt: new Date() })
        .where(eq(items.id, item.id));
    } else {
      result.synced++;

      // Marquer comme synced avec l'ID serveur
      await db
        .update(items)
        .set({
          syncStatus: "synced",
          serverId: response?.id,
          updatedAt: new Date(),
        })
        .where(eq(items.id, item.id));
    }
  }

  // 3. Invalider le cache React Query
  await queryClient.invalidateQueries({ queryKey: ["items"] });

  return result;
}

/**
 * Envoie un item vers AdonisJS via Tuyau
 */
async function sendItemToServer(item: ItemEntity) {
  // Utiliser Tuyau pour l'appel API type-safe
  const response = await tuyau.api.items.$post({
    title: item.title,
    description: item.description ?? undefined,
  });

  if (response.error) {
    throw new Error(response.error.message || "Server error");
  }

  return response.data;
}

/**
 * Retry les items en échec
 */
export async function retryFailedItems(
  db: ExpoSQLiteDatabase
): Promise<SyncResult> {
  // Remettre les items failed en pending
  await db
    .update(items)
    .set({ syncStatus: "pending" })
    .where(eq(items.syncStatus, "failed"));

  // Relancer la sync
  return syncPendingItems(db);
}
```

### Endpoint AdonisJS correspondant

Dans `apps/web/app/api/items_controller.ts` :

```typescript
import type { HttpContext } from "@adonisjs/core/http";
import Item from "#models/item";
import { createItemValidator } from "#validators/item";

export default class ItemsController {
  /**
   * POST /api/items
   * Reçoit les items synchronisés depuis mobile
   */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(createItemValidator);

    const item = await Item.create({
      title: payload.title,
      description: payload.description,
    });

    return response.created({
      id: item.id,
      title: item.title,
      createdAt: item.createdAt,
    });
  }

  /**
   * GET /api/items
   * Retourne tous les items pour sync mobile
   */
  async index({ response }: HttpContext) {
    const items = await Item.all();
    return response.ok({ items });
  }
}
```

---

## Gestion de la connectivité

### Configuration React Query existante

Votre `apps/mobile/lib/Query.ts` est déjà bien configuré :

```typescript
import NetInfo from "@react-native-community/netinfo";
import { onlineManager, focusManager } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

// Détection réseau automatique
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected));
  });
});

// Refetch au retour au premier plan
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== "web") {
    focusManager.setFocused(status === "active");
  }
}

AppState.addEventListener("change", onAppStateChange);
```

### Importer dans le layout

Ajouter dans `apps/mobile/app/_layout.tsx` :

```typescript
import "../lib/Query"; // Active la détection réseau
```

---

## Patterns avancés

### Hook unifié : Cache local + Remote

```typescript
// apps/mobile/data/use-items.ts
import { useEffect, useMemo, useState } from "react";
import { useConnectivity } from "../components/connectivity-provider";
import { useDrizzle } from "../components/database-provider";
import { selectAllItems, replaceAllItems } from "./local/queries";
import { useQuery } from "@tanstack/react-query";
import { tuyau } from "../lib/tuyau";
import type { ItemEntity } from "../db/schema";

export function useItems() {
  const { isOnline } = useConnectivity();
  const db = useDrizzle();
  const [localItems, setLocalItems] = useState<ItemEntity[]>([]);

  // 1. Hydrater depuis le cache local immédiatement
  useEffect(() => {
    selectAllItems(db)
      .then(setLocalItems)
      .catch(console.error);
  }, [db]);

  // 2. Fetch serveur si online
  const remoteQuery = useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const response = await tuyau.api.items.$get();
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    enabled: isOnline,
    staleTime: 60_000,
  });

  // 3. Mettre en cache les données serveur
  useEffect(() => {
    if (remoteQuery.data?.items) {
      const serverItems = remoteQuery.data.items.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        syncStatus: "synced" as const,
        serverId: item.id,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      }));

      replaceAllItems(db, serverItems).catch(console.error);
      setLocalItems(serverItems);
    }
  }, [remoteQuery.data, db]);

  return useMemo(
    () => ({
      items: localItems,
      isLoading: remoteQuery.isLoading,
      isRefreshing: remoteQuery.isFetching,
      error: remoteQuery.error,
      refresh: remoteQuery.refetch,
      isOnline,
    }),
    [localItems, remoteQuery, isOnline]
  );
}
```

### Indicateur de sync dans l'UI

```typescript
// apps/mobile/components/sync-status-badge.tsx
import { View, Text } from "react-native";
import { useConnectivity } from "./connectivity-provider";
import { usePendingCount } from "../data/local/use-items-local";

export function SyncStatusBadge() {
  const { isOnline } = useConnectivity();
  const pendingCount = usePendingCount();

  if (isOnline && pendingCount === 0) {
    return null; // Tout est synchronisé
  }

  return (
    <View className="flex-row items-center gap-2 px-3 py-1 rounded-full bg-yellow-100">
      <View
        className={`w-2 h-2 rounded-full ${
          isOnline ? "bg-green-500" : "bg-red-500"
        }`}
      />
      <Text className="text-xs text-yellow-800">
        {isOnline
          ? `Syncing ${pendingCount} items...`
          : `Offline (${pendingCount} pending)`}
      </Text>
    </View>
  );
}
```

### Protection contre la perte de données

```typescript
// apps/mobile/hooks/use-prevent-leave.ts
import { useEffect } from "react";
import { Alert, BackHandler } from "react-native";
import { useNavigation } from "expo-router";
import { usePendingCount } from "../data/local/use-items-local";

export function usePreventLeaveWithPendingData() {
  const navigation = useNavigation();
  const pendingCount = usePendingCount();

  useEffect(() => {
    if (pendingCount === 0) return;

    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();

      Alert.alert(
        "Données non synchronisées",
        `Vous avez ${pendingCount} élément(s) en attente de synchronisation. Voulez-vous vraiment quitter ?`,
        [
          { text: "Rester", style: "cancel" },
          {
            text: "Quitter",
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation, pendingCount]);
}
```

---

## Résumé du flux complet

### 1. Création offline

```
Utilisateur crée un item
    ↓
createItemLocal() → SQLite (status: pending)
    ↓
useLiveQuery détecte le changement
    ↓
UI mise à jour instantanément
```

### 2. Retour de connexion

```
NetInfo détecte la connexion
    ↓
SyncManager.useEffect() s'exécute
    ↓
syncPendingItems() récupère status='pending'
    ↓
Pour chaque item:
  - tuyau.api.items.$post() vers AdonisJS
  - Si succès: UPDATE status='synced'
  - Si échec: UPDATE status='failed'
    ↓
queryClient.invalidateQueries(['items'])
```

### 3. Ouverture app offline

```
App démarre
    ↓
useItems() hydrate depuis SQLite
    ↓
UI affiche les données en cache
    ↓
isOnline=false, pas de fetch serveur
```

### 4. Pull-to-refresh online

```
Utilisateur tire vers le bas
    ↓
refresh() → invalidateQueries
    ↓
React Query fetch depuis AdonisJS
    ↓
replaceAllItems() met en cache SQLite
    ↓
UI mise à jour avec données fraîches
```

---

## Checklist d'implémentation

- [ ] Installer `drizzle-orm` et `expo-sqlite`
- [ ] Créer le schéma dans `db/schema.ts`
- [ ] Configurer `drizzle.config.ts`
- [ ] Générer les migrations (`npx drizzle-kit generate`)
- [ ] Implémenter `DatabaseProvider`
- [ ] Implémenter `ConnectivityProvider`
- [ ] Implémenter `SyncManager`
- [ ] Créer les queries locales
- [ ] Créer la logique de sync
- [ ] Ajouter les endpoints AdonisJS
- [ ] Tester offline/online
