
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
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
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent bundling of Node.js core modules for the client-side
      config.resolve.fallback = {
        ...config.resolve.fallback, // Spread existing fallbacks
        fs: false, // Example: if 'fs' was an issue
        net: false, // Specifically for the 'net' module
        tls: false, // Often related to 'net' or database drivers
        // Add other Node.js core modules here if they cause similar errors
        // e.g., 'child_process': false, 'crypto': false, etc.
      };
    }
    return config;
  },
};

export default nextConfig;
