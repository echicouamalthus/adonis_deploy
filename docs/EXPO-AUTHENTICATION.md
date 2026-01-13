# Authentication Expo Router + AdonisJS

Guide complet pour implémenter l'authentification dans une app Expo avec :
- Routes protégées via `Stack.Protected` (SDK 53+) ou Route Groups (SDK 52)
- Login persistant avec `expo-secure-store`
- Intégration AdonisJS backend
- Basé sur la [documentation officielle Expo Router](https://docs.expo.dev/router/advanced/authentication)

## Choix de l'approche

| SDK | Approche recommandée | Complexité |
|-----|---------------------|------------|
| **53+** | `Stack.Protected` + `guard` | Simple |
| **52 et moins** | Route Groups + `Redirect` | Moyenne |

Ce guide couvre les deux approches.

---

## Approche SDK 53+ : Stack.Protected (Recommandée)

### Concept
SDK 53 introduit `Stack.Protected` qui filtre automatiquement les routes selon une condition `guard`.

### Architecture

```
apps/mobile/
├── app/
│   ├── _layout.tsx           # Stack.Protected + Providers
│   ├── sign-in.tsx           # Toujours accessible (hors protected)
│   ├── sign-up.tsx           # Toujours accessible (hors protected)
│   └── (app)/                # Groupe protégé par guard
│       ├── _layout.tsx       # Tabs layout
│       └── (tabs)/
│           ├── home/index.tsx
│           ├── settings/index.tsx
│           └── profile/index.tsx
├── contexts/
│   └── ctx.tsx               # SessionProvider + useSession
├── lib/
│   ├── tuyau.ts              # Client API AdonisJS
│   └── useStorageState.ts    # Hook stockage persistant
```

### Étape 1 : useStorageState.ts

```typescript
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useReducer } from 'react';
import { Platform } from 'react-native';

type UseStateHook<T> = [[boolean, T | null], (value: T | null) => void];

function useAsyncState<T>(
  initialValue: [boolean, T | null] = [true, null]
): UseStateHook<T> {
  return useReducer(
    (state: [boolean, T | null], action: T | null = null): [boolean, T | null] => [false, action],
    initialValue
  ) as UseStateHook<T>;
}

export async function setStorageItemAsync(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Local storage is unavailable:', e);
    }
  } else {
    if (value == null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  }
}

export function useStorageState(key: string): UseStateHook<string> {
  const [state, setState] = useAsyncState<string>();

  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          setState(localStorage.getItem(key));
        }
      } catch (e) {
        console.error('Local storage is unavailable:', e);
      }
    } else {
      SecureStore.getItemAsync(key).then((value) => {
        setState(value);
      });
    }
  }, [key]);

  const setValue = useCallback(
    (value: string | null) => {
      setState(value);
      setStorageItemAsync(key, value);
    },
    [key]
  );

  return [state, setValue];
}
```

### Étape 2 : ctx.tsx (Session Context)

```typescript
import { useContext, createContext, type PropsWithChildren } from 'react';
import { useStorageState } from '@/lib/useStorageState';
import { tuyau } from '@/lib/tuyau';

interface User {
  id: number;
  email: string;
  fullName: string;
}

interface AuthContextType {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => void;
  session: string | null;
  user: User | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  signIn: async () => {},
  signUp: async () => {},
  signOut: () => null,
  session: null,
  user: null,
  isLoading: true,
});

export function useSession() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useSession must be wrapped in a <SessionProvider />');
  }
  return value;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [[isLoading, session], setSession] = useStorageState('session');
  const [[, userData], setUserData] = useStorageState('user');

  const user: User | null = userData ? JSON.parse(userData) : null;

  return (
    <AuthContext.Provider
      value={{
        signIn: async (email, password) => {
          const response = await tuyau.api.auth.login.$post({
            json: { email, password },
          });

          if (response.status !== 200) {
            throw new Error('Invalid credentials');
          }

          const data = await response.json();
          setSession(data.token);
          setUserData(JSON.stringify(data.user));
        },
        signUp: async (email, password, fullName) => {
          const response = await tuyau.api.auth.register.$post({
            json: { email, password, fullName },
          });

          if (response.status !== 201) {
            throw new Error('Registration failed');
          }

          const data = await response.json();
          setSession(data.token);
          setUserData(JSON.stringify(data.user));
        },
        signOut: () => {
          setSession(null);
          setUserData(null);
        },
        session,
        user,
        isLoading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

### Étape 3 : _layout.tsx (Root avec Stack.Protected)

```typescript
import './global.css';

import { Stack, SplashScreen } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/tuyau';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SessionProvider, useSession } from '@/contexts/ctx';
import { useEffect } from 'react';

// Empêcher le splash screen de se cacher automatiquement
SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { session, isLoading } = useSession();

  useEffect(() => {
    if (!isLoading) {
      // Cacher le splash screen une fois l'auth chargée
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    // Garder le splash screen visible
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Routes publiques - toujours accessibles */}
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />

      {/* Routes protégées - redirige vers sign-in si pas de session */}
      <Stack.Protected guard={session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <HeroUINativeProvider>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <RootLayoutNav />
            </SessionProvider>
          </QueryClientProvider>
        </HeroUINativeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
```

### Étape 4 : sign-in.tsx

```typescript
import { View, Text } from 'react-native';
import { router, Link } from 'expo-router';
import { Button, TextField } from 'heroui-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSession } from '@/contexts/ctx';
import { useState } from 'react';

const signInSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe minimum 6 caractères'),
});

type SignInData = z.infer<typeof signInSchema>;

export default function SignIn() {
  const { signIn } = useSession();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: SignInData) => {
    try {
      setError(null);
      await signIn(data.email, data.password);
      // Redirection automatique via Stack.Protected
      router.replace('/(app)/(tabs)/home');
    } catch (err) {
      setError('Email ou mot de passe incorrect');
    }
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="p-6 gap-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-center">Connexion</Text>
          <Text className="text-gray-500 text-center">
            Connectez-vous à votre compte
          </Text>
        </View>

        {error && (
          <View className="bg-red-100 p-3 rounded-lg">
            <Text className="text-red-600 text-center">{error}</Text>
          </View>
        )}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.email}>
              <TextField.Label>Email</TextField.Label>
              <TextField.Input
                placeholder="votre@email.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {errors.email && (
                <TextField.ErrorMessage>{errors.email.message}</TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.password}>
              <TextField.Label>Mot de passe</TextField.Label>
              <TextField.Input
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoComplete="password"
              />
              {errors.password && (
                <TextField.ErrorMessage>{errors.password.message}</TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
          {isSubmitting ? 'Connexion...' : 'Se connecter'}
        </Button>

        <View className="flex-row justify-center gap-1">
          <Text className="text-gray-500">Pas encore de compte ?</Text>
          <Link href="/sign-up" asChild>
            <Text className="text-blue-500 font-semibold">S'inscrire</Text>
          </Link>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
```

### Étape 5 : (app)/_layout.tsx

```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
      }}
    >
      <Tabs.Screen
        name="(tabs)/home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(tabs)/settings"
        options={{
          title: 'Paramètres',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="(tabs)/profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

### Étape 6 : Profile avec Sign Out

```typescript
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Button } from 'heroui-native';
import { useSession } from '@/contexts/ctx';

export default function ProfileScreen() {
  const { user, signOut } = useSession();

  const handleSignOut = () => {
    signOut();
    router.replace('/sign-in');
  };

  return (
    <View className="flex-1 p-6 justify-center items-center gap-6">
      <View className="items-center gap-2">
        <View className="w-24 h-24 bg-gray-200 rounded-full justify-center items-center">
          <Text className="text-3xl">
            {user?.fullName?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text className="text-2xl font-bold">{user?.fullName}</Text>
        <Text className="text-gray-500">{user?.email}</Text>
      </View>

      <Button onPress={handleSignOut} className="w-full" variant="outline">
        Se déconnecter
      </Button>
    </View>
  );
}
```

---

## Approche SDK 52 : Route Groups + Redirect

> Pour les projets sur SDK 52 ou moins, utilisez cette approche.

### Concepts clés

#### Principe Expo Router
> "Avec Expo Router, tous les chemins sont toujours définis et accessibles."

La protection des routes se fait au **runtime** via :
1. **React Context** pour gérer l'état d'auth
2. **Route Groups** `(auth)` et `(app)` pour organiser les écrans
3. **Redirect** dans les layouts imbriqués (pas dans le root layout)

#### Erreur courante à éviter
Ne **jamais** déclencher de navigation dans le Root Layout avant qu'il soit monté. La logique de redirection doit être dans un **layout imbriqué**.

### Architecture

```
apps/mobile/
├── app/
│   ├── _layout.tsx           # Providers uniquement (PAS de logique auth)
│   ├── sign-in.tsx           # Login (accessible à tous)
│   └── (app)/                # Groupe protégé
│       ├── _layout.tsx       # Protection + redirect si non auth
│       └── (tabs)/           # Navigation par tabs
│           ├── _layout.tsx
│           ├── home/
│           │   └── index.tsx
│           ├── settings/
│           │   └── index.tsx
│           └── profile/
│               └── index.tsx
├── contexts/
│   └── AuthContext.tsx       # État d'authentification global
├── lib/
│   ├── tuyau.ts              # Client API AdonisJS
│   └── useStorageState.ts    # Hook stockage persistant (recommandé Expo)
```

---

## Étape 1 : Installation des dépendances

```bash
pnpm --filter mobile add expo-secure-store
```

---

## Étape 2 : Hook useStorageState (Recommandé par Expo)

Ce hook gère le stockage persistant avec `expo-secure-store` (native) et `localStorage` (web).

Créer `apps/mobile/lib/useStorageState.ts` :

```typescript
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useReducer } from 'react';
import { Platform } from 'react-native';

type UseStateHook<T> = [[boolean, T | null], (value: T | null) => void];

function useAsyncState<T>(
  initialValue: [boolean, T | null] = [true, null]
): UseStateHook<T> {
  return useReducer(
    (
      state: [boolean, T | null],
      action: T | null = null
    ): [boolean, T | null] => [false, action],
    initialValue
  ) as UseStateHook<T>;
}

export async function setStorageItemAsync(key: string, value: string | null) {
  if (Platform.OS === 'web') {
    try {
      if (value === null) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.error('Local storage is unavailable:', e);
    }
  } else {
    if (value == null) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  }
}

export function useStorageState(key: string): UseStateHook<string> {
  const [state, setState] = useAsyncState<string>();

  // Charger la valeur au montage
  useEffect(() => {
    if (Platform.OS === 'web') {
      try {
        if (typeof localStorage !== 'undefined') {
          setState(localStorage.getItem(key));
        }
      } catch (e) {
        console.error('Local storage is unavailable:', e);
      }
    } else {
      SecureStore.getItemAsync(key).then((value) => {
        setState(value);
      });
    }
  }, [key]);

  // Setter avec persistance
  const setValue = useCallback(
    (value: string | null) => {
      setState(value);
      setStorageItemAsync(key, value);
    },
    [key]
  );

  return [state, setValue];
}
```

---

## Étape 2b : Stockage sécurisé (Alternative objet)

Si vous préférez une API objet plutôt qu'un hook, créer `apps/mobile/lib/storage.ts` :

```typescript
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// Pour le web, fallback sur localStorage
const isWeb = Platform.OS === 'web';

export const storage = {
  // Token
  async getToken(): Promise<string | null> {
    if (isWeb) {
      return localStorage.getItem(TOKEN_KEY);
    }
    return await SecureStore.getItemAsync(TOKEN_KEY);
  },

  async setToken(token: string): Promise<void> {
    if (isWeb) {
      localStorage.setItem(TOKEN_KEY, token);
      return;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  },

  async removeToken(): Promise<void> {
    if (isWeb) {
      localStorage.removeItem(TOKEN_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  },

  // User data
  async getUser<T>(): Promise<T | null> {
    const data = isWeb
      ? localStorage.getItem(USER_KEY)
      : await SecureStore.getItemAsync(USER_KEY);
    return data ? JSON.parse(data) : null;
  },

  async setUser<T>(user: T): Promise<void> {
    const data = JSON.stringify(user);
    if (isWeb) {
      localStorage.setItem(USER_KEY, data);
      return;
    }
    await SecureStore.setItemAsync(USER_KEY, data);
  },

  async removeUser(): Promise<void> {
    if (isWeb) {
      localStorage.removeItem(USER_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(USER_KEY);
  },

  // Clear all
  async clear(): Promise<void> {
    await this.removeToken();
    await this.removeUser();
  },
};
```

---

## Étape 3 : AuthContext avec persistance

Créer `apps/mobile/contexts/AuthContext.tsx` :

```typescript
import {
  ReactNode,
  createContext,
  useContext,
  useState,
  useEffect,
} from 'react';
import { useRouter, useSegments } from 'expo-router';
import { storage } from '@/lib/storage';
import { tuyau } from '@/lib/tuyau';

// Types
interface User {
  id: number;
  email: string;
  fullName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}

// Context
const AuthContext = createContext<AuthContextType | null>(null);

// Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  // Charger l'état d'auth au démarrage
  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Redirection automatique basée sur l'état d'auth
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const isAuthenticated = !!token && !!user;

    if (!isAuthenticated && !inAuthGroup) {
      // Non authentifié et pas dans (auth) -> rediriger vers login
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      // Authentifié et dans (auth) -> rediriger vers main
      router.replace('/(main)/(tabs)/home');
    }
  }, [token, user, segments, isLoading]);

  // Charger token et user depuis le storage
  async function loadStoredAuth() {
    try {
      const [storedToken, storedUser] = await Promise.all([
        storage.getToken(),
        storage.getUser<User>(),
      ]);

      if (storedToken && storedUser) {
        // Vérifier si le token est encore valide
        const isValid = await verifyToken(storedToken);
        if (isValid) {
          setToken(storedToken);
          setUser(storedUser);
        } else {
          await storage.clear();
        }
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
      await storage.clear();
    } finally {
      setIsLoading(false);
    }
  }

  // Vérifier le token avec le backend
  async function verifyToken(authToken: string): Promise<boolean> {
    try {
      const response = await tuyau.api.auth.me.$get({
        headers: { Authorization: `Bearer ${authToken}` },
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  // Login
  async function login(email: string, password: string) {
    try {
      const response = await tuyau.api.auth.login.$post({
        json: { email, password },
      });

      if (response.status !== 200) {
        throw new Error('Invalid credentials');
      }

      const data = await response.json();
      const { token: newToken, user: newUser } = data;

      // Sauvegarder dans le storage
      await Promise.all([
        storage.setToken(newToken),
        storage.setUser(newUser),
      ]);

      setToken(newToken);
      setUser(newUser);

      // Redirection gérée par useEffect
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  // Register
  async function register(email: string, password: string, fullName: string) {
    try {
      const response = await tuyau.api.auth.register.$post({
        json: { email, password, fullName },
      });

      if (response.status !== 201) {
        throw new Error('Registration failed');
      }

      const data = await response.json();
      const { token: newToken, user: newUser } = data;

      await Promise.all([
        storage.setToken(newToken),
        storage.setUser(newUser),
      ]);

      setToken(newToken);
      setUser(newUser);
    } catch (error) {
      console.error('Register failed:', error);
      throw error;
    }
  }

  // Logout
  async function logout() {
    try {
      // Appeler l'API pour invalider le token côté serveur
      if (token) {
        await tuyau.api.auth.logout.$post({
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Toujours nettoyer localement
      await storage.clear();
      setToken(null);
      setUser(null);
      // Redirection gérée par useEffect
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

---

## Étape 4 : Root Layout

Modifier `apps/mobile/app/_layout.tsx` :

```typescript
import './global.css';

import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/tuyau';
import { HeroUINativeProvider } from 'heroui-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <HeroUINativeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(main)" />
              </Stack>
            </AuthProvider>
          </QueryClientProvider>
        </HeroUINativeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
```

---

## Étape 5 : Auth Layout

Créer `apps/mobile/app/(auth)/_layout.tsx` :

```typescript
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="sign-in" />
      <Stack.Screen name="sign-up" />
    </Stack>
  );
}
```

---

## Étape 6 : Sign In Screen

Créer `apps/mobile/app/(auth)/sign-in.tsx` :

```typescript
import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { Button, TextField } from 'heroui-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

const signInSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Mot de passe minimum 6 caractères'),
});

type SignInData = z.infer<typeof signInSchema>;

export default function SignIn() {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignInData) => {
    try {
      setError(null);
      await login(data.email, data.password);
    } catch (err) {
      setError('Email ou mot de passe incorrect');
    }
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="p-6 gap-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-center">Connexion</Text>
          <Text className="text-gray-500 text-center">
            Connectez-vous à votre compte
          </Text>
        </View>

        {error && (
          <View className="bg-red-100 p-3 rounded-lg">
            <Text className="text-red-600 text-center">{error}</Text>
          </View>
        )}

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.email}>
              <TextField.Label>Email</TextField.Label>
              <TextField.Input
                placeholder="votre@email.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {errors.email && (
                <TextField.ErrorMessage>
                  {errors.email.message}
                </TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.password}>
              <TextField.Label>Mot de passe</TextField.Label>
              <TextField.Input
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoComplete="password"
              />
              {errors.password && (
                <TextField.ErrorMessage>
                  {errors.password.message}
                </TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
          {isSubmitting ? 'Connexion...' : 'Se connecter'}
        </Button>

        <View className="flex-row justify-center gap-1">
          <Text className="text-gray-500">Pas encore de compte ?</Text>
          <Link href="/(auth)/sign-up" asChild>
            <Text className="text-blue-500 font-semibold">S'inscrire</Text>
          </Link>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
```

---

## Étape 7 : Sign Up Screen

Créer `apps/mobile/app/(auth)/sign-up.tsx` :

```typescript
import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { Button, TextField } from 'heroui-native';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

const signUpSchema = z
  .object({
    fullName: z.string().min(2, 'Nom minimum 2 caractères'),
    email: z.string().email('Email invalide'),
    password: z.string().min(6, 'Mot de passe minimum 6 caractères'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

type SignUpData = z.infer<typeof signUpSchema>;

export default function SignUp() {
  const { register } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: SignUpData) => {
    try {
      setError(null);
      await register(data.email, data.password, data.fullName);
    } catch (err) {
      setError('Erreur lors de l\'inscription');
    }
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="p-6 gap-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-center">Inscription</Text>
          <Text className="text-gray-500 text-center">
            Créez votre compte
          </Text>
        </View>

        {error && (
          <View className="bg-red-100 p-3 rounded-lg">
            <Text className="text-red-600 text-center">{error}</Text>
          </View>
        )}

        <Controller
          control={control}
          name="fullName"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.fullName}>
              <TextField.Label>Nom complet</TextField.Label>
              <TextField.Input
                placeholder="John Doe"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoComplete="name"
              />
              {errors.fullName && (
                <TextField.ErrorMessage>
                  {errors.fullName.message}
                </TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.email}>
              <TextField.Label>Email</TextField.Label>
              <TextField.Input
                placeholder="votre@email.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              {errors.email && (
                <TextField.ErrorMessage>
                  {errors.email.message}
                </TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.password}>
              <TextField.Label>Mot de passe</TextField.Label>
              <TextField.Input
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoComplete="new-password"
              />
              {errors.password && (
                <TextField.ErrorMessage>
                  {errors.password.message}
                </TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextField isInvalid={!!errors.confirmPassword}>
              <TextField.Label>Confirmer le mot de passe</TextField.Label>
              <TextField.Input
                placeholder="••••••••"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry
                autoComplete="new-password"
              />
              {errors.confirmPassword && (
                <TextField.ErrorMessage>
                  {errors.confirmPassword.message}
                </TextField.ErrorMessage>
              )}
            </TextField>
          )}
        />

        <Button onPress={handleSubmit(onSubmit)} isDisabled={isSubmitting}>
          {isSubmitting ? 'Inscription...' : 'S\'inscrire'}
        </Button>

        <View className="flex-row justify-center gap-1">
          <Text className="text-gray-500">Déjà un compte ?</Text>
          <Link href="/(auth)/sign-in" asChild>
            <Text className="text-blue-500 font-semibold">Se connecter</Text>
          </Link>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}
```

---

## Étape 8 : Main Layout (Routes protégées)

Créer `apps/mobile/app/(main)/_layout.tsx` :

```typescript
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';

export default function MainLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  // Afficher un loader pendant la vérification de l'auth
  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Rediriger vers login si non authentifié
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
```

---

## Étape 9 : Tabs Layout

Créer `apps/mobile/app/(main)/(tabs)/_layout.tsx` :

```typescript
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3b82f6',
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Paramètres',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

---

## Étape 10 : Profile Screen avec Logout

Créer `apps/mobile/app/(main)/(tabs)/profile/index.tsx` :

```typescript
import { View, Text } from 'react-native';
import { Button } from 'heroui-native';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View className="flex-1 p-6 justify-center items-center gap-6">
      <View className="items-center gap-2">
        <View className="w-24 h-24 bg-gray-200 rounded-full justify-center items-center">
          <Text className="text-3xl">
            {user?.fullName?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text className="text-2xl font-bold">{user?.fullName}</Text>
        <Text className="text-gray-500">{user?.email}</Text>
      </View>

      <Button onPress={logout} className="w-full" variant="outline">
        Se déconnecter
      </Button>
    </View>
  );
}
```

---

## Backend AdonisJS : Routes Auth

Ajouter dans `apps/web/app/api/routes.ts` :

```typescript
import router from '@adonisjs/core/services/router';

const AuthController = () => import('#controllers/auth_controller');

router.group(() => {
  router.post('/register', [AuthController, 'register']);
  router.post('/login', [AuthController, 'login']);
  router.post('/logout', [AuthController, 'logout']).use(middleware.auth());
  router.get('/me', [AuthController, 'me']).use(middleware.auth());
}).prefix('/api/auth');
```

---

## Backend AdonisJS : Auth Controller

Créer `apps/web/app/controllers/auth_controller.ts` :

```typescript
import type { HttpContext } from '@adonisjs/core/http';
import User from '#models/user';
import hash from '@adonisjs/core/services/hash';

export default class AuthController {
  async register({ request, response }: HttpContext) {
    const { email, password, fullName } = request.only([
      'email',
      'password',
      'fullName',
    ]);

    const existingUser = await User.findBy('email', email);
    if (existingUser) {
      return response.conflict({ message: 'Email already exists' });
    }

    const user = await User.create({ email, password, fullName });
    const token = await User.accessTokens.create(user);

    return response.created({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      token: token.value!.release(),
    });
  }

  async login({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password']);

    const user = await User.findBy('email', email);
    if (!user) {
      return response.unauthorized({ message: 'Invalid credentials' });
    }

    const isValidPassword = await hash.verify(user.password, password);
    if (!isValidPassword) {
      return response.unauthorized({ message: 'Invalid credentials' });
    }

    const token = await User.accessTokens.create(user);

    return response.ok({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
      token: token.value!.release(),
    });
  }

  async logout({ auth, response }: HttpContext) {
    const user = auth.user!;
    await User.accessTokens.delete(user, user.currentAccessToken.identifier);
    return response.ok({ message: 'Logged out' });
  }

  async me({ auth, response }: HttpContext) {
    const user = auth.user!;
    return response.ok({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
    });
  }
}
```

---

## Résumé

| Fichier | Rôle |
|---------|------|
| `lib/storage.ts` | Stockage sécurisé du token |
| `contexts/AuthContext.tsx` | État global + login/logout |
| `app/_layout.tsx` | Wrap AuthProvider |
| `app/(auth)/_layout.tsx` | Layout public |
| `app/(auth)/sign-in.tsx` | Page login |
| `app/(auth)/sign-up.tsx` | Page register |
| `app/(main)/_layout.tsx` | Protection des routes |
| `app/(main)/(tabs)/_layout.tsx` | Navigation tabs |

**Flux d'authentification :**
1. App démarre → `AuthContext` charge token depuis `SecureStore`
2. Si token valide → redirect vers `/(app)`
3. Si pas de token → redirect vers `/sign-in`
4. Login réussi → sauvegarde token + redirect `/(app)`
5. Logout → supprime token + redirect `/sign-in`

---

## Approche alternative : Modal Login

Expo Router permet aussi d'afficher le login en modal **par-dessus** l'app, préservant ainsi les deep links.

### Avantages
- Conserve l'état de navigation en arrière-plan
- Les deep links fonctionnent même non authentifié
- UX plus fluide (pas de flash blanc)

### Structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx
│   ├── (app)/
│   │   ├── _layout.tsx       # Affiche modal si non auth
│   │   └── ...
│   └── sign-in.tsx           # Présenté en modal
```

### Implémentation

```typescript
// app/(app)/_layout.tsx
import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function AppLayout() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return <Text>Loading...</Text>;
  }

  if (!session) {
    // Présenter sign-in en modal au lieu de redirect
    return (
      <>
        <Stack />
        <Redirect href="/sign-in" />
      </>
    );
  }

  return <Stack />;
}
```

```typescript
// app/_layout.tsx
export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen
          name="sign-in"
          options={{
            presentation: 'modal', // Afficher en modal
            headerShown: false,
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
```

---

## Comparaison des approches

| Aspect | Redirect classique | Modal |
|--------|-------------------|-------|
| Deep links | Perdus si non auth | Préservés |
| UX | Flash blanc possible | Fluide |
| Complexité | Simple | Moyenne |
| Back navigation | Normal | Dismiss modal |

---

## Bonnes pratiques

1. **Ne pas naviguer dans le Root Layout** - Utiliser un layout imbriqué
2. **Toujours vérifier `isLoading`** - Éviter les flashs de redirection
3. **Utiliser `replace` pas `push`** - Pour les redirections auth
4. **Stocker le token dans SecureStore** - Pas AsyncStorage
5. **Valider le token au démarrage** - Vérifier avec le backend
