import { MetadataRoute } from 'next'

/**
 * Genera el manifiesto PWA optimizado utilizando logo.png con cache-busting v3.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ARKI CONCEJAL LISTA 1',
    short_name: 'ARKI 1',
    description: 'Sistema de Gestión Estratégica Lista 1 - Opción 5',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ef4444',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ],
  }
}
