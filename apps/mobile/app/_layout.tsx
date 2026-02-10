import './global.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import { HeroUINativeProvider } from 'heroui-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { queryClient } from '../lib/tuyau'

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <HeroUINativeProvider>
          <QueryClientProvider client={queryClient}>
            <Stack />
          </QueryClientProvider>
        </HeroUINativeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  )
}
