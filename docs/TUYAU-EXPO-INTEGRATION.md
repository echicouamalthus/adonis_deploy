# Intégration Tuyau avec Expo React Native

Guide complet pour intégrer Tuyau (client API type-safe) avec React Query dans une application Expo React Native, du typage des variables d'environnement jusqu'au rendu dans les vues.

## Table des matières

1. [Architecture](#1-architecture)
2. [Prérequis](#2-prérequis)
3. [Configuration Backend (AdonisJS)](#3-configuration-backend-adonisjs)
4. [Configuration Frontend (Expo)](#4-configuration-frontend-expo)
5. [Typage des variables d'environnement](#5-typage-des-variables-denvironnement)
6. [Client Tuyau](#6-client-tuyau)
7. [Provider React Query](#7-provider-react-query)
8. [Hooks React Query](#8-hooks-react-query)
9. [Utilisation dans les vues](#9-utilisation-dans-les-vues)
10. [Gestion de l'authentification](#10-gestion-de-lauthentification)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Architecture

```
monorepo/
├── apps/
│   ├── web/                          # AdonisJS Backend
│   │   ├── .adonisjs/
│   │   │   └── api.ts                # Types API auto-générés
│   │   └── config/
│   │       └── cors.ts               # Configuration CORS
│   └── mobile/                       # Expo React Native
│       ├── lib/
│       │   └── tuyau.ts              # Client Tuyau + QueryClient
│       ├── hooks/
│       │   ├── useAuth.ts            # Hooks authentification
│       │   ├── useUsers.ts           # Hooks CRUD users
│       │   └── useHello.ts           # Hook test API
│       └── app/
│           ├── _layout.tsx           # Provider React Query
│           └── index.tsx             # Page d'accueil
```

### Flux de données

```
┌─────────────────────────────────────────────────────────────┐
│                     EXPO MOBILE APP                         │
├─────────────────────────────────────────────────────────────┤
│  Vue (index.tsx)                                            │
│       │                                                     │
│       ▼                                                     │
│  Hook React Query (useHello.ts)                             │
│       │                                                     │
│       ▼                                                     │
│  Client Tuyau (tuyau.ts) ──── Types ──► api.ts (AdonisJS)  │
│       │                                                     │
└───────┼─────────────────────────────────────────────────────┘
        │ HTTP Request
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    ADONISJS BACKEND                         │
├─────────────────────────────────────────────────────────────┤
│  CORS Middleware ──► Route ──► Controller ──► Response     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Prérequis

### Dépendances à installer

```bash
# Dans apps/mobile
cd apps/mobile

# React Query et Tuyau (déjà installés si vous suivez le guide)
pnpm add @tanstack/react-query @tuyau/client

# AsyncStorage pour l'authentification
npx expo install @react-native-async-storage/async-storage
```

### Vérifier le package.json

```json
{
  "dependencies": {
    "@tanstack/react-query": "^5.90.16",
    "@tuyau/client": "^0.2.10"
  }
}
```

---

## 3. Configuration Backend (AdonisJS)

### Étape 3.1 : Configurer CORS

Modifier `apps/web/config/cors.ts` :

```typescript
import { defineConfig } from '@adonisjs/cors'

const corsConfig = defineConfig({
  enabled: true,
  origin: (requestOrigin) => {
    const allowedOrigins = [
      'http://localhost:8081',    // Expo web
      'http://localhost:19006',   // Expo web (ancien port)
      'http://localhost:3000',    // Next.js ou autre
      'http://10.0.2.2:8081',     // Android Emulator
    ]

    if (process.env.NODE_ENV === 'production') {
      allowedOrigins.push('https://votre-domaine.com')
    }

    return allowedOrigins.includes(requestOrigin)
  },
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  headers: true,
  exposeHeaders: [],
  credentials: true,
  maxAge: 90,
})

export default corsConfig
```

### Étape 3.2 : Générer les types Tuyau

```bash
cd apps/web
node ace tuyau:generate
```

Cela génère `apps/web/.adonisjs/api.ts` avec tous les types de votre API.

### Étape 3.3 : Redémarrer le serveur

```bash
# Arrêter (Ctrl+C) puis relancer
pnpm dev:web
```

---

## 4. Configuration Frontend (Expo)

### Étape 4.1 : Structure des dossiers

Créer la structure suivante dans `apps/mobile/` :

```
apps/mobile/
├── lib/
│   └── tuyau.ts
├── hooks/
│   ├── useAuth.ts
│   ├── useUsers.ts
│   └── useHello.ts
└── app/
    ├── _layout.tsx
    └── index.tsx
```

---

## 5. Typage des variables d'environnement

### Étape 5.1 : Créer le fichier .env

Créer `apps/mobile/.env` :

```bash
# URL de l'API AdonisJS
EXPO_PUBLIC_API_URL=http://localhost:3333
```

### Étape 5.2 : Typer les variables d'environnement

Créer `apps/mobile/env.d.ts` :

```typescript
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_API_URL: string;
    }
  }
}

export {};
```

### Étape 5.3 : Ajouter au tsconfig.json

Modifier `apps/mobile/tsconfig.json` :

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts",
    "env.d.ts"
  ]
}
```

---

## 6. Client Tuyau

### Étape 6.1 : Créer le client Tuyau

Créer `apps/mobile/lib/tuyau.ts` :

```typescript
import { createTuyau } from '@tuyau/client';
import { api } from '../../web/.adonisjs/api';
import { QueryClient } from '@tanstack/react-query';

/**
 * Configuration du QueryClient React Query
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * URL de l'API avec fallback
 */
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333';

/**
 * Client Tuyau type-safe
 */
export const tuyau = createTuyau({
  api,
  baseUrl: API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

/**
 * Export du type pour l'autocomplétion
 */
export type TuyauClient = typeof tuyau;
```

---

## 7. Provider React Query

### Étape 7.1 : Configurer le Provider

Modifier `apps/mobile/app/_layout.tsx` :

```typescript
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/tuyau';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Accueil' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </QueryClientProvider>
  );
}
```

---

## 8. Hooks React Query

### Étape 8.1 : Hook de test API (useHello)

Créer `apps/mobile/hooks/useHello.ts` :

```typescript
import { useQuery } from '@tanstack/react-query';
import { tuyau } from '@/lib/tuyau';

/**
 * Hook pour tester la connexion à l'API
 * Endpoint: GET /api/hello
 */
export const useHello = () => {
  return useQuery({
    queryKey: ['hello'],
    queryFn: async () => {
      const response = await tuyau.api.hello.$get();

      if (response.error) {
        throw new Error(response.error.message || 'Erreur API');
      }

      return response.data;
    },
  });
};
```

### Étape 8.2 : Hooks CRUD Users (useUsers)

Créer `apps/mobile/hooks/useUsers.ts` :

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tuyau } from '@/lib/tuyau';

/**
 * GET - Liste des utilisateurs
 */
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await tuyau.users.$get();

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors du chargement');
      }

      return response.data;
    },
  });
};

/**
 * POST - Créer un utilisateur
 */
export const useCreateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      fullName: string;
      email: string;
      password: string;
      roleId: number;
    }) => {
      const response = await tuyau.users.$post(data);

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la création');
      }

      return response.data;
    },
    onSuccess: () => {
      // Invalider le cache pour recharger la liste
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

/**
 * PUT - Mettre à jour un utilisateur
 */
export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: number;
      fullName?: string;
      email?: string;
    }) => {
      const response = await tuyau.users({ id }).$put(data);

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la mise à jour');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};

/**
 * DELETE - Supprimer un utilisateur
 */
export const useDeleteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const response = await tuyau.users({ id }).$delete();

      if (response.error) {
        throw new Error(response.error.message || 'Erreur lors de la suppression');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
```

### Étape 8.3 : Hooks Authentification (useAuth)

Créer `apps/mobile/hooks/useAuth.ts` :

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tuyau } from '@/lib/tuyau';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const TOKEN_KEY = 'auth_token';

/**
 * POST - Connexion
 */
export const useSignIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const response = await tuyau.login.$post(credentials);

      if (response.error) {
        throw new Error(response.error.message || 'Identifiants invalides');
      }

      return response.data;
    },
    onSuccess: async (data) => {
      // Stocker le token si présent
      if (data?.token) {
        await AsyncStorage.setItem(TOKEN_KEY, data.token);
      }
      // Rediriger vers l'accueil
      router.replace('/(tabs)');
    },
  });
};

/**
 * POST - Inscription
 */
export const useSignUp = () => {
  return useMutation({
    mutationFn: async (data: {
      fullName: string;
      email: string;
      password: string;
    }) => {
      const response = await tuyau['sign-up'].$post(data);

      if (response.error) {
        throw new Error(response.error.message || "Erreur lors de l'inscription");
      }

      return response.data;
    },
    onSuccess: () => {
      router.replace('/login');
    },
  });
};

/**
 * GET - Déconnexion
 */
export const useSignOut = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await tuyau.logout.$get();
      await AsyncStorage.removeItem(TOKEN_KEY);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
    onSuccess: () => {
      // Vider tout le cache
      queryClient.clear();
      router.replace('/login');
    },
  });
};

/**
 * POST - Mot de passe oublié
 */
export const useForgotPassword = () => {
  return useMutation({
    mutationFn: async (data: { email: string }) => {
      const response = await tuyau['forgot-password'].$post(data);

      if (response.error) {
        throw new Error(response.error.message);
      }

      return response.data;
    },
  });
};
```

---

## 9. Utilisation dans les vues

### Étape 9.1 : Page d'accueil avec test API

Modifier `apps/mobile/app/index.tsx` :

```typescript
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useHello } from '@/hooks/useHello';

export default function HomeScreen() {
  const { data, isLoading, error, refetch } = useHello();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Test API Tuyau</Text>

      {/* État de chargement */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      )}

      {/* Erreur */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Erreur: {error.message}</Text>
          <Text style={styles.retryText} onPress={() => refetch()}>
            Réessayer
          </Text>
        </View>
      )}

      {/* Données */}
      {data && (
        <View style={styles.successContainer}>
          <Text style={styles.successText}>Connexion réussie !</Text>
          <Text style={styles.dataText}>
            {JSON.stringify(data, null, 2)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: '#ffebee',
    padding: 20,
    borderRadius: 10,
  },
  errorText: {
    color: '#c62828',
    marginBottom: 10,
  },
  retryText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  successContainer: {
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 20,
    borderRadius: 10,
  },
  successText: {
    color: '#2e7d32',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  dataText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#333',
  },
});
```

### Étape 9.2 : Liste des utilisateurs

Créer `apps/mobile/app/users.tsx` :

```typescript
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useUsers, useDeleteUser } from '@/hooks/useUsers';

export default function UsersScreen() {
  const { data: users, isLoading, error, refetch, isRefetching } = useUsers();
  const deleteUser = useDeleteUser();

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Confirmation', `Supprimer ${name} ?`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteUser.mutate(id, {
            onError: (error) => Alert.alert('Erreur', error.message),
          });
        },
      },
    ]);
  };

  // Chargement initial
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Chargement des utilisateurs...</Text>
      </View>
    );
  }

  // Erreur
  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error.message}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Liste des utilisateurs
  return (
    <FlatList
      data={users}
      keyExtractor={(item) => item.id.toString()}
      renderItem={({ item }) => (
        <View style={styles.userCard}>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.fullName}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
          </View>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDelete(item.id, item.fullName)}
          >
            <Text style={styles.deleteButtonText}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      contentContainerStyle={styles.list}
      ListEmptyComponent={
        <Text style={styles.emptyText}>Aucun utilisateur</Text>
      }
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  errorText: {
    color: '#c62828',
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    padding: 15,
  },
  userCard: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  deleteButton: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 50,
    fontSize: 16,
  },
});
```

### Étape 9.3 : Page de connexion

Créer `apps/mobile/app/login.tsx` :

```typescript
import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSignIn } from '@/hooks/useAuth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const signIn = useSignIn();

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    signIn.mutate(
      { email: email.trim(), password },
      {
        onError: (error) => {
          Alert.alert('Erreur de connexion', error.message);
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.form}>
        <Text style={styles.title}>Connexion</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, signIn.isPending && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={signIn.isPending}
        >
          {signIn.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>

        {signIn.isError && (
          <Text style={styles.errorText}>{signIn.error.message}</Text>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 40,
    textAlign: 'center',
    color: '#333',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
    marginTop: 15,
  },
});
```

---

## 10. Gestion de l'authentification

### Étape 10.1 : Client Tuyau avec token

Pour les requêtes authentifiées, créer un client avec le token :

```typescript
// lib/tuyau.ts (version avec authentification)
import { createTuyau } from '@tuyau/client';
import { api } from '../../web/.adonisjs/api';
import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
    },
  },
});

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333';

// Client de base (sans auth)
export const tuyau = createTuyau({
  api,
  baseUrl: API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// Fonction pour créer un client authentifié
export const createAuthenticatedClient = async () => {
  const token = await AsyncStorage.getItem('auth_token');

  return createTuyau({
    api,
    baseUrl: API_URL,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
};
```

---

## 11. Troubleshooting

### Erreur CORS

```
Access to fetch at 'http://localhost:3333/api/hello' from origin
'http://localhost:8081' has been blocked by CORS policy
```

**Solution** :
1. Vérifier `apps/web/config/cors.ts`
2. Ajouter `http://localhost:8081` dans `allowedOrigins`
3. Redémarrer le serveur AdonisJS

### Erreur "Network request failed"

**Solutions** :
1. Vérifier que le backend tourne (`pnpm dev:web`)
2. Android Emulator : utiliser `http://10.0.2.2:3333`
3. Device physique : utiliser votre IP locale

### Types non reconnus

**Solution** :
```bash
cd apps/web
node ace tuyau:generate
```

### Module '@/lib/tuyau' introuvable

**Solution** : Vérifier `tsconfig.json` :
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## Récapitulatif des fichiers

```
apps/mobile/
├── .env                          # Variables d'environnement
├── env.d.ts                      # Typage des variables
├── tsconfig.json                 # Configuration TypeScript
├── lib/
│   └── tuyau.ts                  # Client Tuyau + QueryClient
├── hooks/
│   ├── useAuth.ts                # signIn, signUp, signOut
│   ├── useUsers.ts               # CRUD users
│   └── useHello.ts               # Test API
└── app/
    ├── _layout.tsx               # Provider React Query
    ├── index.tsx                 # Page d'accueil
    ├── login.tsx                 # Page connexion
    └── users.tsx                 # Liste utilisateurs
```

---

## Commandes utiles

```bash
# Lancer le backend
pnpm dev:web

# Lancer l'app mobile
cd apps/mobile && pnpm start

# Régénérer les types Tuyau
cd apps/web && node ace tuyau:generate

# Installer une dépendance Expo
cd apps/mobile && npx expo install <package>

# Vider le cache Expo
cd apps/mobile && npx expo start --clear
```
