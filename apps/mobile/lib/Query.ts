import NetInfo from '@react-native-community/netinfo'
import { focusManager, onlineManager } from '@tanstack/react-query'
import type { AppStateStatus } from 'react-native'
import { AppState, Platform } from 'react-native'

/**
 * Configuration React Query pour la gestion réseau
 * - Détecte la connexion/déconnexion réseau
 * - Refetch automatique quand la connexion revient
 * - Refetch automatique quand l'app revient au premier plan
 */

// 1. Détection de la connexion réseau
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(Boolean(state.isConnected))
  })
})

// 2. Refetch automatique quand l'app revient au premier plan
function onAppStateChange(status: AppStateStatus) {
  if (Platform.OS !== 'web') {
    focusManager.setFocused(status === 'active')
  }
}

// 3. Écouter les changements d'état de l'app
AppState.addEventListener('change', onAppStateChange)
