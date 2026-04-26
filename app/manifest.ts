import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'IBRead',
    short_name: 'IBRead',
    description: 'Sua estante de leitura pessoal',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8F9F7',
    theme_color: '#1A1A1A',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
