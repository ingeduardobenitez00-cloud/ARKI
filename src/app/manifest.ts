import { MetadataRoute } from 'next'

/**
 * Genera el manifiesto PWA optimizado utilizando logo.png con cache-busting v3.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ARKI CONCEJAL LISTA 2P',
    short_name: 'ARKI 2P',
    description: 'Sistema de Gestión Estratégica Lista 2P - Opción 2',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ef4444',
    icons: [
      {
        src: '/logo.png?v=3',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/logo.png?v=3',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/logo.png?v=3',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/logo.png?v=3',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
  }
}
