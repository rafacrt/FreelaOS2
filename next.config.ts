
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
  // The webpack configuration block below is removed
  // because Turbopack is enabled via the --turbopack flag in the dev script.
  // Turbopack does not use this webpack configuration, and having it present
  // can cause warnings or unexpected behavior.
  // If client-side fallbacks for Node.js core modules were critical,
  // a Turbopack-specific solution or disabling Turbopack would be needed.
};

export default nextConfig;
