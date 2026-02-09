# Intégration Transmit avec Expo React Native

Guide complet pour intégrer Transmit (Server-Sent Events) avec React Query dans une application Expo React Native, pour les fonctionnalités temps réel.

> **Prérequis** : Avoir déjà configuré Tuyau selon [TUYAU-EXPO-INTEGRATION.md](./TUYAU-EXPO-INTEGRATION.md). Transmit est **complémentaire** à Tuyau, pas un remplacement.

---

## Table des matières

1. [Architecture](#1-architecture)
2. [Tuyau vs Transmit](#2-tuyau-vs-transmit)
3. [Configuration Backend (AdonisJS)](#3-configuration-backend-adonisjs)
4. [Configuration Frontend (Expo)](#4-configuration-frontend-expo)
5. [Client Transmit](#5-client-transmit)
6. [Hooks temps réel](#6-hooks-temps-réel)
7. [Intégration avec React Query](#7-intégration-avec-react-query)
8. [Utilisation dans les vues](#8-utilisation-dans-les-vues)
9. [Channels et événements](#9-channels-et-événements)
10. [Gestion de la reconnexion](#10-gestion-de-la-reconnexion)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     EXPO MOBILE APP                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐      ┌─────────────────────────┐      │
│  │     TUYAU           │      │      TRANSMIT           │      │
│  │   (HTTP REST)       │      │   (SSE Real-time)       │      │
│  ├─────────────────────┤      ├─────────────────────────┤      │
│  │ • useProducts()     │      │ • useOrderUpdates()     │      │
│  │ • useCreateOrder()  │      │ • useStockUpdates()     │      │
│  │ • useCart()         │      │ • useNotifications()    │      │
│  │ • useAuth()         │      │                         │      │
│  └──────────┬──────────┘      └───────────┬─────────────┘      │
│             │                             │                     │
│             │  Request/Response           │  Server → Client    │
│             │  (bidirectionnel)           │  (unidirectionnel)  │
│             │                             │                     │
└─────────────┼─────────────────────────────┼─────────────────────┘
              │                             │
              ▼                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADONISJS BACKEND                             │
├─────────────────────────────────────────────────────────────────┤
│  REST Controllers              Transmit Channels                │
│  ─────────────────             ─────────────────                │
│  POST /api/orders       →      orders/{userId}                  │
│  GET /api/products      →      products/stock                   │
│  PUT /api/cart          →      notifications/{userId}           │
└─────────────────────────────────────────────────────────────────┘
```

### Flux de données temps réel

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Backend    │         │   Transmit   │         │  Mobile App  │
│   Action     │────────▶│   Channel    │────────▶│   Hook       │
└──────────────┘         └──────────────┘         └──────────────┘
                                                          │
                                                          ▼
                                                  ┌──────────────┐
                                                  │ React Query  │
                                                  │ Cache Update │
                                                  └──────────────┘
                                                          │
                                                          ▼
                                                  ┌──────────────┐
                                                  │  UI Update   │
                                                  │  (re-render) │
                                                  └──────────────┘
```

---

## 2. Tuyau vs Transmit

| Aspect | Tuyau | Transmit |
|--------|-------|----------|
| **Protocole** | HTTP REST | SSE (Server-Sent Events) |
| **Direction** | Bidirectionnel | Serveur → Client uniquement |
| **Connexion** | Nouvelle à chaque requête | Persistante |
| **Usage principal** | CRUD, mutations | Notifications, live updates |
| **React Query** | useQuery, useMutation | Invalide le cache |

### Quand utiliser quoi ?

```
TUYAU (Actions utilisateur)          TRANSMIT (Événements serveur)
════════════════════════════         ═══════════════════════════════
✓ Charger la liste des produits     ✓ Produit en rupture de stock
✓ Créer une commande                ✓ Statut commande mis à jour
✓ Modifier le panier                ✓ Nouvelle notification
✓ Se connecter / déconnecter        ✓ Prix modifié en temps réel
✓ Mettre à jour le profil           ✓ Livreur en route
```

---

## 3. Configuration Backend (AdonisJS)

### Étape 3.1 : Installer Transmit

```bash
cd apps/web
node ace add @adonisjs/transmit
```

### Étape 3.2 : Configurer Transmit

Vérifier `apps/web/config/transmit.ts` :

```typescript
import { defineConfig } from '@adonisjs/transmit'

export default defineConfig({
  pingInterval: '30s',
  transport: {
    driver: 'redis',  // ou 'memory' pour dev
  },
})
```

### Étape 3.3 : Créer les channels

Créer `apps/web/start/transmit.ts` :

```typescript
import transmit from '@adonisjs/transmit/services/main'

/**
 * Channel pour les mises à jour de commandes d'un utilisateur
 * Pattern: orders/{userId}
 */
transmit.authorize<{ userId: string }>('orders/:userId', (ctx, { userId }) => {
  // Vérifier que l'utilisateur peut s'abonner à ce channel
  return ctx.auth.user?.id.toString() === userId
})

/**
 * Channel pour les mises à jour de stock (public)
 * Pattern: products/stock
 */
transmit.authorize('products/stock', () => {
  return true // Accessible à tous les utilisateurs connectés
})

/**
 * Channel pour les notifications d'un utilisateur
 * Pattern: notifications/{userId}
 */
transmit.authorize<{ userId: string }>('notifications/:userId', (ctx, { userId }) => {
  return ctx.auth.user?.id.toString() === userId
})

/**
 * Channel admin pour les nouvelles commandes
 * Pattern: admin/orders
 */
transmit.authorize('admin/orders', (ctx) => {
  return ctx.auth.user?.role === 'admin'
})
```

### Étape 3.4 : Émettre des événements

Dans tes services, émettre des événements quand quelque chose change :

```typescript
// apps/web/app/bakery/services/order_service.ts
import transmit from '@adonisjs/transmit/services/main'
import Order from '#bakery/models/order'

export default class OrderService {
  /**
   * Mettre à jour le statut d'une commande
   */
  async updateStatus(orderId: string, status: OrderStatus) {
    const order = await Order.findOrFail(orderId)
    order.status = status
    await order.save()

    // Notifier le client
    transmit.broadcast(`orders/${order.userId}`, {
      type: 'order:status_changed',
      payload: {
        orderId: order.id,
        status: status,
        updatedAt: new Date().toISOString(),
      },
    })

    // Notifier les admins si commande confirmée
    if (status === 'confirmed') {
      transmit.broadcast('admin/orders', {
        type: 'order:confirmed',
        payload: {
          orderId: order.id,
          customerName: order.customer.fullName,
          total: order.total,
        },
      })
    }

    return order
  }

  /**
   * Mettre à jour le stock d'un produit
   */
  async updateProductStock(productId: string, quantity: number) {
    const product = await Product.findOrFail(productId)
    product.stock = quantity
    await product.save()

    // Notifier tous les clients du changement de stock
    transmit.broadcast('products/stock', {
      type: 'product:stock_changed',
      payload: {
        productId: product.id,
        stock: quantity,
        inStock: quantity > 0,
      },
    })

    // Si rupture de stock
    if (quantity === 0) {
      transmit.broadcast('products/stock', {
        type: 'product:out_of_stock',
        payload: {
          productId: product.id,
          name: product.name,
        },
      })
    }

    return product
  }
}
```

### Étape 3.5 : Configurer CORS pour SSE

Modifier `apps/web/config/cors.ts` :

```typescript
import { defineConfig } from '@adonisjs/cors'

export default defineConfig({
  enabled: true,
  origin: (requestOrigin) => {
    const allowedOrigins = [
      'http://localhost:8081',    // Expo web
      'http://localhost:19006',   // Expo web (ancien port)
      'http://10.0.2.2:8081',     // Android Emulator
    ]

    if (process.env.NODE_ENV === 'production') {
      allowedOrigins.push('https://votre-domaine.com')
    }

    // Mobile apps n'envoient pas d'Origin header
    if (!requestOrigin) {
      return true
    }

    return allowedOrigins.includes(requestOrigin)
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})
```

---

## 4. Configuration Frontend (Expo)

### Étape 4.1 : Installer les dépendances

```bash
cd apps/mobile
pnpm add @adonisjs/transmit-client
```

### Étape 4.2 : Structure des dossiers

```
apps/mobile/
├── lib/
│   ├── tuyau.ts                  # Client HTTP (existant)
│   └── transmit.ts               # Client SSE (nouveau)
├── hooks/
│   ├── useAuth.ts                # Tuyau
│   ├── useProducts.ts            # Tuyau
│   ├── useOrders.ts              # Tuyau
│   └── realtime/
│       ├── useOrderUpdates.ts    # Transmit
│       ├── useStockUpdates.ts    # Transmit
│       └── useNotifications.ts   # Transmit
└── app/
    ├── _layout.tsx               # Providers
    └── (tabs)/
        └── orders.tsx            # Vue avec temps réel
```

---

## 5. Client Transmit

### Étape 5.1 : Créer le client

Créer `apps/mobile/lib/transmit.ts` :

```typescript
import { Transmit } from '@adonisjs/transmit-client'
import AsyncStorage from '@react-native-async-storage/async-storage'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333'

/**
 * Client Transmit pour les connexions SSE temps réel
 */
export const transmit = new Transmit({
  baseUrl: API_URL,
})

/**
 * Créer un client Transmit authentifié
 * À utiliser pour les channels privés (orders/{userId}, notifications/{userId})
 */
export const createAuthenticatedTransmit = async () => {
  const token = await AsyncStorage.getItem('auth_token')

  return new Transmit({
    baseUrl: API_URL,
    beforeSubscribe: async (request) => {
      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`)
      }
    },
  })
}

/**
 * Types d'événements Transmit
 */
export interface TransmitEvent<T = unknown> {
  type: string
  payload: T
}

// Types spécifiques par channel
export interface OrderStatusChangedEvent {
  type: 'order:status_changed'
  payload: {
    orderId: string
    status: string
    updatedAt: string
  }
}

export interface ProductStockChangedEvent {
  type: 'product:stock_changed'
  payload: {
    productId: string
    stock: number
    inStock: boolean
  }
}

export interface ProductOutOfStockEvent {
  type: 'product:out_of_stock'
  payload: {
    productId: string
    name: string
  }
}

export interface NotificationEvent {
  type: 'notification:new'
  payload: {
    id: string
    title: string
    message: string
    createdAt: string
  }
}

export type OrderChannelEvent = OrderStatusChangedEvent
export type ProductChannelEvent = ProductStockChangedEvent | ProductOutOfStockEvent
export type NotificationChannelEvent = NotificationEvent
```

---

## 6. Hooks temps réel

### Étape 6.1 : Hook pour les mises à jour de commandes

Créer `apps/mobile/hooks/realtime/useOrderUpdates.ts` :

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Transmit } from '@adonisjs/transmit-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { OrderChannelEvent } from '@/lib/transmit'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333'

interface UseOrderUpdatesOptions {
  userId: string | undefined
  enabled?: boolean
  onStatusChange?: (orderId: string, status: string) => void
}

/**
 * Hook pour écouter les mises à jour de commandes en temps réel
 */
export function useOrderUpdates({
  userId,
  enabled = true,
  onStatusChange,
}: UseOrderUpdatesOptions) {
  const queryClient = useQueryClient()
  const transmitRef = useRef<Transmit | null>(null)
  const subscriptionRef = useRef<ReturnType<Transmit['subscription']> | null>(null)

  const connect = useCallback(async () => {
    if (!userId || !enabled) return

    try {
      // Récupérer le token pour l'authentification
      const token = await AsyncStorage.getItem('auth_token')

      // Créer le client Transmit
      transmitRef.current = new Transmit({
        baseUrl: API_URL,
        beforeSubscribe: async (request) => {
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`)
          }
        },
      })

      // S'abonner au channel
      const channel = `orders/${userId}`
      subscriptionRef.current = transmitRef.current.subscription(channel)

      // Créer la souscription
      await subscriptionRef.current.create()

      // Écouter les messages
      subscriptionRef.current.onMessage((data: OrderChannelEvent) => {
        console.log(`[Transmit] Order event received:`, data)

        switch (data.type) {
          case 'order:status_changed':
            // Invalider le cache de la commande spécifique
            queryClient.invalidateQueries({
              queryKey: ['order', data.payload.orderId],
            })
            // Invalider la liste des commandes
            queryClient.invalidateQueries({
              queryKey: ['orders'],
            })
            // Callback optionnel
            onStatusChange?.(data.payload.orderId, data.payload.status)
            break
        }
      })

      console.log(`[Transmit] Connected to channel: ${channel}`)
    } catch (error) {
      console.error('[Transmit] Connection error:', error)
    }
  }, [userId, enabled, queryClient, onStatusChange])

  const disconnect = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.delete()
      subscriptionRef.current = null
    }
    if (transmitRef.current) {
      transmitRef.current = null
    }
    console.log('[Transmit] Disconnected from orders channel')
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    reconnect: connect,
    disconnect,
  }
}
```

### Étape 6.2 : Hook pour les mises à jour de stock

Créer `apps/mobile/hooks/realtime/useStockUpdates.ts` :

```typescript
import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Transmit } from '@adonisjs/transmit-client'
import { Alert } from 'react-native'
import type { ProductChannelEvent } from '@/lib/transmit'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333'

interface UseStockUpdatesOptions {
  enabled?: boolean
  showOutOfStockAlert?: boolean
}

/**
 * Hook pour écouter les changements de stock en temps réel
 */
export function useStockUpdates({
  enabled = true,
  showOutOfStockAlert = true,
}: UseStockUpdatesOptions = {}) {
  const queryClient = useQueryClient()
  const transmitRef = useRef<Transmit | null>(null)
  const subscriptionRef = useRef<ReturnType<Transmit['subscription']> | null>(null)

  const connect = useCallback(async () => {
    if (!enabled) return

    try {
      transmitRef.current = new Transmit({
        baseUrl: API_URL,
      })

      const channel = 'products/stock'
      subscriptionRef.current = transmitRef.current.subscription(channel)

      await subscriptionRef.current.create()

      subscriptionRef.current.onMessage((data: ProductChannelEvent) => {
        console.log(`[Transmit] Stock event received:`, data)

        switch (data.type) {
          case 'product:stock_changed':
            // Mettre à jour le cache du produit
            queryClient.setQueryData(
              ['product', data.payload.productId],
              (old: any) => {
                if (!old) return old
                return {
                  ...old,
                  stock: data.payload.stock,
                  inStock: data.payload.inStock,
                }
              }
            )
            // Invalider la liste des produits
            queryClient.invalidateQueries({
              queryKey: ['products'],
            })
            break

          case 'product:out_of_stock':
            if (showOutOfStockAlert) {
              Alert.alert(
                'Rupture de stock',
                `${data.payload.name} n'est plus disponible.`
              )
            }
            // Invalider les produits
            queryClient.invalidateQueries({
              queryKey: ['products'],
            })
            queryClient.invalidateQueries({
              queryKey: ['product', data.payload.productId],
            })
            break
        }
      })

      console.log(`[Transmit] Connected to channel: ${channel}`)
    } catch (error) {
      console.error('[Transmit] Stock connection error:', error)
    }
  }, [enabled, queryClient, showOutOfStockAlert])

  const disconnect = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.delete()
      subscriptionRef.current = null
    }
    if (transmitRef.current) {
      transmitRef.current = null
    }
  }, [])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return { reconnect: connect, disconnect }
}
```

### Étape 6.3 : Hook pour les notifications

Créer `apps/mobile/hooks/realtime/useNotifications.ts` :

```typescript
import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Transmit } from '@adonisjs/transmit-client'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { NotificationChannelEvent } from '@/lib/transmit'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333'

interface Notification {
  id: string
  title: string
  message: string
  createdAt: string
  read: boolean
}

interface UseNotificationsOptions {
  userId: string | undefined
  enabled?: boolean
  onNewNotification?: (notification: Notification) => void
}

/**
 * Hook pour écouter les notifications en temps réel
 */
export function useNotifications({
  userId,
  enabled = true,
  onNewNotification,
}: UseNotificationsOptions) {
  const queryClient = useQueryClient()
  const transmitRef = useRef<Transmit | null>(null)
  const subscriptionRef = useRef<ReturnType<Transmit['subscription']> | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const connect = useCallback(async () => {
    if (!userId || !enabled) return

    try {
      const token = await AsyncStorage.getItem('auth_token')

      transmitRef.current = new Transmit({
        baseUrl: API_URL,
        beforeSubscribe: async (request) => {
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`)
          }
        },
      })

      const channel = `notifications/${userId}`
      subscriptionRef.current = transmitRef.current.subscription(channel)

      await subscriptionRef.current.create()

      subscriptionRef.current.onMessage((data: NotificationChannelEvent) => {
        console.log(`[Transmit] Notification received:`, data)

        if (data.type === 'notification:new') {
          const notification: Notification = {
            ...data.payload,
            read: false,
          }

          // Mettre à jour le cache des notifications
          queryClient.setQueryData(['notifications'], (old: Notification[] = []) => {
            return [notification, ...old]
          })

          // Incrémenter le compteur
          setUnreadCount((prev) => prev + 1)

          // Callback optionnel
          onNewNotification?.(notification)
        }
      })

      console.log(`[Transmit] Connected to channel: ${channel}`)
    } catch (error) {
      console.error('[Transmit] Notifications connection error:', error)
    }
  }, [userId, enabled, queryClient, onNewNotification])

  const disconnect = useCallback(() => {
    if (subscriptionRef.current) {
      subscriptionRef.current.delete()
      subscriptionRef.current = null
    }
    if (transmitRef.current) {
      transmitRef.current = null
    }
  }, [])

  const markAsRead = useCallback((notificationId: string) => {
    queryClient.setQueryData(['notifications'], (old: Notification[] = []) => {
      return old.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    })
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [queryClient])

  const markAllAsRead = useCallback(() => {
    queryClient.setQueryData(['notifications'], (old: Notification[] = []) => {
      return old.map((n) => ({ ...n, read: true }))
    })
    setUnreadCount(0)
  }, [queryClient])

  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    unreadCount,
    markAsRead,
    markAllAsRead,
    reconnect: connect,
    disconnect,
  }
}
```

---

## 7. Intégration avec React Query

### Étape 7.1 : Provider combiné

Modifier `apps/mobile/app/_layout.tsx` :

```typescript
import { Stack } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/tuyau'
import { StatusBar } from 'expo-status-bar'
import { useAuth } from '@/hooks/useAuth'
import { useOrderUpdates } from '@/hooks/realtime/useOrderUpdates'
import { useStockUpdates } from '@/hooks/realtime/useStockUpdates'
import { useNotifications } from '@/hooks/realtime/useNotifications'
import { Alert } from 'react-native'

function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  // Connexions temps réel
  useOrderUpdates({
    userId: user?.id,
    enabled: !!user,
    onStatusChange: (orderId, status) => {
      if (status === 'shipped') {
        Alert.alert('Commande expédiée', `Votre commande #${orderId} est en route !`)
      }
    },
  })

  useStockUpdates({
    enabled: !!user,
    showOutOfStockAlert: true,
  })

  useNotifications({
    userId: user?.id,
    enabled: !!user,
    onNewNotification: (notification) => {
      Alert.alert(notification.title, notification.message)
    },
  })

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeProvider>
        <StatusBar style="auto" />
        <Stack>
          <Stack.Screen name="index" options={{ title: 'Accueil' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </RealtimeProvider>
    </QueryClientProvider>
  )
}
```

### Étape 7.2 : Pattern de mise à jour optimiste

```typescript
// Exemple : Mise à jour optimiste du stock dans le panier
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { tuyau } from '@/lib/tuyau'

export function useAddToCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const response = await tuyau.api.cart.$post({ productId, quantity })
      if (response.error) throw new Error(response.error.message)
      return response.data
    },

    // Mise à jour optimiste
    onMutate: async ({ productId, quantity }) => {
      // Annuler les requêtes en cours
      await queryClient.cancelQueries({ queryKey: ['cart'] })

      // Snapshot du cache actuel
      const previousCart = queryClient.getQueryData(['cart'])

      // Mise à jour optimiste
      queryClient.setQueryData(['cart'], (old: any) => {
        // ... logique de mise à jour
        return old
      })

      return { previousCart }
    },

    // En cas d'erreur, rollback
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(['cart'], context.previousCart)
      }
    },

    // Toujours refetch après mutation
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] })
    },
  })
}
```

---

## 8. Utilisation dans les vues

### Étape 8.1 : Page des commandes avec temps réel

```typescript
// apps/mobile/app/(tabs)/orders.tsx
import { View, FlatList, RefreshControl, Text, StyleSheet } from 'react-native'
import { useOrders } from '@/hooks/useOrders'
import { useOrderUpdates } from '@/hooks/realtime/useOrderUpdates'
import { useAuth } from '@/hooks/useAuth'
import { OrderCard } from '@/components/organisms/OrderCard'

export default function OrdersScreen() {
  const { user } = useAuth()
  const { data: orders, isLoading, refetch, isRefetching } = useOrders()

  // Écouter les mises à jour en temps réel
  // Le cache React Query est automatiquement invalidé quand un événement arrive
  useOrderUpdates({
    userId: user?.id,
    enabled: !!user,
    onStatusChange: (orderId, status) => {
      console.log(`Order ${orderId} status changed to ${status}`)
    },
  })

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <Text>Chargement...</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Indicateur temps réel */}
      <View style={styles.realtimeIndicator}>
        <View style={styles.dot} />
        <Text style={styles.realtimeText}>Mises à jour en temps réel</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <OrderCard order={item} />}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>Aucune commande</Text>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  realtimeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#e8f5e9',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
    marginRight: 8,
  },
  realtimeText: {
    fontSize: 12,
    color: '#2e7d32',
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    color: '#999',
  },
})
```

### Étape 8.2 : Badge de notifications

```typescript
// apps/mobile/components/organisms/NotificationBadge.tsx
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useNotifications } from '@/hooks/realtime/useNotifications'
import { useAuth } from '@/hooks/useAuth'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'

export function NotificationBadge() {
  const { user } = useAuth()
  const { unreadCount } = useNotifications({
    userId: user?.id,
    enabled: !!user,
  })

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/notifications')}
    >
      <Ionicons name="notifications-outline" size={24} color="#333" />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
})
```

### Étape 8.3 : Catalogue avec stock temps réel

```typescript
// apps/mobile/app/(tabs)/index.tsx
import { View, FlatList, StyleSheet } from 'react-native'
import { useProducts } from '@/hooks/useProducts'
import { useStockUpdates } from '@/hooks/realtime/useStockUpdates'
import { ProductCard } from '@/components/organisms/ProductCard'

export default function CatalogScreen() {
  const { data: products, isLoading } = useProducts()

  // Le stock se met à jour automatiquement via Transmit
  useStockUpdates({
    enabled: true,
    showOutOfStockAlert: true,
  })

  return (
    <FlatList
      data={products}
      numColumns={2}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ProductCard
          product={item}
          // Le stock est toujours à jour grâce à Transmit
          disabled={!item.inStock}
        />
      )}
      contentContainerStyle={styles.list}
    />
  )
}

const styles = StyleSheet.create({
  list: {
    padding: 10,
  },
})
```

---

## 9. Channels et événements

### Channels pour La Fabrique

| Channel | Pattern | Accès | Événements |
|---------|---------|-------|------------|
| **Orders** | `orders/{userId}` | Authentifié (propriétaire) | `order:status_changed`, `order:delivery_updated` |
| **Stock** | `products/stock` | Public | `product:stock_changed`, `product:out_of_stock` |
| **Notifications** | `notifications/{userId}` | Authentifié (propriétaire) | `notification:new` |
| **Admin Orders** | `admin/orders` | Admin uniquement | `order:new`, `order:confirmed` |

### Structure des événements

```typescript
// Types d'événements
interface TransmitEvent<T> {
  type: string
  payload: T
}

// Exemples
// order:status_changed
{
  type: 'order:status_changed',
  payload: {
    orderId: 'order_123',
    status: 'shipped',
    updatedAt: '2024-01-15T10:30:00Z'
  }
}

// product:out_of_stock
{
  type: 'product:out_of_stock',
  payload: {
    productId: 'prod_456',
    name: 'Pain au levain'
  }
}

// notification:new
{
  type: 'notification:new',
  payload: {
    id: 'notif_789',
    title: 'Commande confirmée',
    message: 'Votre commande #123 a été confirmée',
    createdAt: '2024-01-15T10:30:00Z'
  }
}
```

---

## 10. Gestion de la reconnexion

### Hook avec reconnexion automatique

```typescript
// apps/mobile/hooks/realtime/useRealtimeConnection.ts
import { useEffect, useRef, useCallback, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import NetInfo from '@react-native-community/netinfo'

interface UseRealtimeConnectionOptions {
  connect: () => Promise<void>
  disconnect: () => void
  maxRetries?: number
  retryDelay?: number
}

export function useRealtimeConnection({
  connect,
  disconnect,
  maxRetries = 5,
  retryDelay = 3000,
}: UseRealtimeConnectionOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const appState = useRef(AppState.currentState)

  const attemptReconnect = useCallback(async () => {
    if (retryCount >= maxRetries) {
      console.log('[Transmit] Max retries reached')
      return
    }

    try {
      await connect()
      setIsConnected(true)
      setRetryCount(0)
    } catch (error) {
      console.log(`[Transmit] Reconnect attempt ${retryCount + 1} failed`)
      setRetryCount((prev) => prev + 1)
      setTimeout(attemptReconnect, retryDelay)
    }
  }, [connect, retryCount, maxRetries, retryDelay])

  // Gérer les changements d'état de l'app
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          // L'app revient au premier plan
          console.log('[Transmit] App became active, reconnecting...')
          attemptReconnect()
        } else if (nextAppState.match(/inactive|background/)) {
          // L'app passe en arrière-plan
          console.log('[Transmit] App went to background, disconnecting...')
          disconnect()
          setIsConnected(false)
        }
        appState.current = nextAppState
      }
    )

    return () => subscription.remove()
  }, [attemptReconnect, disconnect])

  // Gérer les changements de connectivité réseau
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !isConnected) {
        console.log('[Transmit] Network restored, reconnecting...')
        attemptReconnect()
      } else if (!state.isConnected && isConnected) {
        console.log('[Transmit] Network lost')
        setIsConnected(false)
      }
    })

    return () => unsubscribe()
  }, [isConnected, attemptReconnect])

  // Connexion initiale
  useEffect(() => {
    attemptReconnect()
    return () => disconnect()
  }, [])

  return {
    isConnected,
    retryCount,
    reconnect: attemptReconnect,
  }
}
```

### Utilisation avec indicateur de connexion

```typescript
// apps/mobile/components/organisms/ConnectionStatus.tsx
import { View, Text, StyleSheet } from 'react-native'

interface ConnectionStatusProps {
  isConnected: boolean
}

export function ConnectionStatus({ isConnected }: ConnectionStatusProps) {
  if (isConnected) return null

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Reconnexion en cours...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ff9800',
    padding: 8,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 12,
  },
})
```

---

## 11. Troubleshooting

### Erreur "Connection refused"

**Cause** : Le serveur AdonisJS n'est pas accessible.

**Solutions** :
1. Vérifier que le backend tourne (`pnpm dev:web`)
2. Android Emulator : utiliser `http://10.0.2.2:3333`
3. Device physique : utiliser votre IP locale

### Erreur "Unauthorized"

**Cause** : Le token d'authentification n'est pas envoyé.

**Solution** : Vérifier `beforeSubscribe` dans le client Transmit :
```typescript
const transmit = new Transmit({
  baseUrl: API_URL,
  beforeSubscribe: async (request) => {
    const token = await AsyncStorage.getItem('auth_token')
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
  },
})
```

### Événements non reçus

**Solutions** :
1. Vérifier que le channel existe côté backend
2. Vérifier l'autorisation dans `start/transmit.ts`
3. Vérifier que `transmit.broadcast()` est appelé

### Déconnexions fréquentes

**Solutions** :
1. Augmenter `pingInterval` dans la config Transmit
2. Implémenter la reconnexion automatique (section 10)
3. Vérifier la stabilité du réseau

---

## Récapitulatif des fichiers

```
apps/mobile/
├── lib/
│   ├── tuyau.ts                      # Client HTTP (existant)
│   └── transmit.ts                   # Client SSE + types
├── hooks/
│   ├── useAuth.ts                    # Tuyau
│   ├── useProducts.ts                # Tuyau
│   ├── useOrders.ts                  # Tuyau
│   └── realtime/
│       ├── useOrderUpdates.ts        # Transmit - Statut commandes
│       ├── useStockUpdates.ts        # Transmit - Stock produits
│       ├── useNotifications.ts       # Transmit - Notifications
│       └── useRealtimeConnection.ts  # Gestion reconnexion
├── components/
│   └── organisms/
│       ├── NotificationBadge.tsx     # Badge notifications
│       └── ConnectionStatus.tsx      # Indicateur connexion
└── app/
    ├── _layout.tsx                   # Providers + RealtimeProvider
    └── (tabs)/
        ├── index.tsx                 # Catalogue + stock temps réel
        └── orders.tsx                # Commandes + statut temps réel

apps/web/
├── config/
│   └── transmit.ts                   # Configuration Transmit
├── start/
│   └── transmit.ts                   # Définition des channels
└── app/bakery/services/
    └── order_service.ts              # Émission des événements
```

---

## Commandes utiles

```bash
# Installer Transmit côté backend
cd apps/web && node ace add @adonisjs/transmit

# Installer le client côté mobile
cd apps/mobile && pnpm add @adonisjs/transmit-client

# Installer NetInfo pour la gestion réseau
cd apps/mobile && npx expo install @react-native-community/netinfo

# Lancer les deux apps
pnpm dev:web    # Terminal 1
pnpm dev:mobile # Terminal 2
```
