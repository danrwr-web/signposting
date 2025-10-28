/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'jsdom', 'jest-environment-jsdom'],
  webpack: (config, { isServer }) => {
    // Exclude jsdom from bundling
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        jsdom: false,
      };
    }
    
    // Mark jsdom as external
    config.externals = config.externals || [];
    config.externals.push({
      'jsdom': 'commonjs jsdom',
      'jest-environment-jsdom': 'commonjs jest-environment-jsdom',
    });
    
    return config;
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
}

module.exports = nextConfig
