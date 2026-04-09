
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
       {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      }
    ],
  },
  webpack: (config, { isServer }) => {
    // This is to solve the "Module not found: Can't resolve 'fs'" error
    // when using dbf-reader on the client side.
    if (!isServer) {
        config.resolve.fallback = {
            fs: false,
            'node:fs': false,
            'stream': false,
            'node:stream': false,
            path: false,
            'node:path': false
        }
    }
    return config;
  },
};

module.exports = nextConfig;
