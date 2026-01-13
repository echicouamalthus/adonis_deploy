import { defineConfig } from '@adonisjs/cors'

/**
 * Configuration options to tweak the CORS policy. The following
 * options are documented on the official documentation website.
 *
 * https://docs.adonisjs.com/guides/security/cors
 */
const corsConfig = defineConfig({
  enabled: true,
  origin: (requestOrigin) => {
    // Autoriser les origines en développement
    const allowedOrigins = [
      'http://localhost:8081', // Expo web
      'http://localhost:19006', // Expo web (ancien port)
      'http://localhost:3000', // Next.js ou autre
      'http://10.0.2.2:8081', // Android Emulator
    ]

    // En production, ajouter les domaines autorisés via variable d'environnement
    // Exemple: CORS_ORIGINS=https://app.example.com,https://mobile.example.com
    if (process.env.NODE_ENV === 'production' && process.env.VITE_APP_URL) {
      const productionOrigins = process.env.VITE_APP_URL.split(',').map((o) => o.trim())
      allowedOrigins.push(...productionOrigins)
    }

    // Pour mobile en production, autoriser toutes les requêtes sans origin (apps natives)
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

export default corsConfig
