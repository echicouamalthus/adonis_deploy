# Guide d'implémentation des notifications Expo dans le monorepo

Ce guide adapte l'implémentation des notifications Expo au contexte de notre monorepo **Turborepo + AdonisJS + Expo**.

## Table des matières

- [Vue d'ensemble de l'architecture](#vue-densemble-de-larchitecture)
- [Structure des fichiers dans le monorepo](#structure-des-fichiers-dans-le-monorepo)
- [Installation et configuration](#installation-et-configuration)
- [Implémentation mobile (apps/mobile)](#implémentation-mobile-appsmobile)
- [Implémentation backend (apps/web)](#implémentation-backend-appsweb)
- [Intégration Tuyau type-safe](#intégration-tuyau-type-safe)
- [Tests](#tests)
- [Déploiement](#déploiement)

---

## Vue d'ensemble de l'architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MONOREPO STRUCTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  packages/notifications-types/                                   │
│  ├── src/index.ts                (Types partagés TypeScript)     │
│  └── package.json                                                │
│                                                                   │
│  apps/mobile/                     (Expo 54 + React Native)       │
│  ├── lib/notifications.ts         (Hooks et utilitaires)         │
│  ├── lib/tuyau.ts                 (Client API type-safe)         │
│  ├── components/NotificationToggle.tsx                           │
│  ├── app/_layout.tsx              (Initialisation)               │
│  └── __tests__/                   (Tests Jest)                   │
│                                                                   │
│  apps/web/                        (AdonisJS v6 Backend)          │
│  ├── app/notifications/                                          │
│  │   ├── push_tokens_controller.ts                               │
│  │   ├── notification_service.ts                                 │
│  │   └── models/push_token.ts                                    │
│  ├── database/migrations/                                        │
│  │   └── create_push_tokens_table.ts                             │
│  ├── start/routes.ts              (Routes API)                   │
│  └── tests/                       (Tests Japa)                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        FLUX DE DONNÉES                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  1. Mobile App demande permission                                │
│                ↓                                                  │
│  2. Récupère Expo Push Token                                     │
│                ↓                                                  │
│  3. Envoie token via Tuyau → AdonisJS API                        │
│                ↓                                                  │
│  4. Backend stocke token en BDD                                  │
│                ↓                                                  │
│  5. Backend envoie notification via Expo Push API                │
│                ↓                                                  │
│  6. Mobile reçoit et affiche notification                        │
│                ↓                                                  │
│  7. Navigation basée sur data (via Expo Router)                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Structure des fichiers dans le monorepo

```
first_adonis_deploy/
├── packages/
│   └── notifications-types/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
│
├── apps/
│   ├── mobile/
│   │   ├── lib/
│   │   │   ├── notifications.ts
│   │   │   ├── notificationService.ts
│   │   │   └── tuyau.ts
│   │   ├── components/
│   │   │   └── NotificationToggle.tsx
│   │   ├── app/
│   │   │   ├── _layout.tsx
│   │   │   └── (tabs)/
│   │   │       └── settings.tsx
│   │   ├── app.json
│   │   ├── __tests__/
│   │   │   ├── notifications.test.ts
│   │   │   └── NotificationToggle.test.tsx
│   │   └── package.json
│   │
│   └── web/
│       ├── app/
│       │   └── notifications/
│       │       ├── push_tokens_controller.ts
│       │       ├── notification_service.ts
│       │       └── models/
│       │           └── push_token.ts
│       ├── database/
│       │   └── migrations/
│       │       └── 1737900000000_create_push_tokens_table.ts
│       ├── start/
│       │   └── routes.ts
│       ├── config/
│       │   └── notifications.ts
│       ├── tests/
│       │   └── functional/
│       │       └── notifications/
│       │           ├── push_tokens.spec.ts
│       │           └── notification_service.spec.ts
│       └── package.json
│
└── docs/
    └── EXPO-NOTIFICATIONS-MONOREPO.md (ce fichier)
```

---

## Installation et configuration

### 1. Créer le package partagé de types

**packages/notifications-types/package.json**
```json
{
  "name": "@workspace/notifications-types",
  "version": "0.0.0",
  "private": true,
  "license": "PROPRIETARY",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "devDependencies": {
    "@workspace/typescript-config": "workspace:*",
    "typescript": "^5.7.3"
  }
}
```

**packages/notifications-types/tsconfig.json**
```json
{
  "extends": "@workspace/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**packages/notifications-types/src/index.ts**
```typescript
/**
 * Types partagés pour le système de notifications
 * Utilisés par apps/mobile et apps/web
 */

export interface PushToken {
  id: number
  userId: number
  token: string
  platform: 'ios' | 'android'
  createdAt: Date
  updatedAt: Date
}

export interface CreatePushTokenDTO {
  userId: number
  token: string
  platform: 'ios' | 'android'
}

export interface NotificationPayload {
  title: string
  body: string
  data?: Record<string, any>
  sound?: boolean
  badge?: number
}

export interface ScheduleNotificationPayload extends NotificationPayload {
  userId: number
  scheduledFor?: Date
}

export interface NotificationData {
  screen?: string
  userId?: number
  messageId?: string
  [key: string]: unknown
}

export type NotificationPermissionStatus =
  | 'undetermined'
  | 'granted'
  | 'denied'

export interface NotificationState {
  expoPushToken: string | null
  notification: any | null
  error: string | null
  permissionStatus: NotificationPermissionStatus
}

// Types pour les API endpoints (Tuyau)
export interface PushTokensAPI {
  store: {
    request: CreatePushTokenDTO
    response: PushToken
  }
  destroy: {
    request: { token: string }
    response: { success: boolean }
  }
  index: {
    request: { userId: number }
    response: PushToken[]
  }
}
```

### 2. Installer les dépendances mobile

```bash
# Dans apps/mobile
cd apps/mobile
npx expo install expo-notifications expo-device expo-constants
pnpm add @workspace/notifications-types
```

### 3. Installer les dépendances backend

```bash
# Dans apps/web
cd apps/web
pnpm add expo-server-sdk
pnpm add -D @types/node
pnpm add @workspace/notifications-types
```

---

## Implémentation mobile (apps/mobile)

### 1. Configuration app.json

**apps/mobile/app.json**
```json
{
  "expo": {
    "name": "MyApp",
    "slug": "my-app",
    "version": "1.0.0",
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": ["./assets/notification-sound.wav"]
        }
      ]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#ffffff",
      "androidMode": "default",
      "androidCollapsedTitle": "#{unread_notifications} nouvelles notifications"
    },
    "android": {
      "package": "com.yourcompany.myapp",
      "permissions": [
        "RECEIVE_BOOT_COMPLETED"
      ]
    },
    "ios": {
      "bundleIdentifier": "com.yourcompany.myapp",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    }
  }
}
```

### 2. Hooks et utilitaires

**apps/mobile/lib/notifications.ts**
```typescript
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'expo-router'
import type {
  NotificationState,
  NotificationData,
  NotificationPermissionStatus
} from '@workspace/notifications-types'

/**
 * Configuration globale des notifications
 * À appeler dans _layout.tsx
 */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  })
}

/**
 * Hook principal pour gérer les notifications
 * Gère les permissions et le push token
 */
export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [permissionStatus, setPermissionStatus] =
    useState<NotificationPermissionStatus>('undetermined')

  useEffect(() => {
    registerForPushNotificationsAsync()
      .then(result => {
        if (result) {
          setExpoPushToken(result.token)
          setPermissionStatus(result.status)
        }
      })
      .catch(err => {
        setError(err.message)
        setPermissionStatus('denied')
      })
  }, [])

  return {
    expoPushToken,
    error,
    permissionStatus,
  }
}

/**
 * Demande les permissions et récupère le push token
 */
export async function registerForPushNotificationsAsync(): Promise<{
  token: string
  status: NotificationPermissionStatus
} | undefined> {
  // Configuration du canal Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    })
  }

  // Vérifier si c'est un appareil physique
  if (!Device.isDevice) {
    throw new Error('Les notifications push nécessitent un appareil physique')
  }

  // Vérifier les permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  // Demander les permissions si nécessaire
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') {
    throw new Error('Permission de notification refusée')
  }

  // Obtenir le token
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  })

  return {
    token: tokenData.data,
    status: finalStatus as NotificationPermissionStatus,
  }
}

/**
 * Hook pour écouter les notifications
 * Gère la réception et les interactions
 */
export function useNotificationListener() {
  const router = useRouter()
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()

  useEffect(() => {
    // Listener pour notifications reçues (app au premier plan)
    notificationListener.current =
      Notifications.addNotificationReceivedListener(notification => {
        console.log('📩 Notification reçue:', notification)
        // Vous pouvez afficher un toast ou mettre à jour l'UI
      })

    // Listener pour interactions (tap sur notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(response => {
        console.log('👆 Notification tapée:', response)

        // Navigation basée sur les données
        const data = response.notification.request.content.data as NotificationData

        if (data.screen) {
          router.push(data.screen)
        }
      })

    // Cleanup
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(
          notificationListener.current
        )
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(
          responseListener.current
        )
      }
    }
  }, [router])
}

/**
 * Planifier une notification locale
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  trigger: Notifications.NotificationTriggerInput | null,
  data?: NotificationData
): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data ?? {},
      sound: true,
      badge: 1,
    },
    trigger,
  })
}

/**
 * Annuler toutes les notifications planifiées
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}

/**
 * Gérer le badge de l'app
 */
export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count)
}

export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync()
}

export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0)
}
```

### 3. Service d'API (intégration Tuyau)

**apps/mobile/lib/notificationService.ts**
```typescript
import { api } from './tuyau'
import type { CreatePushTokenDTO } from '@workspace/notifications-types'
import { Platform } from 'react-native'

/**
 * Service pour communiquer avec l'API backend
 * Utilise Tuyau pour la type-safety
 */
class NotificationService {
  /**
   * Enregistrer un push token auprès du backend
   */
  async registerPushToken(token: string, userId: number): Promise<void> {
    try {
      const payload: CreatePushTokenDTO = {
        userId,
        token,
        platform: Platform.OS as 'ios' | 'android',
      }

      const { data, error } = await api.notifications.pushTokens.store.$post({
        body: payload,
      })

      if (error) {
        throw new Error(`Erreur lors de l'enregistrement: ${error.message}`)
      }

      console.log('✅ Token enregistré:', data)
    } catch (error) {
      console.error('❌ Erreur registerPushToken:', error)
      throw error
    }
  }

  /**
   * Supprimer un push token
   */
  async unregisterPushToken(token: string): Promise<void> {
    try {
      const { data, error } = await api.notifications.pushTokens.destroy.$delete({
        body: { token },
      })

      if (error) {
        throw new Error(`Erreur lors de la suppression: ${error.message}`)
      }

      console.log('✅ Token supprimé')
    } catch (error) {
      console.error('❌ Erreur unregisterPushToken:', error)
      throw error
    }
  }

  /**
   * Récupérer tous les tokens d'un utilisateur
   */
  async getUserTokens(userId: number) {
    try {
      const { data, error } = await api.notifications.pushTokens.index.$get({
        query: { userId },
      })

      if (error) {
        throw new Error(`Erreur lors de la récupération: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('❌ Erreur getUserTokens:', error)
      throw error
    }
  }
}

export const notificationService = new NotificationService()
```

### 4. Composant NotificationToggle

**apps/mobile/components/NotificationToggle.tsx**
```typescript
import { useState, useEffect } from 'react'
import { View, Text, Switch, Alert, ActivityIndicator } from 'react-native'
import * as Notifications from 'expo-notifications'
import { useAuth } from '@/hooks/useAuth' // Votre hook d'authentification
import { notificationService } from '@/lib/notificationService'
import { registerForPushNotificationsAsync } from '@/lib/notifications'

export function NotificationToggle() {
  const { user } = useAuth()
  const [isEnabled, setIsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined')

  useEffect(() => {
    checkPermissionStatus()
  }, [])

  const checkPermissionStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync()
      setPermissionStatus(status)
      setIsEnabled(status === 'granted')
    } catch (error) {
      console.error('Erreur vérification permission:', error)
    }
  }

  const toggleNotifications = async (value: boolean) => {
    if (!user) {
      Alert.alert('Erreur', 'Vous devez être connecté')
      return
    }

    setIsLoading(true)

    try {
      if (value) {
        // Activer les notifications
        const result = await registerForPushNotificationsAsync()

        if (result) {
          // Enregistrer le token sur le backend
          await notificationService.registerPushToken(result.token, user.id)

          setIsEnabled(true)
          setPermissionStatus('granted')
          Alert.alert('✅ Notifications activées', 'Vous recevrez désormais des notifications.')
        }
      } else {
        // Désactiver les notifications
        const { status } = await Notifications.getPermissionsAsync()

        if (status === 'granted') {
          const tokenData = await Notifications.getExpoPushTokenAsync()

          // Supprimer le token du backend
          await notificationService.unregisterPushToken(tokenData.data)
        }

        // Annuler toutes les notifications locales
        await Notifications.cancelAllScheduledNotificationsAsync()

        setIsEnabled(false)
        Alert.alert('🔕 Notifications désactivées', 'Vous ne recevrez plus de notifications.')
      }
    } catch (error: any) {
      console.error('Erreur toggle notifications:', error)

      if (error.message.includes('refusée')) {
        Alert.alert(
          '❌ Permission refusée',
          'Veuillez activer les notifications dans les paramètres de votre appareil.',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Ouvrir Paramètres',
              onPress: () => Notifications.openSettingsAsync()
            },
          ]
        )
      } else {
        Alert.alert('Erreur', error.message || 'Une erreur est survenue')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View className="w-full px-4 py-3 bg-surface rounded-xl border border-border">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="text-foreground font-outfit-semibold text-base">
            Notifications
          </Text>
          <Text className="text-muted font-outfit text-sm mt-1">
            {permissionStatus === 'granted'
              ? 'Activées'
              : permissionStatus === 'denied'
              ? 'Refusées - Aller dans Paramètres'
              : 'Non configurées'}
          </Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="small" />
        ) : (
          <Switch
            value={isEnabled}
            onValueChange={toggleNotifications}
            disabled={isLoading}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={isEnabled ? '#f5dd4b' : '#f4f3f4'}
          />
        )}
      </View>
    </View>
  )
}
```

### 5. Initialisation dans _layout.tsx

**apps/mobile/app/_layout.tsx**
```typescript
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import {
  configureNotifications,
  useNotifications,
  useNotificationListener
} from '@/lib/notifications'
import { notificationService } from '@/lib/notificationService'
import { useAuth } from '@/hooks/useAuth'

// Configuration globale
configureNotifications()

export default function RootLayout() {
  const { user } = useAuth()
  const { expoPushToken, error, permissionStatus } = useNotifications()

  // Écouter les notifications
  useNotificationListener()

  // Enregistrer le token quand disponible
  useEffect(() => {
    if (expoPushToken && user && permissionStatus === 'granted') {
      notificationService
        .registerPushToken(expoPushToken, user.id)
        .then(() => console.log('📱 Token enregistré automatiquement'))
        .catch(err => console.error('❌ Erreur auto-register:', err))
    }
  }, [expoPushToken, user, permissionStatus])

  useEffect(() => {
    if (error) {
      console.error('❌ Erreur notifications:', error)
    }
  }, [error])

  return (
    <Stack>
      {/* Vos écrans */}
    </Stack>
  )
}
```

---

## Implémentation backend (apps/web)

### 1. Migration de base de données

**apps/web/database/migrations/1737900000000_create_push_tokens_table.ts**
```typescript
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'push_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').primary()
      table.integer('user_id').unsigned().notNullable()
      table.string('token', 255).notNullable().unique()
      table.enum('platform', ['ios', 'android']).notNullable()
      table.boolean('is_active').defaultTo(true)
      table.timestamp('last_used_at').nullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()

      // Foreign key
      table
        .foreign('user_id')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')

      // Index pour les recherches fréquentes
      table.index(['user_id', 'is_active'])
      table.index('token')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
```

### 2. Modèle PushToken

**apps/web/app/notifications/models/push_token.ts**
```typescript
import { DateTime } from 'luxon'
import { BaseModel, column, belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#users/models/user'

export default class PushToken extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare token: string

  @column()
  declare platform: 'ios' | 'android'

  @column()
  declare isActive: boolean

  @column.dateTime()
  declare lastUsedAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
```

### 3. Service de notifications

**apps/web/app/notifications/notification_service.ts**
```typescript
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'
import PushToken from './models/push_token.js'
import logger from '@adonisjs/core/services/logger'
import type {
  NotificationPayload,
  ScheduleNotificationPayload
} from '@workspace/notifications-types'

export default class NotificationService {
  private expo: Expo

  constructor() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
    })
  }

  /**
   * Envoyer une notification push à un ou plusieurs utilisateurs
   */
  async sendPushNotification(
    userIds: number | number[],
    payload: NotificationPayload
  ): Promise<ExpoPushTicket[]> {
    const ids = Array.isArray(userIds) ? userIds : [userIds]

    // Récupérer tous les tokens actifs des utilisateurs
    const tokens = await PushToken.query()
      .whereIn('user_id', ids)
      .where('is_active', true)

    if (tokens.length === 0) {
      logger.warn('Aucun token actif trouvé', { userIds: ids })
      return []
    }

    // Construire les messages
    const messages: ExpoPushMessage[] = tokens
      .filter(token => Expo.isExpoPushToken(token.token))
      .map(token => ({
        to: token.token,
        sound: payload.sound !== false ? 'default' : undefined,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        badge: payload.badge,
      }))

    // Envoyer par chunks (recommandé par Expo)
    const chunks = this.expo.chunkPushNotifications(messages)
    const tickets: ExpoPushTicket[] = []

    for (const chunk of chunks) {
      try {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk)
        tickets.push(...ticketChunk)
        logger.info('Notifications envoyées', { count: chunk.length })
      } catch (error) {
        logger.error('Erreur envoi notifications', { error, chunk })
      }
    }

    // Mettre à jour lastUsedAt
    await PushToken.query()
      .whereIn('id', tokens.map(t => t.id))
      .update({ lastUsedAt: new Date() })

    return tickets
  }

  /**
   * Vérifier les receipts et gérer les tokens invalides
   */
  async processReceipts(ticketIds: string[]): Promise<void> {
    const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(ticketIds)

    for (const chunk of receiptIdChunks) {
      try {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk)

        for (const receiptId in receipts) {
          const receipt = receipts[receiptId]

          if (receipt.status === 'error') {
            logger.error('Erreur notification', {
              receiptId,
              message: receipt.message,
              details: receipt.details,
            })

            // Token invalide ou appareil non enregistré
            if (
              receipt.details?.error === 'DeviceNotRegistered' ||
              receipt.details?.error === 'InvalidCredentials'
            ) {
              // Désactiver le token
              await this.deactivateTokenByReceiptId(receiptId)
            }
          }
        }
      } catch (error) {
        logger.error('Erreur traitement receipts', { error })
      }
    }
  }

  /**
   * Désactiver un token invalide
   */
  private async deactivateTokenByReceiptId(receiptId: string): Promise<void> {
    // Note: Vous devrez stocker la correspondance ticket<->token si besoin
    logger.warn('Token à désactiver', { receiptId })
  }

  /**
   * Envoyer une notification à tous les utilisateurs
   */
  async broadcastNotification(payload: NotificationPayload): Promise<void> {
    const tokens = await PushToken.query().where('is_active', true)
    const userIds = tokens.map(t => t.userId)

    if (userIds.length > 0) {
      await this.sendPushNotification(userIds, payload)
    }
  }

  /**
   * Envoyer une notification programmée (via job queue recommandé)
   */
  async scheduleNotification(
    payload: ScheduleNotificationPayload
  ): Promise<void> {
    // TODO: Implémenter avec Bull/BullMQ ou autre queue
    // Pour l'instant, envoi immédiat
    await this.sendPushNotification(payload.userId, payload)
  }
}
```

### 4. Controller

**apps/web/app/notifications/push_tokens_controller.ts**
```typescript
import type { HttpContext } from '@adonisjs/core/http'
import PushToken from './models/push_token.js'
import { storePushTokenValidator, destroyPushTokenValidator } from './validators.js'

export default class PushTokensController {
  /**
   * POST /api/notifications/push-tokens
   * Enregistrer un nouveau push token
   */
  async store({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(storePushTokenValidator)

    // Vérifier que l'utilisateur authentifié = userId
    if (auth.user!.id !== payload.userId) {
      return response.forbidden({
        message: 'Non autorisé'
      })
    }

    // Vérifier si le token existe déjà
    const existing = await PushToken.query()
      .where('token', payload.token)
      .first()

    if (existing) {
      // Réactiver si désactivé
      if (!existing.isActive) {
        existing.isActive = true
        await existing.save()
      }
      return response.ok(existing)
    }

    // Créer nouveau token
    const pushToken = await PushToken.create({
      userId: payload.userId,
      token: payload.token,
      platform: payload.platform,
      isActive: true,
    })

    return response.created(pushToken)
  }

  /**
   * DELETE /api/notifications/push-tokens
   * Supprimer un push token
   */
  async destroy({ request, response, auth }: HttpContext) {
    const { token } = await request.validateUsing(destroyPushTokenValidator)

    const pushToken = await PushToken.query()
      .where('token', token)
      .where('user_id', auth.user!.id)
      .firstOrFail()

    // Soft delete: désactiver plutôt que supprimer
    pushToken.isActive = false
    await pushToken.save()

    return response.ok({ success: true })
  }

  /**
   * GET /api/notifications/push-tokens
   * Récupérer les tokens d'un utilisateur
   */
  async index({ request, response, auth }: HttpContext) {
    const userId = request.input('userId', auth.user!.id)

    // Vérifier les permissions
    if (auth.user!.id !== userId && !auth.user!.isAdmin) {
      return response.forbidden({
        message: 'Non autorisé'
      })
    }

    const tokens = await PushToken.query()
      .where('user_id', userId)
      .where('is_active', true)
      .orderBy('created_at', 'desc')

    return response.ok(tokens)
  }
}
```

### 5. Validators

**apps/web/app/notifications/validators.ts**
```typescript
import vine from '@vinejs/vine'

export const storePushTokenValidator = vine.compile(
  vine.object({
    userId: vine.number().positive(),
    token: vine.string().trim().minLength(10),
    platform: vine.enum(['ios', 'android']),
  })
)

export const destroyPushTokenValidator = vine.compile(
  vine.object({
    token: vine.string().trim().minLength(10),
  })
)
```

### 6. Routes

**apps/web/start/routes.ts**
```typescript
import router from '@adonisjs/core/services/router'
import { middleware } from '#start/kernel'

// Routes notifications (authentifiées)
router
  .group(() => {
    router
      .group(() => {
        router.post('/push-tokens', '#notifications/push_tokens_controller.store')
        router.delete('/push-tokens', '#notifications/push_tokens_controller.destroy')
        router.get('/push-tokens', '#notifications/push_tokens_controller.index')
      })
      .prefix('/notifications')
  })
  .prefix('/api')
  .use(middleware.auth())
```

### 7. Configuration

**apps/web/config/notifications.ts**
```typescript
import env from '#start/env'

export default {
  /**
   * Expo Access Token (optionnel, recommandé pour production)
   * https://expo.dev/accounts/[account]/settings/access-tokens
   */
  expoAccessToken: env.get('EXPO_ACCESS_TOKEN', ''),

  /**
   * Activer les notifications push
   */
  enabled: env.get('NOTIFICATIONS_ENABLED', true),

  /**
   * Nombre max de notifications à envoyer en batch
   */
  batchSize: 100,

  /**
   * Timeout pour les requêtes Expo (ms)
   */
  timeout: 10000,
}
```

---

## Intégration Tuyau type-safe

### 1. Exporter les routes depuis AdonisJS

**apps/web/package.json** (ajout du script)
```json
{
  "scripts": {
    "tuyau:generate": "node ace tuyau:generate"
  }
}
```

### 2. Générer les types Tuyau

```bash
cd apps/web
pnpm tuyau:generate
```

Cela génère `.adonisjs/api.ts` avec tous les types de routes.

### 3. Configuration client mobile

**apps/mobile/lib/tuyau.ts** (mise à jour)
```typescript
import { createTuyau } from '@tuyau/client'
import type { api as ApiType } from '../../../web/.adonisjs/api'

export const api = createTuyau<ApiType>({
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Helper pour ajouter le token d'authentification
export function setAuthToken(token: string) {
  api.$config.headers['Authorization'] = `Bearer ${token}`
}

export function clearAuthToken() {
  delete api.$config.headers['Authorization']
}
```

### 4. Utilisation dans l'app mobile

```typescript
import { api } from '@/lib/tuyau'

// Enregistrer un token (type-safe!)
const { data, error } = await api.notifications.pushTokens.store.$post({
  body: {
    userId: user.id,
    token: expoPushToken,
    platform: 'ios',
  },
})

// Autocomplétion et vérification des types!
```

---

## Tests

### 1. Tests mobile (Jest)

**apps/mobile/__tests__/notifications.test.ts**
```typescript
import { registerForPushNotificationsAsync } from '@/lib/notifications'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'

jest.mock('expo-notifications')
jest.mock('expo-device')

describe('Notifications', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('registerForPushNotificationsAsync', () => {
    it('should throw error on simulator', async () => {
      ;(Device.isDevice as any) = false

      await expect(registerForPushNotificationsAsync()).rejects.toThrow(
        'Les notifications push nécessitent un appareil physique'
      )
    })

    it('should request permissions if not granted', async () => {
      ;(Device.isDevice as any) = true
      ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'undetermined',
      })
      ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      })
      ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
        data: 'ExponentPushToken[test]',
      })

      const result = await registerForPushNotificationsAsync()

      expect(Notifications.requestPermissionsAsync).toHaveBeenCalled()
      expect(result?.token).toBe('ExponentPushToken[test]')
      expect(result?.status).toBe('granted')
    })

    it('should throw error if permission denied', async () => {
      ;(Device.isDevice as any) = true
      ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      })
      ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      })

      await expect(registerForPushNotificationsAsync()).rejects.toThrow(
        'Permission de notification refusée'
      )
    })
  })
})
```

**apps/mobile/__tests__/NotificationToggle.test.tsx**
```typescript
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { NotificationToggle } from '@/components/NotificationToggle'
import * as Notifications from 'expo-notifications'
import { notificationService } from '@/lib/notificationService'

jest.mock('expo-notifications')
jest.mock('@/lib/notificationService')
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, name: 'Test User' } }),
}))

describe('NotificationToggle', () => {
  it('should render correctly', () => {
    const { getByText } = render(<NotificationToggle />)
    expect(getByText('Notifications')).toBeTruthy()
  })

  it('should show current permission status', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    })

    const { getByText } = render(<NotificationToggle />)

    await waitFor(() => {
      expect(getByText('Activées')).toBeTruthy()
    })
  })

  it('should handle toggle on', async () => {
    ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    })
    ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    })
    ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValue({
      data: 'ExponentPushToken[test]',
    })
    ;(notificationService.registerPushToken as jest.Mock).mockResolvedValue(
      undefined
    )

    const { getByRole } = render(<NotificationToggle />)
    const toggle = getByRole('switch')

    fireEvent(toggle, 'valueChange', true)

    await waitFor(() => {
      expect(notificationService.registerPushToken).toHaveBeenCalledWith(
        'ExponentPushToken[test]',
        1
      )
    })
  })
})
```

**apps/mobile/jest.config.js**
```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  collectCoverageFrom: [
    'lib/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
}
```

**apps/mobile/jest.setup.js**
```javascript
import '@testing-library/jest-native/extend-expect'

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  removeNotificationSubscription: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  setBadgeCountAsync: jest.fn(),
  getBadgeCountAsync: jest.fn(),
  openSettingsAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: {
    MAX: 5,
  },
}))

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
}))
```

### 2. Tests backend (Japa)

**apps/web/tests/functional/notifications/push_tokens.spec.ts**
```typescript
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import User from '#users/models/user'
import PushToken from '#notifications/models/push_token'

test.group('Push Tokens - store', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should create a new push token', async ({ client, assert }) => {
    const user = await User.create({
      email: 'test@example.com',
      password: 'password123',
      fullName: 'Test User',
    })

    const response = await client
      .post('/api/notifications/push-tokens')
      .loginAs(user)
      .json({
        userId: user.id,
        token: 'ExponentPushToken[test123]',
        platform: 'ios',
      })

    response.assertStatus(201)
    response.assertBodyContains({
      userId: user.id,
      token: 'ExponentPushToken[test123]',
      platform: 'ios',
      isActive: true,
    })

    const pushToken = await PushToken.findByOrFail('token', 'ExponentPushToken[test123]')
    assert.equal(pushToken.userId, user.id)
  })

  test('should return existing token if already exists', async ({ client }) => {
    const user = await User.create({
      email: 'test2@example.com',
      password: 'password123',
      fullName: 'Test User 2',
    })

    // Créer le token une première fois
    await client
      .post('/api/notifications/push-tokens')
      .loginAs(user)
      .json({
        userId: user.id,
        token: 'ExponentPushToken[duplicate]',
        platform: 'android',
      })

    // Essayer de créer à nouveau
    const response = await client
      .post('/api/notifications/push-tokens')
      .loginAs(user)
      .json({
        userId: user.id,
        token: 'ExponentPushToken[duplicate]',
        platform: 'android',
      })

    response.assertStatus(200) // OK au lieu de CREATED
  })

  test('should forbid creating token for another user', async ({ client }) => {
    const user1 = await User.create({
      email: 'user1@example.com',
      password: 'password123',
      fullName: 'User 1',
    })

    const user2 = await User.create({
      email: 'user2@example.com',
      password: 'password123',
      fullName: 'User 2',
    })

    const response = await client
      .post('/api/notifications/push-tokens')
      .loginAs(user1)
      .json({
        userId: user2.id, // Tenter d'enregistrer pour un autre user
        token: 'ExponentPushToken[malicious]',
        platform: 'ios',
      })

    response.assertStatus(403)
  })

  test('should require authentication', async ({ client }) => {
    const response = await client
      .post('/api/notifications/push-tokens')
      .json({
        userId: 1,
        token: 'ExponentPushToken[test]',
        platform: 'ios',
      })

    response.assertStatus(401)
  })
})

test.group('Push Tokens - destroy', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should soft delete a push token', async ({ client, assert }) => {
    const user = await User.create({
      email: 'test3@example.com',
      password: 'password123',
      fullName: 'Test User 3',
    })

    const pushToken = await PushToken.create({
      userId: user.id,
      token: 'ExponentPushToken[todelete]',
      platform: 'ios',
    })

    const response = await client
      .delete('/api/notifications/push-tokens')
      .loginAs(user)
      .json({
        token: pushToken.token,
      })

    response.assertStatus(200)
    response.assertBodyContains({ success: true })

    await pushToken.refresh()
    assert.isFalse(pushToken.isActive)
  })

  test('should not delete token of another user', async ({ client }) => {
    const user1 = await User.create({
      email: 'user3@example.com',
      password: 'password123',
      fullName: 'User 3',
    })

    const user2 = await User.create({
      email: 'user4@example.com',
      password: 'password123',
      fullName: 'User 4',
    })

    const pushToken = await PushToken.create({
      userId: user2.id,
      token: 'ExponentPushToken[protected]',
      platform: 'android',
    })

    const response = await client
      .delete('/api/notifications/push-tokens')
      .loginAs(user1)
      .json({
        token: pushToken.token,
      })

    response.assertStatus(404) // findOrFail échoue
  })
})

test.group('Push Tokens - index', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('should list user tokens', async ({ client, assert }) => {
    const user = await User.create({
      email: 'test4@example.com',
      password: 'password123',
      fullName: 'Test User 4',
    })

    await PushToken.createMany([
      { userId: user.id, token: 'Token1', platform: 'ios' },
      { userId: user.id, token: 'Token2', platform: 'android' },
    ])

    const response = await client
      .get('/api/notifications/push-tokens')
      .loginAs(user)
      .qs({ userId: user.id })

    response.assertStatus(200)
    assert.lengthOf(response.body(), 2)
  })
})
```

**apps/web/tests/functional/notifications/notification_service.spec.ts**
```typescript
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import NotificationService from '#notifications/notification_service'
import PushToken from '#notifications/models/push_token'
import User from '#users/models/user'

test.group('NotificationService', (group) => {
  let service: NotificationService

  group.each.setup(() => testUtils.db().withGlobalTransaction())

  group.setup(() => {
    service = new NotificationService()
  })

  test('should send notification to user', async ({ assert }) => {
    const user = await User.create({
      email: 'notify@example.com',
      password: 'password123',
      fullName: 'Notify User',
    })

    await PushToken.create({
      userId: user.id,
      token: 'ExponentPushToken[valid]',
      platform: 'ios',
      isActive: true,
    })

    // Note: Ceci enverra réellement une notification en test
    // Vous devriez mocker expo-server-sdk pour les tests
    const tickets = await service.sendPushNotification(user.id, {
      title: 'Test',
      body: 'Test notification',
      sound: true,
    })

    assert.isArray(tickets)
  })

  test('should not send to inactive tokens', async ({ assert }) => {
    const user = await User.create({
      email: 'inactive@example.com',
      password: 'password123',
      fullName: 'Inactive User',
    })

    await PushToken.create({
      userId: user.id,
      token: 'ExponentPushToken[inactive]',
      platform: 'ios',
      isActive: false,
    })

    const tickets = await service.sendPushNotification(user.id, {
      title: 'Test',
      body: 'Should not send',
    })

    assert.isEmpty(tickets)
  })

  test('should broadcast to all active users', async ({ assert }) => {
    // Créer plusieurs utilisateurs avec tokens
    const users = await User.createMany([
      { email: 'user1@example.com', password: 'password123', fullName: 'User 1' },
      { email: 'user2@example.com', password: 'password123', fullName: 'User 2' },
    ])

    await PushToken.createMany([
      { userId: users[0].id, token: 'Token1', platform: 'ios', isActive: true },
      { userId: users[1].id, token: 'Token2', platform: 'android', isActive: true },
    ])

    await service.broadcastNotification({
      title: 'Broadcast',
      body: 'Message pour tous',
    })

    // Vérifier que tous les tokens ont été mis à jour
    const tokens = await PushToken.query().whereNotNull('last_used_at')
    assert.lengthOf(tokens, 2)
  })
})
```

### 3. Configuration des tests

**apps/mobile/package.json** (ajout des scripts)
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "@testing-library/react-native": "^12.7.2",
    "@testing-library/jest-native": "^5.4.3",
    "jest": "^29.7.0",
    "jest-expo": "^54.0.0"
  }
}
```

**apps/web/.env.test**
```env
NODE_ENV=test
DB_CONNECTION=sqlite
DB_DATABASE=:memory:
SESSION_DRIVER=memory
NOTIFICATIONS_ENABLED=false
```

---

## Déploiement

### 1. Variables d'environnement

**apps/web/.env.production**
```env
# Expo
EXPO_ACCESS_TOKEN=your_expo_access_token_here

# Notifications
NOTIFICATIONS_ENABLED=true

# Database (déjà configuré)
DB_CONNECTION=pg
DB_HOST=your_db_host
DB_PORT=5432
```

**apps/mobile/.env.production**
```env
EXPO_PUBLIC_API_URL=https://your-api.com
EXPO_PUBLIC_PROJECT_ID=your_expo_project_id
```

### 2. Railway deployment

Le backend est déjà configuré pour Railway. Ajoutez simplement les variables d'environnement dans le dashboard Railway.

### 3. Expo EAS Build

**apps/mobile/eas.json**
```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-staging-api.com"
      }
    },
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-staging-api.com"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-production-api.com"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### 4. Build et déploiement

```bash
# Backend (automatique via Railway)
git push origin main

# Mobile
cd apps/mobile
eas build --platform ios --profile production
eas build --platform android --profile production
eas submit --platform ios
eas submit --platform android
```

---

## Commandes utiles

```bash
# Développement
pnpm dev                                    # Tous les apps
pnpm --filter mobile start                  # Mobile uniquement
pnpm --filter web dev                       # Backend uniquement

# Tests
pnpm --filter mobile test                   # Tests mobile
pnpm --filter web test                      # Tests backend
pnpm --filter mobile test:coverage          # Coverage mobile

# Database
pnpm --filter web run migration:run         # Exécuter migrations
pnpm --filter web run migration:rollback    # Rollback migrations

# Build
pnpm build                                  # Build tout
cd apps/mobile && npx expo prebuild         # Après modif app.json

# Tuyau
pnpm --filter web tuyau:generate            # Générer types API
```

---

## Checklist d'implémentation

### Phase 1: Setup
- [ ] Créer `packages/notifications-types` avec les types partagés
- [ ] Ajouter les dépendances mobile (`expo-notifications`, etc.)
- [ ] Ajouter les dépendances backend (`expo-server-sdk`)
- [ ] Configurer `apps/mobile/app.json`

### Phase 2: Backend
- [ ] Créer la migration `create_push_tokens_table`
- [ ] Créer le modèle `PushToken`
- [ ] Créer `NotificationService`
- [ ] Créer `PushTokensController` et validators
- [ ] Ajouter les routes dans `start/routes.ts`
- [ ] Créer `config/notifications.ts`

### Phase 3: Mobile
- [ ] Créer `lib/notifications.ts` avec hooks
- [ ] Créer `lib/notificationService.ts`
- [ ] Créer `components/NotificationToggle.tsx`
- [ ] Initialiser dans `app/_layout.tsx`
- [ ] Ajouter à la page Settings

### Phase 4: Tests
- [ ] Tests unitaires mobile (`notifications.test.ts`)
- [ ] Tests composant (`NotificationToggle.test.tsx`)
- [ ] Tests backend (`push_tokens.spec.ts`)
- [ ] Tests service (`notification_service.spec.ts`)

### Phase 5: Intégration
- [ ] Générer les types Tuyau
- [ ] Configurer le client Tuyau mobile
- [ ] Tester l'envoi de notifications depuis le backend
- [ ] Tester la réception sur mobile

### Phase 6: Déploiement
- [ ] Configurer les variables d'environnement Railway
- [ ] Configurer EAS Build
- [ ] Tester en staging
- [ ] Déployer en production

---

## Ressources

- [Documentation Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [expo-server-sdk](https://github.com/expo/expo-server-sdk-node)
- [Tuyau Documentation](https://tuyau.dev)
- [AdonisJS Testing](https://docs.adonisjs.com/guides/testing)
- [Jest Expo Preset](https://docs.expo.dev/develop/unit-testing/)

---

## Support

Pour toute question ou problème:
1. Consulter la section troubleshooting du guide original
2. Vérifier les logs Railway (backend)
3. Vérifier les logs Expo (mobile via `npx expo start`)
4. Vérifier la documentation Expo Notifications

---

**Dernière mise à jour:** 2026-01-26
**Version:** 1.0.0
**Auteur:** Claude Code
